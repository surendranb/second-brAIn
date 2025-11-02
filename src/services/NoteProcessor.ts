import { TraceManager } from './TraceManager';
import { LLMService } from './LLMService';
import { ContentExtractor, ContentExtractionError, type ExtractedContent } from './ContentExtractor';
import { HierarchyService, type HierarchyAnalysisResult } from './HierarchyService';
import { Notice, TFile } from 'obsidian';
import { PromptLoader } from '../../prompt-loader';
import { generateId } from '../utils';

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
    private contentExtractor: ContentExtractor;
    private hierarchyService: HierarchyService;
    private plugin: any; // Plugin reference for file operations
    private summaryView: any; // SummaryView reference for note creation
    private statusCallback?: StatusCallback;
    private promptLoader: PromptLoader;

    constructor(traceManager: TraceManager, llmService: LLMService, plugin: any, summaryView: any) {
        this.traceManager = traceManager;
        this.llmService = llmService;
        this.plugin = plugin;
        this.summaryView = summaryView;
        this.contentExtractor = new ContentExtractor(plugin);
        this.hierarchyService = new HierarchyService(llmService, traceManager);
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
        console.log('🎯 [TRACE] NoteProcessor.processURL() called with:', input);
        console.log('🔍 [TRACE] Available services:', {
            contentExtractor: !!this.contentExtractor,
            hierarchyService: !!this.hierarchyService,
            traceManager: !!this.traceManager,
            llmService: !!this.llmService
        });

        // 1. Extract content using ContentExtractor service
        console.log('📥 [TRACE] Step 1: Starting content extraction');
        this.updateStatus(0, 'Extracting content...');
        const extractedContent = await this.contentExtractor.extractContent(input.url);
        console.log('✅ [TRACE] Step 1: Content extraction completed:', {
            type: extractedContent.metadata.type,
            length: extractedContent.metadata.length,
            title: extractedContent.metadata.title
        });
        this.updateStatus(0, `Content extracted successfully (${extractedContent.metadata.type}, ${extractedContent.metadata.length} chars)`);
        
        // 2. Start trace
        console.log('📊 [TRACE] Step 2: Starting trace');
        this.updateStatus(1, 'Starting trace and span...');
        const traceId = await this.traceManager.startTrace({
            name: 'note-creation',
            input: { url: input.url, intent: input.intent },
            metadata: { source: 'note-processor' }
        });
        console.log('✅ [TRACE] Step 2: Trace started with ID:', traceId);

        const noteId = generateId();
        this.traceManager.startNoteTracking(noteId);

        try {
            // 3. AI-Driven Hierarchy Analysis (NEW - replaces hierarchy in 5-pass)
            console.log('🧠 [TRACE] Step 3: Starting hierarchy analysis');
            this.updateStatus(2, 'Analyzing knowledge hierarchy...');
            const hierarchyResult = await this.hierarchyService.analyzeHierarchy(
                extractedContent.metadata.title || 'Untitled',
                extractedContent.content,
                extractedContent.metadata,
                traceId
            );
            console.log('✅ [TRACE] Step 3: Hierarchy analysis completed:', {
                hierarchy: hierarchyResult.hierarchy,
                confidence: hierarchyResult.confidence
            });
            
            // 4. 5-Pass AI Content Analysis (EXISTING - keep as-is)
            console.log('🔄 [TRACE] Step 4: Starting 5-pass AI analysis');
            this.updateStatus(3, 'Running 5-pass AI analysis...');
            const analysisResult = await this.traceManager.withSpan(
                'content-analysis',
                async (spanId) => {
                    return await this.performAIAnalysis(extractedContent, input, traceId);
                },
                traceId,
                { input: { 
                    content: extractedContent.content.substring(0, 500) + '...',
                    contentType: extractedContent.metadata.type,
                    contentLength: extractedContent.metadata.length
                } }
            );
            console.log('✅ [TRACE] Step 4: 5-pass analysis completed');
            
            // Override hierarchy from 5-pass with our AI-driven hierarchy
            analysisResult.hierarchy = hierarchyResult.hierarchy;
            analysisResult.hierarchy_confidence = hierarchyResult.confidence;
            analysisResult.hierarchy_reasoning = hierarchyResult.reasoning;

            // 5. Create note with hierarchy
            this.updateStatus(4, 'Creating note...');
            const note = await this.createNote(analysisResult, input.url, input.intent);
            this.updateStatus(4, 'Note created successfully');

            // 6. MOC cascade within span
            this.updateStatus(5, 'Creating MOC structure...');
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
                        noteTitle: analysisResult.title,
                        confidence: analysisResult.hierarchy_confidence
                    }
                }
            );

            // 7. End trace
            this.updateStatus(7, 'Finalizing...');
            await this.traceManager.endTrace(traceId, {
                output: { 
                    noteCreated: true,
                    notePath: note.path,
                    hierarchy: analysisResult.hierarchy,
                    confidence: analysisResult.hierarchy_confidence
                }
            });

            this.updateStatus(7, 'Process complete!');
            return { note, traceId };

        } catch (error) {
            // Determine which step failed based on the error type and context
            let errorStep = 7; // Default to final step
            let errorMessage = `Error: ${error.message}`;
            
            if (error instanceof ContentExtractionError) {
                errorStep = 0; // Content extraction step
                errorMessage = `❌ Content extraction failed: ${error.message}`;
                console.error('[NoteProcessor] ❌ STOPPING PROCESS - Content extraction failed:', {
                    url: error.url,
                    type: error.extractorType,
                    reason: error.reason
                });
            } else if (error.message.includes('Gemini API error') || error.message.includes('503')) {
                errorStep = 2; // AI Analysis step
                errorMessage = `❌ AI Analysis failed: ${error.message}`;
            } else if (error.message.includes('note') || error.message.includes('file')) {
                errorStep = 4; // Note creation step
                errorMessage = `❌ Note creation failed: ${error.message}`;
            }
            
            this.updateStatus(errorStep, errorMessage, true);
            
            // End trace with error details
            await this.traceManager.endTrace(traceId, { 
                output: { 
                    error: error.message,
                    errorStep: errorStep,
                    errorType: error.constructor.name,
                    processStopped: true
                } 
            });
            
            // Re-throw the error to stop the entire process
            throw error;
        } finally {
            await this.traceManager.completeNoteTracking();
        }
    }



    private async performAIAnalysis(extractedContent: ExtractedContent, input: ProcessingInput, traceId: string): Promise<any> {
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
            const fullPrompt = `${prompt}\n\nContent to analyze:\n${extractedContent.content}`;

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
                        this.updateStatus(3, `AI overloaded, retrying in ${waitTime}s (attempt ${retryCount}/${maxRetries})...`);
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


    private async createNote(analysisResult: any, url: string, intent: string = 'knowledge_building'): Promise<TFile> {
        console.log('[NoteProcessor] Creating enhanced note with full functionality:', analysisResult.title);
        
        const title = analysisResult.title || 'Untitled Note';
        const summary = analysisResult.summary || 'No summary generated';
        const metadata = analysisResult.metadata || {};
        const hierarchy = analysisResult.hierarchy;
        const learningContext = analysisResult.learning_context;
        const actionItems = analysisResult.action_items;
        
        // Sanitize filename
        const fileName = title.replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, ' ').trim() + '.md';
        
        let folderPath = this.plugin.settings.mocFolder || 'MOCs';
        let mocPath: string | null = null;
        
        // Enhanced MOC Integration - Use hierarchy for proper placement
        if (this.plugin.settings.enableMOC && hierarchy && hierarchy.level1 && hierarchy.level2) {
            console.log('[NoteProcessor] Processing hierarchy:', hierarchy);
            
            try {
                // Ensure MOC structure exists using existing MOC manager
                await this.plugin.mocManager.ensureMOCExists(hierarchy);
                
                // Get the most specific MOC directory for file placement
                folderPath = this.plugin.mocManager.getMostSpecificMOCDirectory(hierarchy);
                mocPath = await this.plugin.mocManager.getMostSpecificMOCPath(hierarchy);
                
                console.log('[NoteProcessor] ✅ MOC structure created, placing note in:', folderPath);
            } catch (error) {
                console.error('[NoteProcessor] ❌ MOC creation failed, using default folder:', error);
                folderPath = this.plugin.settings.mocFolder || 'MOCs';
            }
        }
        
        // Ensure target folder exists
        const folder = this.plugin.app.vault.getAbstractFileByPath(folderPath);
        if (!folder) {
            await this.plugin.app.vault.createFolder(folderPath);
        }
        
        // Create comprehensive frontmatter with all features
        const now = new Date();
        const frontmatter: any = {
            title: title,
            date: now.toISOString().split('T')[0],
            type: "summary",
            intent: intent,
            source: {
                type: url.includes('youtube.com') ? 'youtube' : 'web',
                url: url,
                source_type: url.includes('youtube.com') ? 'video' : 'article',
                detected_platform: url.includes('youtube.com') ? 'youtube' : 'web'
            },
            status: "draft",
            created: now.toISOString(),
            modified: now.toISOString()
        };
        
        // Add action items if available
        if (actionItems && Array.isArray(actionItems) && actionItems.length > 0) {
            frontmatter.action_items = actionItems;
        }
        
        // Add hierarchy if available
        if (hierarchy && hierarchy.level1 && hierarchy.level2) {
            frontmatter.hierarchy = hierarchy;
        }
        
        // Add MOC path if created
        if (mocPath) {
            frontmatter.moc = mocPath;
        }
        
        // Add learning context if available
        if (learningContext) {
            frontmatter.learning_context = learningContext;
        }
        
        // Add metadata fields
        if (metadata.tags && Array.isArray(metadata.tags)) {
            frontmatter.tags = metadata.tags;
        }
        if (metadata.speakers && Array.isArray(metadata.speakers)) {
            frontmatter.speakers = metadata.speakers;
        }
        if (metadata.topics && Array.isArray(metadata.topics)) {
            frontmatter.topics = metadata.topics;
        }
        
        // Create YAML frontmatter with proper formatting
        let noteContent = '---\n';
        
        const formatYamlValue = (value: any, indent: string = ''): string => {
            if (Array.isArray(value)) {
                return value.map(item => `${indent}  - "${item}"`).join('\n');
            } else if (typeof value === 'object' && value !== null) {
                return Object.entries(value)
                    .map(([subKey, subValue]) => `${indent}  ${subKey}: "${subValue}"`)
                    .join('\n');
            } else if (typeof value === 'string') {
                return `"${value}"`;
            } else {
                return String(value);
            }
        };
        
        for (const [key, value] of Object.entries(frontmatter)) {
            if (Array.isArray(value)) {
                noteContent += `${key}:\n`;
                noteContent += formatYamlValue(value) + '\n';
            } else if (typeof value === 'object' && value !== null) {
                noteContent += `${key}:\n`;
                noteContent += formatYamlValue(value) + '\n';
            } else {
                noteContent += `${key}: ${formatYamlValue(value)}\n`;
            }
        }
        noteContent += '---\n\n';
        
        // Add AI-generated content (already includes title, content, and source)
        noteContent += summary;
        
        // Create the file
        const filePath = `${folderPath}/${fileName}`;
        const createdFile = await this.plugin.app.vault.create(filePath, noteContent);
        
        // Update MOC with new note if MOC was created
        if (mocPath && this.plugin.mocManager) {
            try {
                await this.plugin.mocManager.updateMOC(mocPath, createdFile.path, title, learningContext);
                console.log('[NoteProcessor] ✅ Note added to MOC:', mocPath);
            } catch (error) {
                console.error('[NoteProcessor] ❌ Failed to update MOC:', error);
            }
        }
        
        return createdFile;
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