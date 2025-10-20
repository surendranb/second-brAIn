/**
 * MOC Manager - Core MOC System Operations
 * Handles MOC creation, updates, and hierarchy management
 */

import { App, TFile } from 'obsidian';
import { MOCHierarchy, LearningContext, MOCCreationOptions, MOCUpdateOptions, MOCLevel, MOCType } from './moc-types';
import { HierarchyManager } from './hierarchy-manager';
import { MOCIntelligence } from './moc-intelligence';

export class MOCManager {
    private app: App;
    private hierarchyManager: HierarchyManager;
    private mocIntelligence: MOCIntelligence;
    private mocFolder: string;

    constructor(app: App, settings: any) {
        this.app = app;
        this.hierarchyManager = new HierarchyManager(app, settings);
        this.mocIntelligence = new MOCIntelligence(app);
        this.mocFolder = settings.mocFolder || 'MOCs';
    }

    /**
     * Creates or ensures a MOC exists for the given hierarchy
     */
    async ensureMOCExists(options: MOCCreationOptions): Promise<string> {
        console.log('[MOCManager] 🏗️ Ensuring MOC exists for hierarchy:', options.hierarchy);

        const mocPath = this.generateMOCPath(options.hierarchy);
        const mocFile = this.app.vault.getAbstractFileByPath(mocPath);

        if (mocFile) {
            console.log('[MOCManager] ✅ MOC already exists:', mocPath);
            
            // Update existing MOC if requested
            if (options.add_note || options.apply_intelligence) {
                await this.updateMOC(mocPath, options);
            }
            
            return mocPath;
        }

        // Create new MOC
        console.log('[MOCManager] 🆕 Creating new MOC:', mocPath);
        await this.createMOC(mocPath, options);
        
        return mocPath;
    }

    /**
     * Creates a new MOC file
     */
    private async createMOC(mocPath: string, options: MOCCreationOptions): Promise<void> {
        const mocContent = this.generateMOCContent(options.hierarchy, options.learning_context);
        
        // Ensure directory exists
        const mocDir = mocPath.substring(0, mocPath.lastIndexOf('/'));
        await this.ensureDirectoryExists(mocDir);
        
        // Create the MOC file
        await this.app.vault.create(mocPath, mocContent);
        console.log('[MOCManager] ✅ Created MOC file:', mocPath);

        // Add to hierarchy tracking
        await this.hierarchyManager.addToHierarchy(options.hierarchy);

        // Add note if provided
        if (options.add_note) {
            await this.addNoteToMOC(mocPath, options.add_note.path, options.add_note.title, options.add_note.learning_context);
        }

        // Apply intelligence if requested
        if (options.apply_intelligence) {
            await this.mocIntelligence.updateMOCWithIntelligence(mocPath);
        }

        // Update parent MOCs if requested
        if (options.update_parents) {
            await this.updateParentMOCStructure(options.hierarchy);
        }
    }

    /**
     * Updates an existing MOC
     */
    async updateMOC(mocPath: string, options: MOCUpdateOptions): Promise<void> {
        console.log('[MOCManager] 🔄 Updating MOC:', mocPath);

        // Add note if provided
        if (options.add_note) {
            await this.addNoteToMOC(mocPath, options.add_note.path, options.add_note.title, options.add_note.learning_context);
        }

        // Apply intelligence if requested
        if (options.apply_intelligence) {
            await this.mocIntelligence.updateMOCWithIntelligence(mocPath);
        }

        // Update parent MOCs if requested
        if (options.update_parents) {
            const mocFile = this.app.vault.getAbstractFileByPath(mocPath) as TFile;
            if (mocFile) {
                const content = await this.app.vault.read(mocFile);
                const hierarchy = this.extractHierarchyFromMOC(content);
                if (hierarchy) {
                    await this.updateParentMOCStructure(hierarchy);
                }
            }
        }
    }

    /**
     * Adds a note to a MOC's Notes section
     */
    private async addNoteToMOC(mocPath: string, notePath: string, noteTitle: string, learningContext?: LearningContext): Promise<void> {
        const mocFile = this.app.vault.getAbstractFileByPath(mocPath) as TFile;
        if (!mocFile) return;

        let content = await this.app.vault.read(mocFile);
        
        // Find the Notes section
        const notesSection = content.indexOf('## Notes');
        if (notesSection === -1) {
            console.warn('[MOCManager] No Notes section found in MOC:', mocPath);
            return;
        }

        // Add the note link
        const complexityLevel = learningContext?.complexity_level || 'intermediate';
        const noteLink = `- [[${noteTitle}]] (${complexityLevel})`;
        
        // Insert the note link
        const insertPoint = content.indexOf('\n', notesSection + 8); // After "## Notes"
        content = content.substring(0, insertPoint) + '\n' + noteLink + content.substring(insertPoint);
        
        await this.app.vault.modify(mocFile, content);
        console.log('[MOCManager] ✅ Added note to MOC:', noteTitle);
    }

    /**
     * Updates parent MOC structures to include new child MOCs
     */
    private async updateParentMOCStructure(hierarchy: MOCHierarchy): Promise<void> {
        console.log('[MOCManager] 🔗 Updating parent MOC structure for:', hierarchy);

        // Update each parent level
        if (hierarchy.level4) {
            // Update level 3 parent
            const parentHierarchy = { level1: hierarchy.level1, level2: hierarchy.level2, level3: hierarchy.level3 };
            await this.addChildToParentMOC(parentHierarchy, hierarchy.level4, 'concept');
        }
        
        if (hierarchy.level3) {
            // Update level 2 parent
            const parentHierarchy = { level1: hierarchy.level1, level2: hierarchy.level2 };
            await this.addChildToParentMOC(parentHierarchy, hierarchy.level3, 'topic');
        }
        
        if (hierarchy.level2) {
            // Update level 1 parent
            const parentHierarchy = { level1: hierarchy.level1, level2: '' };
            await this.addChildToParentMOC(parentHierarchy, hierarchy.level2, 'area');
        }
    }

    /**
     * Adds a child MOC to a parent's Sub-Levels section
     */
    private async addChildToParentMOC(parentHierarchy: MOCHierarchy, childName: string, childType: MOCType): Promise<void> {
        const parentPath = this.generateMOCPath(parentHierarchy);
        const parentFile = this.app.vault.getAbstractFileByPath(parentPath) as TFile;
        
        if (!parentFile) {
            console.log('[MOCManager] ⚠️ Parent MOC not found:', parentPath);
            return;
        }

        let content = await this.app.vault.read(parentFile);
        
        // Find the Sub-Levels section
        const subLevelsMatch = content.match(/## 🔽 Sub-Levels\n([\s\S]*?)(?=\n##|\n---|\n\*|$)/);
        if (!subLevelsMatch) {
            console.log('[MOCManager] ⚠️ No Sub-Levels section found in parent MOC:', parentPath);
            return;
        }

        const subLevelsContent = subLevelsMatch[1];
        const childMOCName = `00-${childName} MOC`;
        const childLink = `- [[${childMOCName}]] (${this.capitalizeFirst(childType)})`;

        // Check if child already exists
        if (subLevelsContent.includes(childMOCName)) {
            console.log('[MOCManager] ✅ Child already exists in parent Sub-Levels:', childName);
            return;
        }

        // Add the child link
        const newSubLevelsContent = subLevelsContent.trim() + '\n' + childLink;
        content = content.replace(subLevelsMatch[0], `## 🔽 Sub-Levels\n${newSubLevelsContent}\n`);
        
        await this.app.vault.modify(parentFile, content);
        console.log('[MOCManager] ✅ Added child to parent Sub-Levels:', childName, '→', parentPath);
    }

    /**
     * Generates the file path for a MOC based on its hierarchy
     */
    private generateMOCPath(hierarchy: MOCHierarchy): string {
        let path = this.mocFolder;
        
        if (hierarchy.level1) path += `/${hierarchy.level1}`;
        if (hierarchy.level2) path += `/${hierarchy.level2}`;
        if (hierarchy.level3) path += `/${hierarchy.level3}`;
        
        // Determine the MOC name based on the deepest level
        let mocName = '';
        if (hierarchy.level4) {
            mocName = `00-${hierarchy.level4} MOC.md`;
        } else if (hierarchy.level3) {
            mocName = `00-${hierarchy.level3} MOC.md`;
        } else if (hierarchy.level2) {
            mocName = `00-${hierarchy.level2} MOC.md`;
        } else {
            mocName = `00-${hierarchy.level1} MOC.md`;
        }
        
        return `${path}/${mocName}`;
    }

    /**
     * Generates MOC content based on hierarchy and learning context
     */
    private generateMOCContent(hierarchy: MOCHierarchy, learningContext?: LearningContext): string {
        const level = this.getMOCLevel(hierarchy);
        const type = this.getMOCType(level);
        const title = this.getMOCTitle(hierarchy);
        
        return `---
type: "moc"
title: "${title}"
domain: "${hierarchy.level1}"
level: ${level}
created: "${new Date().toISOString()}"
updated: "${new Date().toISOString()}"
tags: ["moc","${hierarchy.level1.toLowerCase()}","level-${level}"]
note_count: 0
learning_paths: []
---

# ${title}

> [!info] Knowledge ${this.capitalizeFirst(type)}
> This MOC represents the **${title}** ${type} within the **${hierarchy.level1}** domain.
${level === 4 ? `> This is the most specific level for **${title}** concepts.` : ''}

${this.generateParentLink(hierarchy)}

## 🔄 Related Concepts
<!-- Related concepts will be linked here automatically -->

## Learning Paths
${this.generateLearningPaths(hierarchy, learningContext)}

## Core Concepts
- [[00-${title} MOC]]

## Related Topics
<!-- Related topics will be added automatically as new notes are created -->

${this.generatePrerequisites(learningContext)}

## Notes
<!-- Notes will be added automatically to the most specific level -->

---
*This ${this.capitalizeFirst(type)} MOC was automatically generated and will be updated as new content is added.*`;
    }

    /**
     * Helper methods
     */
    private getMOCLevel(hierarchy: MOCHierarchy): MOCLevel {
        if (hierarchy.level4) return 4;
        if (hierarchy.level3) return 3;
        if (hierarchy.level2) return 2;
        return 1;
    }

    private getMOCType(level: MOCLevel): MOCType {
        switch (level) {
            case 1: return 'domain';
            case 2: return 'area';
            case 3: return 'topic';
            case 4: return 'concept';
        }
    }

    private getMOCTitle(hierarchy: MOCHierarchy): string {
        if (hierarchy.level4) return hierarchy.level4;
        if (hierarchy.level3) return hierarchy.level3;
        if (hierarchy.level2) return hierarchy.level2;
        return hierarchy.level1;
    }

    private generateParentLink(hierarchy: MOCHierarchy): string {
        if (hierarchy.level4 && hierarchy.level3) {
            return `## 🔼 Parent Level\n- [[00-${hierarchy.level3} MOC]] (Topic)\n\n`;
        }
        if (hierarchy.level3 && hierarchy.level2) {
            return `## 🔼 Parent Level\n- [[00-${hierarchy.level2} MOC]] (Area)\n\n`;
        }
        if (hierarchy.level2 && hierarchy.level1) {
            return `## 🔼 Parent Level\n- [[00-${hierarchy.level1} MOC]] (Domain)\n\n`;
        }
        return '';
    }

    private generateLearningPaths(hierarchy: MOCHierarchy, learningContext?: LearningContext): string {
        const paths = [];
        
        if (hierarchy.level2) paths.push(`- [[${hierarchy.level2} Learning Path]]`);
        if (hierarchy.level3) paths.push(`- [[${hierarchy.level3} Learning Path]]`);
        if (hierarchy.level4) paths.push(`- [[${hierarchy.level4} Learning Path]]`);
        
        return paths.length > 0 ? paths.join('\n') : '<!-- Learning paths will be generated automatically -->';
    }

    private generatePrerequisites(learningContext?: LearningContext): string {
        if (!learningContext?.prerequisites || learningContext.prerequisites.length === 0) {
            return '## Prerequisites\n<!-- Prerequisites will be populated from note learning contexts -->\n';
        }
        
        const prereqs = learningContext.prerequisites.map(p => `- [[${p}]]`).join('\n');
        return `## Prerequisites\n${prereqs}\n`;
    }

    private capitalizeFirst(str: string): string {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    private async ensureDirectoryExists(dirPath: string): Promise<void> {
        const parts = dirPath.split('/');
        let currentPath = '';
        
        for (const part of parts) {
            currentPath += (currentPath ? '/' : '') + part;
            const folder = this.app.vault.getAbstractFileByPath(currentPath);
            
            if (!folder) {
                await this.app.vault.createFolder(currentPath);
            }
        }
    }

    private extractHierarchyFromMOC(content: string): MOCHierarchy | null {
        // Extract hierarchy from MOC frontmatter or content
        const domainMatch = content.match(/domain:\s*"([^"]+)"/);
        if (!domainMatch) return null;

        // This is a simplified extraction - could be enhanced
        return {
            level1: domainMatch[1],
            level2: '' // Would need more sophisticated parsing
        };
    }
}