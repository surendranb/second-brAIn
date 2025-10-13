import { App, TFile } from 'obsidian';
import { ProcessingIntent } from './main';

export interface IntentPrompts {
    structure: string;
    content: string;
    perspectives: string;
    connections: string;
    learning: string;
}

export class PromptLoader {
    private app: App;
    private promptCache: Map<ProcessingIntent, IntentPrompts> = new Map();

    constructor(app: App) {
        this.app = app;
    }

    async loadPromptsForIntent(intent: ProcessingIntent): Promise<IntentPrompts> {
        // Check cache first
        if (this.promptCache.has(intent)) {
            return this.promptCache.get(intent)!;
        }

        try {
            const promptFile = await this.getPromptFile(intent);
            if (promptFile) {
                const prompts = await this.parsePromptFile(promptFile);
                this.promptCache.set(intent, prompts);
                return prompts;
            }
        } catch (error) {
            console.error(`[PromptLoader] Failed to load prompts for intent ${intent}:`, error);
        }

        // Fallback to default prompts if intent-specific prompts not found
        return this.getDefaultPrompts();
    }

    private async getPromptFile(intent: ProcessingIntent): Promise<TFile | null> {
        const promptFileName = `prompts/${this.getPromptFileName(intent)}`;
        const file = this.app.vault.getAbstractFileByPath(promptFileName);
        return file as TFile || null;
    }

    private getPromptFileName(intent: ProcessingIntent): string {
        const fileNames: Record<ProcessingIntent, string> = {
            'knowledge_building': 'knowledge-building.md',
            'event_documentation': 'event-documentation.md',
            'quick_reference': 'quick-reference.md',
            'research_collection': 'research-collection.md',
            'professional_intelligence': 'professional-intelligence.md',
            'personal_development': 'personal-development.md',
            'news_events': 'news-events.md',
            'inspiration_capture': 'inspiration-capture.md'
        };
        return fileNames[intent] || 'knowledge-building.md';
    }

    private async parsePromptFile(file: TFile): Promise<IntentPrompts> {
        const content = await this.app.vault.read(file);
        
        // Extract prompts from markdown code blocks
        const prompts: Partial<IntentPrompts> = {};
        
        // Structure & Metadata Prompt
        const structureMatch = content.match(/## Structure & Metadata Prompt\s*```\s*([\s\S]*?)\s*```/);
        if (structureMatch) {
            prompts.structure = structureMatch[1].trim();
        }

        // Content Analysis Prompt
        const contentMatch = content.match(/## Content Analysis Prompt\s*```\s*([\s\S]*?)\s*```/);
        if (contentMatch) {
            prompts.content = contentMatch[1].trim();
        }

        // Perspectives & Examples Prompt
        const perspectivesMatch = content.match(/## Perspectives & Examples Prompt\s*```\s*([\s\S]*?)\s*```/);
        if (perspectivesMatch) {
            prompts.perspectives = perspectivesMatch[1].trim();
        }

        // Connections & Applications Prompt
        const connectionsMatch = content.match(/## Connections & Applications Prompt\s*```\s*([\s\S]*?)\s*```/);
        if (connectionsMatch) {
            prompts.connections = connectionsMatch[1].trim();
        }

        // Learning & Next Steps Prompt
        const learningMatch = content.match(/## Learning & Next Steps Prompt\s*```\s*([\s\S]*?)\s*```/);
        if (learningMatch) {
            prompts.learning = learningMatch[1].trim();
        }

        // Ensure all prompts are present, fallback to defaults if missing
        const defaultPrompts = this.getDefaultPrompts();
        return {
            structure: prompts.structure || defaultPrompts.structure,
            content: prompts.content || defaultPrompts.content,
            perspectives: prompts.perspectives || defaultPrompts.perspectives,
            connections: prompts.connections || defaultPrompts.connections,
            learning: prompts.learning || defaultPrompts.learning
        };
    }

    private getDefaultPrompts(): IntentPrompts {
        // Return the current default prompts from settings as fallback
        return {
            structure: `You are an expert knowledge organizer. Analyze this content and return comprehensive structure and metadata.

EXISTING KNOWLEDGE HIERARCHY:
{HIERARCHY_CONTEXT}

INSTRUCTIONS:
1. Create an optimal title that captures the essence
2. Determine the best hierarchy placement (avoid duplicates, use existing when appropriate)
3. Extract comprehensive metadata (speakers, topics, key concepts, tags)
4. Assess learning context (prerequisites, complexity, reading time)
5. Classify the source type based on content and context
6. Provide a concise overview (2-3 sentences)

{ADDITIONAL_INSTRUCTIONS}

Content to analyze:
{CONTENT}

Return ONLY valid JSON:
{
  "title": "Comprehensive title",
  "hierarchy": {
    "level1": "Domain",
    "level2": "Area", 
    "level3": "Topic",
    "level4": "Concept"
  },
  "metadata": {
    "speakers": ["speaker1", "speaker2"],
    "topics": ["topic1", "topic2"],
    "key_concepts": ["concept1", "concept2"],
    "tags": ["#tag1", "#tag2"],
    "related": ["related1", "related2"]
  },
  "learning_context": {
    "prerequisites": ["prereq1", "prereq2"],
    "related_concepts": ["concept1", "concept2"],
    "learning_path": ["step1", "step2"],
    "complexity_level": "beginner|intermediate|advanced",
    "estimated_reading_time": "X minutes"
  },
  "source_type": "social|academic|news|professional|traditional",
  "overview": "Brief 2-3 sentence overview of the content"
}`,
            content: `You are an expert content analyst. Provide deep, comprehensive analysis of this content.

CONTENT CONTEXT:
Title: {TITLE}
Domain: {DOMAIN}
Topic: {TOPIC}

INSTRUCTIONS:
Create comprehensive analysis sections. Be thorough and detailed.

{ADDITIONAL_INSTRUCTIONS}

Content to analyze:
{CONTENT}

Return ONLY valid JSON:
{
  "context": "Detailed background and why this matters",
  "key_facts": [
    "Fact 1 with detailed explanation",
    "Fact 2 with detailed explanation"
  ],
  "deep_insights": [
    "Insight 1: Deep analysis of patterns, implications, connections",
    "Insight 2: Another profound insight with reasoning"
  ],
  "core_concepts": [
    "Concept 1: Detailed explanation and significance", 
    "Concept 2: Another key concept with context"
  ],
  "detailed_summary": "Comprehensive summary covering all major points"
}`,
            perspectives: `You are an expert at analyzing multiple viewpoints and creating practical examples.

CONTENT CONTEXT:
Title: {TITLE}
Overview: {OVERVIEW}

INSTRUCTIONS:
Analyze different perspectives and create rich examples.

{ADDITIONAL_INSTRUCTIONS}

Content to analyze:
{CONTENT}

Return ONLY valid JSON:
{
  "multiple_perspectives": [
    {
      "viewpoint": "Academic/Research Perspective",
      "analysis": "Detailed analysis from this viewpoint"
    },
    {
      "viewpoint": "Industry/Practical Perspective", 
      "analysis": "Detailed analysis from this viewpoint"
    }
  ],
  "analogies_examples": [
    {
      "concept": "Key concept being explained",
      "analogy": "Detailed analogy with clear explanation",
      "real_world_example": "Concrete real-world example with context"
    }
  ],
  "case_studies": [
    "Detailed case study 1 showing practical application"
  ]
}`,
            connections: `You are an expert at finding connections and practical applications.

CONTENT CONTEXT:
Title: {TITLE}
Domain: {DOMAIN}
Key Concepts: {KEY_CONCEPTS}

INSTRUCTIONS:
Find deep connections and practical applications.

{ADDITIONAL_INSTRUCTIONS}

Content to analyze:
{CONTENT}

Return ONLY valid JSON:
{
  "knowledge_connections": [
    {
      "related_field": "Connected field/domain",
      "connection_type": "How they connect",
      "detailed_explanation": "Deep explanation of the connection"
    }
  ],
  "practical_applications": [
    {
      "domain": "Application domain",
      "application": "Specific application",
      "implementation": "How to implement/use this",
      "benefits": "Expected benefits and outcomes"
    }
  ],
  "implications_consequences": [
    "Long-term implication 1 with detailed reasoning"
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
    "Specific gap 1 with explanation of why it matters"
  ],
  "learning_pathways": [
    {
      "pathway_name": "Learning Path",
      "steps": [
        "Step 1: Detailed description and resources"
      ],
      "estimated_time": "Time estimate",
      "difficulty": "difficulty level"
    }
  ],
  "actionable_next_steps": [
    {
      "category": "Immediate Actions",
      "actions": [
        "Specific action 1 with clear instructions"
      ]
    }
  ],
  "reflection_questions": [
    "Deep question 1 to promote critical thinking"
  ]
}`
        };
    }

    clearCache(): void {
        this.promptCache.clear();
    }
}