import { Plugin, WorkspaceLeaf, ItemView, Notice, TFolder, App, TFile, Modal } from 'obsidian';
import { AISummarizerSettingsTab } from './settings';
import { HierarchyManager } from './hierarchy-manager';
import { PromptLoader } from './prompt-loader';
import { MOCManager } from './moc-manager';
// import { HierarchyAnalyzer } from './hierarchy-analyzer'; // Removed - replaced by HierarchyService
import { PluginIntegration, LLMService, TraceManager, ContentExtractionError } from './src/services';
import { NoteProcessor } from './src/services/NoteProcessor';
import { findUniqueFileName, generateId, estimateTokens, calculateCost, formatTokens } from './src/utils';
import { GEMINI_MODELS, PROCESSING_INTENTS, DEFAULT_SETTINGS, type GeminiModel, type ProcessingIntent, type ProcessingIntentOption, type PluginSettings, type Provider } from './src/config';
import { SettingModal } from './src/components';

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
        { label: 'Extract Content', state: 'idle' },
        { label: 'Start Trace', state: 'idle' },
        { label: 'Analyze Hierarchy', state: 'idle' },
        { label: '5-Pass AI Analysis', state: 'idle' },
        { label: 'Create Note', state: 'idle' },
        { label: 'Build MOCs', state: 'idle' },
        { label: 'Update Intelligence', state: 'idle' },
        { label: 'Complete', state: 'idle' }
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

            // Usage tracking is now handled automatically by TraceManager
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
                    // Simple cleanup - remove common JSON issues
                    const cleanedResponse = response.text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
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
            // Simple cleanup fallback
            const cleanedResponse = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
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
            this.startNoteGenerationClean();
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
                this.startNoteGenerationClean();
            } else {
                if (!this.noteDropdown.value) {
                    this.showError(urlError, 'Please select a note to organize.');
                    this.noteDropdown.focus();
                    return;
                }
                new Notice('Note organization feature temporarily disabled during refactoring.');
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
        this.setupUsageTracking();
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
            // Ensure error is shown in both UI and Notice
            console.error('[SummaryView] Process failed:', error);

            // Update status steps to show error
            if (error.name === 'ContentExtractionError') {
                this.updateStatusSteps(0, `❌ ${error.message}`, true);
            } else {
                this.updateStatusSteps(7, `❌ Process failed: ${error.message}`, true);
            }

            // Show notice with user-friendly message
            new Notice(`❌ Failed to process URL: ${error.message}`, 8000);
        }
    }

    private async requestManualAlternatives() {
        if (!this.currentTitle || !this.currentMetadata) {
            new Notice('No current note data available for alternatives request.');
            return;
        }


        try {
            // TODO: Reimplement with NoteProcessor
            new Notice('Manual alternatives feature temporarily disabled during refactoring.');
            return;

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
        const result = await this.makeAIRequestDirect(prompt);
        const duration = Date.now() - startTime;
        const inputTokens = estimateTokens(prompt);
        const outputTokens = estimateTokens(JSON.stringify(result));
        const totalTokens = inputTokens + outputTokens;
        const model = this.modelDropdown?.value || 'gemini-2.5-flash';
        const cost = calculateCost(inputTokens, outputTokens, model);


        // Usage tracking now handled by TraceManager automatically

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

    // ===== TRACEMANAGER-BASED USAGE TRACKING =====
    
    /**
     * Setup TraceManager usage tracking callbacks
     */
    private setupUsageTracking(): void {
        const traceManager = this.getTraceManager();
        if (!traceManager) return;

        // Listen for usage events from TraceManager
        traceManager.onUsage((event) => {
            // Update settings-based usage stats for persistence
            if (this.plugin.settings.trackUsage) {
                this.plugin.settings.usageStats.current.tokens += event.totalTokens;
                this.plugin.settings.usageStats.current.cost += event.cost;
                
                this.plugin.settings.usageStats.session.tokens += event.totalTokens;
                this.plugin.settings.usageStats.session.cost += event.cost;
                
                this.plugin.settings.usageStats.lifetime.tokens += event.totalTokens;
                this.plugin.settings.usageStats.lifetime.cost += event.cost;
                
                this.plugin.saveSettings();
                this.updateStatsFooter();
            }
        });
    }

    // OLD METHOD - REPLACED BY TRACEMANAGER
    private updateUsageStats_OLD(inputTokens: number, outputTokens: number, model: string): void {
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
                'Extract',
                'Trace',
                'Hierarchy',
                '5-Pass AI',
                'Note',
                'MOCs',
                'Intelligence',
                'Complete'
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
    // hierarchyAnalyzer: HierarchyAnalyzer; // Replaced by HierarchyService
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
            // this.hierarchyAnalyzer = new HierarchyAnalyzer(); // Replaced by HierarchyService
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

            // Initialize NoteProcessor with the services
            if (this.llmService && this.traceManager) {
                this.noteProcessor = new NoteProcessor(
                    this.traceManager,
                    this.llmService,
                    this, // plugin reference
                    null // summaryView reference - will be set when view is created
                );
            }
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