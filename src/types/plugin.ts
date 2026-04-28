/**
 * Plugin-specific type definitions
 * Extracted from main.ts for better modularity
 */

// MOC-related Types
export interface MOCHierarchy {
    level1: string; // Knowledge Domain (e.g., "Computer Science")
    level2: string; // Learning Area (e.g., "Machine Learning") 
    level3?: string; // Specific Topic (e.g., "Neural Networks")
    level4?: string; // Key Concept (e.g., "Backpropagation")
}

export interface LearningContext {
    prerequisites: string[];
    related_concepts: string[];
    learning_path: string[];
    complexity_level: 'beginner' | 'intermediate' | 'advanced';
    estimated_reading_time?: string;
}

export interface MOCMetadata {
    title: string;
    type: 'moc';
    domain: string;
    created: string;
    updated: string;
    tags: string[];
    note_count: number;
    learning_paths: string[];
}

export interface MOC {
    metadata: MOCMetadata;
    sections: {
        learning_paths: string[];
        core_concepts: string[];
        related_topics: string[];
        notes: string[];
    };
    filepath: string;
}

export interface NoteHierarchyAnalysis {
    hierarchy: MOCHierarchy;
    learning_context: LearningContext;
    moc_placement: {
        primary_moc: string;
        secondary_mocs?: string[];
    };
}

export interface Perspective {
    viewpoint: string;
    analysis: string;
}

export interface Analogy {
    concept: string;
    analogy: string;
    real_world_example: string;
}

export interface CaseStudy {
    case_study_name?: string;
    description?: string;
}

export interface KnowledgeConnection {
    related_field: string;
    connection_type: string;
    detailed_explanation: string;
}

export interface PracticalApplication {
    domain: string;
    application: string;
    implementation: string;
    benefits: string;
}

export interface LearningPathway {
    pathway_name: string;
    difficulty: string;
    steps: string[];
}

export interface FullAnalysisResult {
    title: string;
    summary?: string;
    overview?: string;
    context?: string;
    detailed_summary?: string;
    key_facts?: string[];
    deep_insights?: string[];
    core_concepts?: string[];
    multiple_perspectives?: Perspective[];
    analogies_examples?: Analogy[];
    case_studies?: (CaseStudy | string)[];
    knowledge_connections?: KnowledgeConnection[];
    practical_applications?: PracticalApplication[];
    learning_pathways?: LearningPathway[];
    hierarchy?: MOCHierarchy;
    hierarchy_confidence?: number;
    hierarchy_reasoning?: string;
    primary_author?: string;
    learning_context?: LearningContext;
    metadata?: Record<string, unknown>;
}

export interface HierarchyAnalysisResult {
    primary_hierarchy: MOCHierarchy;
    confidence_score: number;
    reasoning: string;
    alternative_hierarchies: Array<{
        hierarchy: MOCHierarchy;
        strength: number;
        reasoning?: string;
    }>;
    learning_context?: LearningContext;
}