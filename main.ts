import { Plugin, WorkspaceLeaf, ItemView, Notice, TFolder, App, TFile, Modal } from 'obsidian';
import { AISummarizerSettingsTab } from './settings';
import { PluginIntegration, LLMService, TraceManager } from './src/services';
import { NoteProcessor } from './src/services/NoteProcessor';
import { UsageHistoryManager } from './src/services/UsageHistoryManager';
import { MOCManager } from './src/services/moc-manager';
import { PromptLoader } from './src/services/prompt-loader';
import { findUniqueFileName, generateId, estimateTokens, calculateCost, formatTokens } from './src/utils';
import { GEMINI_MODELS, OPENROUTER_MODELS, PROCESSING_INTENTS, DEFAULT_SETTINGS, type GeminiModel, type ProcessingIntent, type ProcessingIntentOption, type Provider } from './src/config';
import { SettingModal } from './src/components';

type PluginSettings = typeof DEFAULT_SETTINGS;
const VIEW_TYPE_SUMMARY = 'ai-summarizer-summary';

class SummaryView extends ItemView {
    private urlInput: HTMLInputElement;
    private promptInput: HTMLTextAreaElement;
    private modelDropdown: HTMLSelectElement;
    private intentDropdown: HTMLSelectElement;
    private progressFill: HTMLDivElement;
    private statusMessage: HTMLDivElement;
    private usageHistoryManager: UsageHistoryManager;
    private retryButton: HTMLButtonElement;

    constructor(leaf: WorkspaceLeaf, private plugin: AISummarizerPlugin) {
        super(leaf);
        this.initializeUsageTracking();
        this.initializeNoteProcessor();
    }

    private async initializeUsageTracking() {
        this.usageHistoryManager = new UsageHistoryManager(this.app);
        if (this.plugin.traceManager) this.plugin.traceManager.setUsageHistoryManager(this.usageHistoryManager);
    }

    private initializeNoteProcessor() {
        if (this.plugin.llmService && this.plugin.traceManager) {
            this.plugin.noteProcessor = new NoteProcessor(this.plugin.traceManager, this.plugin.llmService, this.plugin, this);
        } else {
            setTimeout(() => this.initializeNoteProcessor(), 1000);
        }
    }

    getViewType() { return VIEW_TYPE_SUMMARY; }
    getDisplayText() { return 'AI Summarizer'; }

    async onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        this.addCustomStyles();

        const mainContainer = contentEl.createEl('div', { cls: 'brain-main-container' });
        
        // --- INPUT CARD ---
        const inputCard = mainContainer.createEl('div', { cls: 'brain-card' });
        inputCard.createEl('div', { cls: 'brain-card-header' }).createEl('h3', { text: '📝 Input', cls: 'brain-card-title' });

        const configSection = inputCard.createEl('div', { cls: 'brain-config-section' });
        
        // --- SELECTION ROW ---
        const dropdownRow = configSection.createEl('div', { cls: 'brain-dropdown-row' });
        
        // Provider Group
        const providerGroup = dropdownRow.createEl('div', { cls: 'brain-form-group brain-form-group-third' });
        providerGroup.createEl('label', { text: '🔌 Provider', cls: 'brain-form-label' });
        const providerDropdown = providerGroup.createEl('select', { cls: 'brain-select' }) as HTMLSelectElement;
        providerDropdown.add(new Option('Gemini', 'gemini'));
        providerDropdown.add(new Option('OpenRouter', 'openrouter'));
        providerDropdown.value = this.plugin.settings.provider;
        providerDropdown.addEventListener('change', async () => {
            this.plugin.settings.provider = providerDropdown.value as Provider;
            this.populateModelDropdown();
            await this.plugin.saveSettings();
        });

        // Model Group
        const modelGroup = dropdownRow.createEl('div', { cls: 'brain-form-group brain-form-group-third' });
        modelGroup.createEl('label', { text: '🤖 AI Model', cls: 'brain-form-label' });
        this.modelDropdown = modelGroup.createEl('select', { cls: 'brain-select' }) as HTMLSelectElement;
        this.populateModelDropdown();
        this.modelDropdown.addEventListener('change', async () => {
            const val = this.modelDropdown.value;
            if (this.plugin.settings.provider === 'openrouter') this.plugin.settings.openrouter.model = val;
            else this.plugin.settings.gemini.model = val;
            await this.plugin.saveSettings();
        });

        // Intent Group
        const intentGroup = dropdownRow.createEl('div', { cls: 'brain-form-group brain-form-group-third' });
        intentGroup.createEl('label', { text: '🎯 Intent', cls: 'brain-form-label' });
        this.intentDropdown = intentGroup.createEl('select', { cls: 'brain-select' }) as HTMLSelectElement;
        this.populateIntentDropdown();
        this.intentDropdown.addEventListener('change', async () => {
            this.plugin.settings.defaultIntent = this.intentDropdown.value as ProcessingIntent;
            await this.plugin.saveSettings();
        });

        const urlGroup = configSection.createEl('div', { cls: 'brain-form-group' });
        urlGroup.createEl('label', { text: '🌐 Content URL', cls: 'brain-form-label' });
        this.urlInput = urlGroup.createEl('input', { type: 'text', placeholder: 'YouTube or Article URL...', cls: 'brain-input' });

        const instructionsGroup = configSection.createEl('div', { cls: 'brain-form-group' });
        instructionsGroup.createEl('label', { text: '💡 Instructions', cls: 'brain-form-label' });
        this.promptInput = instructionsGroup.createEl('textarea', { placeholder: 'Extra focus areas...', cls: 'brain-textarea' });

        const cleanButton = inputCard.createEl('button', { text: '✨ Summarize & Organize', cls: 'brain-clean-button' });
        cleanButton.addEventListener('click', () => this.startNoteGenerationClean());

        // --- NEW SLEEK PROGRESS AREA ---
        const progressCard = mainContainer.createEl('div', { cls: 'brain-card' });
        this.statusMessage = progressCard.createEl('div', { cls: 'brain-progress-status-text', text: 'Ready to process' });
        
        const progressBarContainer = progressCard.createEl('div', { cls: 'brain-progress-bar-container' });
        this.progressFill = progressBarContainer.createEl('div', { cls: 'brain-progress-bar-fill' });
        this.progressFill.style.width = '0%';

        const progressLabels = progressCard.createEl('div', { cls: 'brain-progress-labels' });
        progressLabels.createEl('span', { text: 'Extract' });
        progressLabels.createEl('span', { text: 'Analyze' });
        progressLabels.createEl('span', { text: 'Create' });
        progressLabels.createEl('span', { text: 'Done' });

        this.retryButton = progressCard.createEl('button', { text: '🔄 Retry', cls: 'brain-retry-button' });
        this.retryButton.style.display = 'none';
        this.retryButton.onclick = () => this.startNoteGenerationClean();

        this.createStatsFooter();
    }

    private async startNoteGenerationClean() {
        const url = this.urlInput.value;
        if (!url || !this.plugin.noteProcessor) { new Notice('Missing URL or AI services'); return; }
        this.retryButton.style.display = 'none';

        try {
            this.plugin.noteProcessor.setStatusCallback((step, msg, err) => this.updateStatusSteps(step, msg, err));
            const result = await this.plugin.noteProcessor.processURL({ url, prompt: this.promptInput.value, intent: this.intentDropdown.value });
            await this.app.workspace.getLeaf().openFile(result.note);
            new Notice('Success!');
            await this.updateStatsFooter();
        } catch (e) {
            console.error(e);
            this.updateStatusSteps(7, `❌ Error: ${e.message}`, true);
        }
    }

    private updateStatusSteps(step: number, status: string, error: boolean = false) {
        // Map 8 internal steps to 0-100%
        // Step 0: Extract (15%), 2: Hierarchy (30%), 3: Analysis (30-80%), 4: Note (90%), 7: Done (100%)
        let percent = 0;
        if (step === 0) percent = 15;
        else if (step === 1) percent = 20;
        else if (step === 2) percent = 30;
        else if (step === 3) {
            // Handle granular analysis sub-steps if status contains "Pass X/5"
            const passMatch = status.match(/(\d)\/(\d)/);
            if (passMatch) {
                const currentPass = parseInt(passMatch[1]);
                percent = 30 + (currentPass * 10); // Each pass adds 10% (30 -> 80)
            } else {
                percent = 50;
            }
        }
        else if (step === 4) percent = 85;
        else if (step === 5 || step === 6) percent = 95;
        else if (step === 7) percent = 100;

        if (error) {
            this.progressFill.style.backgroundColor = 'var(--color-red)';
            this.retryButton.style.display = 'block';
        } else {
            this.progressFill.style.backgroundColor = 'var(--interactive-accent)';
        }

        this.progressFill.style.width = `${percent}%`;
        this.statusMessage.textContent = status;
    }

    private populateModelDropdown() {
        this.modelDropdown.innerHTML = '';
        const models = this.plugin.settings.provider === 'openrouter' ? OPENROUTER_MODELS : GEMINI_MODELS;
        models.forEach(m => {
            const opt = document.createElement('option');
            opt.value = m.id; opt.text = m.name;
            this.modelDropdown.appendChild(opt);
        });
        this.modelDropdown.value = this.plugin.getCurrentModel();
    }

    private populateIntentDropdown() {
        this.intentDropdown.innerHTML = '';
        PROCESSING_INTENTS.forEach(i => {
            const opt = document.createElement('option');
            opt.value = i.id; opt.text = i.name;
            this.intentDropdown.appendChild(opt);
        });
        this.intentDropdown.value = this.plugin.settings.defaultIntent;
    }

    private statsFooter: HTMLElement;
    private createStatsFooter() {
        this.statsFooter = this.containerEl.createEl('div', { cls: 'brain-stats-footer' });
        this.updateStatsFooter();
    }

    private async updateStatsFooter() {
        if (!this.statsFooter || !this.usageHistoryManager) return;
        const metrics = await this.usageHistoryManager.getMetrics();
        this.statsFooter.innerHTML = `📊 Lifetime: ${metrics.lifetime.notes} notes • $${metrics.lifetime.cost.toFixed(2)}`;
    }

    private addCustomStyles() {
        const styleEl = document.createElement('style');
        styleEl.textContent = `
            .brain-main-container { padding: 16px; font-family: var(--font-interface); }
            .brain-card { background: var(--background-primary); border: 1px solid var(--background-modifier-border); border-radius: 12px; padding: 20px; margin-bottom: 16px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); }
            .brain-card-header { margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid var(--background-modifier-border); }
            .brain-card-title { margin: 0; font-size: 1em; font-weight: 600; color: var(--text-normal); }
            .brain-config-section { display: flex; flex-direction: column; gap: 12px; }
            .brain-dropdown-row { display: flex; gap: 10px; }
            .brain-form-group { display: flex; flex-direction: column; gap: 4px; }
            .brain-form-group-third { flex: 1; min-width: 0; }
            .brain-form-label { font-weight: 600; font-size: 0.85em; color: var(--text-muted); }
            .brain-select, .brain-input, .brain-textarea { 
                width: 100%; 
                padding: 12px 12px; 
                border-radius: 6px; 
                border: 1px solid var(--background-modifier-border); 
                background: var(--background-secondary); 
                color: var(--text-normal); 
                font-size: 0.95em;
                line-height: 1.2;
                min-height: 42px;
            }
            .brain-textarea { resize: vertical; min-height: 80px; }
            .brain-clean-button { width: 100%; padding: 12px; background: var(--interactive-accent); color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; margin-top: 8px; transition: opacity 0.2s; }
            .brain-clean-button:hover { opacity: 0.9; }
            
            /* SLEEK PROGRESS BAR */
            .brain-progress-status-text { text-align: center; font-weight: 600; font-size: 0.95em; margin-bottom: 12px; color: var(--text-normal); }
            .brain-progress-bar-container { width: 100%; height: 8px; background: var(--background-secondary); border-radius: 4px; overflow: hidden; margin-bottom: 8px; border: 1px solid var(--background-modifier-border); }
            .brain-progress-bar-fill { height: 100%; background: var(--interactive-accent); width: 0%; transition: width 0.4s cubic-bezier(0.4, 0, 0.2, 1), background-color 0.3s; }
            .brain-progress-labels { display: flex; justify-content: space-between; padding: 0 4px; }
            .brain-progress-labels span { font-size: 0.7em; color: var(--text-muted); font-weight: 500; text-transform: uppercase; letter-spacing: 0.05em; }
            
            .brain-retry-button { width: 100%; margin-top: 12px; padding: 8px; border-radius: 6px; border: 1px solid var(--color-red); color: var(--color-red); background: transparent; font-weight: 600; cursor: pointer; }
            .brain-stats-footer { margin-top: 20px; text-align: center; font-size: 0.8em; color: var(--text-muted); padding: 8px; border-top: 1px solid var(--background-modifier-border); }
        `;
        document.head.appendChild(styleEl);
    }
}

class AISummarizerPlugin extends Plugin {
    settings: PluginSettings;
    mocManager: MOCManager;
    serviceIntegration: PluginIntegration;
    llmService?: LLMService;
    traceManager?: TraceManager;
    noteProcessor?: NoteProcessor;

    async onload() {
        await this.loadSettings();
        await this.initializeServices();
        this.mocManager = new MOCManager(this.app, this.settings, this, this.llmService);
        this.addRibbonIcon('dice', 'Open AI Summarizer', () => this.activateView());
        this.addSettingTab(new AISummarizerSettingsTab(this.app, this));
        this.registerView(VIEW_TYPE_SUMMARY, (leaf) => new SummaryView(leaf, this));
    }

    async initializeServices() {
        try {
            this.serviceIntegration = new PluginIntegration();
            await this.serviceIntegration.initialize(this.settings);
            this.llmService = this.serviceIntegration.getLLMService();
            this.traceManager = this.serviceIntegration.getTraceManager();
            if (this.mocManager) this.mocManager.mocIntelligence.setLLMService(this.llmService!);
        } catch (e) { console.error('Service init failed', e); }
    }

    async loadSettings() { this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData()); }
    async saveSettings() {
        await this.saveData(this.settings);
        if (this.serviceIntegration) {
            await this.serviceIntegration.reinitialize(this.settings);
            this.llmService = this.serviceIntegration.getLLMService();
            this.traceManager = this.serviceIntegration.getTraceManager();
            if (this.mocManager) this.mocManager.mocIntelligence.setLLMService(this.llmService!);
        }
        this.app.workspace.getLeavesOfType(VIEW_TYPE_SUMMARY).forEach(l => (l.view as any).populateModelDropdown());
    }

    getCurrentModel(): string {
        return this.settings.provider === 'openrouter' ? this.settings.openrouter.model : this.settings.gemini.model;
    }

    async activateView() {
        const { workspace } = this.app;
        let leaf = workspace.getLeavesOfType(VIEW_TYPE_SUMMARY)[0];
        if (!leaf) {
            const rightLeaf = workspace.getRightLeaf(false);
            if (rightLeaf) {
                leaf = rightLeaf;
                await leaf.setViewState({ type: VIEW_TYPE_SUMMARY, active: true });
            }
        }
        if (leaf) workspace.revealLeaf(leaf);
    }
}

export default AISummarizerPlugin;