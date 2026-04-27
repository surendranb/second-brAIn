import { App, PluginSettingTab, Setting } from 'obsidian';
import AISummarizerPlugin from './main';
import { Provider, GeminiModel, GEMINI_MODELS, OPENROUTER_MODELS, ProcessingIntent } from './src/config';
import { IntentPrompts, PromptLoader } from './src/services/prompt-loader';

export class AISummarizerSettingsTab extends PluginSettingTab {
    plugin: AISummarizerPlugin;
    private promptLoader: PromptLoader;

    constructor(app: App, plugin: AISummarizerPlugin) {
        super(app, plugin);
        this.plugin = plugin;
        this.promptLoader = new PromptLoader(this.app);
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        // Provider Selection
        new Setting(containerEl)
            .setName('AI provider')
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
            // Gemini API key
            new Setting(containerEl)
                .setName('Gemini API key')
                .setDesc('Your Google Gemini API key')
                .addText(text => text
                    .setPlaceholder('Enter your API key')
                    .setValue(this.plugin.settings.gemini.apiKey)
                    .onChange(async (value) => {
                        this.plugin.settings.gemini.apiKey = value;
                        await this.plugin.saveSettings();
                    }));

            // Gemini model selection
            new Setting(containerEl)
                .setName('Gemini model')
                .setDesc('Select the Gemini model to use')
                .addDropdown(dropdown => {
                    dropdown.selectEl.empty();
                    GEMINI_MODELS.forEach((model: GeminiModel) => {
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
            // OpenRouter API key
            new Setting(containerEl)
                .setName('OpenRouter API key')
                .setDesc('Your OpenRouter API key')
                .addText(text => text
                    .setPlaceholder('sk-or-...')
                    .setValue(this.plugin.settings.openrouter.apiKey)
                    .onChange(async (value) => {
                        this.plugin.settings.openrouter.apiKey = value;
                        await this.plugin.saveSettings();
                    }));

            // OpenRouter model selection
            new Setting(containerEl)
                .setName('OpenRouter model')
                .setDesc('Select the OpenRouter model to use')
                .addDropdown(dropdown => {
                    dropdown.selectEl.empty();
                    OPENROUTER_MODELS.forEach((model: GeminiModel) => {
                        dropdown.addOption(model.id, `${model.name} - ${model.description}`);
                    });
                    return dropdown
                        .setValue(this.plugin.settings.openrouter.model)
                        .onChange(async (value) => {
                            this.plugin.settings.openrouter.model = value;
                            await this.plugin.saveSettings();
                        });
                });
        }

        // Common Settings
        new Setting(containerEl)
            .setName('Default prompt')
            .setDesc('The default prompt used for summarization')
            .addTextArea(text => text
                .setPlaceholder('Enter your default prompt')
                .setValue(this.plugin.settings.defaultPrompt)
                .onChange(async (value) => {
                    this.plugin.settings.defaultPrompt = value;
                    await this.plugin.saveSettings();
                }));



        // Langfuse tracing
        new Setting(containerEl).setName('Langfuse tracing').setHeading();

        new Setting(containerEl)
            .setName('Enable Langfuse tracing')
            .setDesc('Track AI calls for observability, cost analysis, and performance monitoring')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.langfuse.enabled)
                .onChange(async (value) => {
                    this.plugin.settings.langfuse.enabled = value;
                    await this.plugin.saveSettings();
                    this.display(); // Refresh to show/hide Langfuse settings
                }));

        if (this.plugin.settings.langfuse.enabled) {
            new Setting(containerEl)
                .setName('Langfuse public key')
                .setDesc('Your langfuse public key (pk-lf-...)')
                .addText(text => text
                    .setPlaceholder('pk-lf-...')
                    .setValue(this.plugin.settings.langfuse.publicKey)
                    .onChange(async (value) => {
                        this.plugin.settings.langfuse.publicKey = value;
                        await this.plugin.saveSettings();
                    }));

            new Setting(containerEl)
                .setName('Langfuse secret key')
                .setDesc('Your langfuse secret key (sk-lf-...)')
                .addText(text => {
                    text.inputEl.type = 'password';
                    return text
                        .setPlaceholder('sk-lf-...')
                        .setValue(this.plugin.settings.langfuse.secretKey)
                        .onChange(async (value) => {
                            this.plugin.settings.langfuse.secretKey = value;
                            await this.plugin.saveSettings();
                        });
                });

            new Setting(containerEl)
                .setName('Langfuse base URL')
                .setDesc('Langfuse server URL (use https://cloud.langfuse.com for cloud)')
                .addText(text => text
                    .setPlaceholder('https://cloud.langfuse.com')
                    .setValue(this.plugin.settings.langfuse.baseUrl)
                    .onChange(async (value) => {
                        this.plugin.settings.langfuse.baseUrl = value;
                        await this.plugin.saveSettings();
                    }));
        }

        // MOC organization
        new Setting(containerEl).setName('MOC (map of content)').setHeading();

        new Setting(containerEl)
            .setName('Enable MOC organization')
            .setDesc('Automatically organize notes into knowledge hierarchies (maps of content). Notes will be saved alongside mocs in organized folder structures.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.enableMOC)
                .onChange(async (value) => {
                    this.plugin.settings.enableMOC = value;
                    await this.plugin.saveSettings();
                    this.display(); // Refresh to show/hide MOC folder setting
                }));

        if (this.plugin.settings.enableMOC) {
            new Setting(containerEl)
                .setName('Knowledge base folder')
                .setDesc('Root folder for knowledge organization. Both notes and mocs will be saved in hierarchical subfolders within this directory.')
                .addText(text => text
                    .setPlaceholder('mocs')
                    .setValue(this.plugin.settings.mocFolder)
                    .onChange(async (value) => {
                        this.plugin.settings.mocFolder = value;
                        await this.plugin.saveSettings();
                    }));
        }

        // Topic folders
        new Setting(containerEl).setName('Topic folders').setHeading();

        new Setting(containerEl)
            .setName('Enable topic folders')
            .setDesc('Organize "how to / tutorial" content into topic-specific folders for focused research collections')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.topicFolders.enabled)
                .onChange(async (value) => {
                    this.plugin.settings.topicFolders.enabled = value;
                    await this.plugin.saveSettings();
                    this.display(); // Refresh to show/hide topic folder settings
                }));

        if (this.plugin.settings.topicFolders.enabled) {
            new Setting(containerEl)
                .setName('Topic folders root')
                .setDesc('Root folder for topic-based organization (e.g., "research topics")')
                .addText(text => text
                    .setPlaceholder('research topics')
                    .setValue(this.plugin.settings.topicFolders.rootFolder)
                    .onChange(async (value) => {
                        this.plugin.settings.topicFolders.rootFolder = value;
                        await this.plugin.saveSettings();
                    }));

            new Setting(containerEl)
                .setName('Predefined topics')
                .setDesc('Comma-separated list of topics for quick selection')
                .addTextArea(text => {
                    text.inputEl.rows = 3;
                    return text
                        .setPlaceholder('LLM evals, AI safety, machine learning, data science')
                        .setValue(this.plugin.settings.topicFolders.topics.join(', '))
                        .onChange(async (value) => {
                            this.plugin.settings.topicFolders.topics = value
                                .split(',')
                                .map(topic => topic.trim())
                                .filter(topic => topic.length > 0);
                            await this.plugin.saveSettings();
                        });
                });
        }

        // Transcript Archiving Section
        new Setting(containerEl).setName('Transcript archiving').setHeading();

        new Setting(containerEl)
            .setName('Enable transcript archiving')
            .setDesc('Save the full raw transcript as a separate file in a hierarchical archive folder')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.archive.enabled)
                .onChange(async (value) => {
                    this.plugin.settings.archive.enabled = value;
                    await this.plugin.saveSettings();
                    this.display();
                }));

        if (this.plugin.settings.archive.enabled) {
            new Setting(containerEl)
                .setName('Archive root folder')
                .setDesc('Root folder for hierarchical archiving (year/month)')
                .addText(text => text
                    .setPlaceholder('archive/transcripts')
                    .setValue(this.plugin.settings.archive.rootFolder)
                    .onChange(async (value) => {
                        this.plugin.settings.archive.rootFolder = value;
                        await this.plugin.saveSettings();
                    }));
        }

        // Debug & analysis
        new Setting(containerEl).setName('Debug and analysis').setHeading();

        new Setting(containerEl)
            .setName('Enable debug mode')
            .setDesc('Save raw content, prompts, and AI responses for analysis and prompt improvement')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.debug.enabled)
                .onChange(async (value) => {
                    this.plugin.settings.debug.enabled = value;
                    await this.plugin.saveSettings();
                    this.display(); // Refresh to show/hide debug options
                }));

        if (this.plugin.settings.debug.enabled) {
            new Setting(containerEl)
                .setName('Debug folder')
                .setDesc('Folder where debug files will be saved')
                .addText(text => text
                    .setPlaceholder('Debug')
                    .setValue(this.plugin.settings.debug.debugFolder)
                    .onChange(async (value) => {
                        this.plugin.settings.debug.debugFolder = value;
                        await this.plugin.saveSettings();
                    }));

            new Setting(containerEl)
                .setName('Save raw content')
                .setDesc('Save original transcripts and web content before AI processing')
                .addToggle(toggle => toggle
                    .setValue(this.plugin.settings.debug.saveRawContent)
                    .onChange(async (value) => {
                        this.plugin.settings.debug.saveRawContent = value;
                        await this.plugin.saveSettings();
                    }));

            new Setting(containerEl)
                .setName('Save AI prompts')
                .setDesc('Save the actual prompts sent to the AI for each analysis pass')
                .addToggle(toggle => toggle
                    .setValue(this.plugin.settings.debug.savePrompts)
                    .onChange(async (value) => {
                        this.plugin.settings.debug.savePrompts = value;
                        await this.plugin.saveSettings();
                    }));

            new Setting(containerEl)
                .setName('Save AI responses')
                .setDesc('Save raw AI responses before processing and formatting')
                .addToggle(toggle => toggle
                    .setValue(this.plugin.settings.debug.saveResponses)
                    .onChange(async (value) => {
                        this.plugin.settings.debug.saveResponses = value;
                        await this.plugin.saveSettings();
                    }));
        }

        // Intent & Prompt Management Section
        new Setting(containerEl).setName('Intent and prompt management').setHeading();

        new Setting(containerEl)
            .setName('Default processing intent')
            .setDesc('Choose the default intent for processing content. This determines which prompts and analysis approach to use.')
            .addDropdown(dropdown => dropdown
                .addOption('knowledge_building', 'Knowledge building - deep learning and understanding')
                .addOption('quick_reference', 'Quick reference - actionable guides and how-tos')
                .addOption('research_collection', 'Research collection - academic and research content')
                .addOption('event_documentation', 'Event documentation - meeting notes and events')
                .addOption('professional_intelligence', 'Professional intelligence - business insights')
                .addOption('personal_development', 'Personal development - growth and learning')
                .addOption('news_events', 'News & events - current events and news')
                .addOption('inspiration_capture', 'Inspiration capture - creative and inspirational content')
                .addOption('how_to', 'How-to guides - step-by-step tutorials')
                .setValue(this.plugin.settings.defaultIntent)
                .onChange(async (value) => {
                    this.plugin.settings.defaultIntent = value as ProcessingIntent;
                    await this.plugin.saveSettings();
                }));

        // Prompt Management
        void this.displayIntentManagement(containerEl);
    }

    private displayIntentManagement(containerEl: HTMLElement): void {
        const intentSection = containerEl.createDiv({ cls: 'axiom-intent-section' });

        // Intent Selection for Prompt Editing
        new Setting(intentSection)
            .setName('Edit prompts for intent')
            .setDesc('Select an intent to view and edit its prompts')
            .addDropdown(dropdown => {
                dropdown
                    .addOption('', 'Select an intent to edit...')
                    .addOption('knowledge_building', 'Knowledge building')
                    .addOption('quick_reference', 'Quick reference')
                    .addOption('research_collection', 'Research collection')
                    .addOption('event_documentation', 'Event documentation')
                    .addOption('professional_intelligence', 'Professional intelligence')
                    .addOption('personal_development', 'Personal development')
                    .addOption('news_events', 'News & events')
                    .addOption('inspiration_capture', 'Inspiration capture')
                    .addOption('how_to', 'How-to guides')
                    .onChange(async (value) => {
                        if (value) {
                            await this.displayPromptEditor(intentSection, value as ProcessingIntent);
                        } else {
                            this.clearPromptEditor(intentSection);
                        }
                    });
            });

        // Prompt Status Info
        const statusDiv = intentSection.createDiv({ cls: 'axiom-status-div' });

        statusDiv.createEl('p', {
            text: 'Prompts are loaded from JSON files in the prompts/ folder. Each intent has five specialized prompts: structure, content, perspectives, connections, and learning.',
            cls: 'axiom-status-text'
        });
    }

    private async displayPromptEditor(containerEl: HTMLElement, intent: ProcessingIntent): Promise<void> {
        // Clear any existing prompt editor
        this.clearPromptEditor(containerEl);

        const editorDiv = containerEl.createDiv({ cls: 'axiom-prompt-editor' });

        new Setting(editorDiv)
            .setName(`Prompts for ${this.getIntentDisplayName(intent)}`)
            .setHeading();

        try {
            // Load prompts for this intent
            const prompts = await this.promptLoader.loadPromptsForIntent(intent);

            // Display each prompt type
            const promptTypes = [
                { key: 'structure', name: 'Structure analysis', desc: 'Analyzes content structure and metadata' },
                { key: 'content', name: 'Content extraction', desc: 'Extracts key information and actionable content' },
                { key: 'perspectives', name: 'Perspectives analysis', desc: 'Provides different viewpoints and approaches' },
                { key: 'connections', name: 'Connections mapping', desc: 'Identifies relationships and connections' },
                { key: 'learning', name: 'Learning enhancement', desc: 'Focuses on learning and improvement opportunities' }
            ];

            promptTypes.forEach(({ key, name, desc }) => {
                const promptSection = editorDiv.createDiv({ cls: 'axiom-prompt-section' });

                new Setting(promptSection)
                    .setName(name)
                    .setHeading();

                promptSection.createEl('p', { text: desc, cls: 'axiom-prompt-desc' });

                const promptText = promptSection.createEl('textarea', { cls: 'axiom-prompt-textarea' });
                promptText.value = prompts[key as keyof IntentPrompts];
                promptText.readOnly = true; // For now, make read-only
            });

            // Add info about editing
            editorDiv.createEl('p', {
                text: 'Note: Prompts are currently read-only. To edit prompts, modify the JSON files in the prompts/ folder and restart the plugin.',
                cls: 'axiom-prompt-info'
            });

        } catch (error) {
            editorDiv.createEl('p', {
                text: `Error loading prompts: ${(error as Error).message}`,
                cls: 'axiom-prompt-error'
            });
        }
    }

    private clearPromptEditor(containerEl: HTMLElement): void {
        const existingEditor = containerEl.querySelector('.prompt-editor');
        if (existingEditor) {
            existingEditor.remove();
        }
    }

    private getIntentDisplayName(intent: ProcessingIntent): string {
        const displayNames: Record<ProcessingIntent, string> = {
            'knowledge_building': 'Knowledge building',
            'quick_reference': 'Quick reference',
            'research_collection': 'Research collection',
            'event_documentation': 'Event documentation',
            'professional_intelligence': 'Professional intelligence',
            'personal_development': 'Personal development',
            'news_events': 'News and events',
            'inspiration_capture': 'Inspiration capture',
            'how_to': 'How-to guides',
            'verbatim_qa': 'Verbatim Q&A'
        };
        return displayNames[intent] || intent;
    }
}
