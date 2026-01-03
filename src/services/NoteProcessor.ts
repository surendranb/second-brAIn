import { TraceManager } from './TraceManager';
import { LLMService } from './LLMService';
import { ContentExtractor, type ExtractedContent } from './ContentExtractor';
import { HierarchyService } from './HierarchyService';
import { TFile, TFolder } from 'obsidian';
import { PromptLoader } from './prompt-loader';
import { generateId } from '../utils';

export interface ProcessingInput {
    url: string;
    prompt: string;
    intent: string;
    targetTopic?: string;
    generateQA?: boolean;
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
        
        const traceId = await this.traceManager.startTrace({
            name: 'note-creation',
            input: { url: input.url, intent: input.intent, targetTopic: input.targetTopic },
            metadata: { source: 'note-processor' }
        });

        const noteId = generateId();
        this.traceManager.startNoteTracking(noteId);

        try {
            this.updateStatus(2, 'Analyzing knowledge hierarchy...');
            const vaultMap = await this.getVaultMap();
            const hierarchyResult = await this.hierarchyService.analyzeHierarchy(
                extractedContent.metadata.title || 'Untitled',
                extractedContent.content,
                extractedContent.metadata,
                traceId,
                this.plugin.getCurrentModel(),
                vaultMap
            );
            this.updateStatus(2, `📍 Hierarchy: ${hierarchyResult.hierarchy.level1} > ${hierarchyResult.hierarchy.level2}`);
            
            this.updateStatus(3, 'Running AI analysis (5-pass)...');
            const analysisResult = await this.traceManager.withSpan(
                'content-analysis',
                async () => {
                    return await this.performAIAnalysis(extractedContent, input, traceId);
                },
                traceId,
                { input: { contentType: extractedContent.metadata.type } }
            );
            
            analysisResult.hierarchy = hierarchyResult.hierarchy;
            analysisResult.hierarchy_confidence = hierarchyResult.confidence;
            analysisResult.hierarchy_reasoning = hierarchyResult.reasoning;

            // --- Robust Author Extraction ---
            this.updateStatus(3, '🔍 Identifying primary author...');
            const author = await this.extractPrimaryAuthor(extractedContent, analysisResult, traceId);
            analysisResult.primary_author = author;

            // --- Asset Path Calculation ---
            let qaPath: string | null = null;
            if (input.generateQA) {
                const qaTitle = `${analysisResult.title} (Q&A)`;
                const qaFileName = qaTitle.replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, ' ').trim() + '.md';
                const folderPath = this.getTargetFolderPath(analysisResult, input.intent, input.targetTopic);
                qaPath = `${folderPath}/${qaFileName}`;
            }

            let archivePath: string | null = null;
            if (this.plugin.settings.archive?.enabled) {
                archivePath = this.getArchivePath(analysisResult);
            }

            this.updateStatus(4, '📄 Creating Summary Note...');
            
            // 1. Create Summary Note
            const note = await this.createNote(analysisResult, input.url, input.intent, {
                targetTopic: input.targetTopic,
                archivePath,
                qaPath
            });
            
            // 2. Create Verbatim Q&A Note
            if (input.generateQA) {
                this.updateStatus(4, '💬 Starting verbatim Q&A extraction...');
                try {
                    const qaMarkdown = await this.performVerbatimQAExtraction(extractedContent, traceId);
                    if (!qaMarkdown || qaMarkdown.trim().length < 50) {
                        throw new Error('AI returned empty Q&A content');
                    }
                    await this.createQANote(analysisResult, qaMarkdown, note.path);
                    this.updateStatus(4, '✅ Q&A Note created');
                } catch (e) {
                    this.updateStatus(4, `⚠️ Q&A Extraction failed: ${e.message}`, true);
                }
            }

            // 3. Create Archive File
            if (archivePath) {
                try {
                    await this.saveArchiveFile(extractedContent, analysisResult, note.path, noteId, archivePath);
                    this.updateStatus(4, '📦 Transcript archived (Layer 0)');
                } catch (e) {
                    this.updateStatus(4, `⚠️ Archiving failed: ${e.message}`, true);
                }
            }

            this.updateStatus(5, 'Organizing knowledge graph...');
            await this.traceManager.withSpan(
                'moc-cascade',
                async () => {
                    await this.performMOCCascade(analysisResult, traceId);
                    return { mocUpdated: true };
                },
                traceId,
                { input: { hierarchy: analysisResult.hierarchy } }
            );
            this.updateStatus(5, '🔗 MOC Index updated');

            await this.traceManager.endTrace(traceId, {
                output: { noteCreated: true, notePath: note.path }
            });

            this.updateStatus(7, '🎉 All processes complete!');
            return { note, traceId };

        } catch (error) {
            console.error('❌ Error:', error.message);
            this.updateStatus(7, `❌ Error: ${error.message}`, true);
            await this.traceManager.endTrace(traceId, { 
                output: { error: error.message, processStopped: true } 
            });
            throw error;
        } finally {
            await this.traceManager.completeNoteTracking();
        }
    }

    private getTargetFolderPath(analysisResult: any, intent: string, targetTopic?: string): string {
        let folderPath = this.plugin.settings.mocFolder || 'MOCs';
        if (targetTopic) {
            folderPath = `${this.plugin.settings.topicFolders?.rootFolder || 'Research Topics'}/${targetTopic}`;
        } else if (intent === 'research_collection' && this.plugin.settings.topicFolders?.enabled) {
            const h = analysisResult.hierarchy;
            const match = this.plugin.settings.topicFolders.topics.find((t: string) => 
                [h?.level1, h?.level2, h?.level3].some(l => l && t.toLowerCase() === l.toLowerCase())
            );
            if (match) {
                folderPath = `${this.plugin.settings.topicFolders.rootFolder}/${match}`;
            } else {
                folderPath = this.plugin.settings.topicFolders.rootFolder || 'Research Topics';
            }
        }

        if (this.plugin.settings.enableMOC && analysisResult.hierarchy?.level1) {
            const researchRoot = this.plugin.settings.topicFolders?.rootFolder || 'Research Topics';
            if (!folderPath.startsWith(researchRoot)) {
                folderPath = this.plugin.mocManager.getMostSpecificMOCDirectory(analysisResult.hierarchy);
            }
        }
        return folderPath;
    }

    private getArchivePath(analysisResult: any): string {
        const now = new Date();
        const year = now.getFullYear().toString();
        const month = (now.getMonth() + 1).toString().padStart(2, '0') + '-' + now.toLocaleString('en-US', { month: 'long' });
        const root = this.plugin.settings.archive.rootFolder || 'Archive/Transcripts';
        const monthDir = `${root}/${year}/${month}`;
        
        const dateStr = now.toISOString().split('T')[0];
        const author = analysisResult.primary_author || 'Unknown';
        const authorSlug = author.split(' ')[0].replace(/[^a-zA-Z0-9]/g, '') + '-';
        const safeTitle = (analysisResult.title || 'Untitled').replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, ' ').trim();
        
        return `${monthDir}/${dateStr}-${authorSlug}${safeTitle}-Transcript.md`;
    }

    private async extractPrimaryAuthor(content: ExtractedContent, analysisResult: any, traceId: string): Promise<string> {
        const sample = content.content.substring(0, 5000);
        const metadata = JSON.stringify(analysisResult.metadata || {});
        const promptText = `Identify the single primary author or main guest speaker from this content. Look for host introductions or self-identifications. 

Metadata: ${metadata}
Transcript Preview: ${sample}

Return ONLY the name (e.g. "James Clear"). If unknown, return "Unknown".`;

        try {
            const response = await this.traceManager.generateText({
                prompt: promptText,
                model: this.plugin.getCurrentModel(),
                metadata: { type: 'author-extraction' }
            }, { traceId, generationName: 'author-extraction' });
            
            const name = response.text.trim().replace(/['"]/g, '');
            if (name && name !== "Unknown") {
                this.updateStatus(3, `👤 Author identified: ${name}`);
                return name;
            }
            return analysisResult.metadata?.speakers?.[0] || analysisResult.metadata?.author || 'Unknown';
        } catch (e) {
            return analysisResult.metadata?.speakers?.[0] || analysisResult.metadata?.author || 'Unknown';
        }
    }

    private async performAIAnalysis(extractedContent: ExtractedContent, input: ProcessingInput, traceId: string): Promise<any> {
        const passes = ['Structure & Metadata', 'Content & Concepts', 'Perspectives & Examples', 'Connections & Applications', 'Learning Paths & Actions'];
        let fullResult: any = {};

        for (let i = 0; i < passes.length; i++) {
            const passName = passes[i];
            this.updateStatus(3, `Analysis Pass ${i + 1}/${passes.length}: ${passName}...`);
            if (i > 0) await new Promise(resolve => setTimeout(resolve, 5000));

            const prompt = await this.getPromptForPass(i, input.intent);
            const vaultMap = await this.getVaultMap();
            const fullPrompt = `EXISTING_VAULT_MAP:\n${vaultMap}\n\n${prompt}\n\nContent to analyze:\n${extractedContent.content}`;

            const response = await this.traceManager.generateText({
                prompt: fullPrompt,
                model: this.plugin.getCurrentModel(),
                metadata: { pass: passName }
            }, {
                traceId,
                generationName: `ai-pass-${i + 1}`,
                pass: passName,
                intent: input.intent
            });

            if (!response) continue;
            
            try {
                let cleanedText = response.text.trim();
                if (cleanedText.startsWith('```json')) cleanedText = cleanedText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
                else if (cleanedText.startsWith('```')) cleanedText = cleanedText.replace(/^```\s*/, '').replace(/\s*```$/, '');
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
        
        if (!fullResult.summary) fullResult.summary = this.createSummaryFromAnalysis(fullResult, input.url);
        return fullResult;
    }

    private createSummaryFromAnalysis(result: any, url: string): string {
        let content = `# ${result.title}\n\n`;
        if (result.overview) content += `## Overview\n${result.overview}\n\n`;
        if (result.context) content += `## Context & Background\n${result.context}\n\n`;
        if (result.detailed_summary) content += `## Comprehensive Summary\n${result.detailed_summary}\n\n`;

        const listSections = [
            { key: 'key_facts', title: 'Key Facts' },
            { key: 'deep_insights', title: 'Deep Insights', isInsights: true },
            { key: 'core_concepts', title: 'Core Concepts', isInsights: true }
        ];

        for (const sec of listSections) {
            if (result[sec.key]?.length) {
                content += `## ${sec.title}\n`;
                result[sec.key].forEach((item: string, index: number) => {
                    if (sec.isInsights) {
                        const colonIndex = item.indexOf(':');
                        if (colonIndex > 0 && colonIndex < 100) content += `### ${index + 1}. ${item.substring(0, colonIndex).trim()}\n${item.substring(colonIndex + 1).trim()}\n\n`;
                        else content += `### Insight ${index + 1}\n${item}\n\n`;
                    } else content += `- ${item}\n`;
                });
                content += '\n';
            }
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
        const map = [prompts.structure, prompts.content, prompts.perspectives, prompts.connections, prompts.learning];
        return map[passIndex];
    }

    private async createNote(analysisResult: any, url: string, intent: string, assets: { targetTopic?: string, archivePath?: string | null, qaPath?: string | null }): Promise<TFile> {
        const title = analysisResult.title || 'Untitled Note';
        const fileName = title.replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, ' ').trim() + '.md';
        const folderPath = this.getTargetFolderPath(analysisResult, intent, assets.targetTopic);
        let mocPath: string | null = null;

        if (this.plugin.settings.enableMOC && analysisResult.hierarchy?.level1) {
            try {
                await this.plugin.mocManager.ensureMOCExists(analysisResult.hierarchy, analysisResult.overview);
                mocPath = await this.plugin.mocManager.getMostSpecificMOCPath(analysisResult.hierarchy);
            } catch (e) { console.error('MOC check failed', e); }
        }
        
        if (!(this.plugin.app.vault.getAbstractFileByPath(folderPath))) await this.plugin.app.vault.createFolder(folderPath);
        
        const author = analysisResult.primary_author || 'Unknown';
        const frontmatter = {
            title,
            date: new Date().toISOString().split('T')[0],
            type: "summary",
            intent,
            author,
            source: { url, type: url.includes('youtube.com') ? 'youtube' : 'web' },
            archive_source: assets.archivePath ? `[[${assets.archivePath}]]` : null,
            qna_note: assets.qaPath ? `[[${assets.qaPath}]]` : null,
            status: "draft",
            created: new Date().toISOString(),
            modified: new Date().toISOString(),
            hierarchy: analysisResult.hierarchy,
            moc: mocPath ? `[[${mocPath}]]` : null,
            learning_context: analysisResult.learning_context,
            tags: analysisResult.metadata?.tags
        };
        
        return await this.plugin.app.vault.create(`${folderPath}/${fileName}`, this.buildFrontmatter(frontmatter) + '\n' + analysisResult.summary);
    }

    private async performVerbatimQAExtraction(content: ExtractedContent, traceId: string): Promise<string> {
        const promptLoader = new PromptLoader();
        const promptData = await promptLoader.loadPromptsForIntent('verbatim_qa' as any);
        const promptTemplate = (promptData as any).structure;
        
        const CHUNK_SIZE = 15000; // Resolution Fix
        const text = content.content;
        const chunks: string[] = [];
        for (let i = 0; i < text.length; i += CHUNK_SIZE) {
            chunks.push(text.substring(i, i + CHUNK_SIZE));
        }

        let fullMarkdown = "";
        for (let i = 0; i < chunks.length; i++) {
            this.updateStatus(4, `💬 Extracting Q&A Part ${i + 1}/${chunks.length}...`);
            const fullPrompt = promptTemplate.replace('{CONTENT}', chunks[i]);
            try {
                const response = await this.traceManager.generateText({
                    prompt: fullPrompt,
                    model: this.plugin.getCurrentModel(),
                    metadata: { type: 'verbatim-qa-extraction', part: i + 1 }
                }, { traceId, generationName: `verbatim-qa-p${i+1}`, pass: `Verbatim Q&A ${i+1}`, intent: 'verbatim_qa' });
                
                if (response.text && response.text.trim().length > 10) {
                    const pairCount = (response.text.match(/\*\*Question:\*\*/g) || []).length;
                    this.updateStatus(4, `✅ Part ${i+1}/${chunks.length}: Found ${pairCount} pairs`);
                    fullMarkdown += response.text + "\n\n";
                }
            } catch (e) {
                this.updateStatus(4, `❌ Part ${i + 1} failed: ${e.message}`, true);
                fullMarkdown += `\n\n> [!error] Error extracting Part ${i + 1}\n\n`;
            }
        }
        return fullMarkdown.trim();
    }

    private async createQANote(analysisResult: any, markdown: string, summaryPath: string): Promise<TFile> {
        const title = `${analysisResult.title} (Q&A)`;
        const fileName = title.replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, ' ').trim() + '.md';
        const folderPath = this.plugin.app.vault.getAbstractFileByPath(summaryPath).parent.path;
        const author = analysisResult.primary_author || 'Unknown';
        
        const frontmatter = {
            title,
            date: new Date().toISOString().split('T')[0],
            type: "qna",
            author,
            summary_note: `[[${summaryPath}]]`,
            created: new Date().toISOString()
        };

        return await this.plugin.app.vault.create(`${folderPath}/${fileName}`, this.buildFrontmatter(frontmatter) + '\n' + markdown);
    }

    private async saveArchiveFile(content: ExtractedContent, analysisResult: any, summaryNotePath: string, noteId: string, filePath: string): Promise<void> {
        const folderPath = filePath.substring(0, filePath.lastIndexOf('/'));
        const parts = folderPath.split('/');
        let currentPath = '';
        for (const part of parts) {
            currentPath = currentPath ? `${currentPath}/${part}` : part;
            if (!(this.plugin.app.vault.getAbstractFileByPath(currentPath))) await this.plugin.app.vault.createFolder(currentPath);
        }

        const frontmatter = {
            title: analysisResult.title,
            date: new Date().toISOString().split('T')[0],
            type: "transcript",
            author: analysisResult.primary_author || 'Unknown',
            source_url: content.metadata.url,
            summary_note: `[[${summaryNotePath}]]`,
            note_id: noteId,
            hierarchy: analysisResult.hierarchy,
            created: new Date().toISOString()
        };

        await this.plugin.app.vault.create(filePath, this.buildFrontmatter(frontmatter) + '\n\n# Full Transcript\n\n' + content.content);
    }

    private buildFrontmatter(data: Record<string, any>, indent = 0): string {
        let content = indent === 0 ? '---\n' : '';
        const spaces = '  '.repeat(indent);
        for (const [key, value] of Object.entries(data)) {
            if (value === null || value === undefined) continue;
            if (typeof value === 'string' && value.startsWith('[[')) content += `${spaces}${key}: "${value}"
`;
            else if (Array.isArray(value)) {
                if (value.length === 0) continue;
                content += `${spaces}${key}:\n`;
                value.forEach(v => content += `${spaces}  - ${JSON.stringify(v)}\n`);
            } else if (typeof value === 'object' && !Array.isArray(value)) {
                content += `${spaces}${key}:\n${this.buildFrontmatter(value, indent + 1)}`;
            } else content += `${spaces}${key}: ${JSON.stringify(value)}\n`;
        }
        if (indent === 0) content += '---';
        return content;
    }

    private async performMOCCascade(analysisResult: any, traceId: string): Promise<void> {
        if (!this.plugin.settings.enableMOC || !analysisResult.hierarchy) return;
        const mocStructure = this.plugin.mocManager.createHierarchicalStructure(analysisResult.hierarchy);
        for (let i = mocStructure.length - 1; i >= 0; i--) {
            const levelInfo = mocStructure[i];
            if (i < mocStructure.length - 1) await new Promise(resolve => setTimeout(resolve, 5000));
            try {
                await this.plugin.mocManager.mocIntelligence.updateMOCWithIntelligence(levelInfo.path);
            } catch (error) { console.error(`Failed to update MOC: ${levelInfo.title}`); }
        }
    }

    private async getVaultMap(): Promise<string> {
        try {
            const map = await this.plugin.mocManager.loadHierarchy();
            return Object.keys(map).length === 0 ? "No existing MOCs found." : JSON.stringify(map, null, 2);
        } catch (e) { return "Error retrieving vault map."; }
    }
}