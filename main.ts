import { Plugin, WorkspaceLeaf, ItemView, Notice, TFolder, Setting, PluginSettingTab, App, TFile, Modal } from 'obsidian';
import { GoogleGenerativeAI, GenerateContentRequest } from '@google/generative-ai';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';

const VIEW_TYPE_SUMMARY = 'ai-summarizer-summary';
const execPromise = promisify(exec);

interface PluginSettings {
    geminiApiKey: string;
    geminiModel: string;
    defaultPrompt: string;
    notesFolder: string;
}

const DEFAULT_SETTINGS: PluginSettings = {
    geminiApiKey: '',
    geminiModel: 'gemini-1.5-flash',
    defaultPrompt: 'Summarize the content from {url}.',
    notesFolder: 'Summaries',
};

class SummaryView extends ItemView {
    private urlInput: HTMLInputElement;
    private promptInput: HTMLTextAreaElement;
    private summarizeButton: HTMLButtonElement;
    private summaryTextArea: HTMLTextAreaElement;
    private createNoteButton: HTMLButtonElement;
    private resultArea: HTMLDivElement;
    private loadingIndicator: HTMLDivElement;
    private geminiClient: GoogleGenerativeAI | null = null;

    constructor(leaf: WorkspaceLeaf, private plugin: AISummarizerPlugin) {
        super(leaf);
    }

    getViewType() {
        return VIEW_TYPE_SUMMARY;
    }

    getDisplayText() {
        return 'AI Summarizer';
    }

    async onOpen() {
        const { contentEl } = this;

        contentEl.createEl('h2', { text: 'AI Summarizer' });

        const formContainer = contentEl.createEl('div', { cls: 'ai-summarizer-form' });

        formContainer.createEl('label', { text: 'Enter the URL (YouTube videos, blogs or a podcast transcript) ' });
        this.urlInput = formContainer.createEl('input', { type: 'text', placeholder: 'https://www.youtube.com/watch?v=' }) as HTMLInputElement;

        formContainer.createEl('label', { text: 'Prompt: ' });
        this.promptInput = formContainer.createEl('textarea', { placeholder: 'Write your prompt here...' }) as HTMLTextAreaElement;
        this.promptInput.value = this.plugin.settings.defaultPrompt;

        const buttonContainer = formContainer.createEl('div', { cls: 'button-container' });
        buttonContainer.style.display = 'flex';
        buttonContainer.style.flexDirection = 'column';
        buttonContainer.style.gap = '10px';

        this.summarizeButton = buttonContainer.createEl('button', { text: 'Summarize' }) as HTMLButtonElement;
        this.summarizeButton.style.width = '100%';

        this.createNoteButton = contentEl.createEl('button', { text: 'Create Note', cls: 'ai-summarizer-create-note' }) as HTMLButtonElement;
        this.createNoteButton.style.display = 'none';

        this.summaryTextArea = contentEl.createEl('textarea', { cls: 'ai-summarizer-summary' }) as HTMLTextAreaElement;
        this.summaryTextArea.style.display = 'none';
        this.summaryTextArea.style.width = '100%';
        this.summaryTextArea.style.height = '200px';
        this.summaryTextArea.style.marginTop = '20px';

        this.loadingIndicator = contentEl.createEl('div', { cls: 'ai-summarizer-loading', text: 'Processing...' });
        this.loadingIndicator.style.display = 'none';

        this.resultArea = contentEl.createEl('div', { cls: 'ai-summarizer-result' });

        this.geminiClient = new GoogleGenerativeAI(this.plugin.settings.geminiApiKey);

        this.summarizeButton.addEventListener('click', async () => {
            await this.handleSummarizeButtonClick();
        });

        this.createNoteButton.addEventListener('click', () => {
            this.handleCreateNoteButtonClick();
        });
    }

    private async handleSummarizeButtonClick() {
        const url = this.urlInput.value;
        const prompt = this.promptInput.value;

        if (!url) {
            new Notice('URL cannot be empty.');
            return;
        }

        if (!prompt) {
            new Notice('Prompt cannot be empty.');
            return;
        }

        try {
            this.loadingIndicator.style.display = 'block';
            this.resultArea.innerText = '';
            this.summaryTextArea.style.display = 'none';
            this.createNoteButton.style.display = 'none';

            let content = '';
            if (url.includes('youtube.com')) {
                content = await this.fetchTranscriptFromPython(url);
            } else {
                content = await this.fetchContentFromWebLink(url);
            }

            if (!content) {
                new Notice('Failed to fetch content. Please check the URL.');
                return;
            }

            const summary = await this.summarizeContent(content, prompt, url);

            if (summary) {
                this.summaryTextArea.value = summary;
                this.summaryTextArea.style.display = 'block';
                this.createNoteButton.style.display = 'block';
            } else {
                new Notice('Failed to generate summary.');
            }
        } catch (error) {
            new Notice(`Error: ${error.message}`);
        } finally {
            this.loadingIndicator.style.display = 'none';
        }
    }

    private async handleCreateNoteButtonClick() {
        const summary = this.summaryTextArea.value;
        const url = this.urlInput.value;

        if (summary) {
            try {
                const title = await this.generateTitle(summary);
                const newNote = await this.createNoteWithSummary(summary, title, url);

                if (newNote) {
                    const leaf = this.app.workspace.getLeaf('tab');
                    await leaf.openFile(newNote);
                }

                new Notice('Note created successfully.');
                this.summaryTextArea.style.display = 'none';
                this.createNoteButton.style.display = 'none';
            } catch (error) {
                new Notice('Error creating note.');
            }
        } else {
            new Notice('Summary cannot be empty.');
        }
    }

    private async fetchContentFromWebLink(url: string): Promise<string> {
        const vaultPath = this.app.vault.adapter.getBasePath();
        const scriptPath = path.join(vaultPath, this.plugin.manifest.dir, 'fetch_content.py');
        const quotedScriptPath = `"${scriptPath}"`;
        try {
            const { stdout, stderr } = await execPromise(`python3 ${quotedScriptPath} "${url}"`);

            if (stderr) {
                console.error('fetchContentFromWebLink: Error output from Python script:', stderr);
            }
            return stdout.trim();
        } catch (error) {
            throw new Error(`Failed to fetch content from web link: ${error.message}`);
        }
    }

    private async fetchTranscriptFromPython(url: string): Promise<string> {
        const vaultPath = this.app.vault.adapter.getBasePath();
        const scriptPath = path.join(vaultPath, this.plugin.manifest.dir, 'fetch_transcript.py');
        const quotedScriptPath = `"${scriptPath}"`;
        try {
            const { stdout, stderr } = await execPromise(`python3 ${quotedScriptPath} "${url}"`);
            if (stderr) {
                console.error('fetchTranscriptFromPython: Error output from Python script:', stderr);
            }
            return stdout.trim();
        } catch (error) {
            throw new Error(`Failed to fetch transcript: ${error.message}`);
        }
    }

    private async summarizeContent(text: string, prompt: string, url: string): Promise<string> {
        if (!this.plugin.settings.geminiApiKey || !this.plugin.settings.geminiModel) {
            new Notice('Gemini API Key or model not set.');
            return '';
        }

        try {
            const model = this.geminiClient!.getGenerativeModel({ model: this.plugin.settings.geminiModel });
            const request: GenerateContentRequest = {
                contents: [{
                    role: 'user',
                    parts: [{ text: prompt + "\n\n" + text }]
                }]
            };
            const result = await model.generateContent(request);
            return result.response.text();
        } catch (error) {
            new Notice(`Error: ${error.message}`);
            return '';
        }
    }

    private async generateTitle(summary: string): Promise<string> {
        const prompt = `Generate a descriptive title for the following summary. Ensure the title is not more than 100 characters.\n\nSummary:\n${summary}`;

        try {
            const model = this.geminiClient!.getGenerativeModel({ model: this.plugin.settings.geminiModel });
            const request: GenerateContentRequest = {
                contents: [{
                    role: 'user',
                    parts: [{ text: prompt }]
                }]
            };
            const result = await model.generateContent(request);
            let title = result.response.text();
            title = title.replace(/^"(.*)"$/, '$1').trim();
            return title;
        } catch (error) {
            return 'Untitled';
        }
    }

    private async createNoteWithSummary(summary: string, title: string, url: string): Promise<TFile | null> {
        const folderPath = this.plugin.settings.notesFolder;
        const fileName = this.sanitizeFileName(title + '.md');
        const fileContent = `${summary}\n\nSource: ${url}`;

        try {
            const folder = this.app.vault.getAbstractFileByPath(folderPath) as TFolder;
            if (!folder) {
                await this.app.vault.createFolder(folderPath);
            }
            const newFile = await this.app.vault.create(`${folderPath}/${fileName}`, fileContent);
            return newFile;
        } catch (error) {
            new Notice('Error creating note.');
            return null;
        }
    }

    private sanitizeFileName(fileName: string): string {
        return fileName.replace(/[\\/:*?"<>|]/g, '_');
    }
}

class AISummarizerSettingsTab extends PluginSettingTab {
    plugin: AISummarizerPlugin;

    constructor(app: App, plugin: AISummarizerPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        containerEl.createEl('h2', { text: 'AI Summarizer Settings' });

        new Setting(containerEl)
            .setName('Gemini API Key')
            .setDesc('Your Gemini API key.')
            .addText(text => text
                .setPlaceholder('Enter your API key')
                .setValue(this.plugin.settings.geminiApiKey)
                .onChange(async (value) => {
                    this.plugin.settings.geminiApiKey = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Gemini Model')
            .setDesc('Choose the Gemini model to use.')
            .addDropdown(dropdown => dropdown
                .addOption('gemini-1.5-flash', 'Gemini 1.5 Flash')
                .setValue(this.plugin.settings.geminiModel)
                .onChange(async (value) => {
                    this.plugin.settings.geminiModel = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Prompt')
            .setDesc('Prompt used for summarization.')
            .addTextArea(text => text
                .setPlaceholder('Enter prompt here')
                .setValue(this.plugin.settings.defaultPrompt)
                .onChange(async (value) => {
                    this.plugin.settings.defaultPrompt = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Notes Folder')
            .setDesc('Folder where notes will be saved.')
            .addText(text => text
                .setPlaceholder('Enter folder path')
                .setValue(this.plugin.settings.notesFolder)
                .onChange(async (value) => {
                    this.plugin.settings.notesFolder = value;
                    await this.plugin.saveSettings();
                }));
    }
}

class AISummarizerPlugin extends Plugin {
    settings: PluginSettings;
    firstRun: boolean = true;

    async onload() {
        await this.loadSettings();

        if (!this.settings.geminiApiKey) {
            this.promptForSettings();
        }

        this.addRibbonIcon('dice', 'Open AI Summarizer', async () => {
            this.activateView();
        });

        this.addSettingTab(new AISummarizerSettingsTab(this.app, this));

        this.registerView(VIEW_TYPE_SUMMARY, (leaf) => new SummaryView(leaf, this));
    }

    async loadSettings() {
        const data = await this.loadData();
        if (!data || Object.keys(data).length === 0) {
            this.settings = Object.assign({}, DEFAULT_SETTINGS);
            await this.saveData(this.settings); // Create dummy data.json
        } else {
            this.settings = Object.assign({}, DEFAULT_SETTINGS, data);
        }
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    async activateView() {
        this.app.workspace.getLeaf('split').setViewState({
            type: VIEW_TYPE_SUMMARY,
            active: true,
        });
    }

    private async promptForSettings() {
        return new Promise<void>(async (resolve) => {
            new Notice('Please enter your Gemini API key and other settings.');

            const modal = new SettingModal(this.app, async (settings) => {
                this.settings = Object.assign({}, DEFAULT_SETTINGS, settings);
                await this.saveSettings();
                new Notice('Settings saved. Please reload the plugin for the changes to take effect.');
                this.app.commands.executeCommandById('app:reload-plugin'); // Reload the plugin
                resolve();
            });
            modal.open();
        });
    }
}

class SettingModal extends Modal {
    settings: PluginSettings = { ...DEFAULT_SETTINGS };
    onSubmit: (settings: PluginSettings) => void;

    constructor(app: App, onSubmit: (settings: PluginSettings) => void) {
        super(app);
        this.onSubmit = onSubmit;
    }

    onOpen() {
        const { contentEl } = this;

        contentEl.createEl('h2', { text: 'AI Summarizer Settings' });

        new Setting(contentEl)
            .setName('Gemini API Key')
            .setDesc('Your Gemini API key.')
            .addText(text => text
                .setPlaceholder('Enter your API key')
                .onChange(value => {
                    this.settings.geminiApiKey = value;
                }));

        new Setting(contentEl)
            .setName('Gemini Model')
            .setDesc('Choose the Gemini model to use.')
            .addDropdown(dropdown => dropdown
                .addOption('gemini-1.5-flash', 'Gemini 1.5 Flash')
                .setValue(this.settings.geminiModel)
                .onChange(value => {
                    this.settings.geminiModel = value;
                }));

        new Setting(contentEl)
            .setName('Prompt')
            .setDesc('Prompt used for summarization.')
            .addTextArea(text => text
                .setPlaceholder('Enter prompt here')
                .setValue(this.settings.defaultPrompt)
                .onChange(value => {
                    this.settings.defaultPrompt = value;
                }));

        new Setting(contentEl)
            .setName('Notes Folder')
            .setDesc('Folder where notes will be saved.')
            .addText(text => text
                .setPlaceholder('Enter folder path')
                .setValue(this.settings.notesFolder)
                .onChange(value => {
                    this.settings.notesFolder = value;
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

    onClose() {
        let { contentEl } = this;
        contentEl.empty();
    }
}

export default AISummarizerPlugin;