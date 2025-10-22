/**
 * MOC Manager - Extracted from main.ts (incremental extraction)
 * Handles MOC creation, updates, and hierarchy management
 */

import { App, TFile, TFolder } from 'obsidian';
import { MOCIntelligence } from './moc-intelligence';
import { MOCHierarchy, LearningContext } from './src/types';
import { PluginSettings } from './src/config';

export class MOCManager {
    private app: App;
    private settings: PluginSettings;
    private hierarchyManager?: any;
    private mocIntelligence: MOCIntelligence;
    private plugin?: any; // Reference to main plugin for AI service access

    constructor(app: App, settings: PluginSettings, plugin?: any) {
        this.app = app;
        this.settings = settings;
        this.plugin = plugin;
        this.mocIntelligence = new MOCIntelligence(app);
    }

    // Add method to set hierarchyManager reference (required by plugin)
    setHierarchyManager(hierarchyManager: any): void {
        this.hierarchyManager = hierarchyManager;
    }

    // Enhanced ensureMOCExists with MOC creation and parent updates
    async ensureMOCExists(hierarchy: MOCHierarchy): Promise<string> {
        console.log('[MOCManager] 🚀 Starting MOC creation process for:', `${hierarchy.level1} > ${hierarchy.level2}`);
        
        // Validate hierarchy first
        if (!hierarchy.level1 || !hierarchy.level2) {
            throw new Error(`Invalid hierarchy - missing required levels. Level1: ${hierarchy.level1}, Level2: ${hierarchy.level2}`);
        }

        // Create MOC structure for all levels
        const mocStructure = this.createHierarchicalStructure(hierarchy);
        console.log('[MOCManager] 🗂️ MOC structure to create:', mocStructure);

        // Create all MOC levels and update parents
        for (let i = 0; i < mocStructure.length; i++) {
            const levelInfo = mocStructure[i];
            await this.ensureSingleMOCExists(levelInfo, hierarchy, mocStructure);
            
            // Update parent MOC with this child (if not root level)
            if (i > 0) {
                const parentInfo = mocStructure[i - 1];
                await this.updateParentMOCStructure(parentInfo.path, levelInfo);
            }
        }

        // Return the most specific MOC path
        const mostSpecific = mocStructure[mocStructure.length - 1];
        console.log('[MOCManager] 🎯 Most specific MOC path:', mostSpecific.path);
        return mostSpecific.path;
    }

    // Create hierarchical structure info
    private createHierarchicalStructure(hierarchy: MOCHierarchy): any[] {
        const mocFolder = this.settings.mocFolder || 'MOCs';
        const levels = [];

        // Level 1: Domain (in root MOCs folder)
        levels.push({
            level: 1,
            title: hierarchy.level1,
            path: `${mocFolder}/00-${hierarchy.level1.replace(/[\\/:*?"<>|]/g, '_')} MOC.md`,
            directory: mocFolder
        });

        // Level 2: Area (in domain subfolder)
        const domainDir = `${mocFolder}/${hierarchy.level1.replace(/[\\/:*?"<>|]/g, '_')}`;
        levels.push({
            level: 2,
            title: hierarchy.level2,
            path: `${domainDir}/00-${hierarchy.level2.replace(/[\\/:*?"<>|]/g, '_')} MOC.md`,
            directory: domainDir
        });

        // Level 3: Topic (in area subfolder)
        if (hierarchy.level3) {
            const areaDir = `${domainDir}/${hierarchy.level2.replace(/[\\/:*?"<>|]/g, '_')}`;
            levels.push({
                level: 3,
                title: hierarchy.level3,
                path: `${areaDir}/00-${hierarchy.level3.replace(/[\\/:*?"<>|]/g, '_')} MOC.md`,
                directory: areaDir
            });
        }

        // Level 4: Concept (in topic subfolder)
        if (hierarchy.level4) {
            const topicDir = hierarchy.level3
                ? `${domainDir}/${hierarchy.level2.replace(/[\\/:*?"<>|]/g, '_')}/${hierarchy.level3.replace(/[\\/:*?"<>|]/g, '_')}`
                : `${domainDir}/${hierarchy.level2.replace(/[\\/:*?"<>|]/g, '_')}`;
            levels.push({
                level: 4,
                title: hierarchy.level4,
                path: `${topicDir}/00-${hierarchy.level4.replace(/[\\/:*?"<>|]/g, '_')} MOC.md`,
                directory: topicDir
            });
        }

        return levels;
    }

    // AI-powered method to find semantically similar existing MOCs
    private async findSimilarExistingMOC(levelInfo: any, hierarchy: MOCHierarchy): Promise<string | null> {
        try {
            console.log(`[MOCManager] 🤖 Using AI to find similar MOCs for: ${levelInfo.title}`);
            
            // Get all MOC files in the target directory
            const targetDir = levelInfo.directory;
            const folder = this.app.vault.getAbstractFileByPath(targetDir);
            
            if (!folder || !(folder instanceof TFolder)) {
                console.log(`[MOCManager] 📁 Directory doesn't exist yet: ${targetDir}`);
                return null;
            }

            // Find all MOC files in the directory
            const mocFiles = folder.children
                .filter(file => file instanceof TFile && file.name.endsWith('.md') && file.name.startsWith('00-'))
                .map(file => file as TFile);

            if (mocFiles.length === 0) {
                console.log(`[MOCManager] 📂 No existing MOCs found in directory: ${targetDir}`);
                return null;
            }

            // Read existing MOC titles and content for AI comparison
            const existingMOCs = [];
            for (const mocFile of mocFiles) {
                const content = await this.app.vault.read(mocFile);
                const titleMatch = content.match(/^# (.+)$/m);
                const title = titleMatch ? titleMatch[1] : mocFile.basename.replace('00-', '').replace(' MOC', '');
                
                existingMOCs.push({
                    path: mocFile.path,
                    title: title,
                    filename: mocFile.name
                });
            }

            // Use AI to determine if any existing MOC is similar enough
            const aiDecision = await this.askAIForMOCSimilarity(levelInfo.title, existingMOCs, hierarchy);
            
            if (aiDecision.shouldReuse && aiDecision.selectedMOC) {
                console.log(`[MOCManager] ✅ AI decided to reuse existing MOC: ${aiDecision.selectedMOC}`);
                return aiDecision.selectedMOC;
            }

            console.log(`[MOCManager] 🆕 AI decided to create new MOC for: ${levelInfo.title}`);
            return null;

        } catch (error) {
            console.error('[MOCManager] ❌ Error in AI MOC similarity check:', error);
            return null; // Fall back to creating new MOC
        }
    }

    // Ask AI to determine if existing MOCs are similar enough to reuse
    private async askAIForMOCSimilarity(newTitle: string, existingMOCs: any[], hierarchy: MOCHierarchy): Promise<{shouldReuse: boolean, selectedMOC?: string, reasoning?: string}> {
        const prompt = `You are an expert knowledge management system. I need to decide whether to reuse an existing MOC (Map of Content) or create a new one.

**Context:**
- Domain: ${hierarchy.level1}
- Area: ${hierarchy.level2}
- Topic: ${hierarchy.level3 || 'N/A'}
- New concept title: "${newTitle}"

**Existing MOCs in this directory:**
${existingMOCs.map(moc => `- "${moc.title}" (file: ${moc.filename})`).join('\n')}

**Decision criteria:**
- Reuse if the concepts are essentially the same (e.g., "Quantum Electrodynamics" and "Quantum Electrodynamics (QED)")
- Reuse if one is a clear subset/superset of the other
- Create new if they represent distinct concepts, even if related
- Consider scientific/technical naming conventions and abbreviations

**Required response format (JSON only):**
{
  "shouldReuse": boolean,
  "selectedMOC": "path/to/existing/moc.md" or null,
  "reasoning": "brief explanation of decision"
}`;

        try {
            console.log(`[MOCManager] 🤖 Asking AI to decide MOC similarity for: "${newTitle}"`);
            
            // Use the actual AI service instead of hardcoded heuristics
            const aiResponse = await this.makeAIRequest(prompt);
            
            console.log(`[MOCManager] 🤖 AI decision received:`, aiResponse);
            
            // Validate AI response format
            if (typeof aiResponse.shouldReuse === 'boolean') {
                return {
                    shouldReuse: aiResponse.shouldReuse,
                    selectedMOC: aiResponse.selectedMOC || null,
                    reasoning: aiResponse.reasoning || 'AI decision without reasoning'
                };
            } else {
                console.warn('[MOCManager] ⚠️ Invalid AI response format, falling back to no reuse');
                return { 
                    shouldReuse: false, 
                    reasoning: 'Invalid AI response format' 
                };
            }
            
        } catch (error) {
            console.error('[MOCManager] ❌ Error asking AI for MOC similarity:', error);
            return { 
                shouldReuse: false, 
                reasoning: `AI request failed: ${error.message}` 
            };
        }
    }



    // AI service integration - delegate to main plugin's AI service
    private async makeAIRequest(prompt: string): Promise<any> {
        if (!this.plugin) {
            throw new Error('Plugin reference not available for AI requests');
        }

        // Access the AI service through the plugin's view
        const leaves = this.app.workspace.getLeavesOfType('ai-summarizer-summary');
        if (leaves.length === 0) {
            throw new Error('AI Summarizer view not available');
        }

        const view = leaves[0].view as any;
        if (!view.makeAIRequest) {
            throw new Error('AI service not available in view');
        }

        return await view.makeAIRequest(prompt);
    }

    // Ensure a single MOC exists
    private async ensureSingleMOCExists(levelInfo: any, hierarchy: MOCHierarchy, allLevels: any[]): Promise<void> {
        console.log(`[MOCManager] 🔍 Ensuring MOC exists for level ${levelInfo.level}:`, levelInfo.path);

        // First check if exact file already exists
        const existingFile = this.app.vault.getAbstractFileByPath(levelInfo.path);
        if (existingFile) {
            console.log(`[MOCManager] ✅ MOC already exists: ${levelInfo.path}`);
            return;
        }

        // Check for semantically similar existing MOCs using AI
        const similarMOC = await this.findSimilarExistingMOC(levelInfo, hierarchy);
        if (similarMOC) {
            console.log(`[MOCManager] 🎯 Found similar existing MOC: ${similarMOC} - will reuse instead of creating new one`);
            // Update the levelInfo to use the existing MOC path
            levelInfo.path = similarMOC;
            levelInfo.isExisting = true;
            return;
        }

        // Ensure directory exists
        const folder = this.app.vault.getAbstractFileByPath(levelInfo.directory);
        if (!folder) {
            console.log(`[MOCManager] 📁 Creating directory: ${levelInfo.directory}`);
            await this.app.vault.createFolder(levelInfo.directory);
        }

        // Create MOC content
        const mocContent = this.createHierarchicalMOCTemplate(levelInfo, hierarchy, allLevels);
        
        // Create the MOC file
        console.log(`[MOCManager] 📝 Creating MOC file: ${levelInfo.path}`);
        await this.app.vault.create(levelInfo.path, mocContent);
        console.log(`[MOCManager] ✅ MOC created successfully: ${levelInfo.path}`);
    }

    // Create MOC template with hierarchical navigation
    private createHierarchicalMOCTemplate(levelInfo: any, hierarchy: MOCHierarchy, allLevels: any[]): string {
        const timestamp = new Date().toISOString();
        const currentIndex = allLevels.findIndex(l => l.level === levelInfo.level);
        const parentLevel = currentIndex > 0 ? allLevels[currentIndex - 1] : null;
        const childLevels = allLevels.filter(l => l.level > levelInfo.level);

        const frontmatter = {
            type: 'moc',
            title: levelInfo.title,
            domain: hierarchy.level1,
            level: levelInfo.level,
            created: timestamp,
            updated: timestamp,
            tags: ['moc', hierarchy.level1.toLowerCase().replace(/\s+/g, '-'), `level-${levelInfo.level}`],
            note_count: 0,
            learning_paths: []
        };

        let navigationSection = '';

        // Add parent navigation (if not root level)
        if (parentLevel) {
            navigationSection += `## 🔼 Parent Level\n- [[00-${parentLevel.title} MOC]] (${this.getLevelName(parentLevel.level)})\n\n`;
        }

        // Add child navigation (if has children) - This is the Sub-Levels section
        if (childLevels.length > 0) {
            navigationSection += `## 🔽 Sub-Levels\n`;
            childLevels.forEach(child => {
                navigationSection += `- [[00-${child.title} MOC]] (${this.getLevelName(child.level)})\n`;
            });
            navigationSection += '\n';
        }

        const content = `---
${Object.entries(frontmatter)
                .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
                .join('\n')}
---

# ${levelInfo.title}

> [!info] Knowledge ${this.getLevelName(levelInfo.level)}
> This MOC represents the **${levelInfo.title}** ${this.getLevelName(levelInfo.level).toLowerCase()} within the **${hierarchy.level1}** domain.

${navigationSection}## Learning Paths
<!-- Learning paths will be added as content grows -->

## Core Concepts
<!-- Core concepts will be identified as content is added -->

## Related Topics
<!-- Related topics will be added automatically as new notes are created -->

## Prerequisites
<!-- Prerequisites will be populated from note learning contexts -->

## Notes
<!-- Notes will be added automatically to the most specific level -->

---
*This ${this.getLevelName(levelInfo.level)} MOC was automatically generated and will be updated as new content is added.*`;

        return content;
    }

    // Get level name for display
    private getLevelName(level: number): string {
        switch (level) {
            case 1: return 'Domain';
            case 2: return 'Area';
            case 3: return 'Topic';
            case 4: return 'Concept';
            default: return 'Level';
        }
    }

    // Update parent MOC structure with new child
    private async updateParentMOCStructure(parentMocPath: string, childLevelInfo: any): Promise<void> {
        console.log(`[MOCManager] 🔗 Updating parent MOC with child: ${parentMocPath}`);
        
        try {
            const parentFile = this.app.vault.getAbstractFileByPath(parentMocPath) as TFile;
            if (!parentFile) {
                console.log(`[MOCManager] ⚠️ Parent MOC not found: ${parentMocPath}`);
                return;
            }

            let parentContent = await this.app.vault.read(parentFile);
            const childLink = `- [[00-${childLevelInfo.title} MOC]] (${this.getLevelName(childLevelInfo.level)})`;

            // Check if child is already in Sub-Levels section
            if (parentContent.includes(childLink)) {
                console.log(`[MOCManager] ✅ Child already in parent Sub-Levels: ${childLevelInfo.title}`);
                return;
            }

            // Find Sub-Levels section and add child
            const subLevelsMatch = parentContent.match(/(## 🔽 Sub-Levels\n)([\s\S]*?)(?=\n##|$)/);
            if (subLevelsMatch) {
                const existingSubLevels = subLevelsMatch[2];
                const newSubLevels = existingSubLevels.trim() + '\n' + childLink + '\n';
                parentContent = parentContent.replace(subLevelsMatch[0], `## 🔽 Sub-Levels\n${newSubLevels}\n`);
            } else {
                // Add Sub-Levels section if it doesn't exist
                const insertPoint = parentContent.indexOf('## Learning Paths');
                if (insertPoint !== -1) {
                    const subLevelsSection = `## 🔽 Sub-Levels\n${childLink}\n\n`;
                    parentContent = parentContent.slice(0, insertPoint) + subLevelsSection + parentContent.slice(insertPoint);
                }
            }

            await this.app.vault.modify(parentFile, parentContent);
            console.log(`[MOCManager] ✅ Parent MOC updated with child: ${childLevelInfo.title}`);

        } catch (error) {
            console.error(`[MOCManager] ❌ Error updating parent MOC:`, error);
        }
    }

    // Simplified version of getMostSpecificMOCPath
    async getMostSpecificMOCPath(hierarchy: MOCHierarchy): Promise<string> {
        return this.ensureMOCExists(hierarchy);
    }

    // Basic method for getting MOC directory
    getMostSpecificMOCDirectory(hierarchy: MOCHierarchy): string {
        const mocFolder = this.settings.mocFolder || 'MOCs';
        const domainFolder = hierarchy.level1.replace(/[\\/:*?"<>|]/g, '_');
        const areaFolder = hierarchy.level2.replace(/[\\/:*?"<>|]/g, '_');
        
        if (hierarchy.level4 && hierarchy.level3) {
            return `${mocFolder}/${domainFolder}/${areaFolder}/${hierarchy.level3.replace(/[\\/:*?"<>|]/g, '_')}`;
        } else if (hierarchy.level3) {
            return `${mocFolder}/${domainFolder}/${areaFolder}`;
        } else {
            return `${mocFolder}/${domainFolder}`;
        }
    }

    // Enhanced updateMOC method - adds notes to MOC and applies intelligence
    async updateMOC(mocPath: string, notePath: string, noteTitle: string, learningContext?: LearningContext): Promise<void> {
        console.log('[MOCManager] Adding note to MOC:', noteTitle);
        console.log('[MOCManager] MOC path:', mocPath);
        console.log('[MOCManager] Note path:', notePath);
        
        try {
            const mocFile = this.app.vault.getAbstractFileByPath(mocPath) as TFile;
            if (!mocFile) {
                console.error('[MOCManager] ❌ MOC file not found:', mocPath);
                return;
            }

            let content = await this.app.vault.read(mocFile);
            
            // Extract filename for linking
            const noteFileName = notePath.split('/').pop()?.replace('.md', '') || noteTitle;
            const noteLink = `- [[${noteFileName}]]${learningContext ? ` (${learningContext.complexity_level})` : ''}`;

            // Find Notes section and add the note
            const notesSection = content.match(/## Notes\n([\s\S]*?)(?=\n##|\n---|\n\*|$)/);
            if (notesSection) {
                const existingNotes = notesSection[1];
                
                // Check if note is already listed
                if (!existingNotes.includes(noteLink)) {
                    const updatedNotes = existingNotes.trim() === '<!-- Notes will be added automatically to the most specific level -->' 
                        ? noteLink + '\n'
                        : existingNotes.trim() + '\n' + noteLink + '\n';
                    
                    content = content.replace(notesSection[0], `## Notes\n${updatedNotes}\n`);
                    await this.app.vault.modify(mocFile, content);
                    console.log('[MOCManager] ✅ Note added to MOC:', noteTitle);
                } else {
                    console.log('[MOCManager] ✅ Note already in MOC:', noteTitle);
                }
            } else {
                console.warn('[MOCManager] ⚠️ No Notes section found in MOC');
            }

            // Apply intelligence to the MOC
            console.log('[MOCManager] 🧠 Applying intelligence to MOC...');
            await this.mocIntelligence.updateMOCWithIntelligence(mocPath);
            console.log('[MOCManager] ✅ Intelligence applied to MOC');

        } catch (error) {
            console.error('[MOCManager] ❌ Error updating MOC:', error);
        }
    }

    // Cascade intelligence updates from most specific MOC upward through hierarchy
    async cascadeIntelligenceUpward(hierarchy: MOCHierarchy): Promise<void> {
        console.log('[MOCManager] 🔄 Starting cascading intelligence update...');
        
        try {
            // Get all MOC levels in hierarchy
            const mocStructure = this.createHierarchicalStructure(hierarchy);
            
            // Update intelligence for each level, starting from most specific and going up
            for (let i = mocStructure.length - 1; i >= 0; i--) {
                const levelInfo = mocStructure[i];
                console.log(`[MOCManager] 🧠 Updating intelligence for Level ${levelInfo.level}: ${levelInfo.title}`);
                
                try {
                    await this.mocIntelligence.updateMOCWithIntelligence(levelInfo.path);
                    console.log(`[MOCManager] ✅ Intelligence updated for Level ${levelInfo.level}`);
                } catch (error) {
                    console.error(`[MOCManager] ❌ Failed to update intelligence for Level ${levelInfo.level}:`, error);
                    // Continue with other levels even if one fails
                }
            }
            
            console.log('[MOCManager] ✅ Cascading intelligence update complete');
        } catch (error) {
            console.error('[MOCManager] ❌ Error in cascading intelligence update:', error);
        }
    }
}