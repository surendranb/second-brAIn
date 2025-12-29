import { App, TFile, TFolder, parseYaml, stringifyYaml } from 'obsidian';
import { MOCIntelligence } from './moc-intelligence';
import { MOCHierarchy, LearningContext } from '../types';
import { PluginSettings } from '../config';
import { LLMService } from './LLMService';

export class MOCManager {
    private app: App;
    private settings: PluginSettings;
    public mocIntelligence: MOCIntelligence;
    private hierarchyPath: string;

    constructor(app: App, settings: PluginSettings, plugin?: any, llmService?: LLMService) {
        this.app = app;
        this.settings = settings;
        this.mocIntelligence = new MOCIntelligence(app, llmService);
        this.hierarchyPath = `${this.settings.mocFolder || 'MOCs'}/hierarchy.yaml`;
    }

    async ensureMOCExists(hierarchy: MOCHierarchy, description?: string): Promise<string> {
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
        
        await this.updatePersistedHierarchy(hierarchy, description);
        return mocStructure[mocStructure.length - 1].path;
    }

    async loadHierarchy(): Promise<any> {
        try {
            const file = this.app.vault.getAbstractFileByPath(this.hierarchyPath);
            if (file instanceof TFile) {
                const content = await this.app.vault.read(file);
                return parseYaml(content) || {};
            }
        } catch (e) {}
        return {};
    }

    private async updatePersistedHierarchy(hierarchy: MOCHierarchy, description?: string): Promise<void> {
        const map = await this.loadHierarchy();
        // Truncate to 50 chars to keep the map as a 'index' not a 'database'
        const cleanDesc = description ? description.substring(0, 50).replace(/\n/g, ' ').trim() + "..." : "Concept";
        
        if (!map[hierarchy.level1]) map[hierarchy.level1] = {};
        let current = map[hierarchy.level1];

        if (hierarchy.level2) {
            if (!current[hierarchy.level2]) current[hierarchy.level2] = {};
            current = current[hierarchy.level2];
        }

        if (hierarchy.level3) {
            if (!current[hierarchy.level3]) current[hierarchy.level3] = {};
            current = current[hierarchy.level3];
        }

        if (hierarchy.level4) {
            // Only update if not already set or if explicitly updating
            if (!current[hierarchy.level4] || current[hierarchy.level4] === "Concept") {
                current[hierarchy.level4] = cleanDesc;
            }
        }

        await this.saveHierarchy(map);
    }

    private async saveHierarchy(map: any): Promise<void> {
        const content = stringifyYaml(map);
        const file = this.app.vault.getAbstractFileByPath(this.hierarchyPath);
        if (file instanceof TFile) {
            await this.app.vault.modify(file, content);
        } else {
            await this.app.vault.create(this.hierarchyPath, content);
        }
    }

    public createHierarchicalStructure(hierarchy: MOCHierarchy): any[] {
        const mocFolder = this.settings.mocFolder || 'MOCs';
        const levels = [];

        // Level 1: Domain
        const lvl1 = { 
            level: 1, 
            title: hierarchy.level1, 
            path: `${mocFolder}/00-${hierarchy.level1} MOC.md`, 
            directory: mocFolder 
        };
        levels.push(lvl1);

        // Level 2: Area
        const domainDir = `${mocFolder}/${hierarchy.level1}`;
        const lvl2 = { 
            level: 2, 
            title: hierarchy.level2, 
            path: `${domainDir}/00-${hierarchy.level2} MOC.md`, 
            directory: domainDir 
        };
        levels.push(lvl2);

        // Level 3: Topic
        if (hierarchy.level3) {
            const areaDir = `${domainDir}/${hierarchy.level2}`;
            const lvl3 = {
                level: 3,
                title: hierarchy.level3,
                path: `${areaDir}/00-${hierarchy.level3} MOC.md`,
                directory: areaDir
            };
            levels.push(lvl3);

            // Level 4: Concept
            if (hierarchy.level4) {
                const topicDir = `${areaDir}/${hierarchy.level3}`;
                const lvl4 = {
                    level: 4,
                    title: hierarchy.level4,
                    path: `${topicDir}/00-${hierarchy.level4} MOC.md`,
                    directory: topicDir
                };
                levels.push(lvl4);
            }
        }

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

    async getMostSpecificMOCPath(hierarchy: MOCHierarchy): Promise<string> { 
        const structure = this.createHierarchicalStructure(hierarchy);
        return structure[structure.length - 1].path;
    }

    getMostSpecificMOCDirectory(hierarchy: MOCHierarchy): string {
        const structure = this.createHierarchicalStructure(hierarchy);
        return structure[structure.length - 1].directory;
    }

    async updateMOC(mocPath: string, notePath: string, noteTitle: string, context?: LearningContext): Promise<void> {
        const mocFile = this.app.vault.getAbstractFileByPath(mocPath) as TFile;
        if (!mocFile) return;
        let content = await this.app.vault.read(mocFile);
        const link = `- [[${noteTitle}]]`;
        if (!content.includes(link)) await this.app.vault.modify(mocFile, content + link + '\n');
        await this.mocIntelligence.updateMOCWithIntelligence(mocPath);
    }
}
