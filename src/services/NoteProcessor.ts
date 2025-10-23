import { TraceManager } from './TraceManager';
import { LLMService } from './LLMService';
import { Notice, TFile } from 'obsidian';
import { PromptLoader } from '../../prompt-loader';

export interface ProcessingInput {
    url: string;
    prompt: string;
    intent: string;
}

export interface ProcessingResult {
    note: TFile;
    traceId: string;
}

export interface StatusCallback {
    (step: number, message: string, isError?: boolean): void;
}

export class NoteProcessor {
    private traceManager: TraceManager;
    private llmService: LLMService;
    private plugin: any; // Plugin reference for file operations
    private summaryView: any; // SummaryView reference for note creation
    private statusCallback?: StatusCallback;
    private promptLoader: PromptLoader;

    constructor(traceManager: TraceManager, llmService: LLMService, plugin: any, summaryView: any) {
        this.traceManager = traceManager;
        this.llmService = llmService;
        this.plugin = plugin;
        this.summaryView = summaryView;
        this.promptLoader = new PromptLoader();
    }

    setStatusCallback(callback: StatusCallback) {
        this.statusCallback = callback;
    }

    private updateStatus(step: number, message: string, isError: boolean = false) {
        if (this.statusCallback) {
            this.statusCallback(step, message, isError);
        }
        console.log(`[NoteProcessor] Step ${step}: ${message}`);
    }

    async processURL(input: ProcessingInput): Promise<ProcessingResult> {
        console.log('[NoteProcessor] Starting processing for:', input.url);

        // 1. Extract transcript/content
        this.updateStatus(0, 'Extracting content...');
        const content = await this.extractContent(input.url);
        this.updateStatus(0, 'Content extracted successfully');
        
        // 2. Start trace
        this.updateStatus(1, 'Starting trace and span...');
        const traceId = await this.traceManager.startTrace({
            name: 'note-creation',
            input: { url: input.url, intent: input.intent },
            metadata: { source: 'note-processor' }
        });

        try {
            // 3. AI Analysis within span
            this.updateStatus(2, 'Running 5-pass AI analysis...');
            const analysisResult = await this.traceManager.withSpan(
                'content-analysis',
                async (spanId) => {
                    return await this.performAIAnalysis(content, input, traceId);
                },
                traceId,
                { input: { content: content.substring(0, 500) + '...' } }
            );

            // 5. Log generations (already done in performAIAnalysis)
            this.updateStatus(3, 'AI generations logged successfully');

            // 6. Create note
            this.updateStatus(4, 'Creating note...');
            const note = await this.createNote(analysisResult, input.url);
            this.updateStatus(4, 'Note created successfully');

            // 7. MOC cascade within span
            this.updateStatus(5, 'Starting MOC cascade span...');
            await this.traceManager.withSpan(
                'moc-cascade',
                async (spanId) => {
                    this.updateStatus(6, 'Updating MOCs with AI intelligence...');
                    await this.performMOCCascade(analysisResult, traceId);
                    return { mocUpdated: true };
                },
                traceId,
                { 
                    input: { 
                        hierarchy: analysisResult.hierarchy,
                        noteTitle: analysisResult.title 
                    }
                }
            );

            // 9. End trace
            this.updateStatus(7, 'Ending trace...');
            await this.traceManager.endTrace(traceId, {
                output: { 
                    noteCreated: true,
                    notePath: note.path 
                }
            });

            this.updateStatus(7, 'Process complete!');
            return { note, traceId };

        } catch (error) {
            // Determine which step failed based on the error context
            let errorStep = 7; // Default to final step
            let errorMessage = `Error: ${error.message}`;
            
            if (error.message.includes('Gemini API error') || error.message.includes('503')) {
                errorStep = 2; // AI Analysis step
                errorMessage = `AI Analysis failed: ${error.message}`;
            } else if (error.message.includes('transcript') || error.message.includes('content')) {
                errorStep = 0; // Content extraction step
                errorMessage = `Content extraction failed: ${error.message}`;
            } else if (error.message.includes('note') || error.message.includes('file')) {
                errorStep = 4; // Note creation step
                errorMessage = `Note creation failed: ${error.message}`;
            }
            
            this.updateStatus(errorStep, errorMessage, true);
            await this.traceManager.endTrace(traceId, { 
                output: { error: error.message } 
            });
            throw error;
        }
    }

    private async extractContent(url: string): Promise<string> {
        console.log('[NoteProcessor] Extracting content from:', url);
        
        if (url.includes('youtube.com')) {
            return await this.fetchYouTubeTranscript(url);
        } else {
            return await this.fetchWebContent(url);
        }
    }

    private async fetchYouTubeTranscript(url: string): Promise<string> {
        // Use the exact same approach as the existing app
        const path = require('path');
        
        // @ts-ignore - Get vault path same way as existing code
        const vaultPath = this.plugin.app.vault.adapter.basePath || '';
        const scriptPath = path.join(vaultPath, '.obsidian', 'plugins', 'second-brAIn', 'fetch_transcript.py');
        const venvPython = path.join(vaultPath, '.obsidian', 'plugins', 'second-brAIn', 'venv', 'bin', 'python3');

        console.log('[NoteProcessor] Preparing to run command:', venvPython, scriptPath, url);

        const { spawn } = require('child_process');
        const pythonProcess = spawn(venvPython, [scriptPath, url]);

        let fullOutput = "";
        let lastErrorLine = "";

        return new Promise((resolve, reject) => {
            pythonProcess.stdout.on('data', (data: Buffer) => {
                const output = data.toString();
                fullOutput += output;
                console.log('[NoteProcessor] STDOUT:', output);
            });

            pythonProcess.stderr.on('data', (data: Buffer) => {
                const errorOutput = data.toString();
                fullOutput += errorOutput;
                console.error('[NoteProcessor] STDERR:', errorOutput);
                if (errorOutput.includes("[ERROR]")) {
                    lastErrorLine = errorOutput.trim();
                }
            });

            pythonProcess.on('close', (code: number) => {
                console.log(`[NoteProcessor] Child process exited with code ${code}`);

                const resultMarker = "[INFO] Script finished. Outputting result.";
                const markerIndex = fullOutput.lastIndexOf(resultMarker);
                let processedResult = "";

                if (markerIndex !== -1) {
                    processedResult = fullOutput.substring(markerIndex + resultMarker.length).trim();
                } else {
                    processedResult = fullOutput.trim();
                }

                if (processedResult.startsWith('Error: Failed to fetch transcript after')) {
                    console.error('[NoteProcessor] Command failed with final error message:', processedResult);
                    reject(new Error(processedResult));
                } else if (lastErrorLine && lastErrorLine.startsWith('[ERROR]')) {
                    console.error('[NoteProcessor] Command failed with error from STDERR:', lastErrorLine);
                    reject(new Error(lastErrorLine));
                } else if (code !== 0) {
                    const finalError = `Python script exited with code ${code}. Output: ${processedResult || 'No specific output.'}`;
                    console.error('[NoteProcessor] Command failed with exit code:', finalError);
                    reject(new Error(finalError));
                } else if (!processedResult) {
                    const noTranscriptError = "Error: No transcript data was returned by the script, though it exited cleanly.";
                    console.warn('[NoteProcessor] No transcript data returned:', noTranscriptError);
                    reject(new Error(noTranscriptError));
                } else {
                    console.log('[NoteProcessor] Successfully fetched:', processedResult.substring(0, 100) + "...");
                    resolve(processedResult);
                }
            });

            pythonProcess.on('error', (err: Error) => {
                console.error('[NoteProcessor] Failed to start subprocess.', err);
                reject(new Error(`Failed to start transcript extraction process: ${err.message}`));
            });
        });
    }

    private async fetchWebContent(url: string): Promise<string> {
        // Use the exact same approach as the existing app
        const path = require('path');
        
        // @ts-ignore - Get vault path same way as existing code
        const vaultPath = this.plugin.app.vault.adapter.basePath || '';
        const scriptPath = path.join(vaultPath, '.obsidian', 'plugins', 'second-brAIn', 'fetch_content.py');
        const venvPython = path.join(vaultPath, '.obsidian', 'plugins', 'second-brAIn', 'venv', 'bin', 'python3');

        console.log('[NoteProcessor] Preparing to run command:', venvPython, scriptPath, url);

        const { spawn } = require('child_process');
        const pythonProcess = spawn(venvPython, [scriptPath, url]);

        let fullOutput = "";
        let lastErrorLine = "";

        return new Promise((resolve, reject) => {
            pythonProcess.stdout.on('data', (data: Buffer) => {
                const output = data.toString();
                fullOutput += output;
                console.log('[NoteProcessor] STDOUT:', output);
            });

            pythonProcess.stderr.on('data', (data: Buffer) => {
                const errorOutput = data.toString();
                fullOutput += errorOutput;
                console.error('[NoteProcessor] STDERR:', errorOutput);
                if (errorOutput.includes("[ERROR]")) {
                    lastErrorLine = errorOutput.trim();
                }
            });

            pythonProcess.on('close', (code: number) => {
                console.log(`[NoteProcessor] Child process exited with code ${code}`);
                if (code === 0) {
                    resolve(fullOutput.trim());
                } else {
                    const finalError = lastErrorLine || `Python script for web content exited with code ${code}. Full output: ${fullOutput}`;
                    console.error('[NoteProcessor] Command failed:', finalError);
                    reject(new Error(finalError));
                }
            });

            pythonProcess.on('error', (err: Error) => {
                console.error('[NoteProcessor] Failed to start subprocess.', err);
                reject(new Error(`Failed to start web content extraction process: ${err.message}`));
            });
        });
    }

    private async performAIAnalysis(content: string, input: ProcessingInput, traceId: string): Promise<any> {
        console.log('[NoteProcessor] Starting 5-pass AI analysis');
        
        const passes = [
            'Structure & Metadata',
            'Content & Concepts', 
            'Perspectives & Examples',
            'Connections & Applications',
            'Learning Paths & Actions'
        ];

        let fullResult: any = {};

        for (let i = 0; i < passes.length; i++) {
            const passName = passes[i];
            console.log(`[NoteProcessor] AI Pass ${i + 1}: ${passName}`);

            // Add delay between AI calls to prevent rate limiting (except for first call)
            if (i > 0) {
                console.log(`[NoteProcessor] Waiting 10 seconds before next AI call to prevent rate limiting...`);
                await new Promise(resolve => setTimeout(resolve, 10000));
            }

            // Get prompt for this pass
            const prompt = await this.getPromptForPass(i, input.intent);
            const fullPrompt = `${prompt}\n\nContent to analyze:\n${content}`;

            // Call AI with tracing and retry logic for 503 errors
            let response;
            let retryCount = 0;
            const maxRetries = 2;
            
            while (retryCount <= maxRetries) {
                try {
                    response = await this.traceManager.generateText(
                        {
                            prompt: fullPrompt,
                            model: this.plugin.settings.gemini.model,
                            metadata: { pass: passName }
                        },
                        {
                            traceId,
                            generationName: `ai-pass-${i + 1}`,
                            pass: passName,
                            intent: input.intent
                        }
                    );
                    break; // Success, exit retry loop
                } catch (error) {
                    if (error.message.includes('503') && retryCount < maxRetries) {
                        retryCount++;
                        const waitTime = retryCount * 10; // 10s, 20s
                        console.log(`[NoteProcessor] AI Pass ${i + 1} failed with 503, retrying in ${waitTime}s (attempt ${retryCount}/${maxRetries})`);
                        this.updateStatus(2, `AI overloaded, retrying in ${waitTime}s (attempt ${retryCount}/${maxRetries})...`);
                        await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
                    } else {
                        throw error; // Re-throw if not 503 or max retries reached
                    }
                }
            }

            // Parse and merge results
            if (!response) {
                console.error(`[NoteProcessor] AI Pass ${i + 1} failed - no response received`);
                continue;
            }
            
            try {
                console.log(`[NoteProcessor] AI Pass ${i + 1} raw response:`, response.text.substring(0, 200) + '...');
                
                // Clean the response text - remove markdown code blocks
                let cleanedText = response.text.trim();
                
                // Remove markdown code block markers
                if (cleanedText.startsWith('```json')) {
                    cleanedText = cleanedText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
                } else if (cleanedText.startsWith('```')) {
                    cleanedText = cleanedText.replace(/^```\s*/, '').replace(/\s*```$/, '');
                }
                
                console.log(`[NoteProcessor] AI Pass ${i + 1} cleaned response:`, cleanedText.substring(0, 200) + '...');
                
                const passResult = JSON.parse(cleanedText);
                fullResult = { ...fullResult, ...passResult };
                console.log(`[NoteProcessor] AI Pass ${i + 1} parsed successfully:`, Object.keys(passResult));
            } catch (error) {
                console.warn(`[NoteProcessor] Failed to parse AI response for pass ${i + 1}:`, error);
                console.log(`[NoteProcessor] Raw response that failed to parse:`, response.text);
                
                // Try to extract basic info even if JSON parsing fails
                if (i === 0 && response.text) { // First pass should have title
                    const titleMatch = response.text.match(/title["\s]*:[\s"]*([^"}\n]+)/i);
                    if (titleMatch) {
                        fullResult.title = titleMatch[1].trim();
                        console.log(`[NoteProcessor] Extracted title from failed JSON:`, fullResult.title);
                    }
                }
                
                // Continue with next pass
            }
        }

        // Ensure we have basic structure even if parsing failed
        if (!fullResult.title) {
            // Try to extract title from URL or content
            const urlTitle = input.url.split('/').pop()?.replace(/[^a-zA-Z0-9\s]/g, ' ').trim();
            fullResult.title = urlTitle || 'Extracted Content';
            console.log(`[NoteProcessor] Using fallback title:`, fullResult.title);
        }
        
        if (!fullResult.summary) {
            // Create summary from the analysis results
            fullResult.summary = this.createSummaryFromAnalysis(fullResult, input.url);
            console.log(`[NoteProcessor] Created summary from analysis results`);
        }
        
        console.log(`[NoteProcessor] Final analysis result:`, {
            title: fullResult.title,
            hasHierarchy: !!fullResult.hierarchy,
            hasSummary: !!fullResult.summary,
            hasMetadata: !!fullResult.metadata
        });
        
        return fullResult;
    }

    private createSummaryFromAnalysis(result: any, url: string): string {
        let content = `# ${result.title}\n\n`;

        // Overview
        if (result.overview) {
            content += `## Overview\n${result.overview}\n\n`;
        }

        // Context
        if (result.context) {
            content += `## Context & Background\n${result.context}\n\n`;
        }

        // Detailed Summary
        if (result.detailed_summary) {
            content += `## Comprehensive Summary\n${result.detailed_summary}\n\n`;
        }

        // Key Facts
        if (result.key_facts?.length) {
            content += `## Key Facts\n`;
            result.key_facts.forEach((fact: string) => {
                content += `- ${fact}\n`;
            });
            content += '\n';
        }

        // Deep Insights
        if (result.deep_insights?.length) {
            content += `## Deep Insights\n`;
            result.deep_insights.forEach((insight: string, index: number) => {
                const colonIndex = insight.indexOf(':');
                if (colonIndex > 0 && colonIndex < 100) {
                    const title = insight.substring(0, colonIndex).trim();
                    const body = insight.substring(colonIndex + 1).trim();
                    content += `### ${index + 1}. ${title}\n${body}\n\n`;
                } else {
                    content += `### Insight ${index + 1}\n${insight}\n\n`;
                }
            });
        }

        // Core Concepts
        if (result.core_concepts?.length) {
            content += `## Core Concepts\n`;
            result.core_concepts.forEach((concept: string) => {
                const colonIndex = concept.indexOf(':');
                if (colonIndex > 0 && colonIndex < 100) {
                    const title = concept.substring(0, colonIndex).trim();
                    const body = concept.substring(colonIndex + 1).trim();
                    content += `### ${title}\n${body}\n\n`;
                } else {
                    content += `### ${concept}\n\n`;
                }
            });
        }

        // Multiple Perspectives
        if (result.multiple_perspectives?.length) {
            content += `## Multiple Perspectives\n`;
            result.multiple_perspectives.forEach((perspective: any) => {
                content += `### ${perspective.viewpoint}\n${perspective.analysis}\n\n`;
            });
        }

        // Analogies and Examples
        if (result.analogies_examples?.length) {
            content += `## Analogies & Examples\n`;
            result.analogies_examples.forEach((example: any) => {
                content += `### ${example.concept}\n**Analogy**: ${example.analogy}\n\n**Real-World Example**: ${example.real_world_example}\n\n`;
            });
        }

        // Case Studies
        if (result.case_studies?.length) {
            content += `## Case Studies\n`;
            result.case_studies.forEach((study: any, index: number) => {
                if (typeof study === 'string') {
                    content += `### Case Study ${index + 1}\n${study}\n\n`;
                } else if (study && typeof study === 'object') {
                    const title = study.case_study_name || `Case Study ${index + 1}`;
                    content += `### ${title}\n`;
                    if (study.description) {
                        content += `${study.description}\n\n`;
                    }
                    if (study.lessons_learned && Array.isArray(study.lessons_learned)) {
                        content += `**Key Lessons:**\n`;
                        study.lessons_learned.forEach((lesson: string) => {
                            content += `- ${lesson}\n`;
                        });
                        content += `\n`;
                    }
                } else {
                    content += `### Case Study ${index + 1}\n${String(study)}\n\n`;
                }
            });
        }

        // Knowledge Connections
        if (result.knowledge_connections?.length) {
            content += `## Knowledge Connections\n`;
            result.knowledge_connections.forEach((connection: any) => {
                content += `### ${connection.related_field}\n**Connection Type**: ${connection.connection_type}\n\n${connection.detailed_explanation}\n\n`;
            });
        }

        // Practical Applications
        if (result.practical_applications?.length) {
            content += `## Practical Applications\n`;
            result.practical_applications.forEach((application: any) => {
                content += `### ${application.domain}: ${application.application}\n**Implementation**: ${application.implementation}\n\n**Benefits**: ${application.benefits}\n\n`;
            });
        }

        // Implications and Consequences
        if (result.implications_consequences?.length) {
            content += `## Implications & Consequences\n`;
            result.implications_consequences.forEach((implication: string) => {
                content += `- ${implication}\n`;
            });
            content += '\n';
        }

        // Learning Pathways
        if (result.learning_pathways?.length) {
            content += `## Learning Pathways\n`;
            result.learning_pathways.forEach((pathway: any) => {
                content += `### ${pathway.pathway_name}\n**Estimated Time**: ${pathway.estimated_time} | **Difficulty**: ${pathway.difficulty}\n\n`;
                pathway.steps.forEach((step: string, index: number) => {
                    content += `${index + 1}. ${step}\n`;
                });
                content += '\n';
            });
        }

        // Add source reference
        content += `---\n\n> [!source] Source\n> ${url}\n`;
        
        return content;
    }

    private async getPromptForPass(passIndex: number, intent: string): Promise<string> {
        // Load intent-specific prompts
        const intentPrompts = await this.promptLoader.loadPromptsForIntent(intent as any);
        
        // Map pass index to prompt type with proper typing
        switch (passIndex) {
            case 0:
                return intentPrompts.structure;
            case 1:
                return intentPrompts.content;
            case 2:
                return intentPrompts.perspectives;
            case 3:
                return intentPrompts.connections;
            case 4:
                return intentPrompts.learning;
            default:
                throw new Error(`Invalid pass index: ${passIndex}. Must be 0-4.`);
        }
    }

    private async createNote(analysisResult: any, url: string): Promise<TFile> {
        console.log('[NoteProcessor] Creating note:', analysisResult.title);
        
        // Create note directly using modern file operations
        const title = analysisResult.title || 'Untitled Note';
        const summary = analysisResult.summary || 'No summary generated';
        const metadata = analysisResult.metadata || {};
        
        // Sanitize filename
        const fileName = title.replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, ' ').trim() + '.md';
        
        // Use MOC folder as default location
        const folderPath = this.plugin.settings.mocFolder || 'MOCs';
        
        // Ensure folder exists
        const folder = this.plugin.app.vault.getAbstractFileByPath(folderPath);
        if (!folder) {
            await this.plugin.app.vault.createFolder(folderPath);
        }
        
        // Create frontmatter
        const frontmatter = {
            title: title,
            created: new Date().toISOString().split('T')[0],
            type: 'summary',
            source: {
                type: url.includes('youtube.com') ? 'youtube' : 'web',
                url: url
            },
            tags: metadata.tags || ['#ai-generated'],
            ...(metadata.speakers && { speakers: metadata.speakers }),
            ...(metadata.topics && { topics: metadata.topics })
        };
        
        // Create note content
        let noteContent = '---\n';
        for (const [key, value] of Object.entries(frontmatter)) {
            if (Array.isArray(value)) {
                noteContent += `${key}:\n${value.map(v => `  - ${v}`).join('\n')}\n`;
            } else if (typeof value === 'object' && value !== null) {
                noteContent += `${key}:\n`;
                for (const [subKey, subValue] of Object.entries(value)) {
                    noteContent += `  ${subKey}: ${subValue}\n`;
                }
            } else {
                noteContent += `${key}: ${value}\n`;
            }
        }
        noteContent += '---\n\n';
        noteContent += summary;
        noteContent += `\n\n> **Source**: [${url}](${url})`;
        
        // Create the file
        const filePath = `${folderPath}/${fileName}`;
        return await this.plugin.app.vault.create(filePath, noteContent);
    }

    private async performMOCCascade(analysisResult: any, traceId: string): Promise<void> {
        console.log('[NoteProcessor] Starting MOC cascade');
        
        if (!this.plugin.settings.enableMOC || !analysisResult.hierarchy) {
            console.log('[NoteProcessor] MOC disabled or no hierarchy - skipping cascade');
            return;
        }

        const hierarchy = analysisResult.hierarchy;
        
        // Ensure MOC structure exists
        await this.plugin.mocManager.ensureMOCExists(hierarchy);
        
        // Get MOC files that need updating
        const mocLevels = [
            { level: 1, name: hierarchy.level1 },
            { level: 2, name: hierarchy.level2 },
            { level: 3, name: hierarchy.level3 },
            { level: 4, name: hierarchy.level4 }
        ].filter(level => level.name);

        // Get MOC structure and update each level with proper tracing
        const mocStructure = this.plugin.mocManager.createHierarchicalStructure(hierarchy);
        console.log(`[NoteProcessor] Updating ${mocStructure.length} MOC levels with traced AI intelligence`);
        
        // Update intelligence for each level, starting from most specific and going up
        for (let i = mocStructure.length - 1; i >= 0; i--) {
            const levelInfo = mocStructure[i];
            console.log(`[NoteProcessor] Updating MOC Level ${levelInfo.level}: ${levelInfo.title}`);
            
            // Add delay between MOC AI calls to prevent rate limiting (except for first call)
            if (i < mocStructure.length - 1) {
                console.log(`[NoteProcessor] Waiting 10 seconds before next MOC AI call to prevent rate limiting...`);
                await new Promise(resolve => setTimeout(resolve, 10000));
            }
            
            try {
                // Call AI to analyze and update this MOC level with proper tracing
                await this.traceManager.generateText(
                    {
                        prompt: `Analyze and update MOC intelligence for: ${levelInfo.title}\n\nMOC Path: ${levelInfo.path}\nLevel: ${levelInfo.level}`,
                        model: this.plugin.settings.gemini.model,
                        metadata: { 
                            mocLevel: levelInfo.level,
                            mocTitle: levelInfo.title,
                            mocPath: levelInfo.path
                        }
                    },
                    {
                        traceId,
                        generationName: `moc-intelligence-level-${levelInfo.level}`,
                        pass: `MOC Level ${levelInfo.level}`,
                        intent: 'moc-intelligence'
                    }
                );
                
                // Apply the MOC intelligence update using the existing method
                await this.plugin.mocManager.mocIntelligence.updateMOCWithIntelligence(levelInfo.path);
                console.log(`[NoteProcessor] ✅ Intelligence updated for MOC Level ${levelInfo.level}`);
                
            } catch (error) {
                console.error(`[NoteProcessor] ❌ Failed to update intelligence for MOC Level ${levelInfo.level}:`, error);
                // Continue with other levels even if one fails
            }
        }
        
        console.log(`[NoteProcessor] MOC cascade intelligence update complete`);
    }
}