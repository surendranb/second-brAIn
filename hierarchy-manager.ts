interface HierarchyNode {
    level: number;
    noteCount?: number;
    children?: { [key: string]: HierarchyNode };
    conflict?: string;
    suggestion?: string;
    path?: string;
}

interface HierarchyConflict {
    concept: string;
    locations: Array<{
        path: string;
        level: number;
    }>;
    recommendation: string;
}

interface CentralHierarchy {
    domains: { [key: string]: HierarchyNode };
    conflicts: HierarchyConflict[];
    lastUpdated: string;
    totalMOCs: number;
}

export class HierarchyManager {
    private app: App;
    private settings: PluginSettings;
    private hierarchyFile: string;

    constructor(app: App, settings: PluginSettings) {
        this.app = app;
        this.settings = settings;
        this.hierarchyFile = `${settings.mocFolder || 'MOCs'}/hierarchy.json`;
    }

    async loadHierarchy(): Promise<CentralHierarchy> {
        try {
            const file = this.app.vault.getAbstractFileByPath(this.hierarchyFile);
            if (file) {
                const content = await this.app.vault.read(file as TFile);
                return JSON.parse(content);
            }
        } catch (error) {
            console.log('[HierarchyManager] No existing hierarchy file, creating new one');
        }

        // Return empty hierarchy if file doesn't exist
        return {
            domains: {},
            conflicts: [],
            lastUpdated: new Date().toISOString(),
            totalMOCs: 0
        };
    }

    async saveHierarchy(hierarchy: CentralHierarchy): Promise<void> {
        hierarchy.lastUpdated = new Date().toISOString();
        const content = JSON.stringify(hierarchy, null, 2);
        
        try {
            const file = this.app.vault.getAbstractFileByPath(this.hierarchyFile);
            if (file) {
                await this.app.vault.modify(file as TFile, content);
            } else {
                await this.app.vault.create(this.hierarchyFile, content);
            }
            console.log('[HierarchyManager] Hierarchy saved successfully');
        } catch (error) {
            console.error('[HierarchyManager] Error saving hierarchy:', error);
        }
    }

    async addToHierarchy(mocHierarchy: MOCHierarchy): Promise<void> {
        const hierarchy = await this.loadHierarchy();
        
        // Normalize the MOC hierarchy first
        const normalized = this.normalizeMOCHierarchy(mocHierarchy);
        
        // Check for conflicts before adding
        const conflicts = this.detectConflicts(hierarchy, normalized);
        
        if (conflicts.length > 0) {
            console.log('[HierarchyManager] Conflicts detected:', conflicts);
            // Add to conflicts array but also add to hierarchy with conflict markers
            hierarchy.conflicts.push(...conflicts);
        }

        // Add to hierarchy structure
        this.addNodeToHierarchy(hierarchy, normalized);
        
        // Update metadata
        hierarchy.totalMOCs++;
        
        await this.saveHierarchy(hierarchy);
    }

    private addNodeToHierarchy(hierarchy: CentralHierarchy, mocHierarchy: MOCHierarchy): void {
        // Ensure domain exists
        if (!hierarchy.domains[mocHierarchy.level1]) {
            hierarchy.domains[mocHierarchy.level1] = {
                level: 1,
                noteCount: 0,
                children: {},
                path: mocHierarchy.level1
            };
        }

        let current = hierarchy.domains[mocHierarchy.level1];

        // Add level 2 if exists
        if (mocHierarchy.level2) {
            if (!current.children) current.children = {};
            if (!current.children[mocHierarchy.level2]) {
                current.children[mocHierarchy.level2] = {
                    level: 2,
                    noteCount: 0,
                    children: {},
                    path: `${mocHierarchy.level1} > ${mocHierarchy.level2}`
                };
            }
            current = current.children[mocHierarchy.level2];
        }

        // Add level 3 if exists
        if (mocHierarchy.level3) {
            if (!current.children) current.children = {};
            if (!current.children[mocHierarchy.level3]) {
                current.children[mocHierarchy.level3] = {
                    level: 3,
                    noteCount: 0,
                    children: {},
                    path: `${mocHierarchy.level1} > ${mocHierarchy.level2} > ${mocHierarchy.level3}`
                };
            }
            current = current.children[mocHierarchy.level3];
        }

        // Add level 4 if exists
        if (mocHierarchy.level4) {
            if (!current.children) current.children = {};
            if (!current.children[mocHierarchy.level4]) {
                current.children[mocHierarchy.level4] = {
                    level: 4,
                    noteCount: 0,
                    path: `${mocHierarchy.level1} > ${mocHierarchy.level2} > ${mocHierarchy.level3} > ${mocHierarchy.level4}`
                };
            }
        }
    }

    private detectConflicts(hierarchy: CentralHierarchy, newHierarchy: MOCHierarchy): HierarchyConflict[] {
        const conflicts: HierarchyConflict[] = [];
        
        // Check if any level appears elsewhere in the hierarchy
        const levels = [newHierarchy.level1, newHierarchy.level2, newHierarchy.level3, newHierarchy.level4].filter(Boolean);
        
        for (const level of levels) {
            const existingLocations = this.findConceptInHierarchy(hierarchy, level!);
            if (existingLocations.length > 0) {
                // Add the new location
                const newLocation = this.getNewLocation(newHierarchy, level!);
                if (newLocation && !existingLocations.some(loc => loc.path === newLocation.path)) {
                    conflicts.push({
                        concept: level!,
                        locations: [...existingLocations, newLocation],
                        recommendation: this.generateRecommendation(existingLocations, newLocation)
                    });
                }
            }
        }
        
        return conflicts;
    }

    private findConceptInHierarchy(hierarchy: CentralHierarchy, concept: string): Array<{path: string, level: number}> {
        const locations: Array<{path: string, level: number}> = [];
        
        // Search through all domains
        for (const [domainName, domain] of Object.entries(hierarchy.domains)) {
            if (domainName === concept) {
                locations.push({ path: domainName, level: domain.level });
            }
            this.searchInChildren(domain.children || {}, concept, domainName, locations);
        }
        
        return locations;
    }

    private searchInChildren(
        children: { [key: string]: HierarchyNode }, 
        concept: string, 
        parentPath: string, 
        locations: Array<{path: string, level: number}>
    ): void {
        for (const [childName, child] of Object.entries(children)) {
            const currentPath = `${parentPath} > ${childName}`;
            if (childName === concept) {
                locations.push({ path: currentPath, level: child.level });
            }
            if (child.children) {
                this.searchInChildren(child.children, concept, currentPath, locations);
            }
        }
    }

    private getNewLocation(hierarchy: MOCHierarchy, concept: string): {path: string, level: number} | null {
        if (hierarchy.level1 === concept) return { path: concept, level: 1 };
        if (hierarchy.level2 === concept) return { path: `${hierarchy.level1} > ${concept}`, level: 2 };
        if (hierarchy.level3 === concept) return { path: `${hierarchy.level1} > ${hierarchy.level2} > ${concept}`, level: 3 };
        if (hierarchy.level4 === concept) return { path: `${hierarchy.level1} > ${hierarchy.level2} > ${hierarchy.level3} > ${concept}`, level: 4 };
        return null;
    }

    private generateRecommendation(existingLocations: Array<{path: string, level: number}>, newLocation: {path: string, level: number}): string {
        // Find the highest level (closest to root) existing location
        const highestLevel = Math.min(...existingLocations.map(loc => loc.level));
        const preferredLocation = existingLocations.find(loc => loc.level === highestLevel);
        
        if (preferredLocation && preferredLocation.level < newLocation.level) {
            return `Use existing Level ${preferredLocation.level} location: "${preferredLocation.path}" instead of creating new Level ${newLocation.level} location`;
        }
        
        return `Consider consolidating these locations or choosing the most appropriate level`;
    }

    async getHierarchyContextForAI(): Promise<string> {
        const hierarchy = await this.loadHierarchy();
        
        if (Object.keys(hierarchy.domains).length === 0) {
            return "No existing hierarchy found. This will be the first MOC in the knowledge base.";
        }

        let context = "COMPLETE KNOWLEDGE HIERARCHY:\n\n";
        
        // Add hierarchy structure
        for (const [domainName, domain] of Object.entries(hierarchy.domains)) {
            context += `${domainName} (Level ${domain.level})\n`;
            if (domain.children) {
                context += this.formatChildren(domain.children, 1);
            }
            context += '\n';
        }

        // Add conflicts section if any exist
        if (hierarchy.conflicts.length > 0) {
            context += "\n⚠️ EXISTING CONFLICTS:\n";
            hierarchy.conflicts.forEach(conflict => {
                context += `\n"${conflict.concept}" appears at multiple levels:\n`;
                conflict.locations.forEach(loc => {
                    context += `  - Level ${loc.level}: ${loc.path}\n`;
                });
                context += `  RECOMMENDATION: ${conflict.recommendation}\n`;
            });
        }

        context += `\nSummary: ${hierarchy.totalMOCs} MOCs across ${Object.keys(hierarchy.domains).length} domains\n`;
        context += `Last updated: ${hierarchy.lastUpdated}\n\n`;
        
        context += "PLACEMENT RULES:\n";
        context += "1. ALWAYS check if concept already exists before creating new location\n";
        context += "2. If concept exists at higher level (Level 1-2), USE THAT instead of creating sub-level\n";
        context += "3. Only create new Level 1 domains for truly distinct fields\n";
        context += "4. Prefer nesting under existing relevant domains\n";

        return context;
    }

    private formatChildren(children: { [key: string]: HierarchyNode }, indent: number): string {
        let result = '';
        const spaces = '  '.repeat(indent);
        
        for (const [childName, child] of Object.entries(children)) {
            result += `${spaces}${childName} (Level ${child.level})`;
            if (child.conflict) {
                result += ` ⚠️ CONFLICT: ${child.conflict}`;
            }
            result += '\n';
            
            if (child.children) {
                result += this.formatChildren(child.children, indent + 1);
            }
        }
        
        return result;
    }

    private normalizeMOCHierarchy(hierarchy: MOCHierarchy): MOCHierarchy {
        const normalize = (str: string) => {
            return str.trim()
                .replace(/[&]/g, 'and')
                .replace(/[^\w\s-]/g, '')
                .replace(/\s+/g, ' ')
                .replace(/\bSciences\b/g, 'Science')
                .replace(/\bStudies\b/g, 'Study')
                .replace(/\bTechnologies\b/g, 'Technology')
                .replace(/\bHistories\b/g, 'History')
                .trim();
        };

        return {
            level1: normalize(hierarchy.level1),
            level2: hierarchy.level2 ? normalize(hierarchy.level2) : hierarchy.level2,
            level3: hierarchy.level3 ? normalize(hierarchy.level3) : hierarchy.level3,
            level4: hierarchy.level4 ? normalize(hierarchy.level4) : hierarchy.level4
        };
    }

    async incrementNoteCount(hierarchy: MOCHierarchy): Promise<void> {
        const centralHierarchy = await this.loadHierarchy();
        const normalized = this.normalizeMOCHierarchy(hierarchy);
        
        // Find the most specific node and increment its note count
        const node = this.findMostSpecificNode(centralHierarchy, normalized);
        if (node) {
            node.noteCount = (node.noteCount || 0) + 1;
            await this.saveHierarchy(centralHierarchy);
        }
    }

    private findMostSpecificNode(hierarchy: CentralHierarchy, mocHierarchy: MOCHierarchy): HierarchyNode | null {
        let current = hierarchy.domains[mocHierarchy.level1];
        if (!current) return null;

        if (mocHierarchy.level2 && current.children && current.children[mocHierarchy.level2]) {
            current = current.children[mocHierarchy.level2];
            
            if (mocHierarchy.level3 && current.children && current.children[mocHierarchy.level3]) {
                current = current.children[mocHierarchy.level3];
                
                if (mocHierarchy.level4 && current.children && current.children[mocHierarchy.level4]) {
                    current = current.children[mocHierarchy.level4];
                }
            }
        }

        return current;
    }
}

// Import necessary types
import { App, TFile } from 'obsidian';
import { MOCHierarchy, PluginSettings } from './main'; 