import { App, TFile } from 'obsidian';
import { MOCHierarchy, LearningContext } from '../types';
import { LLMService } from './LLMService';

export interface MOCAnalysis {
    overview: string;
    keyThemes: string[];
    conceptualRelationships: string;
    learningProgress: string;
    knowledgeGaps: string[];
    crossDomainConnections: string[];
    synthesizedInsights: string[];
    learningPaths: string[];
    coreConcepts: string[];
    relatedTopics: string[];
    prerequisites: string[];
    noteReferences: NoteReference[];
}

export interface NoteReference {
    title: string;
    path: string;
    complexity: string;
}

export interface MOCNote {
    title: string;
    content: string;
    learningContext?: LearningContext;
    hierarchy: MOCHierarchy;
}

export class MOCIntelligence {
    private app: App;
    private llmService?: LLMService;

    constructor(app: App, llmService?: LLMService) {
        this.app = app;
        this.llmService = llmService;
    }

    setLLMService(llmService: LLMService): void {
        this.llmService = llmService;
    }

    async updateMOCWithIntelligence(mocPath: string): Promise<void> {
        try {
            const notes = await this.extractNotesFromMOC(mocPath);
            if (notes.length === 0) return;

            const analysis = await this.synthesizeNotes(notes, mocPath);
            await this.applyAnalysisToMOC(mocPath, analysis);
        } catch (error) {
            console.error('MOC intelligence update failed:', error);
        }
    }

    private async synthesizeNotes(notes: MOCNote[], mocPath: string): Promise<MOCAnalysis> {
        const noteSummaries = notes.map(note => ({
            title: note.title,
            summary: this.extractSummaryFromNote(note.content),
            keyTopics: this.extractTopicsFromNote(note.content),
            complexity: note.learningContext?.complexity_level || 'intermediate'
        }));

        try {
            const mocFile = this.app.vault.getAbstractFileByPath(mocPath) as TFile;
            const existingContent = mocFile ? await this.app.vault.read(mocFile) : '';
            return await this.generateAISynthesis(noteSummaries, existingContent, notes);
        } catch (error) {
            return this.generateAccurateAnalysisFromNotes(notes, noteSummaries);
        }
    }

    private async generateAISynthesis(noteSummaries: any[], existingMOCContent?: string, fullNotes?: MOCNote[]): Promise<MOCAnalysis> {
        const prompt = this.createUpdatePrompt(noteSummaries, existingMOCContent);
        
        if (!this.llmService) throw new Error('LLMService required');
        const response = await this.llmService.generateText({ prompt, metadata: { type: 'moc-synthesis' } });
        
        let cleanedText = response.text.trim();
        if (cleanedText.startsWith('```json')) {
            cleanedText = cleanedText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        } else if (cleanedText.startsWith('```')) {
            cleanedText = cleanedText.replace(/^```\s*/, '').replace(/\s*```$/, '');
        }
        
        const aiResponse = JSON.parse(cleanedText);
        const templateSections = this.extractTemplateSections(fullNotes || []);

        return {
            overview: aiResponse.overview || '',
            keyThemes: this.ensureStringArray(aiResponse.keyThemes),
            conceptualRelationships: aiResponse.conceptualRelationships || '',
            learningProgress: aiResponse.learningProgress || '',
            knowledgeGaps: this.ensureStringArray(aiResponse.knowledgeGaps),
            crossDomainConnections: this.ensureStringArray(aiResponse.crossDomainConnections),
            synthesizedInsights: this.ensureStringArray(aiResponse.synthesizedInsights),
            learningPaths: templateSections.learningPaths,
            coreConcepts: templateSections.coreConcepts,
            relatedTopics: templateSections.relatedTopics,
            prerequisites: templateSections.prerequisites,
            noteReferences: templateSections.noteReferences
        };
    }

    private createUpdatePrompt(noteSummaries: any[], existingMOCContent?: string): string {
        return `You are a Knowledge Weaver. Analyze these notes and update the MOC intelligence. 
        
RELATIONSHIP TYPES TO IDENTIFY:
- requiresFoundation: [A] must be known to understand [B]
- scalesTo: How [A] applies at a macro level
- contradicts: New data that challenges existing notes

NEW NOTES: ${JSON.stringify(noteSummaries)}

Return ONLY valid JSON with these keys: overview, keyThemes, conceptualRelationships, learningProgress, knowledgeGaps, crossDomainConnections, synthesizedInsights`;
    }

    private async extractNotesFromMOC(mocPath: string): Promise<MOCNote[]> {
        const mocFile = this.app.vault.getAbstractFileByPath(mocPath) as TFile;
        if (!mocFile) return [];
        const mocContent = await this.app.vault.read(mocFile);
        const notes: MOCNote[] = [];
        
        const noteLinks = mocContent.match(/- \[ \[ ([^\]]+) \] \]/g);
        if (noteLinks) {
            const allFiles = this.app.vault.getMarkdownFiles();
            for (const link of noteLinks) {
                const title = link.match(/ \[ \[ ([^\]]+) \] \] /)?.[1];
                if (!title) continue;
                const noteFile = allFiles.find(f => f.basename === title);
                if (noteFile) {
                    const content = await this.app.vault.read(noteFile);
                    notes.push({ title, content, hierarchy: { level1:'', level2:'' } });
                }
            }
        }
        return notes;
    }

    private async applyAnalysisToMOC(mocPath: string, analysis: MOCAnalysis): Promise<void> {
        const mocFile = this.app.vault.getAbstractFileByPath(mocPath) as TFile;
        if (!mocFile) return;
        let content = await this.app.vault.read(mocFile);
        content = this.updateTemplateSections(content, analysis);
        await this.app.vault.modify(mocFile, content);
    }

    private updateTemplateSections(content: string, analysis: MOCAnalysis): string {
        const sections = [
            { name: 'Learning Paths', data: analysis.learningPaths.map(p => `- ${p}`) },
            { name: 'Core Concepts', data: analysis.coreConcepts.map(c => `- [[${c}]]`) },
            { name: 'Related Topics', data: analysis.relatedTopics.map(t => `- [[${t}]]`) },
            { name: 'Prerequisites', data: analysis.prerequisites.map(p => `- ${p}`) },
            { name: 'Notes', data: analysis.noteReferences.map(n => `- ${n.path} (${n.complexity})`) }
        ];

        for (const section of sections) {
            if (section.data.length > 0) {
                const marker = `## ${section.name}\n`;
                const start = content.indexOf(marker);
                if (start !== -1) {
                    const next = content.indexOf('\n## ', start + 1);
                    const end = next !== -1 ? next : content.length;
                    content = content.substring(0, start + marker.length) + section.data.join('\n') + '\n\n' + content.substring(end);
                }
            }
        }
        return content;
    }

    private ensureStringArray(val: any): string[] {
        return Array.isArray(val) ? val.map(String) : [];
    }

    private extractSummaryFromNote(content: string): string { return content.substring(0, 200); }
    private extractTopicsFromNote(content: string): string[] { return []; }
    
    private extractTemplateSections(notes: MOCNote[]): any {
        const res = { learningPaths: [] as string[], coreConcepts: [] as string[], relatedTopics: [] as string[], prerequisites: [] as string[], noteReferences: [] as NoteReference[] };
        notes.forEach(n => {
            res.noteReferences.push({ title: n.title, path: `[[${n.title}]]`, complexity: 'intermediate' });
        });
        return res;
    }

    private generateAccurateAnalysisFromNotes(notes: MOCNote[], summaries: any[]): MOCAnalysis {
        return {
            overview: `Knowledge area with ${notes.length} notes.`, 
            keyThemes: [],
            conceptualRelationships: 'Relationships emerging.',
            learningProgress: 'Analysis in progress.',
            knowledgeGaps: [],
            crossDomainConnections: [],
            synthesizedInsights: [],
            learningPaths: [],
            coreConcepts: [],
            relatedTopics: [],
            prerequisites: [],
            noteReferences: notes.map(n => ({ title: n.title, path: `[[${n.title}]]`, complexity: 'intermediate' }))
        };
    }
    
    private createEmptyAnalysis(): any { 
        return { learningPaths: [], coreConcepts: [], relatedTopics: [], prerequisites: [], noteReferences: [] }; 
    }
}
