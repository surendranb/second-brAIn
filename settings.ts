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
    }
}
