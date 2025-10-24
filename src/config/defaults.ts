/**
 * Default plugin settings
 * Extracted from main.ts for better modularity
 */

import { DEFAULT_SUMMARIZATION_PROMPT } from '../../prompts';
import { GEMINI_MODELS } from './models';
import type { ProcessingIntent } from './intents';

// Provider Types
export type Provider = 'gemini';

// Settings Interfaces
export interface GeminiSettings {
    apiKey: string;
    model: string;
    models: any[];
}

export interface LangfuseSettings {
    enabled: boolean;
    publicKey: string;
    secretKey: string;
    baseUrl: string;
}

export interface TopicFolderSettings {
    enabled: boolean;
    rootFolder: string;
    topics: string[];
}

export interface DebugSettings {
    enabled: boolean;
    saveRawContent: boolean;
    savePrompts: boolean;
    saveResponses: boolean;
    debugFolder: string;
    enablePromptTesting: boolean;
    useExperimentalPrompts: boolean;
    generateComparisons: boolean;
}

export interface PluginSettings {
    provider: Provider;
    gemini: GeminiSettings;
    defaultPrompt: string;
    mocFolder: string;
    enableMOC: boolean;
    defaultIntent: ProcessingIntent;
    topicFolders: TopicFolderSettings;
    debug: DebugSettings;
    langfuse: LangfuseSettings;
    trackUsage: boolean;
    analysisPrompts: {
        structure: string;
        content: string;
        perspectives: string;
        connections: string;
        learning: string;
    };
}

// Default Settings
export const DEFAULT_SETTINGS: PluginSettings = {
    provider: 'gemini',
    gemini: {
        apiKey: '',
        model: 'gemini-2.5-flash',
        models: GEMINI_MODELS
    },
    defaultPrompt: DEFAULT_SUMMARIZATION_PROMPT,
    mocFolder: 'MOCs',
    enableMOC: true,
    defaultIntent: 'knowledge_building',
    topicFolders: {
        enabled: true,
        rootFolder: 'Research Topics',
        topics: ['LLM Evals', 'AI Safety', 'Machine Learning', 'Data Science', 'Software Engineering']
    },
    debug: {
        enabled: false,
        saveRawContent: true,
        savePrompts: true,
        saveResponses: true,
        debugFolder: 'Debug',
        enablePromptTesting: false,
        useExperimentalPrompts: false,
        generateComparisons: false
    },
    langfuse: {
        enabled: false,
        publicKey: '',
        secretKey: '',
        baseUrl: 'https://cloud.langfuse.com'
    },
    trackUsage: true,
    analysisPrompts: {
        structure: `You are an expert knowledge organizer with deep expertise in content analysis and information architecture.

EXISTING KNOWLEDGE HIERARCHY:
{HIERARCHY_CONTEXT}

CORE ANALYSIS OBJECTIVES:
1. Create a precise, descriptive title that captures the content's unique value proposition
2. Determine optimal knowledge hierarchy placement (avoid duplicates, leverage existing structure)
3. Extract comprehensive metadata with high precision and relevance
4. Assess learning context and cognitive requirements accurately
5. Classify source type and credibility indicators
6. Identify specific, actionable items that readers can implement
7. Provide a compelling overview that highlights key value and insights

QUALITY STANDARDS:
- Title should be specific, searchable, and immediately informative
- Hierarchy placement should reflect content depth and scope accurately
- Metadata should be comprehensive but focused on most relevant elements
- Action items should be specific, measurable, and implementable
- Tags should enhance discoverability and connection to related content

{ADDITIONAL_INSTRUCTIONS}

Content to analyze:
{CONTENT}

Return ONLY valid JSON with enhanced detail and precision:
{
  "title": "Specific, descriptive title that captures unique value",
  "hierarchy": {
    "level1": "Primary knowledge domain",
    "level2": "Specific area or discipline", 
    "level3": "Focused topic or subject",
    "level4": "Specific concept or technique"
  },
  "metadata": {
    "speakers": ["speaker1", "speaker2"],
    "topics": ["specific topic1", "specific topic2"],
    "key_concepts": ["concept1", "concept2", "concept3"],
    "tags": ["#primary", "#secondary", "#tertiary"],
    "related": ["related concept1", "related concept2"]
  },
  "learning_context": {
    "prerequisites": ["specific prereq1", "specific prereq2"],
    "related_concepts": ["connected concept1", "connected concept2"],
    "learning_path": ["step1", "step2", "step3"],
    "complexity_level": "beginner|intermediate|advanced",
    "estimated_reading_time": "X minutes"
  },
  "source_type": "social|academic|news|professional|traditional|tutorial|interview|presentation",
  "action_items": ["Specific actionable item 1", "Specific actionable item 2", "Specific actionable item 3"],
  "overview": "Compelling 2-3 sentence overview highlighting key insights and value proposition"
}`,
        content: `You are an expert content analyst with deep expertise in extracting meaningful insights and synthesizing complex information.

CONTENT CONTEXT:
Title: {TITLE}
Domain: {DOMAIN}
Topic: {TOPIC}

ANALYSIS FRAMEWORK:
- Context: Establish significance, background, and relevance
- Key Facts: Extract verifiable, important information with supporting details
- Deep Insights: Identify patterns, implications, and non-obvious connections
- Core Concepts: Define fundamental ideas and their relationships
- Synthesis: Create comprehensive understanding that connects all elements

QUALITY STANDARDS:
- Context should establish why this content matters and its broader significance
- Key facts should be specific, verifiable, and well-explained
- Insights should reveal deeper patterns and implications beyond surface content
- Core concepts should be clearly defined with their significance explained
- Summary should synthesize all elements into coherent understanding

{ADDITIONAL_INSTRUCTIONS}

Content to analyze:
{CONTENT}

Return ONLY valid JSON with enhanced depth and clarity:
{
  "context": "Comprehensive background explaining why this content matters, its significance in the broader field, and the problems or opportunities it addresses (250+ words with specific details)",
  "key_facts": [
    "Specific fact 1 with detailed explanation, supporting evidence, and context",
    "Specific fact 2 with quantitative details, sources, and implications",
    "Specific fact 3 with concrete examples, data points, and verification",
    "Additional facts as relevant to content depth"
  ],
  "deep_insights": [
    "Insight 1: Pattern analysis revealing underlying principles, cause-effect relationships, and broader implications with reasoning",
    "Insight 2: Connection analysis linking this content to related fields, concepts, or trends with specific examples",
    "Insight 3: Implication analysis exploring consequences, opportunities, and future directions with evidence",
    "Additional insights as content warrants"
  ],
  "core_concepts": [
    "Concept 1: Clear definition, significance, and how it relates to other concepts with examples", 
    "Concept 2: Detailed explanation of mechanism, application, and importance with context",
    "Concept 3: Comprehensive description of principles, usage, and implications with specifics",
    "Additional concepts as content requires"
  ],
  "detailed_summary": "Comprehensive synthesis that weaves together context, facts, insights, and concepts into coherent understanding, highlighting key takeaways and their significance (400+ words)"
}`,
        perspectives: `You are an expert at analyzing multiple viewpoints and creating practical examples.

CONTENT CONTEXT:
Title: {TITLE}
Overview: {OVERVIEW}

INSTRUCTIONS:
Analyze different perspectives and create rich examples. Be comprehensive and detailed.

{ADDITIONAL_INSTRUCTIONS}

Content to analyze:
{CONTENT}

Return ONLY valid JSON:
{
  "multiple_perspectives": [
    {
      "viewpoint": "Academic/Research Perspective",
      "analysis": "Detailed analysis from this viewpoint (100+ words)"
    },
    {
      "viewpoint": "Industry/Practical Perspective", 
      "analysis": "Detailed analysis from this viewpoint (100+ words)"
    },
    {
      "viewpoint": "Critical/Skeptical Perspective",
      "analysis": "Detailed analysis from this viewpoint (100+ words)"
    }
  ],
  "analogies_examples": [
    {
      "concept": "Key concept being explained",
      "analogy": "Detailed analogy with clear explanation",
      "real_world_example": "Concrete real-world example with context"
    },
    {
      "concept": "Another key concept",
      "analogy": "Another detailed analogy",
      "real_world_example": "Another concrete example"
    }
  ],
  "case_studies": [
    "Detailed case study 1 showing practical application",
    "Detailed case study 2 with different context",
    "Detailed case study 3 highlighting challenges"
  ]
}`,
        connections: `You are an expert at finding connections and practical applications.

CONTENT CONTEXT:
Title: {TITLE}
Domain: {DOMAIN}
Key Concepts: {KEY_CONCEPTS}

INSTRUCTIONS:
Find deep connections and practical applications. Be thorough and specific.

{ADDITIONAL_INSTRUCTIONS}

Content to analyze:
{CONTENT}

Return ONLY valid JSON:
{
  "knowledge_connections": [
    {
      "related_field": "Connected field/domain",
      "connection_type": "How they connect",
      "detailed_explanation": "Deep explanation of the connection (100+ words)"
    },
    {
      "related_field": "Another connected field",
      "connection_type": "Type of connection",
      "detailed_explanation": "Another detailed explanation"
    }
  ],
  "practical_applications": [
    {
      "domain": "Application domain",
      "application": "Specific application",
      "implementation": "How to implement/use this (100+ words)",
      "benefits": "Expected benefits and outcomes"
    },
    {
      "domain": "Another domain",
      "application": "Another application", 
      "implementation": "Implementation details",
      "benefits": "Benefits and outcomes"
    }
  ],
  "implications_consequences": [
    "Long-term implication 1 with detailed reasoning",
    "Long-term implication 2 with analysis",
    "Potential unintended consequence with explanation"
  ]
}`,
        learning: `You are an expert learning designer and action planner.

CONTENT CONTEXT:
Title: {TITLE}
Complexity: {COMPLEXITY}
Prerequisites: {PREREQUISITES}

INSTRUCTIONS:
Create comprehensive learning paths and actionable next steps.

{ADDITIONAL_INSTRUCTIONS}

Content to analyze:
{CONTENT}

Return ONLY valid JSON:
{
  "knowledge_gaps": [
    "Specific gap 1 with explanation of why it matters",
    "Specific gap 2 with learning strategy",
    "Specific gap 3 with resources needed"
  ],
  "learning_pathways": [
    {
      "pathway_name": "Beginner Path",
      "steps": [
        "Step 1: Detailed description and resources",
        "Step 2: Next step with specific actions",
        "Step 3: Advanced step with outcomes"
      ],
      "estimated_time": "Time estimate",
      "difficulty": "difficulty level"
    },
    {
      "pathway_name": "Advanced Path",
      "steps": [
        "Advanced step 1 with details",
        "Advanced step 2 with specifics",
        "Advanced step 3 with outcomes"
      ],
      "estimated_time": "Time estimate", 
      "difficulty": "difficulty level"
    }
  ],
  "actionable_next_steps": [
    {
      "category": "Immediate Actions",
      "actions": [
        "Specific action 1 with clear instructions",
        "Specific action 2 with expected outcomes",
        "Specific action 3 with timeline"
      ]
    },
    {
      "category": "Medium-term Goals",
      "actions": [
        "Goal 1 with strategy and metrics",
        "Goal 2 with approach and timeline",
        "Goal 3 with resources needed"
      ]
    }
  ],
  "reflection_questions": [
    "Deep question 1 to promote critical thinking",
    "Deep question 2 to connect to personal experience", 
    "Deep question 3 to explore implications"
  ]
}`
    }
};