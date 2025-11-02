import { Plugin, WorkspaceLeaf, ItemView, Notice, TFolder, Setting, PluginSettingTab, App, TFile, Modal, requestUrl } from 'obsidian';
import { promisify } from 'util';
import * as path from 'path';
import { AISummarizerSettingsTab } from './settings';
import { DEFAULT_SUMMARIZATION_PROMPT, HIERARCHY_ANALYSIS_PROMPT, ENHANCED_SUMMARIZATION_PROMPT } from './prompts';
import { HierarchyManager } from './hierarchy-manager';
import { PromptLoader } from './prompt-loader';
import { MOCIntelligence } from './moc-intelligence';
import { MOCManager } from './moc-manager';
import { HierarchyAnalyzer } from './hierarchy-analyzer';
import { PluginIntegration, LLMService, TraceManager } from './src/services';
import { NoteProcessor } from './src/services/NoteProcessor';
import {
    sanitizeFileName,
    findUniqueFileName,
    generateId,
    extractPlatformFromUrl,
    formatMOCContextForAI,
    estimateTokens,
    calculateCost,
    formatTokens
} from './src/utils';
import {
    GEMINI_MODELS,
    PROCESSING_INTENTS,
    DEFAULT_SETTINGS,
    type GeminiModel,
    type ProcessingIntent,
    type ProcessingIntentOption,
    type PluginSettings,
    type Provider
} from './src/config';
import {
    type MOCHierarchy,
    type LearningContext,
    type MOCMetadata,
    type MOC,
    type NoteHierarchyAnalysis
} from './src/types';
import { HierarchyChoiceModal, SettingModal } from './src/components';

const VIEW_TYPE_SUMMARY = 'ai-summarizer-summary';


class SummaryView extends ItemView {
    private urlInput: HTMLInputElement;
    private noteDropdown: HTMLSelectElement;
    private urlModeRadio: HTMLInputElement;
    private noteModeRadio: HTMLInputElement;
    private promptInput: HTMLTextAreaElement;
    private generateButton: HTMLButtonElement;
    private resultArea: HTMLDivElement;
    private loadingIndicator: HTMLDivElement;

    private modelDropdown: HTMLSelectElement;
    private intentDropdown: HTMLSelectElement;
    private topicDropdown: HTMLSelectElement;
    private topicSection: HTMLDivElement;
    private promptLoader: PromptLoader;
    private currentTraceId: string | null = null;
    private progressContainer: HTMLDivElement;
    private statusMessage: HTMLDivElement;
    private retryButton: HTMLButtonElement;
    private alternativesButton: HTMLButtonElement;
    private currentStep: number = 0;
    private steps: string[] = ['Fetch', 'Generate'];
    private statusSteps: { label: string, state: 'idle' | 'in-progress' | 'success' | 'error', currentAttempt?: number, totalAttempts?: number }[] = [
        { label: 'Fetch Content/Transcript', state: 'idle' },
        { label: 'AI Analysis: Structure & Metadata', state: 'idle' },
        { label: 'AI Analysis: Content & Concepts', state: 'idle' },
        { label: 'AI Analysis: Perspectives & Examples', state: 'idle' },
        { label: 'AI Analysis: Connections & Applications', state: 'idle' },
        { label: 'AI Analysis: Learning Paths & Actions', state: 'idle' },
        { label: 'Create Knowledge Hierarchy', state: 'idle' },
        { label: 'Save & Open Note', state: 'idle' }
    ];
    private currentTitle: string = '';
    private currentMetadata: any = null;

    constructor(leaf: WorkspaceLeaf, private plugin: AISummarizerPlugin) {
        super(leaf);
        this.promptLoader = new PromptLoader();

        this.initializeNoteProcessor();
    }

    private initializeNoteProcessor() {
        console.log('[SummaryView] Checking services for NoteProcessor initialization...', {
            llmService: !!this.plugin.llmService,
            traceManager: !!this.plugin.traceManager,
            serviceIntegration: !!this.plugin.serviceIntegration,
            serviceIntegrationReady: this.plugin.serviceIntegration?.isReady()
        });

        if (this.plugin.llmService && this.plugin.traceManager) {
            this.plugin.noteProcessor = new NoteProcessor(
                this.plugin.traceManager,
                this.plugin.llmService,
                this.plugin,
                this // Pass SummaryView instance
            );
        } else {
            setTimeout(() => this.initializeNoteProcessor(), 1000);
        }
    }

    /**
     * Get TraceManager from plugin (with fallback)
     */
    private getTraceManager(): TraceManager | null {
        return this.plugin.getTraceManager();
    }

    /**
     * Get LLMService from plugin (with fallback)
     */
    private getLLMService(): LLMService | null {
        return this.plugin.getLLMService();
    }

    /**
     * Modern AI request with integrated tracing and usage tracking
     * This will gradually replace the legacy makeTracedAIRequest method
     */
    private async makeModernAIRequest(prompt: string, metadata: any = {}): Promise<any> {
        const traceManager = this.getTraceManager();
        const llmService = this.getLLMService();

        if (!traceManager || !llmService) {
            return this.makeTracedAIRequest(prompt, metadata);
        }

        const model = this.modelDropdown?.value || 'gemini-2.5-flash';
        const request = {
            prompt,
            model,
            temperature: 0.7,
            maxTokens: 4000,
            metadata: {
                pass: metadata.pass || 'unknown',
                intent: metadata.intent || 'unknown',
                url: metadata.url || 'unknown'
            }
        };

        try {

            const traceContext = this.currentTraceId ? { traceId: this.currentTraceId } : undefined;
            const response = await traceManager.generateText(request, traceContext);

            this.updateUsageStats(
                response.usage?.promptTokens || estimateTokens(prompt),
                response.usage?.completionTokens || estimateTokens(response.text),
                model
            );

            return response.text;
        } catch (error) {
            return this.makeTracedAIRequest(prompt, metadata);
        }
    }

    /**
     * Start tracing for note generation
     */
    private async startTrace(metadata: any = {}): Promise<string | null> {
        const traceManager = this.getTraceManager();

        if (!traceManager) {
            return null;
        }

        try {
            const traceId = await traceManager.startTrace({
                name: 'brAIn-note-generation',
                input: {
                    url: metadata.url || 'unknown',
                    intent: metadata.intent || 'unknown',
                    content_length: metadata.content_length || 0
                },
                metadata: {
                    provider: this.plugin.settings.provider,
                    model: this.modelDropdown?.value || 'unknown',
                    intent: metadata.intent || 'unknown',
                    url: metadata.url || 'unknown',
                    timestamp: new Date().toISOString()
                }
            });

            this.currentTraceId = traceId;
            return traceId;
        } catch (error) {
            return null;
        }
    }

    /**
     * End tracing for note generation
     */
    private async endTrace(): Promise<void> {
        const traceManager = this.getTraceManager();

        if (!traceManager || !this.currentTraceId) {
            return;
        }

        try {
            await traceManager.endTrace(this.currentTraceId, {
                output: 'Note generation completed',
                metadata: {
                    endTime: new Date().toISOString(),
                    status: 'completed'
                }
            });

            this.currentTraceId = null;
        } catch (error) {
        }
    }

    /**
     * Make AI request with tracing
     */
    private async makeTracedAIRequest(prompt: string, metadata: any = {}): Promise<any> {
        const traceManager = this.getTraceManager();

        if (!traceManager || !this.currentTraceId) {
            if (!this.plugin.noteProcessor) {
            }
            return this.makeAIRequestDirect(prompt);
        }

        const traceContext = {
            traceId: this.currentTraceId,
            generationName: metadata.pass || 'ai-generation',
            pass: metadata.pass,
            intent: metadata.intent
        };

        const request = {
            prompt,
            model: this.modelDropdown?.value || 'gemini-2.5-flash',
            temperature: 0.3,
            maxTokens: 4000,
            metadata: {
                pass: metadata.pass,
                intent: metadata.intent
            }
        };

        try {
            const response = await traceManager.generateTextWithinTrace(request, traceContext);

            try {
                return JSON.parse(response.text);
            } catch (parseError) {

                try {
                    const cleanedResponse = this.cleanJsonResponse(response.text);
                    return JSON.parse(cleanedResponse);
                } catch (cleanupError) {

                    return {
                        title: 'AI Response Error',
                        metadata: { tags: ['#ai-error'] },
                        hierarchy: { level1: 'General', level2: 'Miscellaneous' },
                        learning_context: { complexity_level: 'intermediate' },
                        overview: 'The AI returned malformed JSON. Please try again.',
                        error: true
                    };
                }
            }
        } catch (error) {
            throw error;
        }
    }

    /**
     * AI request without tracing (fallback)
     */
    private async makeAIRequestDirect(prompt: string): Promise<any> {
        const llmService = this.getLLMService();
        if (!llmService) {
            throw new Error('No LLM service available');
        }

        const request = {
            prompt,
            model: this.modelDropdown?.value || 'gemini-2.5-flash',
            temperature: 0.3,
            maxTokens: 4000
        };

        const response = await llmService.generateText(request);

        const jsonMatch = response.text.match(/```(?:json)?\s*([\s\S]*?)```/);
        const jsonText = jsonMatch ? jsonMatch[1].trim() : response.text.trim();

        try {
            return JSON.parse(jsonText);
        } catch (parseError) {
            const cleanedResponse = this.cleanJsonResponse(jsonText);
            return JSON.parse(cleanedResponse);
        }
    }

    /**
     * Modern file operations - replaces scattered file creation logic
     * This will gradually replace direct vault operations
     */
    private async createNoteWithModernFileOps(
        folderPath: string,
        fileName: string,
        fileContent: string
    ): Promise<TFile | null> {
        try {

            await this.ensureFolderExists(folderPath);

            const finalFileName = await findUniqueFileName(this.app, folderPath, fileName);
            if (finalFileName !== fileName) {
            }

            const newFile = await this.app.vault.create(`${folderPath}/${finalFileName}`, fileContent);

            return newFile;
        } catch (error) {
            return null;
        }
    }

    /**
     * Modern folder creation - replaces direct vault.createFolder calls
     */
    private async ensureFolderExists(folderPath: string): Promise<void> {
        try {
            const folder = this.app.vault.getAbstractFileByPath(folderPath);
            if (!folder) {
                await this.app.vault.createFolder(folderPath);
            }
        } catch (error) {
            throw error;
        }
    }

    /**
     * Modern debug file operations - replaces saveDebugFile
     */
    private async saveDebugFileModern(filename: string, content: string, subfolder?: string): Promise<void> {
        if (!this.plugin.settings.debug.enabled) return;

        try {
            const debugFolder = this.plugin.settings.debug.debugFolder;
            const fullPath = subfolder ? `${debugFolder}/${subfolder}` : debugFolder;

            await this.ensureFolderExists(fullPath);

            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const fullFilename = `${timestamp}_${filename}`;
            const filePath = `${fullPath}/${fullFilename}`;

            await this.app.vault.create(filePath, content);
        } catch (error) {
        }
    }

    getViewType() {
        return VIEW_TYPE_SUMMARY;
    }

    getDisplayText() {
        return 'AI Summarizer';
    }

    async onOpen() {
        const { contentEl } = this;
        contentEl.empty();

        this.addCustomStyles();

        const mainContainer = contentEl.createEl('div', { cls: 'brain-main-container' });

        const inputCard = mainContainer.createEl('div', { cls: 'brain-card' });
        const inputHeader = inputCard.createEl('div', { cls: 'brain-card-header' });
        inputHeader.createEl('h3', { text: '📝 Input', cls: 'brain-card-title' });

        const modeSelector = inputCard.createEl('div', { cls: 'brain-mode-selector' });

        const urlModeOption = modeSelector.createEl('div', { cls: 'brain-mode-option active' });
        this.urlModeRadio = urlModeOption.createEl('input', { type: 'radio' }) as HTMLInputElement;
        this.urlModeRadio.name = 'inputMode';
        this.urlModeRadio.value = 'url';
        this.urlModeRadio.checked = true;
        this.urlModeRadio.style.display = 'none';
        urlModeOption.createEl('span', { text: '🔗 Create from URL' });

        const noteModeOption = modeSelector.createEl('div', { cls: 'brain-mode-option' });
        this.noteModeRadio = noteModeOption.createEl('input', { type: 'radio' }) as HTMLInputElement;
        this.noteModeRadio.name = 'inputMode';
        this.noteModeRadio.value = 'note';
        this.noteModeRadio.style.display = 'none';
        noteModeOption.createEl('span', { text: '📄 Organize existing note' });

        const configSection = inputCard.createEl('div', { cls: 'brain-config-section' });

        const dropdownRow = configSection.createEl('div', { cls: 'brain-dropdown-row' });

        const modelGroup = dropdownRow.createEl('div', { cls: 'brain-form-group brain-form-group-half' });
        const modelLabel = modelGroup.createEl('label', { text: '🤖 AI Model', cls: 'brain-form-label' });
        this.modelDropdown = modelGroup.createEl('select', { cls: 'brain-select' }) as HTMLSelectElement;
        this.populateModelDropdown();
        this.modelDropdown.addEventListener('change', async () => {
            this.plugin.settings.gemini.model = this.modelDropdown.value;
            await this.plugin.saveSettings();
        });

        const intentGroup = dropdownRow.createEl('div', { cls: 'brain-form-group brain-form-group-half' });
        const intentLabel = intentGroup.createEl('label', { text: '🎯 Processing Intent', cls: 'brain-form-label' });
        this.intentDropdown = intentGroup.createEl('select', { cls: 'brain-select' }) as HTMLSelectElement;
        this.populateIntentDropdown();
        this.intentDropdown.addEventListener('change', async () => {
            this.plugin.settings.defaultIntent = this.intentDropdown.value as ProcessingIntent;
            await this.plugin.saveSettings();
            this.toggleTopicSelection();
        });

        this.topicSection = configSection.createEl('div', { cls: 'brain-form-group brain-topic-section' });
        this.topicSection.style.display = 'none';
        const topicLabel = this.topicSection.createEl('label', { text: '📁 Research Topic', cls: 'brain-form-label' });
        this.topicSection.createEl('div', { text: 'Choose a topic folder to organize this content', cls: 'brain-form-hint' });
        this.topicDropdown = this.topicSection.createEl('select', { cls: 'brain-select' }) as HTMLSelectElement;
        this.populateTopicDropdown();


        const urlSection = configSection.createEl('div', { cls: 'brain-input-section url-input-section' });
        urlSection.createEl('label', { text: '🌐 Content URL', cls: 'brain-form-label' });
        urlSection.createEl('div', { text: 'YouTube videos, articles, blogs, or podcast transcripts', cls: 'brain-form-hint' });
        this.urlInput = urlSection.createEl('input', {
            type: 'text',
            placeholder: 'https://www.youtube.com/watch?v=...',
            cls: 'brain-input'
        }) as HTMLInputElement;

        const noteSection = configSection.createEl('div', { cls: 'brain-input-section note-input-section' });
        noteSection.style.display = 'none';
        noteSection.createEl('label', { text: '📄 Select Note', cls: 'brain-form-label' });
        noteSection.createEl('div', { text: 'Choose an existing note to organize in your knowledge hierarchy', cls: 'brain-form-hint' });
        this.noteDropdown = noteSection.createEl('select', { cls: 'brain-select' }) as HTMLSelectElement;
        this.populateNoteDropdown(this.noteDropdown);

        const instructionsGroup = configSection.createEl('div', { cls: 'brain-form-group' });
        const instructionsToggle = instructionsGroup.createEl('div', { cls: 'brain-collapsible-header' });
        instructionsToggle.createEl('span', { text: '💡 Additional Instructions (Optional)', cls: 'brain-form-label' });
        const toggleIcon = instructionsToggle.createEl('span', { text: '▶', cls: 'brain-toggle-icon' });

        const instructionsContent = instructionsGroup.createEl('div', { cls: 'brain-collapsible-content' });
        instructionsContent.style.display = 'none'; // Collapsed by default
        instructionsContent.createEl('div', { text: 'Customize the analysis with specific focus areas or perspectives', cls: 'brain-form-hint' });
        this.promptInput = instructionsContent.createEl('textarea', {
            placeholder: 'e.g., "Focus on practical applications" or "Emphasize beginner-friendly explanations"',
            cls: 'brain-textarea'
        }) as HTMLTextAreaElement;

        instructionsToggle.addEventListener('click', () => {
            const isHidden = instructionsContent.style.display === 'none';
            instructionsContent.style.display = isHidden ? 'block' : 'none';
            toggleIcon.textContent = isHidden ? '▼' : '▶';
        });

        const urlError = inputCard.createEl('div', { cls: 'brain-error-message' });
        urlError.style.display = 'none';

        this.generateButton = inputCard.createEl('button', { text: '✨ Generate Note', cls: 'brain-generate-button' }) as HTMLButtonElement;
        this.generateButton.style.display = 'none';

        const cleanButton = inputCard.createEl('button', { text: '🧪 Summarize', cls: 'brain-clean-button' }) as HTMLButtonElement;

        const progressCard = mainContainer.createEl('div', { cls: 'brain-card brain-progress-card' });
        const progressHeader = progressCard.createEl('div', { cls: 'brain-card-header' });
        progressHeader.createEl('h3', { text: '⚡ Progress', cls: 'brain-card-title' });

        this.progressContainer = progressCard.createEl('div', { cls: 'brain-progress-container' });
        this.statusMessage = progressCard.createEl('div', { cls: 'brain-status-message' });

        const actionButtons = progressCard.createEl('div', { cls: 'brain-action-buttons' });
        this.retryButton = actionButtons.createEl('button', { text: '🔄 Retry', cls: 'brain-retry-button' }) as HTMLButtonElement;
        this.retryButton.style.display = 'none';

        this.alternativesButton = actionButtons.createEl('button', { text: '🔀 Request Alternatives', cls: 'brain-alternatives-button' }) as HTMLButtonElement;
        this.alternativesButton.style.display = 'none';

        const toggleInputMode = () => {
            if (this.urlModeRadio.checked) {
                urlSection.style.display = 'block';
                noteSection.style.display = 'none';
                urlModeOption.classList.add('active');
                noteModeOption.classList.remove('active');
            } else {
                urlSection.style.display = 'none';
                noteSection.style.display = 'block';
                urlModeOption.classList.remove('active');
                noteModeOption.classList.add('active');
            }
        };

        urlModeOption.addEventListener('click', () => {
            this.urlModeRadio.checked = true;
            toggleInputMode();
        });

        noteModeOption.addEventListener('click', () => {
            this.noteModeRadio.checked = true;
            toggleInputMode();
        });

        this.retryButton.onclick = () => {
            this.retryButton.style.display = 'none';
            this.statusMessage.innerText = '';
            this.startNoteGeneration();
        };

        this.alternativesButton.onclick = () => {
            this.requestManualAlternatives();
        };

        this.updateStatusSteps(0, 'Ready to generate your note');

        this.generateButton.addEventListener('click', async () => {
            urlError.style.display = 'none';
            this.alternativesButton.style.display = 'none';

            if (!this.intentDropdown.value) {
                this.showError(urlError, 'Please select a processing intent.');
                this.intentDropdown.focus();
                return;
            }

            if (this.intentDropdown.value === 'how_to' && !this.topicDropdown.value) {
                this.showError(urlError, 'Please select a research topic for How To / Tutorial content.');
                this.topicDropdown.focus();
                return;
            }

            if (this.urlModeRadio.checked) {
                if (!this.urlInput.value) {
                    this.showError(urlError, 'Please enter a URL.');
                    this.urlInput.focus();
                    return;
                }
                this.startNoteGeneration();
            } else {
                if (!this.noteDropdown.value) {
                    this.showError(urlError, 'Please select a note to organize.');
                    this.noteDropdown.focus();
                    return;
                }
                this.startNoteOrganization();
            }
        });

        cleanButton.addEventListener('click', async () => {
            urlError.style.display = 'none';
            this.alternativesButton.style.display = 'none';
            this.retryButton.style.display = 'none';
            this.statusMessage.innerText = '';

            if (!this.intentDropdown.value) {
                this.showError(urlError, 'Please select a processing intent.');
                this.intentDropdown.focus();
                return;
            }

            if (this.urlModeRadio.checked) {
                if (!this.urlInput.value) {
                    this.showError(urlError, 'Please enter a URL.');
                    this.urlInput.focus();
                    return;
                }
                this.startNoteGenerationClean();
            } else {
                new Notice('Clean flow currently only supports URL mode.');
            }
        });

        this.urlInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                this.generateButton.click();
            }
        });


        this.urlInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                this.generateButton.focus();
            }
        });

        this.resultArea = contentEl.createEl('div', { cls: 'ai-summarizer-result' }) as HTMLDivElement;
        this.resultArea.style.display = 'none';

        this.createStatsFooter();
    }

    private addCustomStyles() {
        const styleEl = document.createElement('style');
        styleEl.textContent = `
            .brain-main-container {
                max-width: 100%;
                margin: 0 auto;
                padding: 16px;
                font-family: var(--font-interface);
            }

            .brain-card {
                background: var(--background-primary);
                border: 1px solid var(--background-modifier-border);
                border-radius: 12px;
                padding: 20px;
                margin-bottom: 16px;
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
                transition: all 0.2s ease;
            }

            .brain-card:hover {
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            }

            .brain-card-header {
                margin-bottom: 16px;
                padding-bottom: 12px;
                border-bottom: 1px solid var(--background-modifier-border);
            }

            .brain-card-title {
                margin: 0;
                font-size: 1.1em;
                font-weight: 600;
                color: var(--text-normal);
                display: flex;
                align-items: center;
                gap: 8px;
            }

            .brain-mode-selector {
                display: flex;
                gap: 8px;
                margin-bottom: 20px;
                background: var(--background-secondary);
                padding: 4px;
                border-radius: 8px;
            }

            .brain-mode-option {
                flex: 1;
                padding: 12px 16px;
                text-align: center;
                border-radius: 6px;
                cursor: pointer;
                transition: all 0.2s ease;
                font-weight: 500;
                color: var(--text-muted);
            }

            .brain-mode-option:hover {
                background: var(--background-modifier-hover);
                color: var(--text-normal);
            }

            .brain-mode-option.active {
                background: var(--interactive-accent);
                color: var(--text-on-accent);
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
            }

            .brain-config-section {
                display: flex;
                flex-direction: column;
                gap: 16px;
            }

            .brain-dropdown-row {
                display: flex;
                gap: 12px;
                width: 100%;
            }

            .brain-form-group {
                display: flex;
                flex-direction: column;
                gap: 6px;
            }

            .brain-form-group-half {
                flex: 1;
            }

            .brain-form-label {
                font-weight: 600;
                color: var(--text-normal);
                font-size: 0.95em;
                display: flex;
                align-items: center;
                gap: 6px;
            }

            .brain-form-hint {
                font-size: 0.85em;
                color: var(--text-muted);
                margin-bottom: 4px;
            }

            .brain-select {
                /* Use browser default styling for now */
                width: 100%;
                padding: 8px;
                font-size: 14px;
            }

            .brain-input, .brain-textarea {
                padding: 12px 16px;
                border: 1px solid var(--background-modifier-border);
                border-radius: 8px;
                background: var(--background-primary);
                color: var(--text-normal);
                font-size: 0.95em;
                transition: all 0.2s ease;
            }

            .brain-select:focus, .brain-input:focus, .brain-textarea:focus {
                outline: none;
                border-color: var(--interactive-accent);
                box-shadow: 0 0 0 2px rgba(var(--interactive-accent-rgb), 0.2);
            }

            .brain-textarea {
                resize: vertical;
                min-height: 80px;
                font-family: var(--font-interface);
            }

            .brain-generate-button {
                width: 100%;
                padding: 16px 24px;
                background: var(--interactive-accent);
                color: var(--text-on-accent);
                border: none;
                border-radius: 10px;
                font-size: 1.05em;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.2s ease;
                margin-top: 20px;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 8px;
            }

            .brain-generate-button:hover {
                background: var(--interactive-accent-hover);
                transform: translateY(-1px);
                box-shadow: 0 4px 12px rgba(var(--interactive-accent-rgb), 0.3);
            }

            .brain-generate-button:active {
                transform: translateY(0);
            }

            .brain-clean-button {
                width: 100%;
                padding: 12px 20px;
                margin-top: 8px;
                background: var(--color-orange);
                color: white;
                border: none;
                border-radius: 8px;
                font-size: 14px;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.2s ease;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 8px;
            }

            .brain-clean-button:hover {
                background: var(--color-orange-hover, #e67e22);
                transform: translateY(-1px);
                box-shadow: 0 4px 12px rgba(230, 126, 34, 0.3);
            }

            .brain-clean-button:active {
                background: var(--color-orange);
                transform: translateY(0);
            }

            .brain-progress-container {
                display: grid;
                grid-template-columns: repeat(4, 1fr);
                gap: 8px;
                margin-bottom: 16px;
            }

            .brain-progress-step {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 6px;
                padding: 12px 8px;
                border-radius: 8px;
                background: var(--background-secondary);
                transition: all 0.3s ease;
                text-align: center;
                min-height: 80px;
            }

            .brain-progress-step.in-progress {
                background: rgba(255, 193, 7, 0.1);
                border: 2px solid #ffc107;
            }

            .brain-progress-step.success {
                background: rgba(40, 167, 69, 0.1);
                border: 2px solid #28a745;
            }

            .brain-progress-step.error {
                background: rgba(220, 53, 69, 0.1);
                border: 2px solid #dc3545;
            }

            .brain-progress-icon {
                width: 24px;
                height: 24px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 11px;
                font-weight: bold;
                flex-shrink: 0;
                border: 2px solid var(--background-modifier-border);
            }

            .brain-progress-icon.idle {
                background: var(--background-primary);
                color: var(--text-muted);
            }

            .brain-progress-icon.in-progress {
                background: #ffc107;
                color: white;
                border-color: #ffc107;
                animation: pulse 2s infinite;
            }

            .brain-progress-icon.success {
                background: #28a745;
                color: white;
                border-color: #28a745;
            }

            .brain-progress-icon.error {
                background: #dc3545;
                color: white;
                border-color: #dc3545;
            }

            @keyframes pulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.7; }
            }

            .brain-progress-label {
                font-size: 0.8em;
                font-weight: 500;
                color: var(--text-normal);
                line-height: 1.2;
            }

            .brain-progress-attempt {
                font-size: 0.7em;
                color: var(--text-muted);
                background: var(--background-primary);
                padding: 1px 4px;
                border-radius: 3px;
                margin-top: 2px;
            }

            .brain-status-message {
                padding: 12px 16px;
                background: var(--background-secondary);
                border-radius: 8px;
                color: var(--text-normal);
                font-size: 0.95em;
                line-height: 1.4;
                margin-bottom: 12px;
            }

            .brain-action-buttons {
                display: flex;
                gap: 12px;
                flex-wrap: wrap;
            }

            .brain-retry-button, .brain-alternatives-button {
                padding: 10px 16px;
                border: 1px solid var(--background-modifier-border);
                border-radius: 6px;
                background: var(--background-primary);
                color: var(--text-normal);
                cursor: pointer;
                font-size: 0.9em;
                font-weight: 500;
                transition: all 0.2s ease;
                display: flex;
                align-items: center;
                gap: 6px;
            }

            .brain-retry-button:hover, .brain-alternatives-button:hover {
                background: var(--background-modifier-hover);
                border-color: var(--interactive-accent);
            }

            .brain-error-message {
                padding: 12px 16px;
                background: rgba(var(--color-red-rgb), 0.1);
                border: 1px solid var(--color-red);
                border-radius: 8px;
                color: var(--color-red);
                font-size: 0.9em;
                margin-top: 12px;
                display: flex;
                align-items: center;
                gap: 8px;
            }

            .brain-error-message::before {
                content: "⚠️";
            }

            .brain-input-section {
                display: flex;
                flex-direction: column;
                gap: 6px;
            }

            .brain-collapsible-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                cursor: pointer;
                padding: 8px 0;
                border-bottom: 1px solid var(--background-modifier-border);
                margin-bottom: 8px;
            }

            .brain-collapsible-header:hover {
                background: var(--background-modifier-hover);
                border-radius: 4px;
                padding: 8px 8px;
                margin: 0 -8px 8px -8px;
            }

            .brain-toggle-icon {
                font-size: 0.8em;
                color: var(--text-muted);
                transition: transform 0.2s ease;
            }

            .brain-collapsible-content {
                display: flex;
                flex-direction: column;
                gap: 6px;
                margin-top: 8px;
            }
        `;
        document.head.appendChild(styleEl);
    }

    private showError(errorElement: HTMLElement, message: string) {
        errorElement.textContent = message;
        errorElement.style.display = 'block';
        setTimeout(() => {
            errorElement.style.display = 'none';
        }, 5000);
    }

    private async requestManualAlternatives() {
        if (!this.currentTitle || !this.currentMetadata) {
            new Notice('No current note data available for alternatives request.');
            return;
        }


        try {
            const noteContent = this.resultArea.textContent || '';
            const hierarchyResponse = await this.analyzeNoteForHierarchy(noteContent, this.currentTitle);

            const fakeResponse = {
                is_cross_domain: true, // Force as cross-domain to trigger dialog
                confidence_score: 0.5,
                primary_hierarchy: hierarchyResponse.hierarchy,
                alternative_hierarchies: [
                    {
                        level1: hierarchyResponse.hierarchy.level1 === 'Computer Science' ? 'Business' : 'Computer Science',
                        level2: hierarchyResponse.hierarchy.level1 === 'Computer Science' ? 'Digital Transformation' : 'Programming',
                        level3: hierarchyResponse.hierarchy.level3,
                        level4: hierarchyResponse.hierarchy.level4,
                        reasoning: 'Alternative perspective based on practical application focus',
                        strength: 0.7
                    },
                    {
                        level1: 'Professional Development',
                        level2: 'Technical Skills',
                        level3: hierarchyResponse.hierarchy.level3,
                        level4: hierarchyResponse.hierarchy.level4,
                        reasoning: 'Skill-building and career development perspective',
                        strength: 0.6
                    }
                ],
                learning_context: hierarchyResponse.learning_context
            };

            return new Promise((resolve) => {
                const modal = new HierarchyChoiceModal(this.app, fakeResponse, (result) => {
                    new Notice(`Selected hierarchy: ${result.hierarchy.level1} > ${result.hierarchy.level2}`);
                    resolve(result);
                });
                modal.open();
            });

        } catch (error) {
            new Notice('Failed to generate hierarchy alternatives. Check console for details.');
        }
    }

    private populateModelDropdown() {
        this.modelDropdown.innerHTML = '';
        GEMINI_MODELS.forEach((model: GeminiModel) => {
            const option = document.createElement('option');
            option.value = model.id;
            option.text = `${model.name} - ${model.description}`;
            this.modelDropdown.appendChild(option);
        });
        this.modelDropdown.value = this.plugin.settings?.gemini?.model || 'gemini-2.5-flash';
    }

    private populateIntentDropdown() {
        this.intentDropdown.innerHTML = '';
        PROCESSING_INTENTS.forEach((intent: ProcessingIntentOption) => {
            const option = document.createElement('option');
            option.value = intent.id;
            option.text = `${intent.name} - ${intent.description}`;
            this.intentDropdown.appendChild(option);
        });
        this.intentDropdown.value = this.plugin.settings?.defaultIntent || 'knowledge_building';
    }

    private populateTopicDropdown() {
        this.topicDropdown.innerHTML = '';

        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.text = 'Select a topic...';
        this.topicDropdown.appendChild(defaultOption);

        this.plugin.settings.topicFolders.topics.forEach((topic: string) => {
            const option = document.createElement('option');
            option.value = topic;
            option.text = `📋 ${topic}`;
            this.topicDropdown.appendChild(option);
        });

        const separatorOption = document.createElement('option');
        separatorOption.disabled = true;
        separatorOption.text = '─────────────────';
        this.topicDropdown.appendChild(separatorOption);

        this.addExistingFoldersToDropdown();

        const separatorOption2 = document.createElement('option');
        separatorOption2.disabled = true;
        separatorOption2.text = '─────────────────';
        this.topicDropdown.appendChild(separatorOption2);

        const browseOption = document.createElement('option');
        browseOption.value = '__browse__';
        browseOption.text = '📁 Browse for existing folder...';
        this.topicDropdown.appendChild(browseOption);

        const newTopicOption = document.createElement('option');
        newTopicOption.value = '__new__';
        newTopicOption.text = '+ Create new topic...';
        this.topicDropdown.appendChild(newTopicOption);

    }

    private addExistingFoldersToDropdown() {
        try {
            const rootFolder = this.plugin.settings.topicFolders.rootFolder;
            const rootFolderObj = this.app.vault.getAbstractFileByPath(rootFolder);

            if (rootFolderObj && rootFolderObj instanceof TFolder) {
                const subfolders = rootFolderObj.children
                    .filter(child => child instanceof TFolder)
                    .map(folder => folder.name)
                    .sort();

                subfolders.forEach(folderName => {
                    if (!this.plugin.settings.topicFolders.topics.includes(folderName)) {
                        const option = document.createElement('option');
                        option.value = `__existing__:${folderName}`;
                        option.text = `📂 ${folderName} (existing)`;
                        this.topicDropdown.appendChild(option);
                    }
                });
            }
        } catch (error) {
        }
    }

    private toggleTopicSelection() {
        const isHowToIntent = this.intentDropdown.value === 'how_to';
        this.topicSection.style.display = isHowToIntent ? 'block' : 'none';
    }

    private async showFolderBrowser(): Promise<string | null> {
        return new Promise((resolve) => {
            const modal = new FolderSelectionModal(this.app, (selectedFolder) => {
                resolve(selectedFolder);
            });
            modal.open();
        });
    }

    private async getSelectedTopic(): Promise<string | null> {
        const selectedValue = this.topicDropdown.value;

        if (!selectedValue) {
            return null;
        }

        if (selectedValue === '__new__') {
            const newTopic = prompt('Enter a name for the new research topic:');
            if (newTopic && newTopic.trim()) {
                return newTopic.trim();
            }
            return null;
        }

        if (selectedValue === '__browse__') {
            return await this.showFolderBrowser();
        }

        if (selectedValue.startsWith('__existing__:')) {
            return selectedValue.replace('__existing__:', '');
        }

        return selectedValue;
    }

    private async saveDebugFile(filename: string, content: string, subfolder?: string): Promise<void> {
        if (!this.plugin.settings.debug.enabled) return;

        try {
            const debugFolder = this.plugin.settings.debug.debugFolder;
            const fullPath = subfolder ? `${debugFolder}/${subfolder}` : debugFolder;

            const folderExists = this.app.vault.getAbstractFileByPath(fullPath);
            if (!folderExists) {
                await this.app.vault.createFolder(fullPath);
            }

            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const fullFilename = `${timestamp}_${filename}`;
            const filePath = `${fullPath}/${fullFilename}`;

            await this.app.vault.create(filePath, content);
        } catch (error) {
        }
    }

    private async debugLogRawContent(url: string, content: string, intent: string): Promise<void> {
        if (!this.plugin.settings.debug.saveRawContent) return;

        const debugContent = `# Raw Content Debug Log

**URL:** ${url}
**Intent:** ${intent}
**Timestamp:** ${new Date().toISOString()}
**Content Length:** ${content.length} characters

---

## Raw Content

${content}
`;

        await this.saveDebugFile('raw-content.md', debugContent, 'raw-content');
    }

    private async debugLogPrompt(passName: string, prompt: string, intent: string): Promise<void> {
        if (!this.plugin.settings.debug.savePrompts) return;

        const debugContent = `# AI Prompt Debug Log

**Pass:** ${passName}
**Intent:** ${intent}
**Timestamp:** ${new Date().toISOString()}
**Prompt Length:** ${prompt.length} characters

---

## Actual Prompt Sent to AI

${prompt}
`;

        await this.saveDebugFile(`prompt-${passName.toLowerCase().replace(/\s+/g, '-')}.md`, debugContent, 'prompts');
    }

    private async debugLogResponse(passName: string, response: any, intent: string): Promise<void> {
        if (!this.plugin.settings.debug.saveResponses) return;

        const debugContent = `# AI Response Debug Log

**Pass:** ${passName}
**Intent:** ${intent}
**Timestamp:** ${new Date().toISOString()}
**Response Type:** ${typeof response}

---

## Raw AI Response

\`\`\`json
${JSON.stringify(response, null, 2)}
\`\`\`

---

## Response Analysis

**Is Valid JSON:** ${typeof response === 'object' ? 'Yes' : 'No'}
**Has Expected Fields:** ${response && typeof response === 'object' ? Object.keys(response).join(', ') : 'N/A'}
`;

        await this.saveDebugFile(`response-${passName.toLowerCase().replace(/\s+/g, '-')}.md`, debugContent, 'responses');
    }

    private async ensureTopicFolder(topicName: string): Promise<string> {
        const rootFolder = this.plugin.settings.topicFolders.rootFolder;
        const topicFolderPath = `${rootFolder}/${topicName}`;

        try {
            const rootFolderExists = this.app.vault.getAbstractFileByPath(rootFolder);
            if (!rootFolderExists) {
                await this.app.vault.createFolder(rootFolder);
            }

            const topicFolderExists = this.app.vault.getAbstractFileByPath(topicFolderPath);
            if (!topicFolderExists) {
                await this.app.vault.createFolder(topicFolderPath);
            }

            return topicFolderPath;
        } catch (error) {
            throw error;
        }
    }

    private async addTopicToSettings(topicName: string): Promise<void> {
        if (!this.plugin.settings.topicFolders.topics.includes(topicName)) {
            this.plugin.settings.topicFolders.topics.push(topicName);
            await this.plugin.saveSettings();
        }
    }


    private async makeTracedAIRequestLegacy(prompt: string, metadata: any = {}): Promise<any> {

        if (!this.currentTraceId) {
        }


        const startTime = Date.now();
        const result = await this.makeAIRequest(prompt);
        const duration = Date.now() - startTime;

        const inputTokens = estimateTokens(prompt);
        const outputTokens = estimateTokens(JSON.stringify(result));
        const totalTokens = inputTokens + outputTokens;
        const model = this.modelDropdown?.value || 'gemini-2.5-flash';
        const cost = calculateCost(inputTokens, outputTokens, model);


        this.updateUsageStats(inputTokens, outputTokens, model);

        try {
            const generationId = generateId();
            /*
            await this.sendToLangfuse('generations', {
                id: generationId,
                traceId: this.currentTraceId,
                name: metadata.pass || 'ai-request',
                model: model,
                input: prompt.substring(0, 500), // Truncate for privacy
                output: typeof result === 'string' ? result.substring(0, 500) : 'JSON response',
                startTime: new Date(startTime).toISOString(),
                endTime: new Date().toISOString(),
                usage: {
                    promptTokens: inputTokens,
                    completionTokens: outputTokens,
                    totalTokens: totalTokens
                },
                metadata: {
                    duration_ms: duration,
                    cost_usd: cost,
                    pass: metadata.pass || 'unknown',
                    intent: metadata.intent || 'unknown'
                }
            });
            */
        } catch (error) {
        }

        return result;
    }


    private updateUsageStats(inputTokens: number, outputTokens: number, model: string): void {
        if (!this.plugin.settings.trackUsage) return;

        const totalTokens = inputTokens + outputTokens;
        const cost = calculateCost(inputTokens, outputTokens, model);

        this.plugin.settings.usageStats.current.tokens += totalTokens;
        this.plugin.settings.usageStats.current.cost += cost;

        this.plugin.settings.usageStats.session.tokens += totalTokens;
        this.plugin.settings.usageStats.session.cost += cost;

        this.plugin.settings.usageStats.lifetime.tokens += totalTokens;
        this.plugin.settings.usageStats.lifetime.cost += cost;

        this.plugin.saveSettings();

        this.updateStatsFooter();
    }

    private commitNoteToStats(): void {
        if (!this.plugin.settings.trackUsage) return;

        this.plugin.settings.usageStats.session.notes += 1;
        this.plugin.settings.usageStats.lifetime.notes += 1;

        this.plugin.settings.usageStats.current = { tokens: 0, cost: 0 };

        this.plugin.saveSettings();

        this.updateStatsFooter();
    }

    private statsFooter: HTMLElement;

    private createStatsFooter(): void {
        this.statsFooter = this.contentEl.createEl('div', {
            cls: 'ai-summarizer-stats-footer'
        });

        this.statsFooter.style.cssText = `
            padding: 8px 12px;
            border-top: 1px solid var(--background-modifier-border);
            font-size: 0.85em;
            color: var(--text-muted);
            text-align: center;
            background: var(--background-secondary);
            margin-top: 12px;
        `;

        this.updateStatsFooter();
    }

    private updateStatsFooter(): void {
        if (!this.statsFooter || !this.plugin.settings.trackUsage) return;

        const stats = this.plugin.settings.usageStats;
        const { lifetime, session, current } = stats;

        let text = `📊 ${lifetime.notes} notes • ${formatTokens(lifetime.tokens)} tokens • $${lifetime.cost.toFixed(2)}`;

        if (current.tokens > 0) {
            text += ` • This note: ${formatTokens(current.tokens)} tokens, ~$${current.cost.toFixed(3)}`;
        } else if (session.notes > 0) {
            text += ` • Today: ${session.notes} notes, $${session.cost.toFixed(2)}`;
        }

        this.statsFooter.textContent = text;
    }

    private async updateActionTracker(): Promise<void> {
        try {

            const allFiles = this.app.vault.getMarkdownFiles();
            const actionItems: Array<{
                items: string[];
                source: string;
                created: string;
                intent: string;
            }> = [];

            for (const file of allFiles) {
                try {
                    const content = await this.app.vault.read(file);
                    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);

                    if (frontmatterMatch) {
                        const frontmatter = frontmatterMatch[1];

                        const actionItemsMatch = frontmatter.match(/action_items:\s*\[([\s\S]*?)\]/);
                        if (actionItemsMatch) {
                            try {
                                const actionItemsStr = '[' + actionItemsMatch[1] + ']';
                                const items = JSON.parse(actionItemsStr);

                                if (items && items.length > 0) {
                                    const createdMatch = frontmatter.match(/created:\s*"([^"]+)"/);
                                    const intentMatch = frontmatter.match(/intent:\s*"([^"]+)"/);

                                    actionItems.push({
                                        items: items,
                                        source: file.basename,
                                        created: createdMatch ? createdMatch[1] : new Date().toISOString(),
                                        intent: intentMatch ? intentMatch[1] : 'unknown'
                                    });
                                }
                            } catch (parseError) {
                            }
                        }
                    }
                } catch (fileError) {
                }
            }

            actionItems.sort((a, b) => new Date(a.created).getTime() - new Date(b.created).getTime());

            const trackerContent = `# Actions Tracker

*Auto-generated from notes with action items. Updated: ${new Date().toLocaleString()}*

${actionItems.length === 0 ?
                    '## No action items found\n\nProcess some content with actionable items to see them here!' :
                    actionItems.map(item =>
                        `## From: [[${item.source}]] *(${item.intent})*
${item.items.map(action => `- [ ] ${action}`).join('\n')}
`).join('\n')}

---
*This file is auto-generated. Check off completed actions - they'll stay checked!*
*Use Dataview or other Obsidian plugins to create more advanced action databases.*`;

            const trackerPath = 'Actions-Tracker.md';
            const existingFile = this.app.vault.getAbstractFileByPath(trackerPath);

            if (existingFile) {
                await this.app.vault.modify(existingFile as TFile, trackerContent);
            } else {
                await this.app.vault.create(trackerPath, trackerContent);
            }


        } catch (error) {
        }
    }


    private populateNoteDropdown(dropdown: HTMLSelectElement) {
        dropdown.innerHTML = '';

        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.text = 'Select a note to organize...';
        dropdown.appendChild(defaultOption);

        const markdownFiles = this.app.vault.getMarkdownFiles();

        markdownFiles.forEach((file) => {
            const option = document.createElement('option');
            option.value = file.path;
            option.text = file.basename;
            dropdown.appendChild(option);
        });
    }

    private updateStatusSteps(currentStep: number, status: string, error: boolean = false, attemptInfo?: { current: number, total: number }) {
        for (let i = 0; i < this.statusSteps.length; i++) {
            this.statusSteps[i].state = 'idle';
            this.statusSteps[i].currentAttempt = undefined;
            this.statusSteps[i].totalAttempts = undefined;
        }
        for (let i = 0; i < currentStep; i++) {
            this.statusSteps[i].state = 'success';
        }

        if (currentStep < this.statusSteps.length) {
            if (error) {
                this.statusSteps[currentStep].state = 'error';
            } else {
                this.statusSteps[currentStep].state = 'in-progress';
            }
            if (attemptInfo) {
                this.statusSteps[currentStep].currentAttempt = attemptInfo.current;
                this.statusSteps[currentStep].totalAttempts = attemptInfo.total;
            }
        }

        this.progressContainer.innerHTML = '';

        for (let i = 0; i < this.statusSteps.length; i++) {
            const step = this.statusSteps[i];
            const stepEl = document.createElement('div');
            stepEl.className = `brain-progress-step ${step.state}`;

            const icon = document.createElement('div');
            icon.className = `brain-progress-icon ${step.state}`;

            switch (step.state) {
                case 'idle':
                    icon.textContent = (i + 1).toString();
                    break;
                case 'in-progress':
                    icon.textContent = '⚡';
                    break;
                case 'success':
                    icon.textContent = '✓';
                    break;
                case 'error':
                    icon.textContent = '✗';
                    break;
            }

            stepEl.appendChild(icon);

            const label = document.createElement('div');
            label.className = 'brain-progress-label';
            const shortLabels = [
                'Fetch Content',
                'Structure',
                'Content',
                'Perspectives',
                'Connections',
                'Learning',
                'Hierarchy',
                'Save & Open'
            ];
            label.textContent = shortLabels[i] || step.label;
            stepEl.appendChild(label);

            if (step.state === 'in-progress' && step.currentAttempt && step.totalAttempts) {
                const attemptEl = document.createElement('div');
                attemptEl.className = 'brain-progress-attempt';
                attemptEl.textContent = `${step.currentAttempt}/${step.totalAttempts}`;
                stepEl.appendChild(attemptEl);
            }

            this.progressContainer.appendChild(stepEl);
        }

        this.statusMessage.innerHTML = `
            <div style="display: flex; align-items: center; gap: 8px;">
                ${error ? '❌' : currentStep >= this.statusSteps.length ? '✅' : '⚡'}
                <span>${status}</span>
            </div>
        `;

        if (error) {
            this.retryButton.style.display = 'block';
        } else {
            this.retryButton.style.display = 'none';
        }

        if (!error && currentStep === this.statusSteps.length - 1 && status.includes('✅')) {
            this.alternativesButton.style.display = 'inline-block';
        } else {
            this.alternativesButton.style.display = 'none';
        }
    }

    private async startNoteGeneration() {
        const url = this.urlInput.value;
        const prompt = this.promptInput.value;
        const selectedIntent = this.intentDropdown.value as ProcessingIntent;

        if (!url) {
            new Notice('Please enter a URL.');
            return;
        }

        this.statusSteps = [
            { label: 'Fetch Content/Transcript', state: 'idle' },
            { label: 'AI Analysis: Structure & Metadata', state: 'idle' },
            { label: 'AI Analysis: Content & Concepts', state: 'idle' },
            { label: 'AI Analysis: Perspectives & Examples', state: 'idle' },
            { label: 'AI Analysis: Connections & Applications', state: 'idle' },
            { label: 'AI Analysis: Learning Paths & Actions', state: 'idle' },
            { label: 'Create Knowledge Hierarchy', state: 'idle' },
            { label: 'Save & Open Note', state: 'idle' }
        ];
        this.updateStatusSteps(0, 'Initiating process...'); // Initial status before fetching

        try {
            if (!this.resultArea) {
                this.resultArea = this.containerEl.createEl('div', { cls: 'ai-summarizer-result' }) as HTMLDivElement;
            }
            this.resultArea.innerText = '';

            let content = '';
            this.updateStatusSteps(0, 'Connecting to source and extracting content...');

            if (url.includes('youtube.com')) {
                try {
                    content = await this.fetchTranscriptFromPython(url);
                    this.updateStatusSteps(0, 'Transcript fetched successfully.', false); // Mark step 0 as success
                } catch (error) {
                    const errorMessage = typeof error === 'string' ? error : (error as Error).message;
                    new Notice('Failed to fetch transcript. ' + errorMessage);
                    this.updateStatusSteps(0, 'Failed to fetch transcript: ' + errorMessage, true);
                    return;
                }
            } else {
                this.updateStatusSteps(0, 'Fetching web content...'); // Status for web content
                content = await this.fetchContentFromWebLink(url);
                if (!content || content.startsWith('Error:') || content.includes('[ERROR]')) {
                    new Notice('Failed to fetch content. Please check the URL.');
                    this.updateStatusSteps(0, 'Failed to fetch content. Please check the URL.', true);
                    return;
                }
                this.updateStatusSteps(0, 'Web content fetched successfully.', false); // Mark step 0 as success
            }

            if (!content || content.trim().length < 10) { // Adjusted length check, as even short transcripts can be valid
                const noticeMsg = 'Failed to fetch meaningful content. The content may be too short or the URL is incorrect.';
                new Notice(noticeMsg);
                this.updateStatusSteps(0, noticeMsg, true);
                return;
            }


            await this.debugLogRawContent(url, content, selectedIntent);

            const result = await this.summarizeContent(content, prompt, url);
            if (!result.summary) {
                new Notice('AI failed to generate structured content. This might be due to API issues or content complexity.');
                this.updateStatusSteps(1, 'AI analysis failed. Check your API settings and try again.', true);
                return;
            }

            if (result.summary.includes('Raw AI Response')) {
                this.statusMessage.innerText = 'AI response required fallback parsing - content preserved but may need manual review';
                new Notice('Note created with fallback parsing. Please review the content for completeness.');
            }

            this.updateStatusSteps(6, 'Creating knowledge hierarchy and MOC structure...');
            await new Promise(res => setTimeout(res, 100));

            this.currentMetadata = result.metadata;
            this.currentTitle = result.title;

            this.updateStatusSteps(7, 'Creating note file and updating trackers...');

            const newNote = await this.createNoteWithSummary(result.summary, result.title, url, result.metadata, result, selectedIntent);
            if (newNote) {
                this.updateStatusSteps(7, 'Updating action tracker...', false);
                await this.updateActionTracker();

                this.updateStatusSteps(7, 'Opening note...', false);
                const leaf = this.app.workspace.getLeaf('tab');
                await leaf.openFile(newNote);
                this.updateStatusSteps(8, 'Complete! Note organized and ready.', false);
                new Notice('Note created and organized successfully!');
            } else {
                this.updateStatusSteps(7, 'Failed to create note file', true);
            }
        } catch (error) { // This is a general catch for startNoteGeneration, not specific to transcript fetching
            const errorMessage = typeof error === 'string' ? error : (error as Error).message;
            new Notice('An error occurred: ' + errorMessage);
            this.updateStatusSteps(1, 'Error occurred: ' + errorMessage, true);
        }
    }

    private async startNoteGenerationClean() {

        const url = this.urlInput.value;
        const prompt = this.promptInput.value;
        const selectedIntent = this.intentDropdown.value as ProcessingIntent;

        if (!url) {
            new Notice('Please enter a URL.');
            return;
        }

        if (!this.plugin.noteProcessor) {

            if (this.plugin.llmService && this.plugin.traceManager) {
                this.plugin.noteProcessor = new NoteProcessor(
                    this.plugin.traceManager,
                    this.plugin.llmService,
                    this.plugin,
                    this
                );
            } else {
                console.log('[NoteProcessor] ❌ Services not ready, forcing initialization...', {
                    llmService: !!this.plugin.llmService,
                    traceManager: !!this.plugin.traceManager,
                    serviceIntegration: !!this.plugin.serviceIntegration,
                    serviceIntegrationReady: this.plugin.serviceIntegration?.isReady()
                });

                try {
                    await this.plugin.initializeServices();

                    if (this.plugin.llmService && this.plugin.traceManager) {
                        this.plugin.noteProcessor = new NoteProcessor(
                            this.plugin.traceManager,
                            this.plugin.llmService,
                            this.plugin,
                            this
                        );
                    } else {
                        new Notice('Failed to initialize AI services. Please check your API key settings.');
                        return;
                    }
                } catch (error) {
                    new Notice('Failed to initialize AI services. Please check your settings.');
                    return;
                }
            }
        }

        this.statusSteps = [
            { label: '1. Extract Content', state: 'idle' },
            { label: '2. Start Trace & Span', state: 'idle' },
            { label: '3. AI Analysis (5 passes)', state: 'idle' },
            { label: '4. Log Generations', state: 'idle' },
            { label: '5. Create Note', state: 'idle' },
            { label: '6. Start MOC Cascade Span', state: 'idle' },
            { label: '7. MOC AI Updates', state: 'idle' },
            { label: '8. End Trace', state: 'idle' }
        ];

        if (!this.resultArea) {
            this.resultArea = this.containerEl.createEl('div', { cls: 'ai-summarizer-result' }) as HTMLDivElement;
        }
        this.resultArea.innerText = '';

        try {
            this.plugin.noteProcessor.setStatusCallback((step: number, message: string, isError?: boolean) => {
                this.updateStatusSteps(step, message, isError);
            });

            const result = await this.plugin.noteProcessor.processURL({
                url,
                prompt,
                intent: selectedIntent
            });

            this.updateStatusSteps(7, 'Complete! Note created and organized.');

            await this.app.workspace.getLeaf().openFile(result.note);

            new Notice(`Note created successfully! Trace ID: ${result.traceId}`);

        } catch (error) {
            new Notice('Failed to process URL: ' + error.message);
        }
    }

    private async startNoteOrganization() {
        const notePath = this.noteDropdown.value;
        const selectedIntent = this.intentDropdown.value as ProcessingIntent;

        try {
            if (!this.resultArea) {
                this.resultArea = this.containerEl.createEl('div', { cls: 'ai-summarizer-result' }) as HTMLDivElement;
            }
            this.resultArea.innerText = '';

            this.updateStatusSteps(0, 'Reading note content...');
            this.statusMessage.innerText = 'Loading existing note content...';

            const noteFile = this.app.vault.getAbstractFileByPath(notePath) as TFile;
            if (!noteFile) {
                new Notice('Note file not found.');
                this.updateStatusSteps(0, 'Note file not found.', true);
                return;
            }

            const noteContent = await this.app.vault.read(noteFile);

            this.updateStatusSteps(1, 'Analyzing note for organization...');
            this.statusMessage.innerText = 'AI is analyzing content to determine best knowledge hierarchy...';

            const analysis = await this.analyzeNoteForHierarchy(noteContent, noteFile.basename);
            if (!analysis.hierarchy) {
                new Notice('Failed to analyze note for organization.');
                this.updateStatusSteps(1, 'Failed to analyze note content.', true);
                return;
            }


            this.updateStatusSteps(2, 'Creating knowledge hierarchy...');
            this.statusMessage.innerText = `Organizing in ${analysis.hierarchy.level1} > ${analysis.hierarchy.level2}...`;

            const mocPath = await this.plugin.mocManager.ensureMOCExists(analysis.hierarchy);

            this.updateStatusSteps(3, 'Adding to knowledge map...');
            this.statusMessage.innerText = 'Adding note to knowledge map...';

            await this.plugin.mocManager.updateMOC(mocPath, notePath, noteFile.basename, analysis.learning_context);

            this.updateStatusSteps(3, 'Organization complete!', false);
            new Notice(`Note organized in ${analysis.hierarchy.level1} > ${analysis.hierarchy.level2}`);

            const leaf = this.app.workspace.getLeaf('tab');
            await leaf.openFile(noteFile);

        } catch (error) {
            new Notice('An error occurred while organizing the note.');
            this.updateStatusSteps(3, 'Organization failed.', true);
        }
    }

    private async analyzeNoteForHierarchy(noteContent: string, noteTitle: string): Promise<{ hierarchy: MOCHierarchy, learning_context: LearningContext }> {

        const mocContext = await this.plugin.hierarchyManager.getHierarchyContextForAI();

        const hierarchyPrompt = `${HIERARCHY_ANALYSIS_PROMPT}

EXISTING MOC STRUCTURE:
${mocContext}

Note Title: "${noteTitle}"

Note Content:
${noteContent}

IMPORTANT: Consider the existing MOC structure above. If this content fits naturally under an existing hierarchy, place it there instead of creating a parallel structure. For example:
- If you have "Ultrafast Phenomenon" and new content is "Ultrafast Optics", place it as: Ultrafast Phenomenon > Ultrafast Optics
- If you have "Machine Learning" and new content is "Neural Networks", place it as: Computer Science > Machine Learning > Neural Networks
- Only create new top-level domains when the content truly doesn't fit existing hierarchies.`;

        let selectedModel = '';

        const traceManager = this.plugin.getTraceManager();
        if (traceManager) {
            const selectedModel = this.modelDropdown?.value || this.plugin.settings.gemini.model;
            const response = await traceManager.generateText({
                prompt: hierarchyPrompt,
                model: selectedModel,
                temperature: 0.3,
                maxTokens: 1000
            });

            return await this.parseHierarchyResponse(response.text);
        }

        throw new Error('AI services not available');
    }

    private async parseHierarchyResponse(responseText: string): Promise<{ hierarchy: MOCHierarchy, learning_context: LearningContext }> {

        let jsonText = responseText;
        const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch) {
            jsonText = jsonMatch[1].trim();
        }

        try {
            jsonText = this.cleanupJSON(jsonText);
            const response = JSON.parse(jsonText);
            console.log('[parseHierarchyResponse] 🔍 Analysis result:', {
                is_cross_domain: response.is_cross_domain,
                confidence: response.confidence_score,
                alternatives_count: response.alternative_hierarchies?.length || 0
            });

            const hasAlternatives = response.alternative_hierarchies && response.alternative_hierarchies.length > 0;
            const lowConfidence = response.confidence_score && response.confidence_score < 0.8;
            const shouldShowChoice = response.is_cross_domain || hasAlternatives || lowConfidence;

            if (shouldShowChoice && hasAlternatives) {

                return new Promise((resolve) => {
                    const modal = new HierarchyChoiceModal(this.app, response, (result) => {
                        resolve(result);
                    });
                    modal.open();
                });
            }

            if (response.primary_hierarchy && response.learning_context) {
                return {
                    hierarchy: response.primary_hierarchy,
                    learning_context: response.learning_context
                };
            }

            if (response.hierarchy && response.learning_context) {
                return {
                    hierarchy: response.hierarchy,
                    learning_context: response.learning_context
                };
            }
        } catch (error) {
        }

        return {
            hierarchy: {
                level1: 'General Knowledge',
                level2: 'Miscellaneous'
            },
            learning_context: {
                prerequisites: [],
                related_concepts: [],
                learning_path: ['General Knowledge'],
                complexity_level: 'intermediate',
                estimated_reading_time: '5-10 minutes'
            }
        };
    }

    private async fetchContentFromWebLink(url: string): Promise<string> {
        // @ts-ignore
        const vaultPath = this.app.vault.adapter.basePath || '';
        const scriptPath = path.join(vaultPath, '.obsidian', 'plugins', 'second-brAIn', 'fetch_content.py');
        const venvPython = path.join(vaultPath, '.obsidian', 'plugins', 'second-brAIn', 'venv', 'bin', 'python3');


        const { spawn } = require('child_process');
        const pythonProcess = spawn(venvPython, [scriptPath, url]);

        let fullOutput = "";
        let lastErrorLine = "";

        return new Promise((resolve, reject) => {
            pythonProcess.stdout.on('data', (data: Buffer) => {
                const output = data.toString();
                fullOutput += output;
            });

            pythonProcess.stderr.on('data', (data: Buffer) => {
                const errorOutput = data.toString();
                fullOutput += errorOutput;
                if (errorOutput.includes("[ERROR]")) {
                    lastErrorLine = errorOutput.trim();
                }
            });

            pythonProcess.on('close', (code: number) => {
                if (code === 0) {
                    resolve(fullOutput.trim());
                } else {
                    const finalError = lastErrorLine || `Python script for web content exited with code ${code}. Full output: ${fullOutput}`;
                    reject(new Error(finalError));
                }
            });

            pythonProcess.on('error', (err: Error) => {
                reject(new Error(`Failed to start web content extraction process: ${err.message}`));
            });
        });
    }

    private async fetchTranscriptFromPython(url: string): Promise<string> {
        // @ts-ignore
        const vaultPath = this.app.vault.adapter.basePath || '';
        const scriptPath = path.join(vaultPath, '.obsidian', 'plugins', 'second-brAIn', 'fetch_transcript.py');
        const venvPython = path.join(vaultPath, '.obsidian', 'plugins', 'second-brAIn', 'venv', 'bin', 'python3');


        const { spawn } = require('child_process');
        const pythonProcess = spawn(venvPython, [scriptPath, url]);

        let fullOutput = "";
        let lastErrorLine = "";

        return new Promise((resolve, reject) => {
            pythonProcess.stdout.on('data', (data: Buffer) => {
                const output = data.toString();
                fullOutput += output;

                const attemptMatch = output.match(/\[INFO\] Attempt (\d+)\/(\d+): Fetching transcript/);
                if (attemptMatch) {
                    const currentAttempt = parseInt(attemptMatch[1]);
                    const totalAttempts = parseInt(attemptMatch[2]);
                    this.updateStatusSteps(0, `Fetching transcript (Attempt ${currentAttempt}/${totalAttempts})...`, false, { current: currentAttempt, total: totalAttempts });
                }
            });

            pythonProcess.stderr.on('data', (data: Buffer) => {
                const errorOutput = data.toString();
                fullOutput += errorOutput; // Also add stderr to fullOutput for context
                if (errorOutput.includes("[ERROR]")) { // Catch specific errors from script
                    lastErrorLine = errorOutput.trim();
                }
            });

            pythonProcess.on('close', (code: number) => {

                const resultMarker = "[INFO] Script finished. Outputting result.";
                const markerIndex = fullOutput.lastIndexOf(resultMarker);
                let processedResult = "";

                if (markerIndex !== -1) {
                    processedResult = fullOutput.substring(markerIndex + resultMarker.length).trim();
                } else {
                    processedResult = fullOutput.trim();
                }

                if (processedResult.startsWith('Error: Failed to fetch transcript after')) {
                    this.updateStatusSteps(0, processedResult, true); // Update UI with final error
                    reject(processedResult);
                } else if (lastErrorLine && lastErrorLine.startsWith('[ERROR]')) {
                    this.updateStatusSteps(0, lastErrorLine, true);
                    reject(lastErrorLine);
                } else if (code !== 0) {
                    const finalError = `Python script exited with code ${code}. Output: ${processedResult || 'No specific output.'}`;
                    this.updateStatusSteps(0, finalError, true);
                    reject(new Error(finalError));
                } else if (!processedResult) {
                    const noTranscriptError = "Error: No transcript data was returned by the script, though it exited cleanly.";
                    this.updateStatusSteps(0, noTranscriptError, true);
                    reject(noTranscriptError);
                } else {
                    resolve(processedResult);
                }
            });

            pythonProcess.on('error', (err: Error) => {
                this.updateStatusSteps(0, `Failed to start transcript process: ${err.message}`, true);
                reject(new Error(`Failed to start transcript extraction process: ${err.message}`));
            });
        });
    }

    private async summarizeContent(text: string, prompt: string, url: string): Promise<{ summary: string, title: string, metadata: any, hierarchy?: any, learning_context?: any }> {
        let selectedModel = '';

        const hierarchyContext = await this.plugin.hierarchyManager.getHierarchyContextForAI();

        try {
            const selectedIntent = this.intentDropdown.value as ProcessingIntent;
            const comprehensiveResult = await this.generateComprehensiveNote(text, prompt, url, hierarchyContext, selectedIntent);

            return {
                summary: this.formatComprehensiveNote(comprehensiveResult),
                title: comprehensiveResult.title,
                metadata: comprehensiveResult.metadata,
                hierarchy: comprehensiveResult.hierarchy,
                learning_context: comprehensiveResult.learning_context
            };
        } catch (error) {
            return await this.fallbackSinglePassAnalysis(text, prompt, url, hierarchyContext);
        }
    }

    private async generateComprehensiveNote(text: string, prompt: string, url: string, hierarchyContext: string, intent: ProcessingIntent): Promise<any> {

        await this.startTrace({
            intent: intent,
            url: url,
            content_length: text.length
        });

        try {
            const additionalInstructions = this.promptInput.value;


            const intentPrompts = await this.promptLoader.loadPromptsForIntent(intent);

            this.updateStatusSteps(1, 'Analyzing structure, title, and metadata...');
            const structure = await this.analyzeStructureAndMetadata(text, hierarchyContext, additionalInstructions, intentPrompts.structure).catch(error => {
                this.updateStatusSteps(1, 'Failed to analyze structure: ' + (error.message || error), true);
                throw error;
            });

            this.updateStatusSteps(2, 'Extracting key concepts and insights...');
            const coreAnalysis = await this.analyzeContentDepth(text, structure, additionalInstructions, intentPrompts.content).catch(error => {
                this.updateStatusSteps(2, 'Failed to analyze content: ' + (error.message || error), true);
                throw error;
            });

            this.updateStatusSteps(3, 'Analyzing different perspectives and examples...');
            const perspectives = await this.analyzePerspectivesAndExamples(text, structure, additionalInstructions, intentPrompts.perspectives).catch(error => {
                this.updateStatusSteps(3, 'Failed to analyze perspectives: ' + (error.message || error), true);
                throw error;
            });

            this.updateStatusSteps(4, 'Finding connections and practical applications...');
            const connections = await this.analyzeConnectionsAndApplications(text, structure, additionalInstructions, intentPrompts.connections).catch(error => {
                this.updateStatusSteps(4, 'Failed to analyze connections: ' + (error.message || error), true);
                throw error;
            });

            this.updateStatusSteps(5, 'Creating learning paths and action items...');
            const learning = await this.analyzeLearningAndNextSteps(text, structure, additionalInstructions, intentPrompts.learning).catch(error => {
                this.updateStatusSteps(5, 'Failed to create learning paths: ' + (error.message || error), true);
                throw error;
            });

            const comprehensiveResult = this.mergeMultiPassResults(structure, coreAnalysis, perspectives, connections, learning);

            this.commitNoteToStats();

            return comprehensiveResult;
        } finally {
            await this.endTrace();
        }
    }

    private injectAdditionalInstructions(basePrompt: string, additionalInstructions: string, context: any = {}): string {
        let processedPrompt = basePrompt;


        processedPrompt = processedPrompt.replace('{HIERARCHY_CONTEXT}', context.hierarchyContext || '');
        processedPrompt = processedPrompt.replace('{CONTENT}', context.content || '{CONTENT}');
        processedPrompt = processedPrompt.replace('{TITLE}', context.title || 'Unknown');
        processedPrompt = processedPrompt.replace('{DOMAIN}', context.domain || 'General');
        processedPrompt = processedPrompt.replace('{TOPIC}', context.topic || 'Miscellaneous');
        processedPrompt = processedPrompt.replace('{OVERVIEW}', context.overview || 'No overview available');
        processedPrompt = processedPrompt.replace('{KEY_CONCEPTS}', context.keyConcepts || 'None identified');
        processedPrompt = processedPrompt.replace('{COMPLEXITY}', context.complexity || 'intermediate');
        processedPrompt = processedPrompt.replace('{PREREQUISITES}', context.prerequisites || 'None specified');

        let intentSpecificInstructions = '';
        const currentIntent = this.intentDropdown?.value as ProcessingIntent;

        switch (currentIntent) {
            case 'how_to':
                const selectedTopic = this.topicDropdown?.value || 'General';
                intentSpecificInstructions = `\nHOW-TO TUTORIAL FOCUS:
- This content is being organized as a tutorial/guide for the topic: "${selectedTopic}"
- Focus on extracting step-by-step processes, methodologies, and actionable instructions
- Identify prerequisites, tools needed, and expected outcomes
- Structure the content to be practical and implementable
- Emphasize learning pathways and skill progression
- Extract specific action items and implementation steps
- Tag with tutorial-specific keywords like #how-to, #tutorial, #guide, #implementation`;
                break;

            case 'knowledge_building':
                intentSpecificInstructions = `\nKNOWLEDGE BUILDING FOCUS:
- This content is for deep learning and understanding
- Focus on conceptual frameworks, theoretical foundations, and comprehensive explanations
- Extract key principles, models, and mental frameworks
- Identify connections to existing knowledge and broader concepts
- Emphasize learning pathways and knowledge progression
- Tag with knowledge-building keywords like #concept, #framework, #theory, #learning`;
                break;

            case 'research_collection':
                intentSpecificInstructions = `\nRESEARCH COLLECTION FOCUS:
- This content is being gathered for a specific research project
- Focus on data points, evidence, methodologies, and findings
- Extract research questions, hypotheses, and conclusions
- Identify sources, citations, and credibility indicators
- Emphasize research methodology and evidence quality
- Tag with research keywords like #research, #data, #evidence, #methodology`;
                break;

            case 'quick_reference':
                intentSpecificInstructions = `\nQUICK REFERENCE FOCUS:
- This content is for immediate practical use and quick lookup
- Focus on actionable information, key facts, and essential details
- Extract checklists, formulas, key numbers, and critical points
- Prioritize brevity and accessibility over depth
- Emphasize practical application and immediate utility
- Tag with reference keywords like #reference, #quick, #facts, #checklist`;
                break;

            case 'professional_intelligence':
                intentSpecificInstructions = `\nPROFESSIONAL INTELLIGENCE FOCUS:
- This content is for staying current in professional field/industry
- Focus on industry trends, market insights, and professional developments
- Extract business implications, competitive advantages, and strategic insights
- Identify key players, market dynamics, and future implications
- Emphasize professional relevance and career impact
- Tag with professional keywords like #industry, #trends, #business, #strategy`;
                break;

            case 'personal_development':
                intentSpecificInstructions = `\nPERSONAL DEVELOPMENT FOCUS:
- This content is for self-improvement and habit formation
- Focus on actionable advice, behavioral insights, and personal growth strategies
- Extract practical exercises, habit formation techniques, and mindset shifts
- Identify personal application opportunities and growth metrics
- Emphasize personal transformation and skill development
- Tag with development keywords like #growth, #habits, #skills, #mindset`;
                break;

            case 'event_documentation':
                intentSpecificInstructions = `\nEVENT DOCUMENTATION FOCUS:
- This content is for recording what happened for future reference
- Focus on chronological events, key decisions, and outcomes
- Extract timelines, participants, decisions made, and results
- Identify lessons learned, what worked, and what didn't
- Emphasize historical record and future reference value
- Tag with documentation keywords like #event, #record, #timeline, #lessons`;
                break;

            case 'news_events':
                intentSpecificInstructions = `\nNEWS & CURRENT EVENTS FOCUS:
- This content is for staying informed about current developments
- Focus on factual reporting, implications, and broader context
- Extract key facts, stakeholders, and potential impacts
- Identify trends, patterns, and connections to other events
- Emphasize timeliness and relevance to current affairs
- Tag with news keywords like #news, #current, #events, #impact`;
                break;

            case 'inspiration_capture':
                intentSpecificInstructions = `\nINSPIRATION CAPTURE FOCUS:
- This content is for preserving creative ideas and inspiration
- Focus on creative insights, innovative approaches, and inspiring concepts
- Extract creative techniques, novel perspectives, and motivational elements
- Identify artistic, creative, or innovative applications
- Emphasize creative potential and inspirational value
- Tag with inspiration keywords like #inspiration, #creative, #ideas, #innovation`;
                break;
        }

        const combinedInstructions = [intentSpecificInstructions, additionalInstructions].filter(Boolean).join('\n');

        if (combinedInstructions.trim()) {
            const additionalSection = `\nADDITIONAL FOCUS:\n${combinedInstructions.trim()}\n\nIMPORTANT: Your response must still be valid JSON. Do not break JSON syntax with unescaped quotes, newlines, or other formatting.\n`;
            processedPrompt = processedPrompt.replace('{ADDITIONAL_INSTRUCTIONS}', additionalSection);
        } else {
            processedPrompt = processedPrompt.replace('{ADDITIONAL_INSTRUCTIONS}', '');
        }

        return processedPrompt;
    }

    private async analyzeStructureAndMetadata(text: string, hierarchyContext: string, additionalInstructions: string = '', customPrompt?: string): Promise<any> {
        if (!customPrompt) {
            throw new Error('No prompt provided for structure analysis');
        }
        const basePrompt = customPrompt;
        const context = {
            hierarchyContext,
            content: text
        };
        const structurePrompt = this.injectAdditionalInstructions(basePrompt, additionalInstructions, context);
        const intent = this.intentDropdown?.value || 'unknown';

        await this.debugLogPrompt('Structure & Metadata', structurePrompt, intent);

        const response = await this.makeTracedAIRequest(structurePrompt, {
            intent: intent,
            pass: 'structure-metadata'
        });

        await this.debugLogResponse('Structure & Metadata', response, intent);

        return response;
    }

    private async analyzeContentDepth(text: string, structure: any, additionalInstructions: string = '', customPrompt?: string): Promise<any> {
        if (!customPrompt) {
            throw new Error('No prompt provided for content analysis');
        }
        const basePrompt = customPrompt;
        const context = {
            content: text,
            title: structure.title || 'Unknown',
            domain: structure.hierarchy?.level1 || 'General',
            topic: structure.hierarchy?.level2 || 'Miscellaneous'
        };
        const depthPrompt = this.injectAdditionalInstructions(basePrompt, additionalInstructions, context);
        const intent = this.intentDropdown?.value || 'unknown';

        await this.debugLogPrompt('Content Depth', depthPrompt, intent);

        const response = await this.makeTracedAIRequest(depthPrompt, {
            intent: intent,
            pass: 'content-depth'
        });

        await this.debugLogResponse('Content Depth', response, intent);

        return response;
    }

    private async analyzePerspectivesAndExamples(text: string, structure: any, additionalInstructions: string = '', customPrompt?: string): Promise<any> {
        if (!customPrompt) {
            throw new Error('No prompt provided for perspectives analysis');
        }
        const basePrompt = customPrompt;
        const context = {
            content: text,
            title: structure.title || 'Unknown',
            overview: structure.overview || 'No overview available'
        };
        const perspectivesPrompt = this.injectAdditionalInstructions(basePrompt, additionalInstructions, context);
        const intent = this.intentDropdown?.value || 'unknown';

        await this.debugLogPrompt('Perspectives & Examples', perspectivesPrompt, intent);

        const response = await this.makeTracedAIRequest(perspectivesPrompt, {
            intent: intent,
            pass: 'perspectives-examples'
        });

        await this.debugLogResponse('Perspectives & Examples', response, intent);

        return response;
    }

    private async analyzeConnectionsAndApplications(text: string, structure: any, additionalInstructions: string = '', customPrompt?: string): Promise<any> {
        if (!customPrompt) {
            throw new Error('No prompt provided for connections analysis');
        }
        const basePrompt = customPrompt;
        const context = {
            content: text,
            title: structure.title || 'Unknown',
            domain: structure.hierarchy?.level1 || 'General',
            keyConcepts: structure.metadata?.key_concepts?.join(', ') || 'None identified'
        };
        const connectionsPrompt = this.injectAdditionalInstructions(basePrompt, additionalInstructions, context);
        const intent = this.intentDropdown?.value || 'unknown';

        await this.debugLogPrompt('Connections & Applications', connectionsPrompt, intent);

        const response = await this.makeTracedAIRequest(connectionsPrompt, {
            intent: intent,
            pass: 'connections-applications'
        });

        await this.debugLogResponse('Connections & Applications', response, intent);

        return response;
    }

    private async analyzeLearningAndNextSteps(text: string, structure: any, additionalInstructions: string = '', customPrompt?: string): Promise<any> {
        if (!customPrompt) {
            throw new Error('No prompt provided for learning analysis');
        }
        const basePrompt = customPrompt;
        const context = {
            content: text,
            title: structure.title || 'Unknown',
            complexity: structure.learning_context?.complexity_level || 'intermediate',
            prerequisites: structure.learning_context?.prerequisites?.join(', ') || 'None specified'
        };
        const learningPrompt = this.injectAdditionalInstructions(basePrompt, additionalInstructions, context);
        const intent = this.intentDropdown?.value || 'unknown';

        await this.debugLogPrompt('Learning & Next Steps', learningPrompt, intent);

        const response = await this.makeTracedAIRequest(learningPrompt, {
            intent: intent,
            pass: 'learning-next-steps'
        });

        await this.debugLogResponse('Learning & Next Steps', response, intent);

        return response;
    }

    private cleanJsonResponse(jsonString: string): string {
        let cleaned = jsonString.trim();

        if (cleaned.startsWith('```json')) {
            cleaned = cleaned.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        } else if (cleaned.startsWith('```')) {
            cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '');
        }

        const firstBrace = cleaned.indexOf('{');
        if (firstBrace !== -1) {
            cleaned = cleaned.substring(firstBrace);

            let braceCount = 0;
            let endIndex = -1;
            for (let i = 0; i < cleaned.length; i++) {
                if (cleaned[i] === '{') braceCount++;
                if (cleaned[i] === '}') braceCount--;
                if (braceCount === 0) {
                    endIndex = i;
                    break;
                }
            }

            if (endIndex !== -1) {
                cleaned = cleaned.substring(0, endIndex + 1);
            }
        }

        return cleaned.trim();
    }

    private fixJsonStringEscaping(jsonString: string): string {
        try {
            let fixed = jsonString;

            fixed = fixed.replace(/"([^"]*?)([^\\])"([^"]*?)"/g, (match, before, quote, after) => {
                if (after && after.length > 0 && !after.startsWith(',') && !after.startsWith('}') && !after.startsWith(']')) {
                    return `"${before}${quote}\\"${after}"`;
                }
                return match;
            });

            fixed = fixed.replace(/(".*?)\n(.*?")/g, '$1\\n$2');

            fixed = fixed.replace(/(".*?[^\\])\\([^"\\nrt])/g, '$1\\\\$2');

            fixed = fixed.replace(/,\s*([}\]])/g, '$1');

            return fixed;
        } catch (error) {
            return jsonString;
        }
    }

    private truncateJsonResponse(jsonString: string): string {
        try {
            const maxLength = 30000;
            if (jsonString.length <= maxLength) return jsonString;

            const truncated = jsonString.substring(0, maxLength);

            const lastComma = truncated.lastIndexOf(',');
            const lastCloseBrace = truncated.lastIndexOf('}');
            const lastCloseBracket = truncated.lastIndexOf(']');

            const safeTruncatePoint = Math.max(lastComma, lastCloseBrace, lastCloseBracket);

            if (safeTruncatePoint > maxLength * 0.8) {
                let result = truncated.substring(0, safeTruncatePoint);

                const openBraces = (result.match(/{/g) || []).length;
                const closeBraces = (result.match(/}/g) || []).length;
                const openBrackets = (result.match(/\[/g) || []).length;
                const closeBrackets = (result.match(/\]/g) || []).length;

                result += '}'.repeat(openBraces - closeBraces);
                result += ']'.repeat(openBrackets - closeBrackets);

                return result;
            }

            return truncated + '}';

        } catch (error) {
            return jsonString.substring(0, 30000) + '}';
        }
    }

    private aggressiveJsonRepair(jsonString: string): string {
        try {
            let repaired = jsonString;

            repaired = repaired.replace(/```json\s*/g, '').replace(/```\s*/g, '');

            const firstBrace = repaired.indexOf('{');
            if (firstBrace === -1) {
                throw new Error('No JSON object found');
            }

            let braceCount = 0;
            let endPos = firstBrace;

            for (let i = firstBrace; i < repaired.length; i++) {
                if (repaired[i] === '{') braceCount++;
                else if (repaired[i] === '}') braceCount--;

                if (braceCount === 0) {
                    endPos = i;
                    break;
                }
            }

            repaired = repaired.substring(firstBrace, endPos + 1);

            repaired = repaired.replace(/"[^"]*"/g, (match) => {
                let content = match.slice(1, -1); // Remove surrounding quotes
                content = content.replace(/"/g, '\\"'); // Escape internal quotes
                content = content.replace(/\n/g, '\\n'); // Escape newlines
                content = content.replace(/\r/g, '\\r'); // Escape carriage returns
                content = content.replace(/\t/g, '\\t'); // Escape tabs
                content = content.replace(/\\/g, '\\\\'); // Escape backslashes
                return `"${content}"`;
            });

            repaired = repaired.replace(/,(\s*[}\]])/g, '$1');

            if (repaired.length > 20000) {
                repaired = repaired.substring(0, 15000) + '}';
            }

            return repaired;

        } catch (error) {
            return '{"error": "Response parsing failed", "fallback": true}';
        }
    }

    private async makeAIRequest(prompt: string): Promise<any> {
        let responseText = '';

        try {
            const traceManager = this.plugin.getTraceManager();
            if (traceManager) {
                const selectedModel = this.modelDropdown?.value || this.plugin.settings.gemini.model;
                const response = await traceManager.generateText({
                    prompt: prompt,
                    model: selectedModel,
                    temperature: 0.3
                });
                responseText = response.text;

                const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
                const jsonText = jsonMatch ? jsonMatch[1].trim() : responseText.trim();

                try {
                    return JSON.parse(jsonText);
                } catch (parseError) {

                    try {
                        const cleanedResponse = this.cleanJsonResponse(jsonText);

                        return JSON.parse(cleanedResponse);
                    } catch (secondParseError) {

                        const aggressiveCleaned = this.aggressiveJsonRepair(jsonText);
                        return JSON.parse(aggressiveCleaned);
                    }
                }
            }

            throw new Error('No valid AI provider configured');

        } catch (error) {
            throw error;
        }
    }

    private mergeMultiPassResults(structure: any, coreAnalysis: any, perspectives: any, connections: any, learning: any): any {
        return {
            title: structure.title,
            metadata: structure.metadata,
            hierarchy: structure.hierarchy,
            learning_context: structure.learning_context,
            overview: structure.overview,

            context: coreAnalysis.context,
            detailed_summary: coreAnalysis.detailed_summary,
            key_facts: coreAnalysis.key_facts,
            deep_insights: coreAnalysis.deep_insights,
            core_concepts: coreAnalysis.core_concepts,

            multiple_perspectives: perspectives.multiple_perspectives,
            analogies_examples: perspectives.analogies_examples,
            case_studies: perspectives.case_studies,

            knowledge_connections: connections.knowledge_connections,
            practical_applications: connections.practical_applications,
            implications_consequences: connections.implications_consequences,

            knowledge_gaps: learning.knowledge_gaps,
            learning_pathways: learning.learning_pathways,
            actionable_next_steps: learning.actionable_next_steps,
            reflection_questions: learning.reflection_questions
        };
    }

    private formatComprehensiveNote(result: any): string {
        let content = `# ${result.title}\n\n`;

        if (result.overview) {
            content += `## Overview\n${result.overview}\n\n`;
        }

        if (result.context) {
            content += `## Context & Background\n${result.context}\n\n`;
        }

        if (result.detailed_summary) {
            content += `## Comprehensive Summary\n${result.detailed_summary}\n\n`;
        }

        if (result.key_facts?.length) {
            content += `## Key Facts\n`;
            result.key_facts.forEach((fact: string) => {
                content += `- ${fact}\n`;
            });
            content += '\n';
        }

        if (result.deep_insights?.length) {
            content += `## Deep Insights\n`;
            result.deep_insights.forEach((insight: string, index: number) => {
                const colonIndex = insight.indexOf(':');
                if (colonIndex > 0 && colonIndex < 100) {
                    const title = insight.substring(0, colonIndex).trim();
                    const body = insight.substring(colonIndex + 1).trim();
                    content += `### ${index + 1}. ${title}\n${body}\n\n`;
                } else {
                    content += `### Insight ${index + 1}\n${insight}\n\n`;
                }
            });
        }

        if (result.core_concepts?.length) {
            content += `## Core Concepts\n`;
            result.core_concepts.forEach((concept: string) => {
                const colonIndex = concept.indexOf(':');
                if (colonIndex > 0 && colonIndex < 100) {
                    const title = concept.substring(0, colonIndex).trim();
                    const body = concept.substring(colonIndex + 1).trim();
                    content += `### ${title}\n${body}\n\n`;
                } else {
                    content += `### ${concept}\n\n`;
                }
            });
        }

        if (result.multiple_perspectives?.length) {
            content += `## Multiple Perspectives\n`;
            result.multiple_perspectives.forEach((perspective: any) => {
                content += `### ${perspective.viewpoint}\n${perspective.analysis}\n\n`;
            });
        }

        if (result.analogies_examples?.length) {
            content += `## Analogies & Examples\n`;
            result.analogies_examples.forEach((example: any) => {
                content += `### ${example.concept}\n**Analogy**: ${example.analogy}\n\n**Real-World Example**: ${example.real_world_example}\n\n`;
            });
        }

        if (result.case_studies?.length) {
            content += `## Case Studies\n`;
            result.case_studies.forEach((study: any, index: number) => {
                if (typeof study === 'string') {
                    content += `### Case Study ${index + 1}\n${study}\n\n`;
                } else if (study && typeof study === 'object') {
                    const title = study.case_study_name || `Case Study ${index + 1}`;
                    content += `### ${title}\n`;
                    if (study.description) {
                        content += `${study.description}\n\n`;
                    }
                    if (study.lessons_learned && Array.isArray(study.lessons_learned)) {
                        content += `**Key Lessons:**\n`;
                        study.lessons_learned.forEach((lesson: string) => {
                            content += `- ${lesson}\n`;
                        });
                        content += `\n`;
                    }
                } else {
                    content += `### Case Study ${index + 1}\n${String(study)}\n\n`;
                }
            });
        }

        if (result.knowledge_connections?.length) {
            content += `## Knowledge Connections\n`;
            result.knowledge_connections.forEach((connection: any) => {
                content += `### ${connection.related_field}\n**Connection Type**: ${connection.connection_type}\n\n${connection.detailed_explanation}\n\n`;
            });
        }

        if (result.practical_applications?.length) {
            content += `## Practical Applications\n`;
            result.practical_applications.forEach((application: any) => {
                content += `### ${application.domain}: ${application.application}\n**Implementation**: ${application.implementation}\n\n**Benefits**: ${application.benefits}\n\n`;
            });
        }

        if (result.implications_consequences?.length) {
            content += `## Implications & Consequences\n`;
            result.implications_consequences.forEach((implication: string) => {
                content += `- ${implication}\n`;
            });
            content += '\n';
        }

        if (result.learning_pathways?.length) {
            content += `## Learning Pathways\n`;
            result.learning_pathways.forEach((pathway: any) => {
                content += `### ${pathway.pathway_name}\n**Estimated Time**: ${pathway.estimated_time} | **Difficulty**: ${pathway.difficulty}\n\n`;
                pathway.steps.forEach((step: string, index: number) => {
                    content += `${index + 1}. ${step}\n`;
                });
                content += '\n';
            });
        }

        if (result.actionable_next_steps?.length) {
            content += `## Actionable Next Steps\n`;
            result.actionable_next_steps.forEach((category: any) => {
                content += `### ${category.category}\n`;
                category.actions.forEach((action: string) => {
                    content += `- [ ] ${action}\n`;
                });
                content += '\n';
            });
        }

        if (result.knowledge_gaps?.length) {
            content += `> [!gap] Knowledge Gaps to Explore\n`;
            result.knowledge_gaps.forEach((gap: any) => {
                if (typeof gap === 'string') {
                    content += `> - [ ] ${gap}\n`;
                } else if (gap && typeof gap === 'object') {
                    const gapText = gap.gap || gap.title || String(gap);
                    const explanation = gap.explanation || gap.description;
                    if (explanation) {
                        content += `> - [ ] **${gapText}**: ${explanation}\n`;
                    } else {
                        content += `> - [ ] ${gapText}\n`;
                    }
                } else {
                    content += `> - [ ] ${String(gap)}\n`;
                }
            });
            content += '\n';
        }

        if (result.reflection_questions?.length) {
            content += `## Reflection Questions\n`;
            result.reflection_questions.forEach((question: string, index: number) => {
                content += `${index + 1}. ${question}\n`;
            });
            content += '\n';
        }

        return content;
    }

    private async fallbackSinglePassAnalysis(text: string, prompt: string, url: string, hierarchyContext: string): Promise<any> {

        const basePrompt = prompt === this.plugin.settings.defaultPrompt ? DEFAULT_SUMMARIZATION_PROMPT : prompt;
        const enhancedPrompt = `${basePrompt}\n\n${ENHANCED_SUMMARIZATION_PROMPT.split('\n\n').slice(1).join('\n\n')}\n\nEXISTING KNOWLEDGE HIERARCHY:\n${hierarchyContext}`;

        const traceManager = this.plugin.getTraceManager();
        if (traceManager) {
            const selectedModel = this.modelDropdown?.value || this.plugin.settings.gemini.model;

            try {
                const response = await traceManager.generateText({
                    prompt: enhancedPrompt + "\n\n" + text,
                    model: selectedModel,
                    temperature: 0.3,
                    maxTokens: 4000
                });
                const responseText = response.text;

                const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
                const jsonText = jsonMatch ? jsonMatch[1].trim() : responseText.trim();

                let sections;
                try {
                    sections = this.validateJSONResponse(JSON.parse(jsonText));
                } catch (jsonError) {

                    if (jsonError.message.includes('position')) {
                        const position = parseInt(jsonError.message.match(/position (\d+)/)?.[1] || '0');
                        const start = Math.max(0, position - 100);
                        const end = Math.min(jsonText.length, position + 100);
                    }

                    try {
                        const cleanedJson = this.cleanupJSON(jsonText);
                        sections = this.validateJSONResponse(JSON.parse(cleanedJson));
                    } catch (cleanupError) {

                        sections = {
                            title: 'AI Generated Summary',
                            metadata: {
                                tags: ['#ai-summary'],
                                topics: [],
                                related: [],
                                speakers: []
                            },
                            hierarchy: {
                                level1: 'General Knowledge',
                                level2: 'Miscellaneous'
                            },
                            learning_context: {
                                prerequisites: [],
                                related_concepts: [],
                                learning_path: [],
                                complexity_level: 'intermediate',
                                estimated_reading_time: '5-10 minutes'
                            },
                            context: 'AI-generated content with parsing issues',
                            summary: jsonText.substring(0, 2000) + '...\n\n> [!warning] JSON Parsing Issue\n> The AI response had formatting issues but content has been preserved.',
                            sections: {
                                raw_ai_response: jsonText
                            }
                        };
                    }
                }

                return {
                    summary: this.formatEnhancedSummary(sections),
                    title: sections.title,
                    metadata: sections.metadata,
                    hierarchy: sections.hierarchy,
                    learning_context: sections.learning_context
                };
            } catch (error) {
                new Notice(`Gemini API Error: ${error.message}`);
                return { summary: '', title: 'Untitled', metadata: {}, hierarchy: undefined, learning_context: undefined };
            }
        }

        return { summary: '', title: 'Untitled', metadata: {}, hierarchy: undefined, learning_context: undefined };
    }

    private parseSections(responseText: string): any {

        const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
        let jsonText = jsonMatch ? jsonMatch[1].trim() : responseText.trim();


        try {
            jsonText = this.cleanupJSON(jsonText);

            const response = JSON.parse(jsonText);

            return {
                title: response.title || 'Untitled',
                metadata: response.metadata || {
                    tags: ['#summary'],
                    topics: [],
                    related: [],
                    speakers: []
                },
                hierarchy: response.hierarchy || {
                    level1: 'General Knowledge',
                    level2: 'Miscellaneous'
                },
                learning_context: response.learning_context || {
                    prerequisites: [],
                    related_concepts: [],
                    learning_path: [],
                    complexity_level: 'intermediate',
                    estimated_reading_time: '5-10 minutes'
                },
                ...response.sections
            };
        } catch (error) {

            try {
                const aggressivelyCleanedJSON = this.aggressiveJSONCleanup(jsonText);
                const response = JSON.parse(aggressivelyCleanedJSON);

                return {
                    title: response.title || 'Untitled',
                    metadata: response.metadata || {
                        tags: ['#summary'],
                        topics: [],
                        related: [],
                        speakers: []
                    },
                    hierarchy: response.hierarchy || {
                        level1: 'General Knowledge',
                        level2: 'Miscellaneous'
                    },
                    learning_context: response.learning_context || {
                        prerequisites: [],
                        related_concepts: [],
                        learning_path: [],
                        complexity_level: 'intermediate',
                        estimated_reading_time: '5-10 minutes'
                    },
                    ...response.sections
                };
            } catch (secondError) {

                throw new Error(`AI returned malformed JSON response. Please regenerate with a clearer prompt. Original error: ${error.message}, Cleanup error: ${secondError.message}`);
            }
        }
    }

    private formatEnhancedSummary(sections: any): string {
        let formattedContent = '';

        if (sections.raw_content) {
            formattedContent += `> [!warning] Parsing Notice\n> The AI response could not be fully parsed as structured data. The raw content is preserved below, and basic organization has been applied. You may want to manually review and enhance this content.\n\n`;
            formattedContent += `## Raw AI Response\n\n${sections.raw_content}\n\n---\n\n`;
        }

        if (sections.context) {
            formattedContent += `> [!context] Context\n> ${sections.context.replace(/\n/g, '\n> ')}\n\n`;
        }

        if (sections.facts && Array.isArray(sections.facts)) {
            formattedContent += `> [!fact] Facts\n`;
            sections.facts.forEach((fact: string) => {
                formattedContent += `> - ${fact}\n`;
            });
            formattedContent += '\n';
        }

        if (sections.perspectives && Array.isArray(sections.perspectives)) {
            formattedContent += `> [!perspective] Perspectives\n`;
            sections.perspectives.forEach((perspective: string) => {
                formattedContent += `> - ${perspective}\n`;
            });
            formattedContent += '\n';
        }

        if (sections.insights && Array.isArray(sections.insights)) {
            formattedContent += `> [!insight] Insights\n`;
            sections.insights.forEach((insight: string) => {
                formattedContent += `> - ${insight}\n`;
            });
            formattedContent += '\n';
        }

        if (sections.personal_reflection) {
            formattedContent += `> [!reflection] Personal Reflection\n> ${sections.personal_reflection.replace(/\n/g, '\n> ')}\n\n`;
        }

        if (sections.analogies && Array.isArray(sections.analogies)) {
            formattedContent += `> [!analogy] Analogies and Metaphors\n`;
            sections.analogies.forEach((analogy: string) => {
                formattedContent += `> - ${analogy}\n`;
            });
            formattedContent += '\n';
        }

        if (sections.questions && Array.isArray(sections.questions)) {
            formattedContent += `> [!question] Questions and Curiosities\n`;
            sections.questions.forEach((question: string) => {
                formattedContent += `> - [ ] ${question}\n`;
            });
            formattedContent += '\n';
        }

        if (sections.applications && Array.isArray(sections.applications)) {
            formattedContent += `> [!example] Applications and Examples\n`;
            sections.applications.forEach((application: string) => {
                formattedContent += `> - ${application}\n`;
            });
            formattedContent += '\n';
        }

        if (sections.contrasts && Array.isArray(sections.contrasts)) {
            formattedContent += `> [!contrast] Contrasts and Comparisons\n`;
            sections.contrasts.forEach((contrast: string) => {
                formattedContent += `> - ${contrast}\n`;
            });
            formattedContent += '\n';
        }

        if (sections.implications && Array.isArray(sections.implications)) {
            formattedContent += `> [!implication] Implications\n`;
            sections.implications.forEach((implication: string) => {
                formattedContent += `> - ${implication}\n`;
            });
            formattedContent += '\n';
        }

        if (sections.knowledge_gaps && Array.isArray(sections.knowledge_gaps)) {
            formattedContent += `> [!gap] Knowledge Gaps\n`;
            sections.knowledge_gaps.forEach((gap: any) => {
                if (typeof gap === 'string') {
                    formattedContent += `> - [ ] ${gap}\n`;
                } else if (gap && typeof gap === 'object') {
                    const gapText = gap.gap || gap.title || String(gap);
                    const explanation = gap.explanation || gap.description;
                    if (explanation) {
                        formattedContent += `> - [ ] **${gapText}**: ${explanation}\n`;
                    } else {
                        formattedContent += `> - [ ] ${gapText}\n`;
                    }
                } else {
                    formattedContent += `> - [ ] ${String(gap)}\n`;
                }
            });
            formattedContent += '\n';
        }

        if (sections.next_steps && Array.isArray(sections.next_steps)) {
            formattedContent += `> [!todo] Next Steps\n`;
            sections.next_steps.forEach((step: string) => {
                formattedContent += `> - [ ] ${step}\n`;
            });
            formattedContent += '\n';
        }

        if (sections.related_goals && Array.isArray(sections.related_goals)) {
            formattedContent += `> [!goal] Related Goals\n`;
            sections.related_goals.forEach((goal: string) => {
                formattedContent += `> - [ ] ${goal}\n`;
            });
            formattedContent += '\n';
        }

        return formattedContent;
    }

    private cleanupJSON(jsonText: string): string {
        let cleaned = jsonText
            .replace(/^\uFEFF/, '') // Remove BOM
            .replace(/[\u200B-\u200D\uFEFF]/g, '') // Remove zero-width spaces and similar
            .replace(/[\u0000-\u001F\u007F-\u009F]/g, '') // Remove control characters
            .replace(/```json\s*|\s*```/g, '')
            .replace(/,(\s*[}\]])/g, '$1') // Remove trailing commas before closing brackets/braces
            .replace(/](\s*[^,}\]\s])/g, '],$1') // Add missing comma after array close
            .replace(/}(\s*[^,}\]\s])/g, '},$1') // Add missing comma after object close
            .replace(/(\w|"|})(\s*\[)/g, '$1,$2') // Add missing comma before array start
            .replace(/(\w|"|})(\s*{)/g, '$1,$2') // Add missing comma before object start
            .replace(/\\"/g, '"')
            .replace(/\\(?!")/g, '')
            .replace(/\\\\"/g, '\\"')
            .replace(/:\s*"([^"]*)"([^",}\]]*)"([^",}\]]*)/g, ': "$1\\"$2\\"$3')
            .replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":')
            .trim();

        if (!cleaned.startsWith('{')) {
            const braceIndex = cleaned.indexOf('{');
            if (braceIndex > -1) {
                cleaned = cleaned.substring(braceIndex);
            }
        }

        try {
            JSON.parse(cleaned);
        } catch (e) {

            cleaned = cleaned.replace(/,\s*""/g, ',"');

            const lines = cleaned.split('\n');
            for (let i = 0; i < lines.length; i++) {
                let line = lines[i];

                if (line.includes('"') && !line.match(/^[\s]*["}]/)) {
                    const quoteCount = (line.match(/"/g) || []).length;
                    if (quoteCount > 2 && quoteCount % 2 === 0) {
                        line = line.replace(/([^:,\[\{]\s*)"([^"]*)"([^,\]\}])/g, '$1\\"$2\\"$3');
                    }
                }
                lines[i] = line;
            }
            cleaned = lines.join('\n');

            cleaned = cleaned
                .replace(/]\s*"/g, '],"') // Fix missing comma after array
                .replace(/}\s*"/g, '},"') // Fix missing comma after object
                .replace(/\[\s*,/g, '[')  // Remove leading comma in arrays
                .replace(/,\s*,/g, ',')   // Remove duplicate commas
                .replace(/,\s*]/g, ']')   // Remove trailing comma before array close
                .replace(/,\s*}/g, '}');  // Remove trailing comma before object close
        }

        return cleaned;
    }

    private aggressiveJSONCleanup(jsonText: string): string {
        let cleaned = jsonText
            .replace(/^\uFEFF/, '') // Remove BOM
            .replace(/[\u200B-\u200D\uFEFF]/g, '') // Remove zero-width spaces
            .replace(/[\u0000-\u001F\u007F-\u009F]/g, '') // Remove control characters
            .replace(/[\u2000-\u206F]/g, '') // Remove additional Unicode spaces
            .replace(/[\u2E00-\u2E7F]/g, ''); // Remove punctuation symbols

        cleaned = cleaned
            .replace(/,\s*([}\]])/g, '$1')
            .replace(/([^\\])"([^"]*)"([^,:}\]]*)/g, '$1\\"$2\\"$3')
            .replace(/\\(?!["\\/bfnrt])/g, '')
            .replace(/([^"])"\s*,?\s*$/gm, '$1",')
            .replace(/}\s*[^}]*$/, '}')
            .replace(/^[^{]*/, '')
            .trim();

        if (!cleaned.startsWith('{')) {
            const match = cleaned.match(/\{[\s\S]*\}/);
            if (match) {
                cleaned = match[0];
            }
        }

        return cleaned;
    }

    private validateJSONResponse(response: any): any {

        const sections = response.sections || response;

        return {
            title: response.title || 'Untitled',
            metadata: response.metadata || {
                tags: ['#summary'],
                topics: [],
                related: [],
                speakers: []
            },
            hierarchy: response.hierarchy || {
                level1: 'General Knowledge',
                level2: 'Miscellaneous'
            },
            learning_context: response.learning_context || {
                prerequisites: [],
                related_concepts: [],
                learning_path: [],
                complexity_level: 'intermediate',
                estimated_reading_time: '5-10 minutes'
            },
            ...sections,
            sections: sections
        };
    }

    private parseMetadata(metadataText: string): any {
        const metadata: any = {
            tags: [],
            topics: [],
            related: [],
            speakers: []
        };

        const lines = metadataText.split('\n');

        for (const line of lines) {
            const [key, value] = line.split(':').map(s => s.trim());
            if (key && value) {
                switch (key.toLowerCase()) {
                    case 'speakers':
                        metadata.speakers = value.split(',')
                            .map(s => s.trim())
                            .filter(s => s.length > 0 && s !== 'N/A')
                            .map(s => s.replace(/^\[|\]$/g, '').trim());
                        break;
                    case 'key topics':
                        metadata.topics = value.split(',')
                            .map(t => t.trim())
                            .filter(t => t.length > 0)
                            .map(t => t.replace(/^\[|\]$/g, '').trim());
                        break;
                    case 'tags':
                        metadata.tags = value.split(',')
                            .map(t => t.trim())
                            .filter(t => t.length > 0)
                            .map(t => t.replace(/^\[|\]$/g, '').trim());
                        break;
                    case 'related concepts':
                        metadata.related = value.split(',')
                            .map(t => t.trim())
                            .filter(t => t.length > 0)
                            .map(t => t.replace(/^\[|\]$/g, '').trim());
                        break;
                }
            }
        }

        if (metadata.tags.length === 0) {
            metadata.tags = ['#summary'];
        }

        return metadata;
    }

    private async createNoteWithSummary(summary: string, title: string, url: string, metadata?: any, fullResult?: any, intent?: ProcessingIntent): Promise<TFile | null> {
        const fileName = sanitizeFileName(title + '.md');
        let folderPath = this.plugin.settings.mocFolder; // fallback to root MOC folder

        if (intent === 'how_to' && this.plugin.settings.topicFolders.enabled) {
            const selectedTopic = await this.getSelectedTopic();
            if (selectedTopic) {
                try {
                    if (selectedTopic !== '__new__' && !this.plugin.settings.topicFolders.topics.includes(selectedTopic)) {
                        await this.addTopicToSettings(selectedTopic);
                    }

                    folderPath = await this.ensureTopicFolder(selectedTopic);
                } catch (error) {
                    new Notice(`Failed to create topic folder. Note will be saved in MOC folder.`);
                }
            }
        }

        let mocPath: string | null = null;
        let hierarchyData: NoteHierarchyAnalysis | null = null;

        const updateMOCStatus = (message: string) => {
            this.statusMessage.innerText = message;
        };

        const useTopicFolders = intent === 'how_to' && this.plugin.settings.topicFolders.enabled && this.topicDropdown.value;

        if (this.plugin.settings.enableMOC && metadata && !useTopicFolders) {
            try {
                const aiHierarchy = fullResult?.hierarchy;
                const aiLearningContext = fullResult?.learning_context;

                if (aiHierarchy && aiHierarchy.level1 && aiHierarchy.level2) {
                    updateMOCStatus(`Organizing in ${aiHierarchy.level1} > ${aiHierarchy.level2}...`);

                    hierarchyData = {
                        hierarchy: aiHierarchy,
                        learning_context: aiLearningContext || {
                            prerequisites: [],
                            related_concepts: [],
                            learning_path: [aiHierarchy.level2],
                            complexity_level: 'intermediate',
                            estimated_reading_time: '5-10 minutes'
                        },
                        moc_placement: {
                            primary_moc: `${aiHierarchy.level1}/${aiHierarchy.level2}`
                        }
                    };


                    updateMOCStatus('Creating knowledge map structure...');
                    mocPath = await this.plugin.mocManager.ensureMOCExists(hierarchyData.hierarchy);

                    folderPath = this.plugin.mocManager.getMostSpecificMOCDirectory(hierarchyData.hierarchy);

                    updateMOCStatus('Knowledge map ready');
                } else {
                    updateMOCStatus('AI hierarchy generation failed - note will be saved without MOC organization');
                    hierarchyData = null;
                    mocPath = null;
                }
            } catch (error) {
                updateMOCStatus('Knowledge organization failed, but note will be saved');
                new Notice('Note will be saved, but automatic organization failed. You can organize it manually later.');
            }
        }

        const frontmatter = {
            title: title,
            date: new Date().toISOString().split('T')[0],
            type: 'summary',
            intent: intent || 'knowledge_building',
            source: {
                type: url.includes('youtube.com') ? 'youtube' : 'web',
                url: url,
                source_type: fullResult?.source_type || 'traditional',
                detected_platform: extractPlatformFromUrl(url)
            },
            status: 'draft',
            created: new Date().toISOString(),
            modified: new Date().toISOString(),
            ...(fullResult?.action_items && fullResult.action_items.length > 0 && {
                action_items: fullResult.action_items
            }),
            ...(hierarchyData && {
                hierarchy: hierarchyData.hierarchy,
                moc: mocPath,
                learning_context: hierarchyData.learning_context
            })
        };

        const fileContent = `---
${Object.entries(frontmatter)
                .map(([key, value]) => {
                    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                        return `${key}:\n${Object.entries(value)
                            .map(([k, v]) => {
                                if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
                                    return `  ${k}:\n${Object.entries(v)
                                        .map(([dk, dv]) => `    ${dk}: ${JSON.stringify(dv)}`)
                                        .join('\n')}`;
                                } else {
                                    return `  ${k}: ${JSON.stringify(v)}`;
                                }
                            })
                            .join('\n')}`;
                    } else {
                        return `${key}: ${JSON.stringify(value)}`;
                    }
                })
                .join('\n')}
---

${summary}

> [!source] Source
> ${url}

${this.currentMetadata?.speakers?.length ? `## Speakers\n${this.currentMetadata.speakers.map((speaker: string) => `- [[${speaker}]]`).join('\n')}\n\n` : ''}

${this.currentMetadata?.topics?.length ? `## Topics\n${this.currentMetadata.topics.map((topic: string) => `- [[${topic}]]`).join('\n')}\n\n` : ''}

${this.currentMetadata?.related?.length ? `## Related Concepts\n${this.currentMetadata.related.map((concept: string) => `- [[${concept}]]`).join('\n')}\n\n` : ''}

${this.currentMetadata?.tags?.length ? `\n${this.currentMetadata.tags.join(' ')}` : ''}`;

        try {
            const folder = this.app.vault.getAbstractFileByPath(folderPath) as TFolder;
            if (!folder) {
                await this.app.vault.createFolder(folderPath);
            }

            const finalFileName = await findUniqueFileName(this.app, folderPath, fileName);
            if (finalFileName !== fileName) {
            }

            const newFile = await this.app.vault.create(`${folderPath}/${finalFileName}`, fileContent);

            if (mocPath && this.plugin.settings.enableMOC) {
                try {
                    updateMOCStatus('Adding note to knowledge map...');
                    await this.plugin.mocManager.updateMOC(mocPath, newFile.path, title, hierarchyData?.learning_context);

                    if (hierarchyData?.hierarchy) {
                        updateMOCStatus('Updating knowledge hierarchy intelligence...');
                        await this.plugin.mocManager.cascadeIntelligenceUpward(hierarchyData.hierarchy);
                    }

                    updateMOCStatus('Note organized in knowledge map!');
                } catch (error) {
                    updateMOCStatus('Note saved (MOC update failed)');
                }
            }

            return newFile;
        } catch (error) {
            new Notice('Error creating note.');
            return null;
        }
    }


}

class FolderSelectionModal extends Modal {
    private onChoose: (folder: string | null) => void;

    constructor(app: App, onChoose: (folder: string | null) => void) {
        super(app);
        this.onChoose = onChoose;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();

        contentEl.createEl('h2', { text: 'Select Existing Folder' });

        const description = contentEl.createEl('p', {
            text: 'Choose an existing folder from your vault to use as a topic folder:'
        });
        description.style.marginBottom = '20px';

        const allFolders = this.app.vault.getAllLoadedFiles()
            .filter(file => file instanceof TFolder)
            .map(folder => folder as TFolder)
            .sort((a, b) => a.path.localeCompare(b.path));

        if (allFolders.length === 0) {
            contentEl.createEl('p', { text: 'No folders found in your vault.' });
            return;
        }

        const folderContainer = contentEl.createEl('div');
        folderContainer.style.maxHeight = '400px';
        folderContainer.style.overflowY = 'auto';
        folderContainer.style.border = '1px solid var(--background-modifier-border)';
        folderContainer.style.borderRadius = '6px';
        folderContainer.style.marginBottom = '20px';

        allFolders.forEach(folder => {
            const folderItem = folderContainer.createEl('div');
            folderItem.style.padding = '10px 15px';
            folderItem.style.cursor = 'pointer';
            folderItem.style.borderBottom = '1px solid var(--background-modifier-border)';
            folderItem.style.display = 'flex';
            folderItem.style.alignItems = 'center';
            folderItem.style.gap = '8px';

            folderItem.createEl('span', { text: '📁' });
            folderItem.createEl('span', { text: folder.path });

            folderItem.addEventListener('mouseenter', () => {
                folderItem.style.backgroundColor = 'var(--background-modifier-hover)';
            });

            folderItem.addEventListener('mouseleave', () => {
                folderItem.style.backgroundColor = '';
            });

            folderItem.addEventListener('click', () => {
                const folderName = folder.name;
                this.onChoose(folderName);
                this.close();
            });
        });

        const buttonContainer = contentEl.createEl('div');
        buttonContainer.style.display = 'flex';
        buttonContainer.style.justifyContent = 'flex-end';
        buttonContainer.style.gap = '10px';

        const cancelButton = buttonContainer.createEl('button', { text: 'Cancel' });
        cancelButton.addEventListener('click', () => {
            this.onChoose(null);
            this.close();
        });
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

class AISummarizerPlugin extends Plugin {
    settings: PluginSettings;
    firstRun: boolean = true;
    mocManager: MOCManager;
    hierarchyAnalyzer: HierarchyAnalyzer;
    hierarchyManager: HierarchyManager;

    public serviceIntegration: PluginIntegration;
    public llmService?: LLMService;
    public traceManager?: TraceManager;
    public noteProcessor?: NoteProcessor;

    async onload() {
        await this.loadSettings();

        await this.initializeServices();

        try {
            this.mocManager = new MOCManager(this.app, this.settings, this);
            this.hierarchyAnalyzer = new HierarchyAnalyzer();
            this.hierarchyManager = new HierarchyManager(this.app, this.settings);

            this.mocManager.setHierarchyManager(this.hierarchyManager);

        } catch (error) {
            new Notice('Failed to initialize MOC components. Some features may not work.');
        }

        await this.checkForMigrationNeeds();

        if (!this.settings.gemini.apiKey) {
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

        this.settings.gemini.models = GEMINI_MODELS;

        const validModelIds = GEMINI_MODELS.map(m => m.id);
        if (!validModelIds.includes(this.settings.gemini.model)) {
            this.settings.gemini.model = 'gemini-2.5-flash';
            await this.saveSettings();
        }
    }

    async saveSettings() {
        await this.saveData(this.settings);

        if (this.serviceIntegration) {
            try {
                await this.serviceIntegration.reinitialize(this.settings);
                this.updateServiceReferences();
            } catch (error) {
            }
        }
    }

    private async checkForMigrationNeeds(): Promise<void> {
        try {
            const summariesFolder = this.app.vault.getAbstractFileByPath('Summaries');
            if (summariesFolder) {
                const summaryFiles = this.app.vault.getMarkdownFiles().filter(file =>
                    file.path.startsWith('Summaries/')
                );

                if (summaryFiles.length > 0) {

                    new Notice(
                        `Found ${summaryFiles.length} notes in the old "Summaries" folder. ` +
                        'New notes will now be organized within the knowledge hierarchy. ' +
                        'Your existing notes remain accessible.',
                        10000
                    );
                }
            }
        } catch (error) {
        }
    }

    async activateView() {
        this.app.workspace.getLeaf('split').setViewState({
            type: VIEW_TYPE_SUMMARY,
            active: true,
        });
    }

    private async promptForSettings() {
        return new Promise<void>(async (resolve) => {
            new Notice('Please configure your AI provider settings.');

            const modal = new SettingModal(this.app, async (settings) => {
                this.settings = Object.assign({}, DEFAULT_SETTINGS, settings);
                await this.saveSettings();
                new Notice('Settings saved. Please reload the plugin for the changes to take effect.');
                this.app.workspace.trigger('app:reload');
                resolve();
            });
            modal.open();
        });
    }

    /**
     * Initialize modular services
     */
    public async initializeServices(): Promise<void> {
        try {

            this.serviceIntegration = new PluginIntegration();
            await this.serviceIntegration.initialize(this.settings);

            this.updateServiceReferences();

        } catch (error) {
            new Notice('Failed to initialize AI services. Using legacy mode.');
        }
    }

    /**
     * Update service references after initialization or settings change
     */
    private updateServiceReferences(): void {
        if (this.serviceIntegration && this.serviceIntegration.isReady()) {
            this.llmService = this.serviceIntegration.getLLMService();
            this.traceManager = this.serviceIntegration.getTraceManager();

        }
    }

    /**
     * Get LLM service (with fallback to legacy mode)
     */
    getLLMService(): LLMService | null {
        return this.llmService || null;
    }

    /**
     * Get trace manager (with fallback to legacy mode)
     */
    getTraceManager(): TraceManager | null {
        return this.traceManager || null;
    }

    /**
     * Plugin cleanup
     */
    async onunload() {

        if (this.serviceIntegration) {
            try {
                await this.serviceIntegration.cleanup();
            } catch (error) {
            }
        }

    }
}


export default AISummarizerPlugin;