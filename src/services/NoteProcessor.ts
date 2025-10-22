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
            this.updateStatus(7, `Error: ${error.message}`, true);
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
                console.log(`[NoteProcessor] Waiting 5 seconds before next AI call to prevent rate limiting...`);
                await new Promise(resolve => setTimeout(resolve, 5000));
            }

            // Get prompt for this pass
            const prompt = await this.getPromptForPass(i, input.intent);
            const fullPrompt = `${prompt}\n\nContent to analyze:\n${content}`;

            // Call AI with tracing
            const response = await this.traceManager.generateText(
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

            // Parse and merge results
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
            fullResult.summary = `# ${fullResult.title}\n\nContent extracted from: ${input.url}\n\n*Note: AI analysis failed to generate structured content. Raw content may need manual review.*`;
            console.log(`[NoteProcessor] Using fallback summary`);
        }
        
        console.log(`[NoteProcessor] Final analysis result:`, {
            title: fullResult.title,
            hasHierarchy: !!fullResult.hierarchy,
            hasSummary: !!fullResult.summary,
            hasMetadata: !!fullResult.metadata
        });
        
        return fullResult;
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
        
        // Use existing note creation logic from SummaryView
        return await this.summaryView.createNoteWithSummary(
            analysisResult.summary || 'No summary generated',
            analysisResult.title || 'Untitled Note',
            url,
            analysisResult.metadata || {},
            analysisResult,
            'knowledge_building' // Default intent
        );
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

        // Update each MOC with AI intelligence
        for (let i = 0; i < mocLevels.length; i++) {
            const mocLevel = mocLevels[i];
            const mocPath = this.plugin.mocManager.getMOCPath(hierarchy, mocLevel.level);
            
            if (mocPath) {
                console.log(`[NoteProcessor] Updating MOC: ${mocPath}`);
                
                // Add delay between MOC AI calls to prevent rate limiting (except for first call)
                if (i > 0) {
                    console.log(`[NoteProcessor] Waiting 5 seconds before next MOC AI call to prevent rate limiting...`);
                    await new Promise(resolve => setTimeout(resolve, 5000));
                }
                
                // Call AI to update MOC with intelligence
                await this.traceManager.generateText(
                    {
                        prompt: `Update MOC intelligence for: ${mocLevel.name}`,
                        model: this.plugin.settings.gemini.model,
                        metadata: { 
                            mocLevel: mocLevel.level,
                            mocName: mocLevel.name,
                            mocPath 
                        }
                    },
                    {
                        traceId,
                        generationName: `moc-update-level-${mocLevel.level}`,
                        intent: 'moc-update'
                    }
                );

                // Apply MOC intelligence update
                await this.plugin.mocIntelligence.updateMOCWithIntelligence(mocPath);
            }
        }
    }
}