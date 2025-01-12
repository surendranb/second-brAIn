import { PluginSettingTab, Setting } from 'obsidian';
import AISummarizerPlugin from './main';  // Adjust the import path if necessary

export class AISummarizerSettingTab extends PluginSettingTab {
  plugin: AISummarizerPlugin;

  constructor(app: App, plugin: AISummarizerPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    let { containerEl } = this;

    containerEl.empty();
    containerEl.createEl('h2', { text: 'AI Summarizer Settings' });

    new Setting(containerEl)
      .setName('OpenAI API Key')
      .setDesc('Enter your OpenAI API key here.')
      .addText(text => text
        .setPlaceholder('Enter API key')
        .setValue(this.plugin.settings.apiKey || '')
        .onChange(value => {
          this.plugin.settings.apiKey = value;
          this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('OpenAI Model')
      .setDesc('Select the OpenAI model to use for summarization.')
      .addDropdown(dropdown => dropdown
        .addOption('gpt-4o-mini', 'GPT-4O Mini')
        .addOption('gpt-4o', 'GPT-4O') 
        .addOption('gpt-4-turbo', 'GPT-4 Turbo')
        .addOption('gpt-4', 'GPT-4')
        .setValue(this.plugin.settings.model)
        .onChange(value => {
          this.plugin.settings.model = value;
          this.plugin.saveSettings();
        }));
  }
}
