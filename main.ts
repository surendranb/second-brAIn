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
        this.registerDomEvent(providerDropdown, 'change', async () => {
            this.plugin.settings.provider = providerDropdown.value as Provider;
            this.populateModelDropdown();
            await this.plugin.saveSettings();
        });

        // Model Group
        const modelGroup = dropdownRow.createEl('div', { cls: 'brain-form-group brain-form-group-third' });
        modelGroup.createEl('label', { text: '🤖 AI Model', cls: 'brain-form-label' });
        this.modelDropdown = modelGroup.createEl('select', { cls: 'brain-select' }) as HTMLSelectElement;
        this.populateModelDropdown();
        this.registerDomEvent(this.modelDropdown, 'change', async () => {
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
        this.registerDomEvent(this.intentDropdown, 'change', async () => {
            this.plugin.settings.defaultIntent = this.intentDropdown.value as ProcessingIntent;
            await this.plugin.saveSettings();
            this.toggleTargetTopicVisibility(); // Check if we need to show topic selector
        });

        // --- DYNAMIC TARGET TOPIC ROW (Hidden by default) ---
        this.targetTopicContainer = configSection.createEl('div', { cls: 'brain-form-group' });
        this.targetTopicContainer.style.display = 'none';
        this.targetTopicContainer.createEl('label', { text: '📂 Target Collection', cls: 'brain-form-label' });
        
        // Create DataList for autocomplete
        const dataListId = 'brain-topic-list';
        const dataList = this.targetTopicContainer.createEl('datalist', { attr: { id: dataListId } });
        this.updateTopicDataList(dataList);

        // Create Input linked to DataList
        this.targetTopicInput = this.targetTopicContainer.createEl('input', { 
            type: 'text', 
            cls: 'brain-input',
            attr: { list: dataListId },
            placeholder: 'Select or type a new topic...'
        });

        // --- Q&A CHECKBOX ---
        const qaGroup = configSection.createEl('div', { 
            cls: 'brain-form-group', 
            attr: { style: 'flex-direction: row; align-items: center; gap: 10px; margin-top: 8px;' } 
        });
        this.qaCheckbox = qaGroup.createEl('input', { type: 'checkbox' });
        this.qaCheckbox.id = 'brain-qa-checkbox';
        const qaLabel = qaGroup.createEl('label', { text: '💬 Generate Verbatim Q&A Note', attr: { for: 'brain-qa-checkbox' } });
        qaLabel.style.fontSize = '0.9em';
        qaLabel.style.cursor = 'pointer';

        // Initial check
        this.toggleTargetTopicVisibility();

        const urlGroup = configSection.createEl('div', { cls: 'brain-form-group' });
        urlGroup.createEl('label', { text: '🌐 Content URL', cls: 'brain-form-label' });
        this.urlInput = urlGroup.createEl('input', { type: 'text', placeholder: 'YouTube or Article URL...', cls: 'brain-input' });

        const instructionsGroup = configSection.createEl('div', { cls: 'brain-form-group' });
        instructionsGroup.createEl('label', { text: '💡 Instructions', cls: 'brain-form-label' });
        this.promptInput = instructionsGroup.createEl('textarea', { placeholder: 'Extra focus areas...', cls: 'brain-textarea' });

        const cleanButton = inputCard.createEl('button', { text: '✨ Summarize & Organize', cls: 'brain-clean-button' });
        this.registerDomEvent(cleanButton, 'click', () => this.startNoteGenerationClean());

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

        // --- CHRONOLOGICAL LOG AREA ---
        const logHeader = progressCard.createEl('div', { cls: 'brain-log-header' });
        logHeader.createEl('span', { text: '📜 Activity Log' });
        const copyLogBtn = logHeader.createEl('button', { text: '📋 Copy', cls: 'brain-copy-log-btn' });
        this.registerDomEvent(copyLogBtn, 'click', () => {
            const logs = Array.from(this.logContainer.querySelectorAll('.brain-log-entry'))
                .map(el => el.textContent)
                .join('\n');
            navigator.clipboard.writeText(logs);
            new Notice('Logs copied to clipboard');
        });

        this.logContainer = progressCard.createEl('div', { cls: 'brain-log-container' });

        this.retryButton = progressCard.createEl('button', { text: '🔄 Retry', cls: 'brain-retry-button' });
        this.retryButton.style.display = 'none';
        this.registerDomEvent(this.retryButton, 'click', () => this.startNoteGenerationClean());

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
        if (this.intentDropdown.value === 'research_collection') {
            this.targetTopicContainer.style.display = 'flex';
            // Refresh datalist in case settings changed externally
            const dataList = this.containerEl.querySelector('#brain-topic-list') as HTMLElement;
            if (dataList) this.updateTopicDataList(dataList);
        } else {
            this.targetTopicContainer.style.display = 'none';
        }
    }

    private async startNoteGenerationClean() {
        const url = this.urlInput.value;
        if (!url || !this.plugin.noteProcessor) { new Notice('Missing URL or AI services'); return; }
        
        // --- UI RESET ---
        this.logContainer.empty();
        this.progressFill.style.width = '0%';
        this.progressFill.style.backgroundColor = 'var(--interactive-accent)';
        this.retryButton.style.display = 'none';

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
                    const dataList = this.containerEl.querySelector('#brain-topic-list') as HTMLElement;
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
        const logEntry = this.logContainer.createEl('div', { cls: 'brain-log-entry' });
        logEntry.innerHTML = `<span class="brain-log-time">[${timeStr}]</span> ${status}`;
        if (error) logEntry.addClass('brain-log-error');
        
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
        
        this.statsFooter.empty();
        
        const todayGroup = this.statsFooter.createEl('div', { cls: 'brain-stats-group' });
        todayGroup.createEl('div', { cls: 'brain-stats-label', text: 'TODAY' });
        todayGroup.createEl('div', { cls: 'brain-stats-value', text: `${metrics.today.notes} notes • $${metrics.today.cost.toFixed(3)}` });

        const separator = this.statsFooter.createEl('div', { cls: 'brain-stats-separator' });

        const lifetimeGroup = this.statsFooter.createEl('div', { cls: 'brain-stats-group' });
        lifetimeGroup.createEl('div', { cls: 'brain-stats-label', text: 'LIFETIME' });
        lifetimeGroup.createEl('div', { cls: 'brain-stats-value', text: `${metrics.lifetime.notes} notes • $${metrics.lifetime.cost.toFixed(2)}` });
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

    async onunload() {
        console.log('[brAIn] Unloading plugin. Cleaning up views and AI services...');
        this.app.workspace.detachLeavesOfType(VIEW_TYPE_SUMMARY);
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