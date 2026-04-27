import { Plugin, WorkspaceLeaf, ItemView, Notice } from 'obsidian';
import { AISummarizerSettingsTab } from './settings';
import { PluginIntegration, LLMService, TraceManager } from './src/services';
import { NoteProcessor } from './src/services/NoteProcessor';
import { UsageHistoryManager } from './src/services/UsageHistoryManager';
import { MOCManager } from './src/services/moc-manager';
import { GEMINI_MODELS, OPENROUTER_MODELS, PROCESSING_INTENTS, DEFAULT_SETTINGS, type ProcessingIntent, type Provider } from './src/config';

type PluginSettings = typeof DEFAULT_SETTINGS;
const VIEW_TYPE_SUMMARY = 'ai-summarizer-summary';

class SummaryView extends ItemView {
    private urlInput: HTMLInputElement;
    private promptInput: HTMLTextAreaElement;
    private modelDropdown: HTMLSelectElement;
    private intentDropdown: HTMLSelectElement;
    private targetTopicInput: HTMLInputElement; // Changed from Select to Input
    private targetTopicContainer: HTMLDivElement;
    private qaCheckbox: HTMLInputElement; // New Checkbox
    private progressFill: HTMLDivElement;
    private statusMessage: HTMLDivElement;
    private logContainer: HTMLDivElement; // New Log Area
    private usageHistoryManager: UsageHistoryManager;
    private retryButton: HTMLButtonElement;

    constructor(leaf: WorkspaceLeaf, private plugin: AISummarizerPlugin) {
        super(leaf);
        void this.initializeUsageTracking();
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
            activeWindow.setTimeout(() => this.initializeNoteProcessor(), 1000);
        }
    }

    getViewType() { return VIEW_TYPE_SUMMARY; }
    getDisplayText() { return 'Axiom'; }

    async onOpen(): Promise<void> {
        const { contentEl } = this;
        contentEl.empty();

        const mainContainer = contentEl.createEl('div', { cls: 'axiom-main-container' });
        
        // --- INPUT CARD ---
        const inputCard = mainContainer.createEl('div', { cls: 'axiom-card' });
        inputCard.createEl('div', { cls: 'axiom-card-header' }).createEl('h3', { text: '📝 Input', cls: 'axiom-card-title' });

        const configSection = inputCard.createEl('div', { cls: 'axiom-config-section' });
        
        // --- SELECTION ROW ---
        const dropdownRow = configSection.createEl('div', { cls: 'axiom-dropdown-row' });
        
        // Provider Group
        const providerGroup = dropdownRow.createEl('div', { cls: 'axiom-form-group axiom-form-group-third' });
        providerGroup.createEl('label', { text: '🔌 Provider', cls: 'axiom-form-label' });
        const providerDropdown = providerGroup.createEl('select', { cls: 'axiom-select' }) as HTMLSelectElement;
        providerDropdown.add(new Option('Gemini', 'gemini'));
        providerDropdown.add(new Option('OpenRouter', 'openrouter'));
        providerDropdown.value = this.plugin.settings.provider;
        this.registerDomEvent(providerDropdown, 'change', async () => {
            this.plugin.settings.provider = providerDropdown.value as Provider;
            this.populateModelDropdown();
            await this.plugin.saveSettings();
        });

        // Model Group
        const modelGroup = dropdownRow.createEl('div', { cls: 'axiom-form-group axiom-form-group-third' });
        modelGroup.createEl('label', { text: '🤖 AI model', cls: 'axiom-form-label' });
        this.modelDropdown = modelGroup.createEl('select', { cls: 'axiom-select' }) as HTMLSelectElement;
        this.populateModelDropdown();
        this.registerDomEvent(this.modelDropdown, 'change', async () => {
            const val = this.modelDropdown.value;
            if (this.plugin.settings.provider === 'openrouter') this.plugin.settings.openrouter.model = val;
            else this.plugin.settings.gemini.model = val;
            await this.plugin.saveSettings();
        });

        // Intent Group
        const intentGroup = dropdownRow.createEl('div', { cls: 'axiom-form-group axiom-form-group-third' });
        intentGroup.createEl('label', { text: '🎯 Intent', cls: 'axiom-form-label' });
        this.intentDropdown = intentGroup.createEl('select', { cls: 'axiom-select' }) as HTMLSelectElement;
        this.populateIntentDropdown();
        this.registerDomEvent(this.intentDropdown, 'change', async () => {
            this.plugin.settings.defaultIntent = this.intentDropdown.value as ProcessingIntent;
            await this.plugin.saveSettings();
            this.toggleTargetTopicVisibility(); // Check if we need to show topic selector
        });

        // --- DYNAMIC TARGET TOPIC ROW (Hidden by default) ---
        this.targetTopicContainer = configSection.createEl('div', { cls: 'axiom-form-group axiom-is-hidden' });
        this.targetTopicContainer.createEl('label', { text: '📂 Target collection', cls: 'axiom-form-label' });
        
        // Create DataList for autocomplete
        const dataListId = 'axiom-topic-list';
        const dataList = this.targetTopicContainer.createEl('datalist', { attr: { id: dataListId } });
        this.updateTopicDataList(dataList);

        // Create Input linked to DataList
        this.targetTopicInput = this.targetTopicContainer.createEl('input', { 
            type: 'text', 
            cls: 'axiom-input',
            attr: { list: dataListId },
            placeholder: 'Select or type a new topic...'
        });

        // --- Q&A CHECKBOX ---
        const qaGroup = configSection.createEl('div', { 
            cls: 'axiom-form-group axiom-qa-group'
        });
        this.qaCheckbox = qaGroup.createEl('input', { type: 'checkbox' });
        this.qaCheckbox.id = 'axiom-qa-checkbox';
        qaGroup.createEl('label', { text: '💬 Generate verbatim Q&A note', cls: 'axiom-qa-label', attr: { for: 'axiom-qa-checkbox' } });

        // Initial check
        this.toggleTargetTopicVisibility();

        const urlGroup = configSection.createEl('div', { cls: 'axiom-form-group' });
        urlGroup.createEl('label', { text: '🌐 Content URL', cls: 'axiom-form-label' });
        this.urlInput = urlGroup.createEl('input', { type: 'text', placeholder: 'YouTube or Article URL...', cls: 'axiom-input' });

        const instructionsGroup = configSection.createEl('div', { cls: 'axiom-form-group' });
        instructionsGroup.createEl('label', { text: '💡 Instructions', cls: 'axiom-form-label' });
        this.promptInput = instructionsGroup.createEl('textarea', { placeholder: 'Extra focus areas...', cls: 'axiom-textarea' });

        const cleanButton = inputCard.createEl('button', { text: '✨ Summarize & organize', cls: 'axiom-clean-button' });
        this.registerDomEvent(cleanButton, 'click', () => { void this.startNoteGenerationClean(); });

        // --- NEW SLEEK PROGRESS AREA ---
        const progressCard = mainContainer.createEl('div', { cls: 'axiom-card' });
        this.statusMessage = progressCard.createEl('div', { cls: 'axiom-progress-status-text', text: 'Ready to process' });
        
        const progressBarContainer = progressCard.createEl('div', { cls: 'axiom-progress-bar-container' });
        this.progressFill = progressBarContainer.createEl('div', { cls: 'axiom-progress-bar-fill' });

        const progressLabels = progressCard.createEl('div', { cls: 'axiom-progress-labels' });
        progressLabels.createEl('span', { text: 'Extract' });
        progressLabels.createEl('span', { text: 'Analyze' });
        progressLabels.createEl('span', { text: 'Create' });
        progressLabels.createEl('span', { text: 'Done' });

        // --- CHRONOLOGICAL LOG AREA ---
        const logHeader = progressCard.createEl('div', { cls: 'axiom-log-header' });
        logHeader.createEl('span', { text: '📜 Activity log' });
        const copyLogBtn = logHeader.createEl('button', { text: '📋 Copy', cls: 'axiom-copy-log-btn' });
        this.registerDomEvent(copyLogBtn, 'click', () => {
            const logs = Array.from(this.logContainer.querySelectorAll('.axiom-log-entry'))
                .map(el => el.textContent)
                .join('\n');
            void navigator.clipboard.writeText(logs);
            new Notice('Logs copied to clipboard');
        });

        this.logContainer = progressCard.createEl('div', { cls: 'axiom-log-container' });

        this.retryButton = progressCard.createEl('button', { text: '🔄 Retry', cls: 'axiom-retry-button axiom-is-hidden' });
        this.registerDomEvent(this.retryButton, 'click', () => { void this.startNoteGenerationClean(); });

        this.createStatsFooter();
    }

    private updateTopicDataList(dataList: HTMLElement) {
        dataList.empty();
        const topics = this.plugin.settings.topicFolders.topics || [];
        topics.sort().forEach(topic => {
            dataList.createEl('option', { attr: { value: topic } });
        });
    }

    private toggleTargetTopicVisibility() {
        const isResearch = this.intentDropdown.value === 'research_collection';
        this.targetTopicContainer.toggleClass('axiom-is-hidden', !isResearch);
        if (isResearch) {
            const dataList = this.containerEl.querySelector('#axiom-topic-list') as HTMLElement;
            if (dataList) this.updateTopicDataList(dataList);
        }
    }

    private async startNoteGenerationClean() {
        const url = this.urlInput.value;
        if (!url || !this.plugin.noteProcessor) { new Notice('Missing URL or AI services'); return; }
        
        // --- UI RESET ---
        this.logContainer.empty();
        this.progressFill.setCssProps({ width: '0%' });
        this.progressFill.removeClass('axiom-progress-fill-error');
        this.retryButton.addClass('axiom-is-hidden');

        try {
            this.plugin.noteProcessor.setStatusCallback((step, msg, err) => this.updateStatusSteps(step, msg, err));
            
            // Get optional target topic
            let targetTopic = undefined;
            if (this.intentDropdown.value === 'research_collection' && this.targetTopicInput.value.trim()) {
                targetTopic = this.targetTopicInput.value.trim();
                
                // Auto-save new topic to settings if it doesn't exist
                if (!this.plugin.settings.topicFolders.topics.includes(targetTopic)) {
                    this.plugin.settings.topicFolders.topics.push(targetTopic);
                    await this.plugin.saveSettings();
                    // Update datalist for next time
                    const dataList = this.containerEl.querySelector('#axiom-topic-list') as HTMLElement;
                    if (dataList) this.updateTopicDataList(dataList);
                    new Notice(`New topic '${targetTopic}' added to settings.`);
                }
            }

            const result = await this.plugin.noteProcessor.processURL({ 
                url, 
                prompt: this.promptInput.value, 
                intent: this.intentDropdown.value,
                targetTopic,
                generateQA: this.qaCheckbox.checked // Pass checkbox state
            });
            
            await this.app.workspace.getLeaf().openFile(result.note);
            new Notice('Success!');
            await this.updateStatsFooter();
        } catch (e) {
            console.error(e);
            this.updateStatusSteps(7, `❌ Error: ${e.message}`, true);
        }
    }

    private updateStatusSteps(step: number, status: string, error: boolean = false) {
        // Log entry with timestamp
        const now = new Date();
        const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const logEntry = this.logContainer.createEl('div', { cls: 'axiom-log-entry' });
        logEntry.createSpan({ cls: 'axiom-log-time', text: `[${timeStr}] ` });
        logEntry.createSpan({ text: status });
        if (error) logEntry.addClass('axiom-log-error');
        
        // Keep only last 50 logs
        while (this.logContainer.childNodes.length > 50) {
            this.logContainer.removeChild(this.logContainer.firstChild!);
        }
        this.logContainer.scrollTop = this.logContainer.scrollHeight;

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
            this.progressFill.addClass('axiom-progress-fill-error');
            this.retryButton.removeClass('axiom-is-hidden');
        } else {
            this.progressFill.removeClass('axiom-progress-fill-error');
        }

        this.progressFill.setCssProps({ width: `${percent}%` });
        this.statusMessage.setText(status);
    }

    public populateModelDropdown() {
        this.modelDropdown.empty();
        const models = this.plugin.settings.provider === 'openrouter' ? OPENROUTER_MODELS : GEMINI_MODELS;
        models.forEach(m => {
            this.modelDropdown.createEl('option', { value: m.id, text: m.name });
        });
        this.modelDropdown.value = this.plugin.getCurrentModel();
    }

    private populateIntentDropdown() {
        this.intentDropdown.empty();
        PROCESSING_INTENTS.forEach(i => {
            this.intentDropdown.createEl('option', { value: i.id, text: i.name });
        });
        this.intentDropdown.value = this.plugin.settings.defaultIntent;
    }

    private statsFooter: HTMLElement;
    private createStatsFooter() {
        this.statsFooter = this.containerEl.createEl('div', { cls: 'axiom-stats-footer' });
        void this.updateStatsFooter();
    }

    private async updateStatsFooter() {
        if (!this.statsFooter || !this.usageHistoryManager) return;
        const metrics = await this.usageHistoryManager.getMetrics();
        
        this.statsFooter.empty();
        
        const todayGroup = this.statsFooter.createEl('div', { cls: 'axiom-stats-group' });
        todayGroup.createEl('div', { cls: 'axiom-stats-label', text: 'Today' });
        todayGroup.createEl('div', { cls: 'axiom-stats-value', text: `${metrics.today.notes} notes • $${metrics.today.cost.toFixed(3)}` });

        this.statsFooter.createEl('div', { cls: 'axiom-stats-separator' });

        const lifetimeGroup = this.statsFooter.createEl('div', { cls: 'axiom-stats-group' });
        lifetimeGroup.createEl('div', { cls: 'axiom-stats-label', text: 'Lifetime' });
        lifetimeGroup.createEl('div', { cls: 'axiom-stats-value', text: `${metrics.lifetime.notes} notes • $${metrics.lifetime.cost.toFixed(2)}` });
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

                

                this.addRibbonIcon('brain', 'Open axiom', () => this.activateView());
        this.addSettingTab(new AISummarizerSettingsTab(this.app, this));
        this.registerView(VIEW_TYPE_SUMMARY, (leaf) => new SummaryView(leaf, this));
    }

    onunload() {
        // No forceful detaching of leaves to preserve user layout
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
        this.app.workspace.getLeavesOfType(VIEW_TYPE_SUMMARY).forEach(l => {
            if (l.view instanceof SummaryView) {
                l.view.populateModelDropdown();
            }
        });
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