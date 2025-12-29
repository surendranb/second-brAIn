import { TraceManager } from './TraceManager';
import { LLMService } from './LLMService';
import { ContentExtractor, type ExtractedContent } from './ContentExtractor';
import { HierarchyService } from './HierarchyService';
import { TFile } from 'obsidian';
import { PromptLoader } from './prompt-loader';
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
    private plugin: any;
    private summaryView: any;
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
    }

    async processURL(input: ProcessingInput): Promise<ProcessingResult> {
        this.updateStatus(0, 'Extracting content...');
        const extractedContent = await this.contentExtractor.extractContent(input.url);
        this.updateStatus(0, `Content extracted (${extractedContent.metadata.type})`);
        console.log('✓ Content extracted');
        
        const traceId = await this.traceManager.startTrace({
            name: 'note-creation',
            input: { url: input.url, intent: input.intent },
            metadata: { source: 'note-processor' }
        });

        const noteId = generateId();
        this.traceManager.startNoteTracking(noteId);

        try {
            this.updateStatus(2, 'Analyzing knowledge hierarchy...');
            const hierarchyResult = await this.hierarchyService.analyzeHierarchy(
                extractedContent.metadata.title || 'Untitled',
                extractedContent.content,
                extractedContent.metadata,
                traceId,
                this.plugin.getCurrentModel()
            );
            console.log(`✓ Hierarchy determined: ${hierarchyResult.hierarchy.level1} > ${hierarchyResult.hierarchy.level2}`);
            
            this.updateStatus(3, 'Running 5-pass AI analysis...');
            const analysisResult = await this.traceManager.withSpan(
                'content-analysis',
                async () => {
                    return await this.performAIAnalysis(extractedContent, input, traceId);
                },
                traceId,
                { input: { contentType: extractedContent.metadata.type } }
            );
            console.log('✓ Analysis complete');
            
            analysisResult.hierarchy = hierarchyResult.hierarchy;
            analysisResult.hierarchy_confidence = hierarchyResult.confidence;
            analysisResult.hierarchy_reasoning = hierarchyResult.reasoning;

            this.updateStatus(4, 'Creating note...');
            const note = await this.createNote(analysisResult, input.url, input.intent);
            console.log(`✓ Note created: ${note.path}`);

            this.updateStatus(5, 'Organizing knowledge...');
            await this.traceManager.withSpan(
                'moc-cascade',
                async () => {
                    await this.performMOCCascade(analysisResult, traceId);
                    return { mocUpdated: true };
                },
                traceId,
                { input: { hierarchy: analysisResult.hierarchy } }
            );
            console.log('✓ Knowledge organized');

            await this.traceManager.endTrace(traceId, {
                output: { noteCreated: true, notePath: note.path }
            });

            this.updateStatus(7, 'Complete!');
            return { note, traceId };

        } catch (error) {
            console.error('❌ Process failed:', error.message);
            this.updateStatus(7, `Error: ${error.message}`, true);
            await this.traceManager.endTrace(traceId, { 
                output: { error: error.message, processStopped: true } 
            });
            throw error;
        } finally {
            await this.traceManager.completeNoteTracking();
        }
    }

    private async performAIAnalysis(extractedContent: ExtractedContent, input: ProcessingInput, traceId: string): Promise<any> {
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
            this.updateStatus(3, `Analysis: ${passName} (${i + 1}/${passes.length})...`);

            if (i > 0) {
                await new Promise(resolve => setTimeout(resolve, 10000));
            }

            const prompt = await this.getPromptForPass(i, input.intent);
            const fullPrompt = `${prompt}\n\nContent to analyze:\n${extractedContent.content}`;

            let response;
            let retryCount = 0;
            const maxRetries = 2;
            
            while (retryCount <= maxRetries) {
                try {
                    response = await this.traceManager.generateText(
                        {
                            prompt: fullPrompt,
                            model: this.plugin.getCurrentModel(),
                            metadata: { pass: passName }
                        },
                        {
                            traceId,
                            generationName: `ai-pass-${i + 1}`,
                            pass: passName,
                            intent: input.intent
                        }
                    );
                    break;
                } catch (error) {
                    if (error.message.includes('503') && retryCount < maxRetries) {
                        retryCount++;
                        await new Promise(resolve => setTimeout(resolve, retryCount * 10000));
                    } else {
                        throw error;
                    }
                }
            }

            if (!response) continue;
            
            try {
                let cleanedText = response.text.trim();
                if (cleanedText.startsWith('```json')) {
                    cleanedText = cleanedText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
                } else if (cleanedText.startsWith('```')) {
                    cleanedText = cleanedText.replace(/^```\s*/, '').replace(/\s*```$/, '');
                }
                const passResult = JSON.parse(cleanedText);
                fullResult = { ...fullResult, ...passResult };
            } catch (error) {
                console.error(`Pass ${i + 1} parse failed`);
            }
        }

        if (!fullResult.title) {
            const urlTitle = input.url.split('/').pop()?.replace(/[^a-zA-Z0-9\s]/g, ' ').trim();
            fullResult.title = urlTitle || 'Extracted Content';
        }
        
        if (!fullResult.summary) {
            fullResult.summary = this.createSummaryFromAnalysis(fullResult, input.url);
        }
        
        return fullResult;
    }

    private createSummaryFromAnalysis(result: any, url: string): string {
        let content = `# ${result.title}\n\n`;
        if (result.overview) content += `## Overview\n${result.overview}\n\n`;
        if (result.context) content += `## Context & Background\n${result.context}\n\n`;
        if (result.detailed_summary) content += `## Comprehensive Summary\n${result.detailed_summary}\n\n`;

        if (result.key_facts?.length) {
            content += `## Key Facts\n`;
            result.key_facts.forEach((fact: string) => content += `- ${fact}\n`);
            content += '\n';
        }

        if (result.deep_insights?.length) {
            content += `## Deep Insights\n`;
            result.deep_insights.forEach((insight: string, index: number) => {
                const colonIndex = insight.indexOf(':');
                if (colonIndex > 0 && colonIndex < 100) {
                    content += `### ${index + 1}. ${insight.substring(0, colonIndex).trim()}\n${insight.substring(colonIndex + 1).trim()}\n\n`;
                } else {
                    content += `### Insight ${index + 1}\n${insight}\n\n`;
                }
            });
        }

        if (result.core_concepts?.length) {
            content += `## Core Concepts\n`;
            result.core_concepts.forEach((concept: string) => {
                const colonIndex = concept.indexOf(':');
                if (colonIndex > 0 && colonIndex < 100) {
                    content += `### ${concept.substring(0, colonIndex).trim()}\n${concept.substring(colonIndex + 1).trim()}\n\n`;
                } else {
                    content += `### ${concept}\n\n`;
                }
            });
        }

        if (result.multiple_perspectives?.length) {
            content += `## Multiple Perspectives\n`;
            result.multiple_perspectives.forEach((p: any) => content += `### ${p.viewpoint}\n${p.analysis}\n\n`);
        }

        if (result.analogies_examples?.length) {
            content += `## Analogies & Examples\n`;
            result.analogies_examples.forEach((e: any) => content += `### ${e.concept}\n**Analogy**: ${e.analogy}\n\n**Real-World Example**: ${e.real_world_example}\n\n`);
        }

        if (result.case_studies?.length) {
            content += `## Case Studies\n`;
            result.case_studies.forEach((study: any, index: number) => {
                const title = study.case_study_name || `Case Study ${index + 1}`;
                content += `### ${title}\n${study.description || String(study)}\n\n`;
            });
        }

        if (result.knowledge_connections?.length) {
            content += `## Knowledge Connections\n`;
            result.knowledge_connections.forEach((c: any) => content += `### ${c.related_field}\n**Connection Type**: ${c.connection_type}\n\n${c.detailed_explanation}\n\n`);
        }

        if (result.practical_applications?.length) {
            content += `## Practical Applications\n`;
            result.practical_applications.forEach((a: any) => content += `### ${a.domain}: ${a.application}\n**Implementation**: ${a.implementation}\n\n**Benefits**: ${a.benefits}\n\n`);
        }

        if (result.learning_pathways?.length) {
            content += `## Learning Pathways\n`;
            result.learning_pathways.forEach((p: any) => {
                content += `### ${p.pathway_name}\n**Difficulty**: ${p.difficulty}\n\n`;
                p.steps.forEach((step: string, i: number) => content += `${i + 1}. ${step}\n`);
                content += '\n';
            });
        }

        content += `---\n\n> [!source] Source\n> ${url}\n`;
        return content;
    }

    private async getPromptForPass(passIndex: number, intent: string): Promise<string> {
        const prompts = await this.promptLoader.loadPromptsForIntent(intent as any);
        switch (passIndex) {
            case 0: return prompts.structure;
            case 1: return prompts.content;
            case 2: return prompts.perspectives;
            case 3: return prompts.connections;
            case 4: return prompts.learning;
            default: throw new Error('Invalid pass');
        }
    }

    private async createNote(analysisResult: any, url: string, intent: string): Promise<TFile> {
        const title = analysisResult.title || 'Untitled Note';
        const fileName = title.replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, ' ').trim() + '.md';
        
        let folderPath = this.plugin.settings.mocFolder || 'MOCs';
        let mocPath: string | null = null;
        
        if (this.plugin.settings.enableMOC && analysisResult.hierarchy?.level1) {
            try {
                await this.plugin.mocManager.ensureMOCExists(analysisResult.hierarchy);
                folderPath = this.plugin.mocManager.getMostSpecificMOCDirectory(analysisResult.hierarchy);
                mocPath = await this.plugin.mocManager.getMostSpecificMOCPath(analysisResult.hierarchy);
            } catch (e) {
                folderPath = this.plugin.settings.mocFolder || 'MOCs';
            }
        }
        
        const folder = this.plugin.app.vault.getAbstractFileByPath(folderPath);
        if (!folder) await this.plugin.app.vault.createFolder(folderPath);
        
        const now = new Date();
        const frontmatter: any = {
            title,
            date: now.toISOString().split('T')[0],
            type: "summary",
            intent,
            source: { url, type: url.includes('youtube.com') ? 'youtube' : 'web' },
            status: "draft",
            created: now.toISOString(),
            modified: now.toISOString(),
            hierarchy: analysisResult.hierarchy,
            moc: mocPath,
            learning_context: analysisResult.learning_context,
            tags: analysisResult.metadata?.tags
        };
        
        let noteContent = '---\n';
        for (const [key, value] of Object.entries(frontmatter)) {
            if (value) noteContent += `${key}: ${JSON.stringify(value)}\n`;
        }
        noteContent += '---\n\n' + analysisResult.summary;
        
        const filePath = `${folderPath}/${fileName}`;
        const createdFile = await this.plugin.app.vault.create(filePath, noteContent);
        
        if (mocPath) {
            await this.plugin.mocManager.updateMOC(mocPath, createdFile.path, title, analysisResult.learning_context);
        }
        
        return createdFile;
    }

    private async performMOCCascade(analysisResult: any, traceId: string): Promise<void> {
        if (!this.plugin.settings.enableMOC || !analysisResult.hierarchy) return;

        const mocStructure = this.plugin.mocManager.createHierarchicalStructure(analysisResult.hierarchy);
        
        for (let i = mocStructure.length - 1; i >= 0; i--) {
            const levelInfo = mocStructure[i];
            if (i < mocStructure.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 10000));
            }
            
            try {
                await this.plugin.mocManager.mocIntelligence.updateMOCWithIntelligence(levelInfo.path);
            } catch (error) {
                console.error(`Failed to update MOC: ${levelInfo.title}`);
            }
        }
    }
}