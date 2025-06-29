import { App, PluginSettingTab, Setting } from 'obsidian';
import AISummarizerPlugin, { Provider, GeminiModel, OpenRouterModel } from './main';

export class AISummarizerSettingsTab extends PluginSettingTab {
    plugin: AISummarizerPlugin;

    constructor(app: App, plugin: AISummarizerPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        // Provider Selection
        new Setting(containerEl)
            .setName('AI Provider')
            .setDesc('Select the AI provider to use for summarization')
            .addDropdown(dropdown => dropdown
                .addOption('gemini', 'Google Gemini')
                .addOption('openrouter', 'OpenRouter')
                .setValue(this.plugin.settings.provider)
                .onChange(async (value) => {
                    this.plugin.settings.provider = value as Provider;
                    await this.plugin.saveSettings();
                    this.display(); // Refresh settings UI
                }));

        // Provider-specific settings
        if (this.plugin.settings.provider === 'gemini') {
            // Gemini API Key
            new Setting(containerEl)
                .setName('Gemini API Key')
                .setDesc('Your Google Gemini API key')
                .addText(text => text
                    .setPlaceholder('Enter your API key')
                    .setValue(this.plugin.settings.gemini.apiKey)
                    .onChange(async (value) => {
                        this.plugin.settings.gemini.apiKey = value;
                        await this.plugin.saveSettings();
                    }));

            // Gemini Model Selection
            new Setting(containerEl)
                .setName('Gemini Model')
                .setDesc('Select the Gemini model to use')
                .addDropdown(dropdown => {
                    // Clear and repopulate dropdown
                    dropdown.selectEl.innerHTML = '';
                    this.plugin.settings.gemini.models.forEach((model: GeminiModel) => {
                        dropdown.addOption(model.id, `${model.name} - ${model.description}`);
                    });
                    return dropdown
                        .setValue(this.plugin.settings.gemini.model)
                        .onChange(async (value) => {
                            this.plugin.settings.gemini.model = value;
                            await this.plugin.saveSettings();
                        });
                });
        } else if (this.plugin.settings.provider === 'openrouter') {
            // OpenRouter API Key
            new Setting(containerEl)
                .setName('OpenRouter API Key')
                .setDesc('Your OpenRouter API key')
                .addText(text => text
                    .setPlaceholder('Enter your API key')
                    .setValue(this.plugin.settings.openrouter.apiKey)
                    .onChange(async (value) => {
                        this.plugin.settings.openrouter.apiKey = value;
                        await this.plugin.saveSettings();
                    }));

            // OpenRouter Model Selection
            new Setting(containerEl)
                .setName('OpenRouter Model')
                .setDesc('Select the model to use via OpenRouter')
                .addDropdown(dropdown => {
                    // Clear and repopulate dropdown
                    dropdown.selectEl.innerHTML = '';
                    this.plugin.settings.openrouter.models.forEach((model: OpenRouterModel) => {
                        dropdown.addOption(model.id, `${model.name} (${model.provider}) - ${model.description}`);
                    });
                    return dropdown
                        .setValue(this.plugin.settings.openrouter.model)
                        .onChange(async (value) => {
                            this.plugin.settings.openrouter.model = value;
                            await this.plugin.saveSettings();
                        });
                });

            // OpenRouter Endpoint
            new Setting(containerEl)
                .setName('OpenRouter Endpoint')
                .setDesc('The OpenRouter API endpoint')
                .addText(text => text
                    .setPlaceholder('Enter endpoint URL')
                    .setValue(this.plugin.settings.openrouter.endpoint)
                    .onChange(async (value) => {
                        this.plugin.settings.openrouter.endpoint = value;
                        await this.plugin.saveSettings();
                    }));
        }

        // Common Settings
        new Setting(containerEl)
            .setName('Default Prompt')
            .setDesc('The default prompt used for summarization')
            .addTextArea(text => text
                .setPlaceholder('Enter your default prompt')
                .setValue(this.plugin.settings.defaultPrompt)
                .onChange(async (value) => {
                    this.plugin.settings.defaultPrompt = value;
                    await this.plugin.saveSettings();
                }));



        // MOC Settings Section
        containerEl.createEl('h3', { text: 'MOC (Map of Content) Settings' });

        new Setting(containerEl)
            .setName('Enable MOC Organization')
            .setDesc('Automatically organize notes into knowledge hierarchies (Maps of Content). Notes will be saved alongside MOCs in organized folder structures.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.enableMOC)
                .onChange(async (value) => {
                    this.plugin.settings.enableMOC = value;
                    await this.plugin.saveSettings();
                    this.display(); // Refresh to show/hide MOC folder setting
                }));

        if (this.plugin.settings.enableMOC) {
            new Setting(containerEl)
                .setName('Knowledge Base Folder')
                .setDesc('Root folder for knowledge organization. Both notes and MOCs will be saved in hierarchical subfolders within this directory.')
                .addText(text => text
                    .setPlaceholder('MOCs')
                    .setValue(this.plugin.settings.mocFolder)
                    .onChange(async (value) => {
                        this.plugin.settings.mocFolder = value;
                        await this.plugin.saveSettings();
                    }));
        }

        // Analysis Prompts Section
        containerEl.createEl('h3', { text: 'Analysis Prompts Configuration' });
        
        const promptsDesc = containerEl.createEl('p', { 
            text: 'Customize the prompts used in the 5-pass analysis system. Use {ADDITIONAL_INSTRUCTIONS} placeholder to inject user instructions from the main UI.' 
        });
        promptsDesc.style.color = 'var(--text-muted)';
        promptsDesc.style.fontSize = '0.9em';
        promptsDesc.style.marginBottom = '20px';

        // Structure Analysis Prompt
        new Setting(containerEl)
            .setName('📋 Structure & Metadata Prompt')
            .setDesc('Prompt for analyzing content structure, titles, hierarchy, and metadata (Pass 1)')
            .addTextArea(text => {
                text.inputEl.rows = 8;
                text.inputEl.style.fontFamily = 'monospace';
                text.inputEl.style.fontSize = '12px';
                return text
                    .setPlaceholder('Enter structure analysis prompt...')
                    .setValue(this.plugin.settings.analysisPrompts.structure)
                    .onChange(async (value) => {
                        this.plugin.settings.analysisPrompts.structure = value;
                        await this.plugin.saveSettings();
                    });
            })
            .addButton(button => button
                .setButtonText('Reset to Default')
                .setTooltip('Reset to default structure prompt')
                .onClick(async () => {
                    // We'll need to import DEFAULT_SETTINGS for this
                    this.plugin.settings.analysisPrompts.structure = this.getDefaultStructurePrompt();
                    await this.plugin.saveSettings();
                    this.display();
                }));

        // Content Analysis Prompt
        new Setting(containerEl)
            .setName('🧠 Content Analysis Prompt')
            .setDesc('Prompt for deep content analysis, facts, insights, and concepts (Pass 2)')
            .addTextArea(text => {
                text.inputEl.rows = 8;
                text.inputEl.style.fontFamily = 'monospace';
                text.inputEl.style.fontSize = '12px';
                return text
                    .setPlaceholder('Enter content analysis prompt...')
                    .setValue(this.plugin.settings.analysisPrompts.content)
                    .onChange(async (value) => {
                        this.plugin.settings.analysisPrompts.content = value;
                        await this.plugin.saveSettings();
                    });
            })
            .addButton(button => button
                .setButtonText('Reset to Default')
                .setTooltip('Reset to default content prompt')
                .onClick(async () => {
                    this.plugin.settings.analysisPrompts.content = this.getDefaultContentPrompt();
                    await this.plugin.saveSettings();
                    this.display();
                }));

        // Perspectives Analysis Prompt
        new Setting(containerEl)
            .setName('👁️ Perspectives & Examples Prompt')
            .setDesc('Prompt for analyzing multiple viewpoints, analogies, and examples (Pass 3)')
            .addTextArea(text => {
                text.inputEl.rows = 8;
                text.inputEl.style.fontFamily = 'monospace';
                text.inputEl.style.fontSize = '12px';
                return text
                    .setPlaceholder('Enter perspectives analysis prompt...')
                    .setValue(this.plugin.settings.analysisPrompts.perspectives)
                    .onChange(async (value) => {
                        this.plugin.settings.analysisPrompts.perspectives = value;
                        await this.plugin.saveSettings();
                    });
            })
            .addButton(button => button
                .setButtonText('Reset to Default')
                .setTooltip('Reset to default perspectives prompt')
                .onClick(async () => {
                    this.plugin.settings.analysisPrompts.perspectives = this.getDefaultPerspectivesPrompt();
                    await this.plugin.saveSettings();
                    this.display();
                }));

        // Connections Analysis Prompt
        new Setting(containerEl)
            .setName('🔗 Connections & Applications Prompt')
            .setDesc('Prompt for finding knowledge connections and practical applications (Pass 4)')
            .addTextArea(text => {
                text.inputEl.rows = 8;
                text.inputEl.style.fontFamily = 'monospace';
                text.inputEl.style.fontSize = '12px';
                return text
                    .setPlaceholder('Enter connections analysis prompt...')
                    .setValue(this.plugin.settings.analysisPrompts.connections)
                    .onChange(async (value) => {
                        this.plugin.settings.analysisPrompts.connections = value;
                        await this.plugin.saveSettings();
                    });
            })
            .addButton(button => button
                .setButtonText('Reset to Default')
                .setTooltip('Reset to default connections prompt')
                .onClick(async () => {
                    this.plugin.settings.analysisPrompts.connections = this.getDefaultConnectionsPrompt();
                    await this.plugin.saveSettings();
                    this.display();
                }));

        // Learning Analysis Prompt
        new Setting(containerEl)
            .setName('🎯 Learning & Next Steps Prompt')
            .setDesc('Prompt for learning pathways, action planning, and next steps (Pass 5)')
            .addTextArea(text => {
                text.inputEl.rows = 8;
                text.inputEl.style.fontFamily = 'monospace';
                text.inputEl.style.fontSize = '12px';
                return text
                    .setPlaceholder('Enter learning analysis prompt...')
                    .setValue(this.plugin.settings.analysisPrompts.learning)
                    .onChange(async (value) => {
                        this.plugin.settings.analysisPrompts.learning = value;
                        await this.plugin.saveSettings();
                    });
            })
            .addButton(button => button
                .setButtonText('Reset to Default')
                .setTooltip('Reset to default learning prompt')
                .onClick(async () => {
                    this.plugin.settings.analysisPrompts.learning = this.getDefaultLearningPrompt();
                    await this.plugin.saveSettings();
                    this.display();
                }));
    }

    // Helper methods to get default prompts
    private getDefaultStructurePrompt(): string {
        return `You are an expert knowledge organizer. Analyze this content and return comprehensive structure and metadata.

EXISTING KNOWLEDGE HIERARCHY:
{HIERARCHY_CONTEXT}

INSTRUCTIONS:
1. Create an optimal title that captures the essence
2. Determine the best hierarchy placement (avoid duplicates, use existing when appropriate)
3. Extract comprehensive metadata (speakers, topics, key concepts, tags)
4. Assess learning context (prerequisites, complexity, reading time)
5. Provide a concise overview (2-3 sentences)

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
  "overview": "Brief 2-3 sentence overview of the content"
}`;
    }

    private getDefaultContentPrompt(): string {
        return `You are an expert content analyst. Provide deep, comprehensive analysis of this content.

CONTENT CONTEXT:
Title: {TITLE}
Domain: {DOMAIN}
Topic: {TOPIC}

INSTRUCTIONS:
Create comprehensive but FOCUSED analysis sections. Be thorough yet concise.
IMPORTANT: Keep each insight/fact under 300 characters. Limit arrays to 4-6 items maximum.

{ADDITIONAL_INSTRUCTIONS}

Content to analyze:
{CONTENT}

Return ONLY valid JSON:
{
  "context": "Detailed background and why this matters (200+ words)",
  "key_facts": [
    "Fact 1 with detailed explanation",
    "Fact 2 with detailed explanation",
    "Fact 3 with detailed explanation"
  ],
  "deep_insights": [
    "Insight 1: Deep analysis of patterns, implications, connections",
    "Insight 2: Another profound insight with reasoning",
    "Insight 3: Third insight connecting to broader themes"
  ],
  "core_concepts": [
    "Concept 1: Detailed explanation and significance", 
    "Concept 2: Another key concept with context",
    "Concept 3: Third important concept"
  ],
  "detailed_summary": "Comprehensive 300+ word summary covering all major points"
}`;
    }

    private getDefaultPerspectivesPrompt(): string {
        return `You are an expert at analyzing multiple viewpoints and creating practical examples.

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
}`;
    }

    private getDefaultConnectionsPrompt(): string {
        return `You are an expert at finding connections and practical applications.

CONTENT CONTEXT:
Title: {TITLE}
Domain: {DOMAIN}
Key Concepts: {KEY_CONCEPTS}

INSTRUCTIONS:
Find deep connections and practical applications. Be thorough yet concise.
IMPORTANT: Keep explanations under 250 characters. Limit arrays to 3-4 items maximum.

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
}`;
    }

    private getDefaultLearningPrompt(): string {
        return `You are an expert learning designer and action planner.

CONTENT CONTEXT:
Title: {TITLE}
Complexity: {COMPLEXITY}
Prerequisites: {PREREQUISITES}

INSTRUCTIONS:
Create comprehensive but CONCISE learning paths and actionable next steps. 
IMPORTANT: Keep each array element under 200 characters. Limit arrays to 3-5 items maximum.

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
}`;
    }
}
