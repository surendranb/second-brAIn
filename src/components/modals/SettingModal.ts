/**
 * Setting Modal Component
 * Extracted from main.ts for better modularity
 */

import { App, Modal, Setting } from 'obsidian';
import { PluginSettings, DEFAULT_SETTINGS, GeminiModel, Provider } from '../../config';

export class SettingModal extends Modal {
    settings: PluginSettings = { ...DEFAULT_SETTINGS };
    onSubmit: (settings: PluginSettings) => void;

    constructor(app: App, onSubmit: (settings: PluginSettings) => void) {
        super(app);
        this.onSubmit = onSubmit;
    }

    display(): void {
        const { contentEl } = this;
        contentEl.empty();
        this.onOpen();
    }

    onOpen() {
        const { contentEl } = this;

        contentEl.createEl('h2', { text: 'AI Summarizer Settings' });

        // Provider Selection
        new Setting(contentEl)
            .setName('AI Provider')
            .setDesc('Select the AI provider to use for summarization')
            .addDropdown(dropdown => dropdown
                .addOption('gemini', 'Google Gemini')
                .setValue(this.settings.provider)
                .onChange(value => {
                    this.settings.provider = value as Provider;
                    this.populateModelDropdown();
                }));

        // Provider-specific settings
        if (this.settings.provider === 'gemini') {
            new Setting(contentEl)
                .setName('Gemini API Key')
                .setDesc('Your Google Gemini API key')
                .addText(text => text
                    .setPlaceholder('Enter your API key')
                    .setValue(this.settings.gemini.apiKey)
                    .onChange(value => {
                        this.settings.gemini.apiKey = value;
                    }));

            new Setting(contentEl)
                .setName('Gemini Model')
                .setDesc('Select the Gemini model to use')
                .addDropdown(dropdown => {
                    this.settings.gemini.models.forEach((model: GeminiModel) => {
                        dropdown.addOption(model.id, `${model.name} - ${model.description}`);
                    });
                    return dropdown
                        .setValue(this.settings.gemini.model)
                        .onChange(value => {
                            this.settings.gemini.model = value;
                        });
                });

            // Common Settings
            new Setting(contentEl)
                .setName('Default Prompt')
                .setDesc('The default prompt used for summarization')
                .addTextArea(text => text
                    .setPlaceholder('Enter your default prompt')
                    .setValue(this.settings.defaultPrompt)
                    .onChange(value => {
                        this.settings.defaultPrompt = value;
                    }));

            new Setting(contentEl)
                .addButton((btn) =>
                    btn
                        .setButtonText("Save")
                        .setCta()
                        .onClick(() => {
                            this.onSubmit(this.settings);
                            this.close();
                        })
                );
        }
    }

    onClose() {
        let { contentEl } = this;
        contentEl.empty();
    }

    populateModelDropdown() {
        this.onOpen();
    }
}