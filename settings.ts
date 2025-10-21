import { App, PluginSettingTab, Setting } from 'obsidian';
import AISummarizerPlugin from './main';
import { Provider, GeminiModel, GEMINI_MODELS, ProcessingIntent } from './src/config';
import { IntentPrompts, PromptLoader } from './prompt-loader';

export class AISummarizerSettingsTab extends PluginSettingTab {
    plugin: AISummarizerPlugin;
    private promptLoader: PromptLoader;

    constructor(app: App, plugin: AISummarizerPlugin) {
        super(app, plugin);
        this.plugin = plugin;
        this.promptLoader = new PromptLoader();
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



        // Langfuse Settings Section
        containerEl.createEl('h3', { text: 'Langfuse Tracing Settings' });

        new Setting(containerEl)
            .setName('Enable Langfuse Tracing')
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
                .setName('Langfuse Public Key')
                .setDesc('Your Langfuse public key (pk-lf-...)')
                .addText(text => text
                    .setPlaceholder('pk-lf-...')
                    .setValue(this.plugin.settings.langfuse.publicKey)
                    .onChange(async (value) => {
                        this.plugin.settings.langfuse.publicKey = value;
                        await this.plugin.saveSettings();
                    }));

            new Setting(containerEl)
                .setName('Langfuse Secret Key')
                .setDesc('Your Langfuse secret key (sk-lf-...)')
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
                .setName('Langfuse Base URL')
                .setDesc('Langfuse server URL (use https://cloud.langfuse.com for cloud)')
                .addText(text => text
                    .setPlaceholder('https://cloud.langfuse.com')
                    .setValue(this.plugin.settings.langfuse.baseUrl)
                    .onChange(async (value) => {
                        this.plugin.settings.langfuse.baseUrl = value;
                        await this.plugin.saveSettings();
                    }));
        }

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

        // Topic Folders Settings Section
        containerEl.createEl('h3', { text: 'Topic Folders Settings' });

        new Setting(containerEl)
            .setName('Enable Topic Folders')
            .setDesc('Organize "How To / Tutorial" content into topic-specific folders for focused research collections')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.topicFolders.enabled)
                .onChange(async (value) => {
                    this.plugin.settings.topicFolders.enabled = value;
                    await this.plugin.saveSettings();
                    this.display(); // Refresh to show/hide topic folder settings
                }));

        if (this.plugin.settings.topicFolders.enabled) {
            new Setting(containerEl)
                .setName('Topic Folders Root')
                .setDesc('Root folder for topic-based organization (e.g., "Research Topics")')
                .addText(text => text
                    .setPlaceholder('Research Topics')
                    .setValue(this.plugin.settings.topicFolders.rootFolder)
                    .onChange(async (value) => {
                        this.plugin.settings.topicFolders.rootFolder = value;
                        await this.plugin.saveSettings();
                    }));

            new Setting(containerEl)
                .setName('Predefined Topics')
                .setDesc('Comma-separated list of topics for quick selection')
                .addTextArea(text => {
                    text.inputEl.rows = 3;
                    return text
                        .setPlaceholder('LLM Evals, AI Safety, Machine Learning, Data Science')
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

        // Debug Settings Section
        containerEl.createEl('h3', { text: 'Debug & Analysis Settings' });

        new Setting(containerEl)
            .setName('Enable Debug Mode')
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
                .setName('Debug Folder')
                .setDesc('Folder where debug files will be saved')
                .addText(text => text
                    .setPlaceholder('Debug')
                    .setValue(this.plugin.settings.debug.debugFolder)
                    .onChange(async (value) => {
                        this.plugin.settings.debug.debugFolder = value;
                        await this.plugin.saveSettings();
                    }));

            new Setting(containerEl)
                .setName('Save Raw Content')
                .setDesc('Save original transcripts and web content before AI processing')
                .addToggle(toggle => toggle
                    .setValue(this.plugin.settings.debug.saveRawContent)
                    .onChange(async (value) => {
                        this.plugin.settings.debug.saveRawContent = value;
                        await this.plugin.saveSettings();
                    }));

            new Setting(containerEl)
                .setName('Save AI Prompts')
                .setDesc('Save the actual prompts sent to the AI for each analysis pass')
                .addToggle(toggle => toggle
                    .setValue(this.plugin.settings.debug.savePrompts)
                    .onChange(async (value) => {
                        this.plugin.settings.debug.savePrompts = value;
                        await this.plugin.saveSettings();
                    }));

            new Setting(containerEl)
                .setName('Save AI Responses')
                .setDesc('Save raw AI responses before processing and formatting')
                .addToggle(toggle => toggle
                    .setValue(this.plugin.settings.debug.saveResponses)
                    .onChange(async (value) => {
                        this.plugin.settings.debug.saveResponses = value;
                        await this.plugin.saveSettings();
                    }));
        }

        // Intent & Prompt Management Section
        containerEl.createEl('h3', { text: 'Intent & Prompt Management' });

        new Setting(containerEl)
            .setName('Default Processing Intent')
            .setDesc('Choose the default intent for processing content. This determines which prompts and analysis approach to use.')
            .addDropdown(dropdown => dropdown
                .addOption('knowledge_building', 'Knowledge Building - Deep learning and understanding')
                .addOption('quick_reference', 'Quick Reference - Actionable guides and how-tos')
                .addOption('research_collection', 'Research Collection - Academic and research content')
                .addOption('event_documentation', 'Event Documentation - Meeting notes and events')
                .addOption('professional_intelligence', 'Professional Intelligence - Business insights')
                .addOption('personal_development', 'Personal Development - Growth and learning')
                .addOption('news_events', 'News & Events - Current events and news')
                .addOption('inspiration_capture', 'Inspiration Capture - Creative and inspirational content')
                .addOption('how_to', 'How-To Guides - Step-by-step tutorials')
                .setValue(this.plugin.settings.defaultIntent)
                .onChange(async (value) => {
                    this.plugin.settings.defaultIntent = value as ProcessingIntent;
                    await this.plugin.saveSettings();
                }));

        // Prompt Management
        this.displayIntentManagement(containerEl);
    }

    private async displayIntentManagement(containerEl: HTMLElement): Promise<void> {
        const intentSection = containerEl.createDiv();
        intentSection.style.marginTop = '20px';

        // Intent Selection for Prompt Editing
        new Setting(intentSection)
            .setName('Edit Prompts for Intent')
            .setDesc('Select an intent to view and edit its prompts')
            .addDropdown(dropdown => {
                dropdown
                    .addOption('', 'Select an intent to edit...')
                    .addOption('knowledge_building', 'Knowledge Building')
                    .addOption('quick_reference', 'Quick Reference')
                    .addOption('research_collection', 'Research Collection')
                    .addOption('event_documentation', 'Event Documentation')
                    .addOption('professional_intelligence', 'Professional Intelligence')
                    .addOption('personal_development', 'Personal Development')
                    .addOption('news_events', 'News & Events')
                    .addOption('inspiration_capture', 'Inspiration Capture')
                    .addOption('how_to', 'How-To Guides')
                    .onChange(async (value) => {
                        if (value) {
                            await this.displayPromptEditor(intentSection, value as ProcessingIntent);
                        } else {
                            this.clearPromptEditor(intentSection);
                        }
                    });
            });

        // Prompt Status Info
        const statusDiv = intentSection.createDiv();
        statusDiv.style.marginTop = '10px';
        statusDiv.style.padding = '10px';
        statusDiv.style.backgroundColor = 'var(--background-secondary)';
        statusDiv.style.borderRadius = '4px';

        const statusText = statusDiv.createEl('p', {
            text: 'Prompts are loaded from JSON files in the prompts/ folder. Each intent has 5 specialized prompts: structure, content, perspectives, connections, and learning.'
        });
        statusText.style.margin = '0';
        statusText.style.fontSize = '0.9em';
        statusText.style.color = 'var(--text-muted)';
    }

    private async displayPromptEditor(containerEl: HTMLElement, intent: ProcessingIntent): Promise<void> {
        // Clear any existing prompt editor
        this.clearPromptEditor(containerEl);

        const editorDiv = containerEl.createDiv();
        editorDiv.addClass('prompt-editor');
        editorDiv.style.marginTop = '20px';
        editorDiv.style.border = '1px solid var(--background-modifier-border)';
        editorDiv.style.borderRadius = '4px';
        editorDiv.style.padding = '15px';

        const titleEl = editorDiv.createEl('h4', { text: `Prompts for ${this.getIntentDisplayName(intent)}` });
        titleEl.style.marginTop = '0';

        try {
            // Load prompts for this intent
            const prompts = await this.promptLoader.loadPromptsForIntent(intent);

            // Display each prompt type
            const promptTypes = [
                { key: 'structure', name: 'Structure Analysis', desc: 'Analyzes content structure and metadata' },
                { key: 'content', name: 'Content Extraction', desc: 'Extracts key information and actionable content' },
                { key: 'perspectives', name: 'Perspectives Analysis', desc: 'Provides different viewpoints and approaches' },
                { key: 'connections', name: 'Connections Mapping', desc: 'Identifies relationships and connections' },
                { key: 'learning', name: 'Learning Enhancement', desc: 'Focuses on learning and improvement opportunities' }
            ];

            promptTypes.forEach(({ key, name, desc }) => {
                const promptSection = editorDiv.createDiv();
                promptSection.style.marginBottom = '15px';

                const promptHeader = promptSection.createEl('h5', { text: name });
                promptHeader.style.marginBottom = '5px';

                const promptDesc = promptSection.createEl('p', { text: desc });
                promptDesc.style.fontSize = '0.9em';
                promptDesc.style.color = 'var(--text-muted)';
                promptDesc.style.marginBottom = '8px';

                const promptText = promptSection.createEl('textarea');
                promptText.value = prompts[key as keyof IntentPrompts];
                promptText.style.width = '100%';
                promptText.style.minHeight = '100px';
                promptText.style.fontFamily = 'var(--font-monospace)';
                promptText.style.fontSize = '0.85em';
                promptText.readOnly = true; // For now, make read-only
                promptText.style.backgroundColor = 'var(--background-secondary)';
                promptText.style.border = '1px solid var(--background-modifier-border)';
                promptText.style.borderRadius = '3px';
                promptText.style.padding = '8px';
            });

            // Add info about editing
            const editInfo = editorDiv.createEl('p', {
                text: 'Note: Prompts are currently read-only. To edit prompts, modify the JSON files in the prompts/ folder and restart the plugin.'
            });
            editInfo.style.fontSize = '0.85em';
            editInfo.style.color = 'var(--text-muted)';
            editInfo.style.fontStyle = 'italic';
            editInfo.style.marginTop = '15px';
            editInfo.style.marginBottom = '0';

        } catch (error) {
            const errorEl = editorDiv.createEl('p', {
                text: `Error loading prompts: ${error.message}`
            });
            errorEl.style.color = 'var(--text-error)';
            errorEl.style.fontStyle = 'italic';
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
            'knowledge_building': 'Knowledge Building',
            'quick_reference': 'Quick Reference',
            'research_collection': 'Research Collection',
            'event_documentation': 'Event Documentation',
            'professional_intelligence': 'Professional Intelligence',
            'personal_development': 'Personal Development',
            'news_events': 'News & Events',
            'inspiration_capture': 'Inspiration Capture',
            'how_to': 'How-To Guides'
        };
        return displayNames[intent] || intent;
    }
}
