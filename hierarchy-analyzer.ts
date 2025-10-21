/**
 * Hierarchy Analyzer - Extracted from main.ts
 * Handles content analysis and hierarchy determination
 */

// Types that need to be defined (matching main.ts)
interface MOCHierarchy {
    level1: string; // Knowledge Domain (e.g., "Computer Science")
    level2: string; // Learning Area (e.g., "Machine Learning") 
    level3?: string; // Specific Topic (e.g., "Neural Networks")
    level4?: string; // Key Concept (e.g., "Backpropagation")
}

interface LearningContext {
    prerequisites: string[];
    related_concepts: string[];
    learning_path: string[];
    complexity_level: 'beginner' | 'intermediate' | 'advanced';
    [key: string]: any;
}

interface NoteHierarchyAnalysis {
    hierarchy: MOCHierarchy;
    learning_context: LearningContext;
    moc_placement: {
        primary_moc: string;
        secondary_mocs?: string[];
    };
}

export class HierarchyAnalyzer {
    async analyzeContent(metadata: any, title: string, content: string): Promise<NoteHierarchyAnalysis> {
        // Extract knowledge domain and hierarchy from metadata and content
        const topics = metadata.topics || [];
        const tags = metadata.tags || [];

        // Simple heuristic-based analysis
        let level1 = 'General Knowledge';
        let level2 = 'Miscellaneous';

        // Try to determine domain from topics and tags
        if (topics.length > 0) {
            const topic = topics[0];

            // Simple domain mapping - can be enhanced with AI later
            if (this.isComputerScience(topic, title, content)) {
                level1 = 'Computer Science';
                level2 = this.determineCSSubdomain(topic, title, content);
            } else if (this.isScience(topic, title, content)) {
                level1 = 'Science';
                level2 = this.determineScienceSubdomain(topic, title, content);
            } else if (this.isBusiness(topic, title, content)) {
                level1 = 'Business';
                level2 = this.determineBusinessSubdomain(topic, title, content);
            } else {
                level1 = 'General Knowledge';
                level2 = topic;
            }
        }

        const hierarchy: MOCHierarchy = {
            level1,
            level2,
            level3: topics[1] || undefined,
            level4: topics[2] || undefined
        };

        const learningContext: LearningContext = {
            prerequisites: metadata.related || [],
            related_concepts: metadata.related || [],
            learning_path: [level2],
            complexity_level: this.determineComplexity(content)
        };

        return {
            hierarchy,
            learning_context: learningContext,
            moc_placement: {
                primary_moc: `${level1}/${level2}`
            }
        };
    }

    private isComputerScience(topic: string, title: string, content: string): boolean {
        const csKeywords = ['programming', 'software', 'algorithm', 'computer', 'coding', 'development', 'tech', 'ai', 'machine learning', 'data science'];
        const text = `${topic} ${title} ${content}`.toLowerCase();
        return csKeywords.some(keyword => text.includes(keyword));
    }

    private isScience(topic: string, title: string, content: string): boolean {
        const scienceKeywords = ['research', 'study', 'experiment', 'theory', 'physics', 'chemistry', 'biology', 'mathematics'];
        const text = `${topic} ${title} ${content}`.toLowerCase();
        return scienceKeywords.some(keyword => text.includes(keyword));
    }

    private isBusiness(topic: string, title: string, content: string): boolean {
        const businessKeywords = ['business', 'management', 'marketing', 'finance', 'strategy', 'leadership', 'entrepreneurship'];
        const text = `${topic} ${title} ${content}`.toLowerCase();
        return businessKeywords.some(keyword => text.includes(keyword));
    }

    private determineCSSubdomain(topic: string, title: string, content: string): string {
        const text = `${topic} ${title} ${content}`.toLowerCase();
        if (text.includes('ai') || text.includes('machine learning') || text.includes('neural')) return 'Artificial Intelligence';
        if (text.includes('web') || text.includes('frontend') || text.includes('backend')) return 'Web Development';
        if (text.includes('data') || text.includes('analytics')) return 'Data Science';
        if (text.includes('mobile') || text.includes('app')) return 'Mobile Development';
        return 'Programming';
    }

    private determineScienceSubdomain(topic: string, title: string, content: string): string {
        const text = `${topic} ${title} ${content}`.toLowerCase();
        if (text.includes('physics')) return 'Physics';
        if (text.includes('chemistry')) return 'Chemistry';
        if (text.includes('biology')) return 'Biology';
        if (text.includes('math')) return 'Mathematics';
        return 'General Science';
    }

    private determineBusinessSubdomain(topic: string, title: string, content: string): string {
        const text = `${topic} ${title} ${content}`.toLowerCase();
        if (text.includes('marketing')) return 'Marketing';
        if (text.includes('finance')) return 'Finance';
        if (text.includes('leadership') || text.includes('management')) return 'Management';
        if (text.includes('entrepreneur')) return 'Entrepreneurship';
        return 'Business Strategy';
    }

    private determineComplexity(content: string): 'beginner' | 'intermediate' | 'advanced' {
        const wordCount = content.split(' ').length;
        if (wordCount < 500) return 'beginner';
        if (wordCount < 1500) return 'intermediate';
        return 'advanced';
    }
}