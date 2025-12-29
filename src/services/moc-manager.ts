import { App, TFile, TFolder } from 'obsidian';
import { MOCIntelligence } from './moc-intelligence';
import { MOCHierarchy, LearningContext } from '../types';
import { PluginSettings } from '../config';
import { LLMService } from './LLMService';

export class MOCManager {
    private app: App;
    private settings: PluginSettings;
    public mocIntelligence: MOCIntelligence;

    constructor(app: App, settings: PluginSettings, plugin?: any, llmService?: LLMService) {
        this.app = app;
        this.settings = settings;
        this.mocIntelligence = new MOCIntelligence(app, llmService);
    }

    async ensureMOCExists(hierarchy: MOCHierarchy): Promise<string> {
        if (!hierarchy.level1 || !hierarchy.level2) throw new Error('Invalid hierarchy');
        const mocStructure = this.createHierarchicalStructure(hierarchy);

        for (let i = 0; i < mocStructure.length; i++) {
            const levelInfo = mocStructure[i];
            await this.ensureSingleMOCExists(levelInfo);
            if (i > 0) {
                const parentInfo = mocStructure[i - 1];
                await this.updateParentMOCStructure(parentInfo.path, levelInfo);
            }
        }
        return mocStructure[mocStructure.length - 1].path;
    }

    public createHierarchicalStructure(hierarchy: MOCHierarchy): any[] {
        const mocFolder = this.settings.mocFolder || 'MOCs';
        const levels = [];
        levels.push({ level: 1, title: hierarchy.level1, path: `${mocFolder}/00-${hierarchy.level1} MOC.md`, directory: mocFolder });
        const domainDir = `${mocFolder}/${hierarchy.level1}`;
        levels.push({ level: 2, title: hierarchy.level2, path: `${domainDir}/00-${hierarchy.level2} MOC.md`, directory: domainDir });
        return levels;
    }

    private async ensureSingleMOCExists(levelInfo: any): Promise<void> {
        const existingFile = this.app.vault.getAbstractFileByPath(levelInfo.path);
        if (existingFile) return;

        const folder = this.app.vault.getAbstractFileByPath(levelInfo.directory);
        if (!folder) await this.app.vault.createFolder(levelInfo.directory);

        const content = `# ${levelInfo.title}\n\n## Learning Paths\n## Core Concepts\n## Related Topics\n## Prerequisites\n## Notes\n`;
        await this.app.vault.create(levelInfo.path, content);
    }

    private async updateParentMOCStructure(parentPath: string, childInfo: any): Promise<void> {
        const parentFile = this.app.vault.getAbstractFileByPath(parentPath) as TFile;
        if (!parentFile) return;
        let content = await this.app.vault.read(parentFile);
        const link = `- [[00-${childInfo.title} MOC]]`;
        if (content.includes(link)) return;
        await this.app.vault.modify(parentFile, content + link + '\n');
    }

    async getMostSpecificMOCPath(hierarchy: MOCHierarchy): Promise<string> { return this.ensureMOCExists(hierarchy); }
    getMostSpecificMOCDirectory(hierarchy: MOCHierarchy): string { return `${this.settings.mocFolder || 'MOCs'}/${hierarchy.level1}`}

    async updateMOC(mocPath: string, notePath: string, noteTitle: string, context?: LearningContext): Promise<void> {
        const mocFile = this.app.vault.getAbstractFileByPath(mocPath) as TFile;
        if (!mocFile) return;
        let content = await this.app.vault.read(mocFile);
        const link = `- [[${noteTitle}]]`;
        if (!content.includes(link)) await this.app.vault.modify(mocFile, content + link + '\n');
        await this.mocIntelligence.updateMOCWithIntelligence(mocPath);
    }
}