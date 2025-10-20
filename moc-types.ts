/**
 * MOC System Types
 * Centralized type definitions for the MOC (Map of Content) system
 */

// Core MOC Types
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

// MOC Analysis Types (from moc-intelligence.ts)
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

// MOC Level Types
export type MOCLevel = 1 | 2 | 3 | 4;
export type MOCType = 'domain' | 'area' | 'topic' | 'concept';

export interface MOCLevelInfo {
    level: MOCLevel;
    type: MOCType;
    description: string;
}

// MOC Creation Options
export interface MOCCreationOptions {
    hierarchy: MOCHierarchy;
    learning_context?: LearningContext;
    note_path?: string;
    note_title?: string;
    apply_intelligence?: boolean;
    update_parents?: boolean;
    add_note?: {
        path: string;
        title: string;
        learning_context?: LearningContext;
    };
}

// MOC Update Options
export interface MOCUpdateOptions {
    add_note?: {
        path: string;
        title: string;
        learning_context?: LearningContext;
    };
    apply_intelligence?: boolean;
    update_parents?: boolean;
}