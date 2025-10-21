import { App, TFile } from 'obsidian';
import { MOCHierarchy, LearningContext } from './main';

export interface MOCAnalysis {
    overview: string;
    keyThemes: string[];
    conceptualRelationships: string;
    learningProgress: string;
    knowledgeGaps: string[];
    crossDomainConnections: string[];
    synthesizedInsights: string[];
}

export interface MOCNote {
    title: string;
    content: string;
    learningContext?: LearningContext;
    hierarchy: MOCHierarchy;
}

export class MOCIntelligence {
    private app: App;

    constructor(app: App) {
        this.app = app;
    }

    /**
     * Analyzes all notes in a MOC and generates intelligent content
     */
    async analyzeMOCContent(mocPath: string): Promise<MOCAnalysis> {
        try {
            // Get all notes referenced in this MOC
            const notes = await this.extractNotesFromMOC(mocPath);
            
            if (notes.length === 0) {
                console.log('[MOCIntelligence] ❌ No notes found - cannot generate meaningful analysis');
                return this.createEmptyAnalysis();
            }

            console.log('[MOCIntelligence] ✅ Found', notes.length, 'notes - proceeding with analysis');
            // Analyze the collected notes
            return await this.synthesizeNotes(notes);
        } catch (error) {
            console.error('[MOCIntelligence] Error analyzing MOC content:', error);
            // NO FALLBACK - return empty analysis to avoid fake data
            return this.createEmptyAnalysis();
        }
    }

    /**
     * Extracts all notes referenced in a MOC file
     */
    private async extractNotesFromMOC(mocPath: string): Promise<MOCNote[]> {
        const mocFile = this.app.vault.getAbstractFileByPath(mocPath) as TFile;
        if (!mocFile) {
            console.log('[MOCIntelligence] MOC file not found:', mocPath);
            return [];
        }

        const mocContent = await this.app.vault.read(mocFile);
        const notes: MOCNote[] = [];

        console.log('[MOCIntelligence] 🔍 Extracting notes from MOC:', mocPath);
        console.log('[MOCIntelligence] 📄 MOC content length:', mocContent.length);

        // Extract note links from the MOC content - look in Notes section specifically
        const notesSection = mocContent.match(/## Notes[\s\S]*?(?=\n##|\n---|\n\*|$)/);
        if (!notesSection) {
            console.log('[MOCIntelligence] ❌ No Notes section found in MOC');
            return [];
        }

        console.log('[MOCIntelligence] 📋 Found Notes section:', notesSection[0].substring(0, 200) + '...');

        // Extract all note links from the Notes section
        const noteLinks = notesSection[0].match(/- \[\[([^\]]+)\]\]/g);
        if (!noteLinks) {
            console.log('[MOCIntelligence] ❌ No note links found in Notes section');
            return [];
        }

        console.log('[MOCIntelligence] 🔗 Found note links:', noteLinks);

        for (const link of noteLinks) {
            const noteTitle = link.match(/\[\[([^\]]+)\]\]/)?.[1];
            if (!noteTitle) continue;

            console.log('[MOCIntelligence] 🔍 Looking for note:', noteTitle);

            // Find the actual note file
            const noteFile = this.findNoteByTitle(noteTitle);
            if (noteFile) {
                console.log('[MOCIntelligence] ✅ Found note file:', noteFile.path);
                const noteContent = await this.app.vault.read(noteFile);
                const hierarchy = this.extractHierarchyFromNote(noteContent);
                const learningContext = this.extractLearningContextFromNote(noteContent);

                notes.push({
                    title: noteTitle,
                    content: noteContent,
                    learningContext,
                    hierarchy
                });
            } else {
                console.log('[MOCIntelligence] ❌ Note file not found:', noteTitle);
            }
        }

        console.log('[MOCIntelligence] 📊 Extracted', notes.length, 'notes from MOC');
        return notes;
    }

    /**
     * Finds a note file by its title
     */
    private findNoteByTitle(title: string): TFile | null {
        const files = this.app.vault.getMarkdownFiles();
        
        // Try exact basename match first
        let match = files.find(file => file.basename === title);
        if (match) {
            console.log('[MOCIntelligence] ✅ Found exact basename match:', match.path);
            return match;
        }

        // Try exact name match
        match = files.find(file => file.name === title + '.md');
        if (match) {
            console.log('[MOCIntelligence] ✅ Found exact name match:', match.path);
            return match;
        }

        // Try partial match (in case of encoding issues)
        match = files.find(file => file.basename.includes(title) || title.includes(file.basename));
        if (match) {
            console.log('[MOCIntelligence] ✅ Found partial match:', match.path);
            return match;
        }

        console.log('[MOCIntelligence] ❌ No match found for title:', title);
        console.log('[MOCIntelligence] 📁 Available files in directory:', 
            files.filter(f => f.path.includes(title.split(' ')[0])).map(f => f.basename).slice(0, 5)
        );
        
        return null;
    }

    /**
     * Extracts hierarchy information from note frontmatter
     */
    private extractHierarchyFromNote(content: string): MOCHierarchy {
        const hierarchyMatch = content.match(/hierarchy:\s*\n([\s\S]*?)(?=\n\w+:|---|\n\n)/);
        if (!hierarchyMatch) return { level1: '', level2: '' };

        const hierarchyText = hierarchyMatch[1];
        const level1 = hierarchyText.match(/level1:\s*"([^"]+)"/)?.[1] || '';
        const level2 = hierarchyText.match(/level2:\s*"([^"]+)"/)?.[1] || '';
        const level3 = hierarchyText.match(/level3:\s*"([^"]+)"/)?.[1] || '';
        const level4 = hierarchyText.match(/level4:\s*"([^"]+)"/)?.[1] || '';

        return { level1, level2, level3, level4 };
    }

    /**
     * Extracts learning context from note frontmatter
     */
    private extractLearningContextFromNote(content: string): LearningContext | undefined {
        const learningMatch = content.match(/learning_context:\s*\n([\s\S]*?)(?=\n\w+:|---|\n\n)/);
        if (!learningMatch) return undefined;

        const learningText = learningMatch[1];
        
        // Extract prerequisites array
        const prereqMatch = learningText.match(/prerequisites:\s*\[([\s\S]*?)\]/);
        const prerequisites = prereqMatch ? 
            prereqMatch[1].split(',').map(p => p.replace(/["\s]/g, '').trim()).filter(p => p) : [];

        // Extract related concepts array
        const relatedMatch = learningText.match(/related_concepts:\s*\[([\s\S]*?)\]/);
        const related_concepts = relatedMatch ? 
            relatedMatch[1].split(',').map(c => c.replace(/["\s]/g, '').trim()).filter(c => c) : [];

        // Extract learning path array
        const pathMatch = learningText.match(/learning_path:\s*\[([\s\S]*?)\]/);
        const learning_path = pathMatch ? 
            pathMatch[1].split(',').map(p => p.replace(/["\s]/g, '').trim()).filter(p => p) : [];

        const complexity_level = learningText.match(/complexity_level:\s*"([^"]+)"/)?.[1] as 'beginner' | 'intermediate' | 'advanced' || 'intermediate';

        return {
            prerequisites,
            related_concepts,
            learning_path,
            complexity_level
        };
    }

    /**
     * Synthesizes multiple notes into MOC analysis - NO FALLBACK STRATEGY
     */
    private async synthesizeNotes(notes: MOCNote[]): Promise<MOCAnalysis> {
        console.log('[MOCIntelligence] 🧠 Synthesizing', notes.length, 'notes');
        
        if (notes.length === 0) {
            console.log('[MOCIntelligence] ❌ CRITICAL: No notes found - cannot synthesize');
            return this.createEmptyAnalysis();
        }

        // Prepare content for AI analysis
        const noteSummaries = notes.map(note => ({
            title: note.title,
            summary: this.extractSummaryFromNote(note.content),
            keyTopics: this.extractTopicsFromNote(note.content),
            complexity: note.learningContext?.complexity_level || 'intermediate'
        }));

        console.log('[MOCIntelligence] 📊 Note summaries prepared:', noteSummaries.length);
        console.log('[MOCIntelligence] 🏷️ Topics found:', noteSummaries.flatMap(s => s.keyTopics).slice(0, 10));

        // ONLY use accurate analysis based on actual notes found - NO FALLBACK
        return this.generateAccurateAnalysisFromNotes(notes, noteSummaries);
    }

    /**
     * Creates a synthesis prompt for AI analysis
     */
    private createSynthesisPrompt(noteSummaries: any[]): string {
        return `
TASK: Analyze the following collection of notes and create a comprehensive MOC synthesis.

NOTES TO ANALYZE:
${noteSummaries.map(note => `
Title: ${note.title}
Summary: ${note.summary}
Key Topics: ${note.keyTopics.join(', ')}
Complexity: ${note.complexity}
`).join('\n')}

GENERATE:
1. OVERVIEW: 2-3 sentences explaining what this collection of knowledge covers
2. KEY THEMES: 3-5 main themes that emerge across the notes
3. CONCEPTUAL RELATIONSHIPS: How the concepts connect and build on each other
4. LEARNING PROGRESS: What understanding has been built and what's still developing
5. KNOWLEDGE GAPS: What important aspects are missing or need more exploration
6. CROSS-DOMAIN CONNECTIONS: How this knowledge connects to other fields
7. SYNTHESIZED INSIGHTS: 3-5 key insights that emerge from combining these sources

Return as JSON with these exact keys: overview, keyThemes, conceptualRelationships, learningProgress, knowledgeGaps, crossDomainConnections, synthesizedInsights
`;
    }

    /**
     * Generates accurate analysis from actual notes found
     */
    private generateAccurateAnalysisFromNotes(notes: MOCNote[], summaries: any[]): MOCAnalysis {
        console.log('[MOCIntelligence] 📊 Analyzing', notes.length, 'notes for synthesis');
        
        const allTopics = summaries.flatMap(s => s.keyTopics);
        const uniqueTopics = [...new Set(allTopics)].filter(topic => topic && topic.length > 0);
        
        console.log('[MOCIntelligence] 🏷️ Unique topics found:', uniqueTopics);
        
        // Accurate analysis based on actual content
        const beginnerCount = notes.filter(n => n.learningContext?.complexity_level === 'beginner').length;
        const intermediateCount = notes.filter(n => n.learningContext?.complexity_level === 'intermediate').length;
        const advancedCount = notes.filter(n => n.learningContext?.complexity_level === 'advanced').length;
        
        console.log('[MOCIntelligence] 📈 Complexity distribution:', { beginnerCount, intermediateCount, advancedCount });
        
        const noteWord = notes.length === 1 ? 'source' : 'sources';
        const topicWord = uniqueTopics.length === 1 ? 'concept' : 'concepts';
        
        // Generate content-specific insights
        const specificInsights = this.generateSpecificInsights(notes, uniqueTopics);
        
        return {
            overview: notes.length > 0 && uniqueTopics.length > 0
                ? `This knowledge area contains ${notes.length} ${noteWord} covering ${uniqueTopics.slice(0, 3).join(', ')}${uniqueTopics.length > 3 ? ' and related concepts' : ''}.`
                : notes.length > 0 
                    ? `This knowledge area contains ${notes.length} ${noteWord} providing foundational understanding of the key concepts.`
                    : 'This knowledge area is ready to be populated with relevant content.',
            keyThemes: uniqueTopics.slice(0, 5),
            conceptualRelationships: notes.length > 1 
                ? `The concepts build from foundational principles through practical applications, with ${beginnerCount} beginner, ${intermediateCount} intermediate, and ${advancedCount} advanced sources.`
                : notes.length === 1 
                    ? `This ${notes[0].learningContext?.complexity_level || 'intermediate'}-level content provides foundational understanding of the key concepts.`
                    : 'Relationships will emerge as content is added.',
            learningProgress: uniqueTopics.length > 0 
                ? `Current understanding covers ${uniqueTopics.length} distinct ${topicWord} with ${this.getComplexityDescription(beginnerCount, intermediateCount, advancedCount)} depth.`
                : 'Beginning to collect foundational knowledge.',
            knowledgeGaps: this.identifyKnowledgeGaps(notes),
            crossDomainConnections: this.identifyCrossDomainConnections(notes),
            synthesizedInsights: specificInsights
        };
    }

    /**
     * Generates content-specific insights instead of generic ones
     */
    private generateSpecificInsights(notes: MOCNote[], topics: string[]): string[] {
        const insights: string[] = [];
        
        if (notes.length === 1) {
            const note = notes[0];
            const mainTopics = topics.slice(0, 2);
            
            if (mainTopics.length > 0) {
                insights.push(`This content provides foundational understanding of ${mainTopics.join(' and ')} concepts`);
            }
            
            // Add domain-specific insight
            const domain = note.hierarchy.level1?.toLowerCase();
            if (domain === 'physics') {
                insights.push('Represents important theoretical physics concepts with practical implications');
            } else if (domain === 'mathematics') {
                insights.push('Demonstrates fundamental mathematical principles with broad applications');
            } else if (domain === 'computer science') {
                insights.push('Shows practical applications of computational concepts and algorithms');
            }
        } else if (notes.length > 1) {
            insights.push(`Multiple sources provide complementary perspectives on ${topics.slice(0, 2).join(' and ')} concepts`);
            
            // Check for complexity progression
            const complexityLevels = [...new Set(notes.map(n => n.learningContext?.complexity_level).filter(c => c))];
            if (complexityLevels.length > 1) {
                insights.push(`Knowledge builds progressively from ${complexityLevels.join(' to ')} levels`);
            }
        }

        return insights.length > 0 ? insights : ['Foundational knowledge base for understanding key concepts'];
    }

    /**
     * Gets a description of complexity distribution
     */
    private getComplexityDescription(beginner: number, intermediate: number, advanced: number): string {
        if (beginner > 0 && intermediate > 0 && advanced > 0) return 'varying levels of';
        if (intermediate > 0 && advanced > 0) return 'intermediate to advanced';
        if (beginner > 0 && intermediate > 0) return 'beginner to intermediate';
        if (advanced > 0) return 'advanced';
        if (intermediate > 0) return 'intermediate';
        if (beginner > 0) return 'beginner';
        return 'varying levels of';
    }

    // REMOVED: generateBasicAnalysisFromNotes - was generating misleading fallback data

    /**
     * Extracts summary from note content
     */
    private extractSummaryFromNote(content: string): string {
        // Look for overview or summary sections
        const overviewMatch = content.match(/## Overview\s*\n(.*?)(?=\n##|\n---|\n\n)/s);
        if (overviewMatch) return overviewMatch[1].trim();

        const summaryMatch = content.match(/## .*Summary.*\s*\n(.*?)(?=\n##|\n---|\n\n)/s);
        if (summaryMatch) return summaryMatch[1].trim();

        // Fallback to first paragraph after title
        const firstParagraph = content.match(/^#[^\n]*\n\n(.*?)(?=\n##|\n---|\n\n)/s);
        return firstParagraph ? firstParagraph[1].trim().substring(0, 200) + '...' : 'No summary available';
    }

    /**
     * Extracts topics from note content
     */
    private extractTopicsFromNote(content: string): string[] {
        const topics: string[] = [];
        
        // Extract from Topics section
        const topicsMatch = content.match(/## Topics\s*\n([\s\S]*?)(?=\n##|\n---|\n\n)/);
        if (topicsMatch) {
            const topicLinks = topicsMatch[1].match(/- \[\[([^\]]+)\]\]/g);
            if (topicLinks) {
                topics.push(...topicLinks.map(link => link.match(/\[\[([^\]]+)\]\]/)?.[1] || ''));
            }
        }

        // Extract from tags
        const tagsMatch = content.match(/#(\w+)/g);
        if (tagsMatch) {
            topics.push(...tagsMatch.map(tag => tag.substring(1)));
        }

        return [...new Set(topics.filter(t => t))];
    }

    /**
     * Identifies knowledge gaps from the collected notes
     */
    private identifyKnowledgeGaps(notes: MOCNote[]): string[] {
        const gaps: string[] = [];
        
        // Check for missing complexity levels
        const hasBeginnerContent = notes.some(n => n.learningContext?.complexity_level === 'beginner');
        const hasAdvancedContent = notes.some(n => n.learningContext?.complexity_level === 'advanced');
        
        if (!hasBeginnerContent) gaps.push('Need more beginner-friendly introductory content');
        if (!hasAdvancedContent) gaps.push('Could benefit from advanced applications and theory');
        
        // Check for practical vs theoretical balance
        const practicalCount = notes.filter(n => 
            n.content.toLowerCase().includes('practical') || 
            n.content.toLowerCase().includes('application') ||
            n.content.toLowerCase().includes('example')
        ).length;
        
        if (practicalCount < notes.length / 2) {
            gaps.push('Need more practical examples and applications');
        }

        return gaps.length > 0 ? gaps : ['Knowledge base appears comprehensive for current scope'];
    }

    /**
     * Identifies cross-domain connections
     */
    private identifyCrossDomainConnections(notes: MOCNote[]): string[] {
        const connections: string[] = [];
        
        // Look for mentions of other domains in the content
        const domains = ['business', 'psychology', 'mathematics', 'physics', 'biology', 'philosophy', 'economics'];
        
        for (const domain of domains) {
            const mentionsCount = notes.filter(n => 
                n.content.toLowerCase().includes(domain)
            ).length;
            
            if (mentionsCount > 0) {
                connections.push(`Connects to ${domain} domain (${mentionsCount} references)`);
            }
        }

        return connections.length > 0 ? connections : ['Primarily focused within its own domain'];
    }

    /**
     * Generates insights from the collected notes
     */
    private generateInsights(notes: MOCNote[], summaries: any[]): string[] {
        const insights: string[] = [];
        
        // Pattern: Multiple perspectives
        if (notes.length >= 3) {
            insights.push(`Multiple sources provide complementary perspectives on the same core concepts`);
        }
        
        // Pattern: Complexity progression
        const complexityLevels = [...new Set(notes.map(n => n.learningContext?.complexity_level).filter(c => c))];
        if (complexityLevels.length > 1) {
            insights.push(`Knowledge builds progressively from ${complexityLevels.join(' to ')} levels`);
        }
        
        // Pattern: Practical applications
        const practicalNotes = notes.filter(n => 
            n.content.toLowerCase().includes('application') || 
            n.content.toLowerCase().includes('practical')
        );
        if (practicalNotes.length > 0) {
            insights.push(`Strong emphasis on practical applications and real-world implementation`);
        }

        return insights.length > 0 ? insights : ['Foundational knowledge base for understanding key concepts'];
    }

    /**
     * Creates truly empty analysis for MOCs with no notes - NO FAKE DATA
     */
    private createEmptyAnalysis(): MOCAnalysis {
        return {
            overview: '', // Empty - no fake content
            keyThemes: [], // Empty - no fake themes
            conceptualRelationships: '', // Empty - no fake relationships
            learningProgress: '', // Empty - no fake progress
            knowledgeGaps: [], // Empty - no fake gaps
            crossDomainConnections: [], // Empty - no fake connections
            synthesizedInsights: [] // Empty - no fake insights
        };
    }

    /**
     * Updates a MOC with intelligent content based on its notes
     */
    async updateMOCWithIntelligence(mocPath: string): Promise<void> {
        try {
            const analysis = await this.analyzeMOCContent(mocPath);
            await this.applyAnalysisToMOC(mocPath, analysis);
        } catch (error) {
            console.error('[MOCIntelligence] Error updating MOC with intelligence:', error);
        }
    }

    /**
     * Applies the analysis to update the MOC content
     */
    private async applyAnalysisToMOC(mocPath: string, analysis: MOCAnalysis): Promise<void> {
        const mocFile = this.app.vault.getAbstractFileByPath(mocPath) as TFile;
        if (!mocFile) return;

        let content = await this.app.vault.read(mocFile);

        // Only apply intelligence if there are actual insights to add
        if (analysis.keyThemes.length === 0 && analysis.synthesizedInsights.length === 0) {
            console.log('[MOCIntelligence] No meaningful insights to add, skipping intelligence update');
            return;
        }

        // Create properly formatted overview section
        const overviewSection = this.createFormattedOverviewSection(analysis);

        // Check if intelligence sections already exist and replace them
        const existingIntelligence = this.detectExistingIntelligence(content);
        
        if (existingIntelligence.found) {
            console.log('[MOCIntelligence] Replacing existing intelligence sections to avoid duplication');
            // Replace existing intelligence sections
            content = content.substring(0, existingIntelligence.startIndex) + 
                     overviewSection + 
                     content.substring(existingIntelligence.endIndex);
        } else {
            console.log('[MOCIntelligence] No existing intelligence found, inserting new sections');
            // Find the insertion point - after the info block but before navigation sections
            const insertionPoint = this.findInsertionPoint(content);
            
            if (insertionPoint !== -1) {
                // Insert with proper spacing
                content = content.substring(0, insertionPoint) + '\n' + overviewSection + '\n' + content.substring(insertionPoint);
            } else {
                console.warn('[MOCIntelligence] Could not find suitable insertion point for intelligence content');
                return;
            }
        }

        await this.app.vault.modify(mocFile, content);
        console.log('[MOCIntelligence] Successfully applied intelligence to MOC (replaced duplicates)');
    }

    /**
     * Detects existing intelligence sections to avoid duplication
     */
    private detectExistingIntelligence(content: string): { found: boolean; startIndex: number; endIndex: number } {
        const intelligenceSections = [
            '## Overview',
            '## Key Themes', 
            '## Conceptual Relationships',
            '## Learning Progress',
            '## Knowledge Gaps',
            '## Cross-Domain Connections',
            '## Key Insights'
        ];

        let firstIntelligenceIndex = -1;
        let lastIntelligenceIndex = -1;

        // Find the first intelligence section
        for (const section of intelligenceSections) {
            const index = content.indexOf(section);
            if (index !== -1) {
                if (firstIntelligenceIndex === -1 || index < firstIntelligenceIndex) {
                    firstIntelligenceIndex = index;
                }
            }
        }

        if (firstIntelligenceIndex === -1) {
            return { found: false, startIndex: -1, endIndex: -1 };
        }

        // Find where intelligence sections end (before navigation or other sections)
        const navigationSections = ['## 🔼', '## 🔽', '## 🔄', '## Learning Paths', '## Core Concepts', '## Related Topics', '## Prerequisites', '## Notes'];
        let endIndex = content.length;

        for (const navSection of navigationSections) {
            const navIndex = content.indexOf(navSection, firstIntelligenceIndex);
            if (navIndex !== -1 && navIndex < endIndex) {
                endIndex = navIndex;
            }
        }

        // Trim back to avoid eating navigation sections
        while (endIndex > firstIntelligenceIndex && content[endIndex - 1] === '\n') {
            endIndex--;
        }

        return { 
            found: true, 
            startIndex: firstIntelligenceIndex,
            endIndex: endIndex
        };
    }

    /**
     * Creates properly formatted overview section
     */
    private createFormattedOverviewSection(analysis: MOCAnalysis): string {
        let section = '';

        // Only add sections that have meaningful content
        if (analysis.overview && analysis.overview !== 'This knowledge area is ready to be populated with relevant content.') {
            section += `## Overview\n${analysis.overview}\n\n`;
        }

        if (analysis.keyThemes.length > 0) {
            section += `## Key Themes\n${analysis.keyThemes.map(theme => `- **${theme}**`).join('\n')}\n\n`;
        }

        if (analysis.conceptualRelationships && !analysis.conceptualRelationships.includes('Relationships will emerge')) {
            section += `## Conceptual Relationships\n${analysis.conceptualRelationships}\n\n`;
        }

        if (analysis.learningProgress && !analysis.learningProgress.includes('Beginning to collect')) {
            section += `## Learning Progress\n${analysis.learningProgress}\n\n`;
        }

        if (analysis.knowledgeGaps.length > 0 && !analysis.knowledgeGaps[0].includes('Need initial content')) {
            section += `## Knowledge Gaps\n${analysis.knowledgeGaps.map(gap => `- ${gap}`).join('\n')}\n\n`;
        }

        if (analysis.crossDomainConnections.length > 0) {
            section += `## Cross-Domain Connections\n${analysis.crossDomainConnections.map(conn => `- ${conn}`).join('\n')}\n\n`;
        }

        if (analysis.synthesizedInsights.length > 0) {
            section += `## Key Insights\n${analysis.synthesizedInsights.map(insight => `- ${insight}`).join('\n')}\n\n`;
        }

        return section.trim();
    }

    /**
     * Finds the best insertion point for intelligence content
     */
    private findInsertionPoint(content: string): number {
        // Look for the end of the info block
        const infoBlockEnd = content.indexOf('> This is the most specific level');
        if (infoBlockEnd !== -1) {
            const nextNewline = content.indexOf('\n\n', infoBlockEnd);
            if (nextNewline !== -1) {
                return nextNewline + 2;
            }
        }

        // Fallback: look for first navigation section
        const navigationStart = content.indexOf('\n## 🔼');
        if (navigationStart !== -1) {
            return navigationStart;
        }

        // Last resort: after title
        const titleEnd = content.indexOf('\n', content.indexOf('# '));
        if (titleEnd !== -1) {
            return titleEnd + 1;
        }

        return -1;
    }
}