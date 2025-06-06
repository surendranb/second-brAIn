import { Plugin, WorkspaceLeaf, ItemView, Notice, TFolder, Setting, PluginSettingTab, App, TFile, Modal } from 'obsidian';
import { GoogleGenerativeAI, GenerateContentRequest } from '@google/generative-ai';
// import { exec } from 'child_process'; // No longer using exec for transcript fetching
import { promisify } from 'util';
import * as path from 'path';
import { AISummarizerSettingsTab } from './settings';

const VIEW_TYPE_SUMMARY = 'ai-summarizer-summary';
// const execPromise = promisify(exec); // No longer using execPromise for transcript

// Provider Types
export type Provider = 'gemini' | 'openrouter';

// Model Types
export interface GeminiModel {
    id: string;
    name: string;
    description: string;
}

export interface OpenRouterModel {
    id: string;
    name: string;
    description: string;
    provider: string;
}

// Provider-specific Settings
export interface GeminiSettings {
    apiKey: string;
    model: string;
    models: GeminiModel[];
}

export interface OpenRouterSettings {
    apiKey: string;
    model: string;
    endpoint: string;
    models: OpenRouterModel[];
}

// MOC-related Types
export interface MOCHierarchy {
    level1: string; // Knowledge Domain (e.g., "Computer Science")
    level2: string; // Learning Area (e.g., "Machine Learning") 
    level3?: string; // Specific Topic (e.g., "Neural Networks")
    level4?: string; // Key Concept (e.g., "Backpropagation")
}

export interface LearningContext {
    prerequisites: string[];
    related_concepts: string[];
    learning_path: string[];
    complexity_level: 'beginner' | 'intermediate' | 'advanced';
    estimated_reading_time?: string;
}

export interface MOCMetadata {
    title: string;
    type: 'moc';
    domain: string;
    created: string;
    updated: string;
    tags: string[];
    note_count: number;
    learning_paths: string[];
}

export interface MOC {
    metadata: MOCMetadata;
    sections: {
        learning_paths: string[];
        core_concepts: string[];
        related_topics: string[];
        notes: string[];
    };
    filepath: string;
}

export interface NoteHierarchyAnalysis {
    hierarchy: MOCHierarchy;
    learning_context: LearningContext;
    moc_placement: {
        primary_moc: string;
        secondary_mocs?: string[];
    };
}

// Main Plugin Settings
export interface PluginSettings {
    provider: Provider;
    gemini: GeminiSettings;
    openrouter: OpenRouterSettings;
    defaultPrompt: string;
    mocFolder: string; // Root folder for knowledge organization (both notes and MOCs)
    enableMOC: boolean; // Toggle for MOC functionality
}

// Available Models
const GEMINI_MODELS: GeminiModel[] = [
    {
        id: 'gemini-2.0-flash-001',
        name: 'Gemini 2.0 Flash',
        description: 'Stable, fast, next-gen multimodal model'
    },
    {
        id: 'gemini-2.0-flash-lite-001',
        name: 'Gemini 2.0 Flash Lite',
        description: 'Stable, cost-efficient, low-latency model'
    },
    {
        id: 'gemini-2.5-pro-preview-05-06',
        name: 'Gemini 2.5 Pro Preview',
        description: 'Preview, most advanced reasoning and multimodal model'
    },
    {
        id: 'gemini-2.5-flash-preview-05-20',
        name: 'Gemini 2.5 Flash Preview',
        description: 'Preview, best price-performance, well-rounded capabilities'
    }
];

const OPENROUTER_MODELS: OpenRouterModel[] = [
    {
        id: 'openai/gpt-3.5-turbo',
        name: 'GPT-3.5 Turbo',
        description: 'Fast and efficient model for most tasks',
        provider: 'OpenAI'
    },
    {
        id: 'openai/gpt-4',
        name: 'GPT-4',
        description: 'Most capable model for complex tasks',
        provider: 'OpenAI'
    },
    {
        id: 'anthropic/claude-3-opus',
        name: 'Claude 3 Opus',
        description: 'Most capable Claude model',
        provider: 'Anthropic'
    },
    {
        id: 'anthropic/claude-3-sonnet',
        name: 'Claude 3 Sonnet',
        description: 'Balanced Claude model',
        provider: 'Anthropic'
    },
    {
        id: 'anthropic/claude-3-haiku',
        name: 'Claude 3 Haiku',
        description: 'Fast and efficient Claude model',
        provider: 'Anthropic'
    }
];

// Default Settings
const DEFAULT_SETTINGS: PluginSettings = {
    provider: 'gemini',
    gemini: {
        apiKey: '',
        model: 'gemini-1.5-flash',
        models: GEMINI_MODELS
    },
    openrouter: {
        apiKey: '',
        model: 'openai/gpt-3.5-turbo',
        endpoint: 'https://openrouter.ai/api/v1/chat/completions',
        models: OPENROUTER_MODELS
    },
    defaultPrompt: `You are an expert knowledge creator, skilled at transforming information into actionable insights for a second brain. Your goal is to create a comprehensive and well-structured note from the provided content.

For each section below, provide detailed and thoughtful content:

CONTEXT:
- Provide the background and setting of the content
- Explain why this information matters
- Set up the framework for understanding the content

FACTS:
- Extract key factual information
- Include specific data points, statistics, or concrete information
- Focus on verifiable and objective information

PERSPECTIVES:
- Present different viewpoints on the topic
- Include contrasting opinions or approaches
- Consider cultural, historical, or theoretical perspectives

INSIGHTS:
- Identify deeper meanings and implications
- Connect ideas to broader concepts
- Highlight patterns and relationships

PERSONAL REFLECTION:
- Share your thoughts on the content
- Connect it to existing knowledge
- Identify personal relevance and applications

ANALOGIES AND METAPHORS:
- Create clear comparisons to explain complex ideas
- Use relatable examples to illustrate concepts
- Draw parallels to familiar situations

QUESTIONS AND CURIOSITIES:
- List important questions that arise
- Identify areas that need further exploration
- Note interesting points that deserve deeper investigation

APPLICATIONS AND EXAMPLES:
- Provide concrete examples of how to apply the information
- Show real-world applications
- Include specific use cases

CONTRASTS AND COMPARISONS:
- Compare with similar concepts or ideas
- Highlight differences and similarities
- Show how this fits into the broader context

IMPLICATIONS:
- Discuss potential impacts and consequences
- Consider short-term and long-term effects
- Explore possible future developments

KNOWLEDGE GAPS:
- Identify areas where more information is needed
- Note assumptions that should be verified
- List topics that require further research

NEXT STEPS:
- Suggest specific actions to take
- Outline a plan for implementation
- Recommend follow-up activities

RELATED GOALS:
- Connect to personal or professional objectives
- Identify how this information supports larger goals
- Suggest ways to integrate this knowledge into existing plans

Please structure your response with clear sections, using bullet points for lists and maintaining a professional yet engaging tone. Focus on creating actionable insights that can be easily referenced and applied.`,
    mocFolder: 'MOCs',
    enableMOC: true
};

class SummaryView extends ItemView {
    private urlInput: HTMLInputElement;
    private noteDropdown: HTMLSelectElement;
    private urlModeRadio: HTMLInputElement;
    private noteModeRadio: HTMLInputElement;
    private promptInput: HTMLTextAreaElement;
    private generateButton: HTMLButtonElement;
    private resultArea: HTMLDivElement;
    private loadingIndicator: HTMLDivElement;
    private geminiClient: GoogleGenerativeAI | null = null;
    private modelDropdown: HTMLSelectElement;
    private progressContainer: HTMLDivElement;
    private statusMessage: HTMLDivElement;
    private retryButton: HTMLButtonElement;
    private currentStep: number = 0;
    private steps: string[] = ['Fetch', 'Generate'];
    private statusSteps: { label: string, state: 'idle' | 'in-progress' | 'success' | 'error', currentAttempt?: number, totalAttempts?: number }[] = [
        { label: 'Fetch Content/Transcript', state: 'idle' },
        { label: 'Generate Note', state: 'idle' },
        { label: 'Organize in Knowledge Map', state: 'idle' },
        { label: 'Save & Open Note', state: 'idle' }
    ];
    private currentTitle: string = '';
    private currentMetadata: any = null;

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
        contentEl.empty();

        // Section: Input
        const inputHeader = contentEl.createEl('h3', { text: 'Input' });
        const formContainer = contentEl.createEl('div', { cls: 'ai-summarizer-form' });
        formContainer.style.marginBottom = '20px';

        // Input mode selector
        const inputModeContainer = formContainer.createEl('div', { cls: 'ai-summarizer-input-mode' });
        inputModeContainer.style.marginBottom = '15px';
        
        const urlModeLabel = inputModeContainer.createEl('label');
        this.urlModeRadio = urlModeLabel.createEl('input', { type: 'radio' }) as HTMLInputElement;
        this.urlModeRadio.name = 'inputMode';
        this.urlModeRadio.value = 'url';
        this.urlModeRadio.checked = true;
        urlModeLabel.appendText(' Create new note from URL');
        
        const noteModeLabel = inputModeContainer.createEl('label');
        noteModeLabel.style.marginLeft = '20px';
        this.noteModeRadio = noteModeLabel.createEl('input', { type: 'radio' }) as HTMLInputElement;
        this.noteModeRadio.name = 'inputMode';
        this.noteModeRadio.value = 'note';
        noteModeLabel.appendText(' Organize existing note');
        
        // URL input section
        const urlSection = formContainer.createEl('div', { cls: 'url-input-section' });
        urlSection.createEl('label', { text: 'Enter the URL (YouTube videos, blogs or a podcast transcript)' });
        this.urlInput = urlSection.createEl('input', { type: 'text', placeholder: 'https://www.youtube.com/watch?v=' }) as HTMLInputElement;
        this.urlInput.setAttribute('aria-label', 'URL input');
        this.urlInput.style.marginBottom = '10px';
        
        // Note selection section
        const noteSection = formContainer.createEl('div', { cls: 'note-input-section' });
        noteSection.style.display = 'none';
        noteSection.createEl('label', { text: 'Select an existing note to organize' });
        this.noteDropdown = noteSection.createEl('select') as HTMLSelectElement;
        this.noteDropdown.style.width = '100%';
        this.noteDropdown.style.marginBottom = '10px';
        
        // Populate note dropdown
        this.populateNoteDropdown(this.noteDropdown);
        
        // Mode switching logic
        const toggleInputMode = () => {
            if (this.urlModeRadio.checked) {
                urlSection.style.display = 'block';
                noteSection.style.display = 'none';
            } else {
                urlSection.style.display = 'none';
                noteSection.style.display = 'block';
            }
        };
        
        this.urlModeRadio.addEventListener('change', toggleInputMode);
        this.noteModeRadio.addEventListener('change', toggleInputMode);

        // Inline error message for URL
        const urlError = formContainer.createEl('div', { cls: 'error-message' });
        urlError.style.display = 'none';

        // Section: Options
        const optionsHeader = contentEl.createEl('h3', { text: 'Options' });
        optionsHeader.style.marginTop = '24px';

        // Prompt collapsible
        const promptToggle = formContainer.createEl('button', { text: 'Show Prompt', cls: 'ai-summarizer-prompt-toggle' }) as HTMLButtonElement;
        promptToggle.setAttribute('aria-expanded', 'false');
        promptToggle.style.marginBottom = '8px';

        const promptHelp = formContainer.createEl('div', { text: '(Optional) Edit the prompt to customize the note structure.', cls: 'ai-summarizer-prompt-help' });
        promptHelp.style.fontSize = '0.9em';
        promptHelp.style.color = 'var(--text-muted)';
        promptHelp.style.marginBottom = '4px';

        this.promptInput = formContainer.createEl('textarea', { placeholder: 'Write your prompt here...' }) as HTMLTextAreaElement;
        this.promptInput.value = this.plugin.settings.defaultPrompt;
        this.promptInput.style.display = 'none';
        this.promptInput.setAttribute('aria-label', 'Prompt input');
        this.promptInput.rows = 8;

        promptToggle.onclick = () => {
            const expanded = promptToggle.getAttribute('aria-expanded') === 'true';
            if (expanded) {
                this.promptInput.style.display = 'none';
                promptToggle.innerText = 'Show Prompt';
                promptToggle.setAttribute('aria-expanded', 'false');
            } else {
                this.promptInput.style.display = 'block';
                promptToggle.innerText = 'Hide Prompt';
                promptToggle.setAttribute('aria-expanded', 'true');
            }
        };

        // Advanced Options collapsible
        const advToggle = formContainer.createEl('button', { text: 'Show Advanced Options', cls: 'ai-summarizer-adv-toggle' }) as HTMLButtonElement;
        advToggle.setAttribute('aria-expanded', 'false');
        advToggle.style.marginBottom = '8px';

        const advOptions = formContainer.createEl('div', { cls: 'ai-summarizer-adv-options' });
        advOptions.style.display = 'none';

        // Model Dropdown
        const modelContainer = advOptions.createEl('div', { cls: 'ai-summarizer-model-container' });
        modelContainer.createEl('label', { text: 'Model: ' });
        this.modelDropdown = modelContainer.createEl('select') as HTMLSelectElement;
        this.populateModelDropdown();
        this.modelDropdown.addEventListener('change', () => {
            if (this.plugin.settings.provider === 'gemini') {
                this.plugin.settings.gemini.model = this.modelDropdown.value;
            } else if (this.plugin.settings.provider === 'openrouter') {
                this.plugin.settings.openrouter.model = this.modelDropdown.value;
            }
        });

        advToggle.onclick = () => {
            const expanded = advToggle.getAttribute('aria-expanded') === 'true';
            if (expanded) {
                advOptions.style.display = 'none';
                advToggle.innerText = 'Show Advanced Options';
                advToggle.setAttribute('aria-expanded', 'false');
            } else {
                advOptions.style.display = 'block';
                advToggle.innerText = 'Hide Advanced Options';
                advToggle.setAttribute('aria-expanded', 'true');
            }
        };

        // Section: Progress
        const progressHeader = contentEl.createEl('h3', { text: 'Progress' });
        progressHeader.style.marginTop = '24px';
        this.progressContainer = contentEl.createEl('div', { cls: 'ai-summarizer-progress-container' });
        this.statusMessage = contentEl.createEl('div', { cls: 'ai-summarizer-status-message' });
        this.retryButton = contentEl.createEl('button', { text: 'Retry', cls: 'ai-summarizer-retry-button' }) as HTMLButtonElement;
        this.retryButton.style.display = 'none';
        this.retryButton.onclick = () => {
            this.retryButton.style.display = 'none';
            this.statusMessage.innerText = '';
            this.startNoteGeneration();
        };
        this.updateStatusSteps(0, 'Idle');

        // Generate Note button
        this.generateButton = formContainer.createEl('button', { text: 'Generate Note' }) as HTMLButtonElement;
        this.generateButton.style.width = '100%';
        this.generateButton.style.marginTop = '18px';

        this.generateButton.addEventListener('click', async () => {
            urlError.style.display = 'none';
            
            if (this.urlModeRadio.checked) {
                if (!this.urlInput.value) {
                    urlError.innerText = 'Please enter a URL.';
                    urlError.style.display = 'block';
                    this.urlInput.focus();
                    return;
                }
                this.startNoteGeneration();
            } else {
                if (!this.noteDropdown.value) {
                    urlError.innerText = 'Please select a note to organize.';
                    urlError.style.display = 'block';
                    this.noteDropdown.focus();
                    return;
                }
                this.startNoteOrganization();
            }
        });

        // Accessibility: focus management
        this.urlInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                this.generateButton.focus();
            }
        });

        this.resultArea = contentEl.createEl('div', { cls: 'ai-summarizer-result' }) as HTMLDivElement;
        this.resultArea.style.display = 'none';

        this.geminiClient = new GoogleGenerativeAI(this.plugin.settings.gemini.apiKey);
    }

    private populateModelDropdown() {
        this.modelDropdown.innerHTML = '';
        if (this.plugin.settings.provider === 'gemini') {
            this.plugin.settings.gemini.models.forEach((model: GeminiModel) => {
                const option = document.createElement('option');
                option.value = model.id;
                option.text = `${model.name} - ${model.description}`;
                if (model.id === this.plugin.settings.gemini.model) option.selected = true;
                this.modelDropdown.appendChild(option);
            });
        } else if (this.plugin.settings.provider === 'openrouter') {
            this.plugin.settings.openrouter.models.forEach((model: OpenRouterModel) => {
                const option = document.createElement('option');
                option.value = model.id;
                option.text = `${model.name} (${model.provider}) - ${model.description}`;
                if (model.id === this.plugin.settings.openrouter.model) option.selected = true;
                this.modelDropdown.appendChild(option);
            });
        }
    }

    private populateNoteDropdown(dropdown: HTMLSelectElement) {
        dropdown.innerHTML = '';
        
        // Add default option
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.text = 'Select a note to organize...';
        dropdown.appendChild(defaultOption);
        
        // Get all markdown files
        const markdownFiles = this.app.vault.getMarkdownFiles();
        
        markdownFiles.forEach((file) => {
            const option = document.createElement('option');
            option.value = file.path;
            option.text = file.basename;
            dropdown.appendChild(option);
        });
    }

    private updateStatusSteps(currentStep: number, status: string, error: boolean = false, attemptInfo?: {current: number, total: number}) {
        // Set all states to idle and clear attempt info
        for (let i = 0; i < this.statusSteps.length; i++) {
            this.statusSteps[i].state = 'idle';
            this.statusSteps[i].currentAttempt = undefined;
            this.statusSteps[i].totalAttempts = undefined;
        }
        // Set states up to currentStep
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

        // Render
        this.progressContainer.innerHTML = '';
        for (let i = 0; i < this.statusSteps.length; i++) {
            const step = this.statusSteps[i];
            const circle = document.createElement('span');
            circle.innerText = '●';
            circle.style.marginRight = '6px';
            switch (step.state) {
                case 'idle': circle.style.color = 'gray'; break;
                case 'in-progress': circle.style.color = 'orange'; break;
                case 'success': circle.style.color = 'green'; break;
                case 'error': circle.style.color = 'red'; break;
            }
            this.progressContainer.appendChild(circle);

            const label = document.createElement('span');
            let labelText = step.label;
            if (step.state === 'in-progress' && step.currentAttempt && step.totalAttempts) {
                labelText = `${step.label} (Attempt ${step.currentAttempt}/${step.totalAttempts})`;
            }
            label.innerText = labelText;
            label.style.marginRight = '18px';
            label.style.fontWeight = i === currentStep ? 'bold' : 'normal';
            label.style.color = circle.style.color;
            this.progressContainer.appendChild(label);
        }
        this.statusMessage.innerText = status;
        if (error) {
            this.retryButton.style.display = 'block';
        } else {
            this.retryButton.style.display = 'none';
        }
    }

    private async startNoteGeneration() {
        console.log('[startNoteGeneration] Starting flow...');
        const url = this.urlInput.value;
        const prompt = this.promptInput.value;

        if (!url) {
            new Notice('Please enter a URL.');
            return;
        }

        // Reset status steps to their initial state before starting
        this.statusSteps = [
            { label: 'Fetch Content/Transcript', state: 'idle' },
            { label: 'Generate Note', state: 'idle' },
            { label: 'Organize in Knowledge Map', state: 'idle' },
            { label: 'Save & Open Note', state: 'idle' }
        ];
        this.updateStatusSteps(0, 'Initiating process...'); // Initial status before fetching

        try {
            console.log('[startNoteGeneration] Clearing UI elements...');
            if (!this.resultArea) {
                console.error('[startNoteGeneration] resultArea is undefined!');
                this.resultArea = this.containerEl.createEl('div', { cls: 'ai-summarizer-result' }) as HTMLDivElement;
            }
            this.resultArea.innerText = '';
            
            let content = '';
            // Step 1: Fetch
            // Initial status update for fetching
            this.updateStatusSteps(0, 'Connecting to source and extracting content...');
            console.log('[startNoteGeneration] Starting content fetch...');

            if (url.includes('youtube.com')) {
                console.log('[startNoteGeneration] Fetching YouTube transcript...');
                // The fetchTranscriptFromPython function now handles its own status updates for retries
                try {
                    content = await this.fetchTranscriptFromPython(url);
                    // If successful, fetchTranscriptFromPython would have called updateStatusSteps for the final success of attempt X/Y
                    // So, we might not need an explicit success message here, or we can set a general "Transcript fetched"
                    this.updateStatusSteps(0, 'Transcript fetched successfully.', false); // Mark step 0 as success
                } catch (error) {
                    // error is expected to be a string message from the Python script or an Error object
                    const errorMessage = typeof error === 'string' ? error : (error as Error).message;
                    console.error('[startNoteGeneration] Transcript fetch failed:', errorMessage);
                    new Notice('Failed to fetch transcript. ' + errorMessage);
                    this.updateStatusSteps(0, 'Failed to fetch transcript: ' + errorMessage, true);
                    return;
                }
            } else {
                // ... (existing web content fetching logic, ensure it also updates status correctly)
                console.log('[startNoteGeneration] Fetching web content...');
                this.updateStatusSteps(0, 'Fetching web content...'); // Status for web content
                content = await this.fetchContentFromWebLink(url);
                if (!content || content.startsWith('Error:') || content.includes('[ERROR]')) {
                    console.error('[startNoteGeneration] Content fetch failed');
                    new Notice('Failed to fetch content. Please check the URL.');
                    this.updateStatusSteps(0, 'Failed to fetch content. Please check the URL.', true);
                    return;
                }
                 this.updateStatusSteps(0, 'Web content fetched successfully.', false); // Mark step 0 as success
            }
            
            // Additional validation to ensure we have meaningful content
            if (!content || content.trim().length < 10) { // Adjusted length check, as even short transcripts can be valid
                console.error('[startNoteGeneration] Content too short or empty');
                const noticeMsg = 'Failed to fetch meaningful content. The content may be too short or the URL is incorrect.';
                new Notice(noticeMsg);
                this.updateStatusSteps(0, noticeMsg, true);
                return;
            }
            
            console.log('[startNoteGeneration] Content fetched successfully, length:', content.length);
            
            // ... rest of the startNoteGeneration method
            this.updateStatusSteps(1, 'Analyzing content with AI...');
            this.statusMessage.innerText = 'This may take 30-60 seconds for complex content...';
            console.log('[startNoteGeneration] Starting content processing...');
            const result = await this.summarizeContent(content, prompt, url);
            if (!result.summary) {
                console.error('[startNoteGeneration] Note generation failed - no summary returned');
                new Notice('AI failed to generate structured content. This might be due to API issues or content complexity.');
                this.updateStatusSteps(1, 'AI response processing failed. Check your API settings and try again.', true);
                return;
            }
            console.log('[startNoteGeneration] Note generated successfully, length:', result.summary.length);
            console.log('[startNoteGeneration] Metadata:', result.metadata);
            
            // Check if we used fallback parsing and inform the user
            if (result.summary.includes('Raw AI Response')) {
                this.statusMessage.innerText = 'AI response required fallback parsing - content preserved but may need manual review';
                new Notice('Note created with fallback parsing. Please review the content for completeness.');
            }
            
            this.updateStatusSteps(2, 'Creating knowledge hierarchy...');
            await new Promise(res => setTimeout(res, 100));
            
            // Store metadata for later use
            this.currentMetadata = result.metadata;
            this.currentTitle = result.title;

            // Create and open the note  
            this.updateStatusSteps(3, 'Creating note file...');
            
            const newNote = await this.createNoteWithSummary(result.summary, result.title, url, result.metadata, result);
            if (newNote) {
                this.updateStatusSteps(3, 'Opening note...', false);
                const leaf = this.app.workspace.getLeaf('tab');
                await leaf.openFile(newNote);
                this.updateStatusSteps(3, 'Complete! Note organized and ready.', false);
                new Notice('Note created and organized successfully!');
            } else {
                console.error('[CreateNote] Note creation failed');
                this.updateStatusSteps(3, 'Failed to create note', true);
            }
        } catch (error) { // This is a general catch for startNoteGeneration, not specific to transcript fetching
            console.error('[startNoteGeneration] Error:', error);
            const errorMessage = typeof error === 'string' ? error : (error as Error).message;
            new Notice('An error occurred: ' + errorMessage);
            // Determine which step the error occurred in, if possible.
            // For now, assume it's after fetching if it reaches here.
            this.updateStatusSteps(1, 'Error occurred: ' + errorMessage, true);
        }
    }

    private async startNoteOrganization() {
        console.log('[startNoteOrganization] Starting note organization...');
        const notePath = this.noteDropdown.value;
        
        try {
            // Clear UI elements
            if (!this.resultArea) {
                this.resultArea = this.containerEl.createEl('div', { cls: 'ai-summarizer-result' }) as HTMLDivElement;
            }
            this.resultArea.innerText = '';
            
            // Update status for note organization flow
            this.updateStatusSteps(0, 'Reading note content...');
            this.statusMessage.innerText = 'Loading existing note content...';
            
            // Read the existing note
            const noteFile = this.app.vault.getAbstractFileByPath(notePath) as TFile;
            if (!noteFile) {
                new Notice('Note file not found.');
                this.updateStatusSteps(0, 'Note file not found.', true);
                return;
            }
            
            const noteContent = await this.app.vault.read(noteFile);
            console.log('[startNoteOrganization] Note content loaded, length:', noteContent.length);
            
            this.updateStatusSteps(1, 'Analyzing note for organization...');
            this.statusMessage.innerText = 'AI is analyzing content to determine best knowledge hierarchy...';
            
            // Use AI to analyze the note for hierarchy placement
            const analysis = await this.analyzeNoteForHierarchy(noteContent, noteFile.basename);
            if (!analysis.hierarchy) {
                new Notice('Failed to analyze note for organization.');
                this.updateStatusSteps(1, 'Failed to analyze note content.', true);
                return;
            }
            
            console.log('[startNoteOrganization] Analysis completed:', analysis);
            
            this.updateStatusSteps(2, 'Creating knowledge hierarchy...');
            this.statusMessage.innerText = `Organizing in ${analysis.hierarchy.level1} > ${analysis.hierarchy.level2}...`;
            
            // Create/update MOC structure
            const mocPath = await this.plugin.mocManager.ensureMOCExists(analysis.hierarchy);
            console.log('[startNoteOrganization] MOC path:', mocPath);
            
            this.updateStatusSteps(3, 'Adding to knowledge map...');
            this.statusMessage.innerText = 'Adding note to knowledge map...';
            
            // Add the note to the MOC
            await this.plugin.mocManager.updateMOC(mocPath, notePath, noteFile.basename, analysis.learning_context);
            
            this.updateStatusSteps(3, 'Organization complete!', false);
            new Notice(`Note organized in ${analysis.hierarchy.level1} > ${analysis.hierarchy.level2}`);
            
            // Open the note
            const leaf = this.app.workspace.getLeaf('tab');
            await leaf.openFile(noteFile);
            
        } catch (error) {
            console.error('[startNoteOrganization] Error:', error);
            new Notice('An error occurred while organizing the note.');
            this.updateStatusSteps(3, 'Organization failed.', true);
        }
    }

    private async analyzeNoteForHierarchy(noteContent: string, noteTitle: string): Promise<{ hierarchy: MOCHierarchy, learning_context: LearningContext }> {
        console.log('[analyzeNoteForHierarchy] Analyzing note for hierarchy placement');
        
        // Create a simplified prompt focused on hierarchy analysis
        const hierarchyPrompt = `Analyze the following note content and determine the best knowledge hierarchy placement. 

Please respond with ONLY a JSON object in this exact format:

{
    "hierarchy": {
        "level1": "Knowledge Domain (e.g., Computer Science, Physics, Business, Philosophy, etc.)",
        "level2": "Learning Area within the domain (e.g., Machine Learning, Quantum Mechanics, Marketing, Ethics)",
        "level3": "Specific Topic (optional)",
        "level4": "Key Concept (optional)"
    },
    "learning_context": {
        "prerequisites": ["Concept 1", "Concept 2"],
        "related_concepts": ["Related Topic 1", "Related Topic 2"],
        "learning_path": ["Step 1", "Step 2", "Step 3"],
        "complexity_level": "beginner|intermediate|advanced",
        "estimated_reading_time": "X minutes"
    }
}

Note Title: "${noteTitle}"

Note Content:
${noteContent}`;

        let selectedModel = '';
        
        if (this.plugin.settings.provider === 'gemini') {
            selectedModel = this.modelDropdown?.value || this.plugin.settings.gemini.model;
            if (!this.plugin.settings.gemini.apiKey) {
                throw new Error('Gemini API key not configured');
            }
            if (!this.geminiClient) {
                this.geminiClient = new GoogleGenerativeAI(this.plugin.settings.gemini.apiKey);
            }
            
            const model = this.geminiClient.getGenerativeModel({ model: selectedModel });
            const result = await model.generateContent({
                contents: [{
                    role: 'user',
                    parts: [{ text: hierarchyPrompt }]
                }]
            });
            const responseText = result.response.text();
            
            // Parse the response
            return this.parseHierarchyResponse(responseText);
            
        } else if (this.plugin.settings.provider === 'openrouter') {
            selectedModel = this.modelDropdown?.value || this.plugin.settings.openrouter.model;
            if (!this.plugin.settings.openrouter.apiKey) {
                throw new Error('OpenRouter API key not configured');
            }
            
            const response = await fetch(this.plugin.settings.openrouter.endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.plugin.settings.openrouter.apiKey}`,
                    'HTTP-Referer': 'https://github.com/yourusername/second-brAIn',
                    'X-Title': 'second-brAIn'
                },
                body: JSON.stringify({
                    model: selectedModel,
                    messages: [
                        { role: 'system', content: 'You are a knowledge organization expert. Analyze content and provide hierarchy placement in the exact JSON format requested.' },
                        { role: 'user', content: hierarchyPrompt }
                    ],
                    temperature: 0.3,
                    max_tokens: 1000
                })
            });
            
            const data = await response.json();
            if (!response.ok) {
                throw new Error(`OpenRouter API error: ${data.error?.message || response.statusText}`);
            }
            
            const responseText = data.choices[0].message.content;
            return this.parseHierarchyResponse(responseText);
        }
        
        throw new Error('No AI provider configured');
    }

    private parseHierarchyResponse(responseText: string): { hierarchy: MOCHierarchy, learning_context: LearningContext } {
        console.log('[parseHierarchyResponse] Parsing hierarchy response');
        
        // Try to extract JSON
        let jsonText = responseText;
        const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch) {
            jsonText = jsonMatch[1].trim();
        }
        
        try {
            // Clean up and parse JSON
            jsonText = this.cleanupJSON(jsonText);
            const response = JSON.parse(jsonText);
            
            if (response.hierarchy && response.learning_context) {
                return {
                    hierarchy: response.hierarchy,
                    learning_context: response.learning_context
                };
            }
        } catch (error) {
            console.error('[parseHierarchyResponse] JSON parsing failed:', error);
        }
        
        // Fallback to heuristic analysis
        console.log('[parseHierarchyResponse] Using fallback heuristic analysis');
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

        console.log('[FetchContent] Preparing to run command:', venvPython, scriptPath, url);

        const { spawn } = require('child_process');
        const pythonProcess = spawn(venvPython, [scriptPath, url]);

        let fullOutput = "";
        let lastErrorLine = "";

        return new Promise((resolve, reject) => {
            pythonProcess.stdout.on('data', (data: Buffer) => {
                const output = data.toString();
                fullOutput += output;
                console.log('[FetchContent] STDOUT:', output);
            });

            pythonProcess.stderr.on('data', (data: Buffer) => {
                const errorOutput = data.toString();
                fullOutput += errorOutput;
                console.error('[FetchContent] STDERR:', errorOutput);
                if (errorOutput.includes("[ERROR]")) {
                    lastErrorLine = errorOutput.trim();
                }
            });

            pythonProcess.on('close', (code: number) => {
                console.log(`[FetchContent] Child process exited with code ${code}`);
                if (code === 0) {
                    resolve(fullOutput.trim());
                } else {
                    const finalError = lastErrorLine || `Python script for web content exited with code ${code}. Full output: ${fullOutput}`;
                    console.error('[FetchContent] Command failed:', finalError);
                    reject(new Error(finalError));
                }
            });

            pythonProcess.on('error', (err: Error) => {
                console.error('[FetchContent] Failed to start subprocess.', err);
                reject(new Error(`Failed to start web content extraction process: ${err.message}`));
            });
        });
    }

    private async fetchTranscriptFromPython(url: string): Promise<string> {
        // @ts-ignore
        const vaultPath = this.app.vault.adapter.basePath || '';
        const scriptPath = path.join(vaultPath, '.obsidian', 'plugins', 'second-brAIn', 'fetch_transcript.py');
        const venvPython = path.join(vaultPath, '.obsidian', 'plugins', 'second-brAIn', 'venv', 'bin', 'python3');

        console.log('[FetchTranscript] Preparing to run command:', venvPython, scriptPath, url);

        // No direct execPromise here, instead, we'll use spawn to get live output
        const { spawn } = require('child_process');
        const pythonProcess = spawn(venvPython, [scriptPath, url]);

        let fullOutput = "";
        let lastErrorLine = "";

        return new Promise((resolve, reject) => {
            pythonProcess.stdout.on('data', (data: Buffer) => {
                const output = data.toString();
                fullOutput += output;
                console.log('[FetchTranscript] STDOUT:', output);

                // Try to parse attempt info
                const attemptMatch = output.match(/\[INFO\] Attempt (\d+)\/(\d+): Fetching transcript/);
                if (attemptMatch) {
                    const currentAttempt = parseInt(attemptMatch[1]);
                    const totalAttempts = parseInt(attemptMatch[2]);
                    this.updateStatusSteps(0, `Fetching transcript (Attempt ${currentAttempt}/${totalAttempts})...`, false, {current: currentAttempt, total: totalAttempts});
                }
            });

            pythonProcess.stderr.on('data', (data: Buffer) => {
                const errorOutput = data.toString();
                fullOutput += errorOutput; // Also add stderr to fullOutput for context
                console.error('[FetchTranscript] STDERR:', errorOutput);
                // Store the last error line in case it's the final error message
                if (errorOutput.includes("[ERROR]")) { // Catch specific errors from script
                    lastErrorLine = errorOutput.trim();
                }
            });

            pythonProcess.on('close', (code: number) => {
                console.log(`[FetchTranscript] Child process exited with code ${code}`);

                const resultMarker = "[INFO] Script finished. Outputting result.";
                const markerIndex = fullOutput.lastIndexOf(resultMarker);
                let processedResult = "";

                if (markerIndex !== -1) {
                    processedResult = fullOutput.substring(markerIndex + resultMarker.length).trim();
                } else {
                    // Fallback if marker is not found
                    // This might happen if the script errors out before printing the marker
                    processedResult = fullOutput.trim();
                }

                // Prioritize error messages from the script's known error format
                if (processedResult.startsWith('Error: Failed to fetch transcript after')) {
                    console.error('[FetchTranscript] Command failed with final error message:', processedResult);
                    this.updateStatusSteps(0, processedResult, true); // Update UI with final error
                    reject(processedResult);
                } else if (lastErrorLine && lastErrorLine.startsWith('[ERROR]')) {
                    // Use other errors captured from stderr if they look like script errors
                    console.error('[FetchTranscript] Command failed with error from STDERR:', lastErrorLine);
                    this.updateStatusSteps(0, lastErrorLine, true);
                    reject(lastErrorLine);
                } else if (code !== 0) {
                    // Generic error if non-zero exit code and no specific script error
                    const finalError = `Python script exited with code ${code}. Output: ${processedResult || 'No specific output.'}`;
                    console.error('[FetchTranscript] Command failed with exit code:', finalError);
                    this.updateStatusSteps(0, finalError, true);
                    reject(new Error(finalError));
                } else if (!processedResult) {
                    const noTranscriptError = "Error: No transcript data was returned by the script, though it exited cleanly.";
                    console.warn('[FetchTranscript] No transcript data returned:', noTranscriptError);
                    this.updateStatusSteps(0, noTranscriptError, true);
                    reject(noTranscriptError);
                } else {
                    console.log('[FetchTranscript] Successfully fetched:', processedResult.substring(0,100) + "...");
                    // Implicit success from updateStatusSteps in startNoteGeneration if this resolves
                    resolve(processedResult);
                }
            });

            pythonProcess.on('error', (err: Error) => {
                console.error('[FetchTranscript] Failed to start subprocess.', err);
                this.updateStatusSteps(0, `Failed to start transcript process: ${err.message}`, true);
                reject(new Error(`Failed to start transcript extraction process: ${err.message}`));
            });
        });
    }

    private async summarizeContent(text: string, prompt: string, url: string): Promise<{ summary: string, title: string, metadata: any, hierarchy?: any, learning_context?: any }> {
        let selectedModel = '';
        console.log('[SummarizeContent] Provider:', this.plugin.settings.provider);
        
        // Enhanced prompt that includes comprehensive note structure and MOC hierarchy analysis
        const enhancedPrompt = `${prompt}\n\nPlease structure your response as a JSON object with the following format:\n\n{
    "title": "Your concise, descriptive title here",
    "metadata": {
        "speakers": ["Speaker 1", "Speaker 2"],
        "topics": ["Topic 1", "Topic 2", "Topic 3"],
        "tags": ["#tag1", "#tag2", "#tag3"],
        "related": ["Concept 1", "Concept 2", "Concept 3"]
    },
    "hierarchy": {
        "level1": "Knowledge Domain (e.g., Computer Science, Physics, Business, Philosophy, etc.)",
        "level2": "Learning Area within the domain (e.g., Machine Learning, Quantum Mechanics, Marketing, Ethics)",
        "level3": "Specific Topic (e.g., Neural Networks, Wave Functions, Digital Marketing, Applied Ethics)",
        "level4": "Key Concept (e.g., Backpropagation, Schrödinger Equation, SEO, Moral Reasoning)"
    },
    "learning_context": {
        "prerequisites": ["Concept 1", "Concept 2"],
        "related_concepts": ["Related Topic 1", "Related Topic 2"],
        "learning_path": ["Step 1", "Step 2", "Step 3"],
        "complexity_level": "beginner|intermediate|advanced",
        "estimated_reading_time": "5-10 minutes"
    },
    "sections": {
        "context": "Background and setting of the content",
        "facts": [
            "Key fact 1",
            "Key fact 2",
            "Key fact 3"
        ],
        "perspectives": [
            "Different viewpoint 1",
            "Different viewpoint 2"
        ],
        "insights": [
            "Important insight 1",
            "Important insight 2",
            "Important insight 3"
        ],
        "personal_reflection": "Your thoughts and connections to existing knowledge",
        "analogies": [
            "Analogy 1",
            "Analogy 2"
        ],
        "questions": [
            "Question 1",
            "Question 2"
        ],
        "applications": [
            "Application 1",
            "Application 2"
        ],
        "contrasts": [
            "Contrast 1",
            "Contrast 2"
        ],
        "implications": [
            "Implication 1",
            "Implication 2"
        ],
        "knowledge_gaps": [
            "Gap 1",
            "Gap 2"
        ],
        "next_steps": [
            "Action 1",
            "Action 2"
        ],
        "related_goals": [
            "Goal 1",
            "Goal 2"
        ]
    }
}

IMPORTANT INSTRUCTIONS FOR HIERARCHY AND LEARNING CONTEXT:

1. HIERARCHY ANALYSIS:
   - level1: Identify the broad knowledge domain (e.g., Computer Science, Physics, Business, Philosophy, History, Biology, etc.)
   - level2: Determine the specific learning area within that domain (e.g., Artificial Intelligence, Quantum Mechanics, Digital Marketing)
   - level3: Identify the specific topic being discussed (e.g., Neural Networks, Quantum Entanglement, SEO Strategy)
   - level4: Extract the key concept or technique (e.g., Backpropagation, Bell's Theorem, Keyword Research)

2. LEARNING CONTEXT:
   - prerequisites: What knowledge should someone have before learning this?
   - related_concepts: What other topics connect to this content?
   - learning_path: What sequence of topics would help someone master this area?
   - complexity_level: Assess based on technical depth, prerequisite knowledge, and cognitive load
   - estimated_reading_time: Based on content length and complexity

3. QUALITY GUIDELINES:
   - Be specific and accurate with domain classification
   - Ensure hierarchy levels make logical sense (general → specific)
   - Prerequisites should be foundational concepts, not advanced topics
   - Learning paths should be progressive and logical

Note: For sections with checkboxes (questions, knowledge_gaps, next_steps, related_goals), the items will be automatically formatted as checkboxes in the final note.`;
        
        if (this.plugin.settings.provider === 'gemini') {
            selectedModel = this.modelDropdown?.value || this.plugin.settings.gemini.model;
            console.log('[SummarizeContent] Using Gemini model:', selectedModel);
            if (!this.plugin.settings.gemini.apiKey) {
                new Notice('Please set your Gemini API key in the settings.');
                console.error('[SummarizeContent] Gemini API key missing.');
                return { summary: '', title: 'Untitled', metadata: {}, hierarchy: undefined, learning_context: undefined };
            }
            if (!this.geminiClient) {
                this.geminiClient = new GoogleGenerativeAI(this.plugin.settings.gemini.apiKey);
            }
            try {
                const model = this.geminiClient.getGenerativeModel({ model: selectedModel });
                const request: GenerateContentRequest = {
                    contents: [{
                        role: 'user',
                        parts: [{ text: enhancedPrompt + "\n\n" + text }]
                    }]
                };
                console.log('[SummarizeContent] Sending request to Gemini API:', request);
                const result = await model.generateContent(request);
                const responseText = result.response.text();
                console.log('[SummarizeContent] Gemini API response:', responseText);
                
                // Parse the response to extract all sections
                const sections = this.parseSections(responseText);
                console.log('[SummarizeContent] Parsed sections with hierarchy:', sections.hierarchy);
                console.log('[SummarizeContent] Parsed sections with learning_context:', sections.learning_context);
                
                return { 
                    summary: this.formatEnhancedSummary(sections),
                    title: sections.title || 'Untitled',
                    metadata: sections.metadata || {},
                    hierarchy: sections.hierarchy,
                    learning_context: sections.learning_context
                };
            } catch (error) {
                new Notice(`Gemini API Error: ${error.message}`);
                console.error('[SummarizeContent] Gemini API error:', error);
                return { summary: '', title: 'Untitled', metadata: {}, hierarchy: undefined, learning_context: undefined };
            }
        } else if (this.plugin.settings.provider === 'openrouter') {
            selectedModel = this.modelDropdown?.value || this.plugin.settings.openrouter.model;
            console.log('[SummarizeContent] Using OpenRouter model:', selectedModel);
            if (!this.plugin.settings.openrouter.apiKey) {
                new Notice('Please set your OpenRouter API key in the settings.');
                console.error('[SummarizeContent] OpenRouter API key missing.');
                return { summary: '', title: 'Untitled', metadata: {}, hierarchy: undefined, learning_context: undefined };
            }
            try {
                const requestBody = {
                    model: selectedModel,
                    messages: [
                        { role: 'system', content: 'You are a helpful AI assistant that creates detailed summaries and notes. Always structure your response with a TITLE: line followed by the SUMMARY: section.' },
                        { role: 'user', content: enhancedPrompt + "\n\n" + text }
                    ],
                    temperature: 0.7,
                    max_tokens: 2000
                };
                console.log('[SummarizeContent] Sending request to OpenRouter API:', requestBody);
                const response = await fetch(this.plugin.settings.openrouter.endpoint, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${this.plugin.settings.openrouter.apiKey}`,
                        'HTTP-Referer': 'https://github.com/yourusername/second-brAIn',
                        'X-Title': 'second-brAIn'
                    },
                    body: JSON.stringify(requestBody)
                });
                const data = await response.json();
                if (!response.ok) {
                    console.error('[SummarizeContent] OpenRouter API error:', data);
                    throw new Error(`OpenRouter API error: ${data.error?.message || response.statusText}`);
                }
                console.log('[SummarizeContent] OpenRouter API response:', data);
                const responseText = data.choices[0].message.content;
                
                // Parse the response to extract all sections
                const sections = this.parseSections(responseText);
                console.log('[SummarizeContent] Parsed sections with hierarchy:', sections.hierarchy);
                console.log('[SummarizeContent] Parsed sections with learning_context:', sections.learning_context);
                
                return { 
                    summary: this.formatEnhancedSummary(sections),
                    title: sections.title || 'Untitled',
                    metadata: sections.metadata || {},
                    hierarchy: sections.hierarchy,
                    learning_context: sections.learning_context
                };
            } catch (error) {
                new Notice(`OpenRouter API Error: ${error.message}`);
                console.error('[SummarizeContent] OpenRouter API error:', error);
                return { summary: '', title: 'Untitled', metadata: {}, hierarchy: undefined, learning_context: undefined };
            }
        }
        return { summary: '', title: 'Untitled', metadata: {}, hierarchy: undefined, learning_context: undefined };
    }

    private parseSections(responseText: string): any {
        // Extract and prepare JSON text
        const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
        let jsonText = jsonMatch ? jsonMatch[1].trim() : responseText;
        
        try {
            // Clean up common JSON issues from AI responses
            jsonText = this.cleanupJSON(jsonText);
            
            // Try to parse the JSON
            const response = JSON.parse(jsonText);
            console.log('[parseSections] Successfully parsed AI response');
            
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
            console.error('[parseSections] JSON parsing failed, attempting cleanup...');
            
            // Try one more time with aggressive cleanup
            try {
                const aggressivelyCleanedJSON = this.aggressiveJSONCleanup(jsonText);
                const response = JSON.parse(aggressivelyCleanedJSON);
                console.log('[parseSections] Successfully parsed with cleanup');
                
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
                console.error('[parseSections] JSON cleanup failed, using fallback parsing');
            }
            
            // Fallback to text parsing method if JSON parsing fails completely
            console.log('[parseSections] Using fallback text parsing');
            const sections: any = {
                title: 'Untitled',
                metadata: {
                    tags: ['#summary'],
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
                    learning_path: ['Miscellaneous'],
                    complexity_level: 'intermediate',
                    estimated_reading_time: '5-10 minutes'
                },
                // Add basic content sections for fallback
                context: 'Content analysis completed with fallback parsing.',
                facts: ['AI response parsing encountered technical issues', 'Content was processed using fallback methods'],
                insights: ['This content may benefit from manual review and enhancement'],
                personal_reflection: 'The original AI response could not be fully parsed, but the content has been preserved.',
                questions: ['What were the key points in the original content?', 'How can this information be better organized?'],
                next_steps: ['Review and enhance the content manually', 'Consider regenerating with a different prompt'],
                applications: ['Use as a starting point for further research', 'Expand with additional context and details']
            };
            
            // Try to extract title from the response text
            let titleMatch = responseText.match(/["']title["']:\s*["']([^"']+)["']/i);
            if (!titleMatch) {
                titleMatch = responseText.match(/TITLE:\s*(.*?)(?:\n|$)/i);
            }
            if (!titleMatch) {
                titleMatch = responseText.match(/title[:\s]+([^\n]+)/i);
            }
            if (titleMatch) {
                sections.title = titleMatch[1].trim();
            }
            
            // Try to extract basic hierarchy from content patterns
            const text = responseText.toLowerCase();
            if (text.includes('computer') || text.includes('programming') || text.includes('software') || text.includes('ai') || text.includes('machine learning')) {
                sections.hierarchy.level1 = 'Computer Science';
                if (text.includes('ai') || text.includes('machine learning') || text.includes('neural')) {
                    sections.hierarchy.level2 = 'Artificial Intelligence';
                } else if (text.includes('web') || text.includes('frontend') || text.includes('backend')) {
                    sections.hierarchy.level2 = 'Web Development';
                } else {
                    sections.hierarchy.level2 = 'Programming';
                }
            } else if (text.includes('business') || text.includes('marketing') || text.includes('finance') || text.includes('management')) {
                sections.hierarchy.level1 = 'Business';
                sections.hierarchy.level2 = 'General Business';
            }
            
            // Extract metadata if it exists
            const metadataMatch = responseText.match(/METADATA:\n([\s\S]*?)(?:\n\n|$)/i);
            if (metadataMatch) {
                sections.metadata = this.parseMetadata(metadataMatch[1].trim());
            }
            
            // Add the original response text as raw content so nothing is lost
            sections.raw_content = responseText;
            
            console.log('[parseSections] Fallback parsing completed');
            return sections;
        }
    }

    private formatEnhancedSummary(sections: any): string {
        let formattedContent = '';
        
        // If we have raw content from fallback parsing, add it first
        if (sections.raw_content) {
            formattedContent += `> [!warning] Parsing Notice\n> The AI response could not be fully parsed as structured data. The raw content is preserved below, and basic organization has been applied. You may want to manually review and enhance this content.\n\n`;
            formattedContent += `## Raw AI Response\n\n${sections.raw_content}\n\n---\n\n`;
        }
        
        // Add context section with callout
        if (sections.context) {
            formattedContent += `> [!context] Context\n> ${sections.context.replace(/\n/g, '\n> ')}\n\n`;
        }
        
        // Add facts section with callout
        if (sections.facts && Array.isArray(sections.facts)) {
            formattedContent += `> [!fact] Facts\n`;
            sections.facts.forEach((fact: string) => {
                formattedContent += `> - ${fact}\n`;
            });
            formattedContent += '\n';
        }
        
        // Add perspectives section with callout
        if (sections.perspectives && Array.isArray(sections.perspectives)) {
            formattedContent += `> [!perspective] Perspectives\n`;
            sections.perspectives.forEach((perspective: string) => {
                formattedContent += `> - ${perspective}\n`;
            });
            formattedContent += '\n';
        }
        
        // Add insights section with callout
        if (sections.insights && Array.isArray(sections.insights)) {
            formattedContent += `> [!insight] Insights\n`;
            sections.insights.forEach((insight: string) => {
                formattedContent += `> - ${insight}\n`;
            });
            formattedContent += '\n';
        }
        
        // Add personal reflection section with callout
        if (sections.personal_reflection) {
            formattedContent += `> [!reflection] Personal Reflection\n> ${sections.personal_reflection.replace(/\n/g, '\n> ')}\n\n`;
        }
        
        // Add analogies section with callout
        if (sections.analogies && Array.isArray(sections.analogies)) {
            formattedContent += `> [!analogy] Analogies and Metaphors\n`;
            sections.analogies.forEach((analogy: string) => {
                formattedContent += `> - ${analogy}\n`;
            });
            formattedContent += '\n';
        }
        
        // Add questions section with callout and checkboxes
        if (sections.questions && Array.isArray(sections.questions)) {
            formattedContent += `> [!question] Questions and Curiosities\n`;
            sections.questions.forEach((question: string) => {
                formattedContent += `> - [ ] ${question}\n`;
            });
            formattedContent += '\n';
        }
        
        // Add applications section with callout
        if (sections.applications && Array.isArray(sections.applications)) {
            formattedContent += `> [!example] Applications and Examples\n`;
            sections.applications.forEach((application: string) => {
                formattedContent += `> - ${application}\n`;
            });
            formattedContent += '\n';
        }
        
        // Add contrasts section with callout
        if (sections.contrasts && Array.isArray(sections.contrasts)) {
            formattedContent += `> [!contrast] Contrasts and Comparisons\n`;
            sections.contrasts.forEach((contrast: string) => {
                formattedContent += `> - ${contrast}\n`;
            });
            formattedContent += '\n';
        }
        
        // Add implications section with callout
        if (sections.implications && Array.isArray(sections.implications)) {
            formattedContent += `> [!implication] Implications\n`;
            sections.implications.forEach((implication: string) => {
                formattedContent += `> - ${implication}\n`;
            });
            formattedContent += '\n';
        }
        
        // Add knowledge gaps section with callout and checkboxes
        if (sections.knowledge_gaps && Array.isArray(sections.knowledge_gaps)) {
            formattedContent += `> [!gap] Knowledge Gaps\n`;
            sections.knowledge_gaps.forEach((gap: string) => {
                formattedContent += `> - [ ] ${gap}\n`;
            });
            formattedContent += '\n';
        }
        
        // Add next steps section with callout and checkboxes
        if (sections.next_steps && Array.isArray(sections.next_steps)) {
            formattedContent += `> [!todo] Next Steps\n`;
            sections.next_steps.forEach((step: string) => {
                formattedContent += `> - [ ] ${step}\n`;
            });
            formattedContent += '\n';
        }
        
        // Add related goals section with callout and checkboxes
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
        // Remove common issues that cause JSON parsing to fail
        let cleaned = jsonText
            // Remove BOM and other invisible Unicode characters
            .replace(/^\uFEFF/, '') // Remove BOM
            .replace(/[\u200B-\u200D\uFEFF]/g, '') // Remove zero-width spaces and similar
            .replace(/[\u0000-\u001F\u007F-\u009F]/g, '') // Remove control characters
            // Remove any markdown formatting if it leaked through
            .replace(/```json\s*|\s*```/g, '')
            // Remove trailing commas before closing brackets/braces
            .replace(/,(\s*[}\]])/g, '$1')
            // Fix escaped quotes in content
            .replace(/\\"/g, '"')
            // Remove any stray backslashes before quotes
            .replace(/\\(?!")/g, '')
            // Fix double-escaped characters
            .replace(/\\\\"/g, '\\"')
            // Fix unescaped quotes inside strings (basic attempt)
            .replace(/:\s*"([^"]*)"([^",}\]]*)"([^",}\]]*)/g, ': "$1\\"$2\\"$3')
            // Clean up any extra spaces around JSON elements
            .trim();
            
        // Ensure it starts and ends with braces
        if (!cleaned.startsWith('{')) {
            const braceIndex = cleaned.indexOf('{');
            if (braceIndex > -1) {
                cleaned = cleaned.substring(braceIndex);
            }
        }
        
        return cleaned;
    }

    private aggressiveJSONCleanup(jsonText: string): string {
        // More aggressive cleanup for severely malformed JSON
        let cleaned = jsonText
            // Remove ALL invisible characters more aggressively
            .replace(/^\uFEFF/, '') // Remove BOM
            .replace(/[\u200B-\u200D\uFEFF]/g, '') // Remove zero-width spaces
            .replace(/[\u0000-\u001F\u007F-\u009F]/g, '') // Remove control characters
            .replace(/[\u2000-\u206F]/g, '') // Remove additional Unicode spaces
            .replace(/[\u2E00-\u2E7F]/g, ''); // Remove punctuation symbols
        
        // Try to fix common patterns that break JSON
        cleaned = cleaned
            // Remove trailing commas more aggressively
            .replace(/,\s*([}\]])/g, '$1')
            // Fix unescaped quotes in strings (simple heuristic)
            .replace(/([^\\])"([^"]*)"([^,:}\]]*)/g, '$1\\"$2\\"$3')
            // Remove any stray backslashes
            .replace(/\\(?!["\\/bfnrt])/g, '')
            // Fix malformed string endings
            .replace(/([^"])"\s*,?\s*$/gm, '$1",')
            // Remove any trailing content after final }
            .replace(/}\s*[^}]*$/, '}')
            // Remove any content before first {
            .replace(/^[^{]*/, '')
            // Ensure proper JSON structure
            .trim();
            
        // If it doesn't start/end with braces, try to extract the main object
        if (!cleaned.startsWith('{')) {
            const match = cleaned.match(/\{[\s\S]*\}/);
            if (match) {
                cleaned = match[0];
            }
        }
        
        return cleaned;
    }

    private parseMetadata(metadataText: string): any {
        console.log('[parseMetadata] Starting to parse metadata text:', metadataText);
        const metadata: any = {
            tags: [],
            topics: [],
            related: [],
            speakers: []
        };
        
        const lines = metadataText.split('\n');
        console.log('[parseMetadata] Split into lines:', lines);
        
        for (const line of lines) {
            const [key, value] = line.split(':').map(s => s.trim());
            console.log('[parseMetadata] Processing line - key:', key, 'value:', value);
            if (key && value) {
                switch (key.toLowerCase()) {
                    case 'speakers':
                        // Split by comma and clean up each speaker
                        metadata.speakers = value.split(',')
                            .map(s => s.trim())
                            .filter(s => s.length > 0 && s !== 'N/A')
                            .map(s => s.replace(/^\[|\]$/g, '').trim());
                        console.log('[parseMetadata] Processed speakers:', metadata.speakers);
                        break;
                    case 'key topics':
                        // Split by comma and clean up each topic
                        metadata.topics = value.split(',')
                            .map(t => t.trim())
                            .filter(t => t.length > 0)
                            .map(t => t.replace(/^\[|\]$/g, '').trim());
                        console.log('[parseMetadata] Processed topics:', metadata.topics);
                        break;
                    case 'tags':
                        // Split by comma and clean up each tag
                        metadata.tags = value.split(',')
                            .map(t => t.trim())
                            .filter(t => t.length > 0)
                            .map(t => t.replace(/^\[|\]$/g, '').trim());
                        console.log('[parseMetadata] Processed tags:', metadata.tags);
                        break;
                    case 'related concepts':
                        // Split by comma and clean up each concept
                        metadata.related = value.split(',')
                            .map(t => t.trim())
                            .filter(t => t.length > 0)
                            .map(t => t.replace(/^\[|\]$/g, '').trim());
                        console.log('[parseMetadata] Processed related concepts:', metadata.related);
                        break;
                }
            }
        }
        
        // Only add default tags if no tags were found
        if (metadata.tags.length === 0) {
            metadata.tags = ['#summary'];
        }
        
        console.log('[parseMetadata] Final metadata object:', metadata);
        return metadata;
    }

    private async createNoteWithSummary(summary: string, title: string, url: string, metadata?: any, fullResult?: any): Promise<TFile | null> {
        const fileName = this.sanitizeFileName(title + '.md');
        let folderPath = this.plugin.settings.mocFolder; // fallback to root MOC folder
        
        // MOC Analysis and Integration
        let mocPath: string | null = null;
        let hierarchyData: NoteHierarchyAnalysis | null = null;
        
        // Helper function to update MOC status
        const updateMOCStatus = (message: string) => {
            this.statusMessage.innerText = message;
        };
        
        if (this.plugin.settings.enableMOC && metadata) {
            try {
                // Use AI-generated hierarchy from the analysis result
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
                    
                    console.log('[CreateNote] Hierarchy detected:', `${hierarchyData.hierarchy.level1} > ${hierarchyData.hierarchy.level2}`);
                    
                    updateMOCStatus('Creating knowledge map structure...');
                    mocPath = await this.plugin.mocManager.ensureMOCExists(hierarchyData.hierarchy);
                    console.log('[CreateNote] MOC path:', mocPath);
                    
                    // Update folder path to place note in MOC hierarchy directory
                    folderPath = this.plugin.mocManager.getMostSpecificMOCDirectory(hierarchyData.hierarchy);
                    console.log('[CreateNote] Note will be saved in:', folderPath);
                    
                    updateMOCStatus('Knowledge map ready');
                } else {
                    console.log('[CreateNote] No AI hierarchy found, falling back to heuristic analysis...');
                    updateMOCStatus('Analyzing content for organization...');
                    hierarchyData = await this.plugin.hierarchyAnalyzer.analyzeContent(metadata, title, summary);
                    updateMOCStatus('Creating knowledge map...');
                    mocPath = await this.plugin.mocManager.ensureMOCExists(hierarchyData.hierarchy);
                    
                    // Update folder path to place note in MOC hierarchy directory
                    folderPath = this.plugin.mocManager.getMostSpecificMOCDirectory(hierarchyData.hierarchy);
                    console.log('[CreateNote] Note will be saved in:', folderPath);
                    
                    updateMOCStatus('Knowledge map ready');
                }
            } catch (error) {
                console.error('[CreateNote] MOC analysis failed:', error);
                updateMOCStatus('Knowledge organization failed, but note will be saved');
                new Notice('Note will be saved, but automatic organization failed. You can organize it manually later.');
                // Continue with note creation even if MOC fails
            }
        }
        
        // Create YAML frontmatter
        const frontmatter = {
            title: title,
            date: new Date().toISOString().split('T')[0],
            type: 'summary',
            source: {
                type: url.includes('youtube.com') ? 'youtube' : 'web',
                url: url
            },
            status: 'draft',
            created: new Date().toISOString(),
            modified: new Date().toISOString(),
            // Add MOC-related metadata if available
            ...(hierarchyData && {
                hierarchy: hierarchyData.hierarchy,
                moc: mocPath,
                learning_context: hierarchyData.learning_context
            })
        };

        // Format the content with YAML frontmatter and Obsidian-native features
        const fileContent = `---
${Object.entries(frontmatter)
    .map(([key, value]) => {
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            // Handle nested objects (like source, hierarchy, learning_context)
            return `${key}:\n${Object.entries(value)
                .map(([k, v]) => {
                    if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
                        // Handle deeply nested objects
                        return `  ${k}:\n${Object.entries(v)
                            .map(([dk, dv]) => `    ${dk}: ${JSON.stringify(dv)}`)
                            .join('\n')}`;
                    } else {
                        return `  ${k}: ${JSON.stringify(v)}`;
                    }
                })
                .join('\n')}`;
        } else {
            // Handle simple values and arrays
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

        console.log('[CreateNote] Creating note. Folder:', folderPath, 'File:', fileName);
        try {
            const folder = this.app.vault.getAbstractFileByPath(folderPath) as TFolder;
            if (!folder) {
                await this.app.vault.createFolder(folderPath);
                console.log('[CreateNote] Folder created:', folderPath);
            }
            const newFile = await this.app.vault.create(`${folderPath}/${fileName}`, fileContent);
            console.log('[CreateNote] Note created:', `${folderPath}/${fileName}`);
            
            // Update MOC with the new note
            if (mocPath && this.plugin.settings.enableMOC) {
                try {
                    updateMOCStatus('Adding note to knowledge map...');
                    console.log('[CreateNote] Adding note to MOC...');
                    await this.plugin.mocManager.updateMOC(mocPath, newFile.path, title, hierarchyData?.learning_context);
                    console.log('[CreateNote] Note successfully added to MOC');
                    updateMOCStatus('Note organized in knowledge map!');
                } catch (error) {
                    console.error('[CreateNote] Failed to update MOC:', error);
                    updateMOCStatus('Note saved (MOC update failed)');
                    // Don't fail note creation if MOC update fails
                }
            }
            
            return newFile;
        } catch (error) {
            new Notice('Error creating note.');
            console.error('[CreateNote] Error creating note:', error);
            return null;
        }
    }

    private sanitizeFileName(fileName: string): string {
        return fileName.replace(/[\\/:*?"<>|]/g, '_');
    }
}

// MOC Management Classes
class MOCManager {
    private app: App;
    private settings: PluginSettings;

    constructor(app: App, settings: PluginSettings) {
        this.app = app;
        this.settings = settings;
    }

    async createMOCTemplate(hierarchy: MOCHierarchy): Promise<string> {
        const timestamp = new Date().toISOString();
        const frontmatter = {
            type: 'moc',
            title: hierarchy.level2,
            domain: hierarchy.level1,
            created: timestamp,
            updated: timestamp,
            tags: ['moc', hierarchy.level1.toLowerCase().replace(/\s+/g, '-')],
            note_count: 0,
            learning_paths: []
        };

        const content = `---
${Object.entries(frontmatter)
    .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
    .join('\n')}
---

# ${hierarchy.level2}

> [!info] Knowledge Domain
> This MOC organizes content within the **${hierarchy.level1}** domain, specifically focusing on **${hierarchy.level2}**.

## Learning Paths
${hierarchy.level3 ? `- [[${hierarchy.level3} Learning Path]]` : ''}
${hierarchy.level4 ? `- [[${hierarchy.level4} Learning Path]]` : ''}

## Core Concepts
${hierarchy.level3 ? `- [[${hierarchy.level3}]]` : ''}
${hierarchy.level4 ? `- [[${hierarchy.level4}]]` : ''}

## Related Topics
<!-- Related topics will be added automatically as new notes are created -->

## Prerequisites
<!-- Prerequisites will be populated from note learning contexts -->

## Notes
<!-- Notes will be added automatically -->

---
*This MOC was automatically generated based on AI analysis and will be updated as new notes are added.*`;

        return content;
    }

    async createHierarchicalMOCTemplate(levelInfo: any, hierarchy: MOCHierarchy, allLevels: any[]): Promise<string> {
        const timestamp = new Date().toISOString();
        const isRootLevel = levelInfo.level === 1;
        const currentIndex = allLevels.findIndex(l => l.level === levelInfo.level);
        const parentLevel = currentIndex > 0 ? allLevels[currentIndex - 1] : null;
        const childLevels = allLevels.filter(l => l.level > levelInfo.level);

        const frontmatter = {
            type: 'moc',
            title: levelInfo.title,
            domain: hierarchy.level1,
            level: levelInfo.level,
            created: timestamp,
            updated: timestamp,
            tags: ['moc', hierarchy.level1.toLowerCase().replace(/\s+/g, '-'), `level-${levelInfo.level}`],
            note_count: 0,
            learning_paths: []
        };

        let navigationSection = '';
        
        // Add parent navigation (if not root level)
        if (parentLevel) {
            navigationSection += `## 🔼 Parent Level\n- [[${parentLevel.title}]] (${this.getLevelName(parentLevel.level)})\n\n`;
        }

        // Add child navigation (if has children)
        if (childLevels.length > 0) {
            navigationSection += `## 🔽 Sub-Levels\n`;
            childLevels.forEach(child => {
                navigationSection += `- [[${child.title}]] (${this.getLevelName(child.level)})\n`;
            });
            navigationSection += '\n';
        }

        // Add sibling navigation (same level, different branches)
        const siblingHint = levelInfo.level > 1 ? `\n## 🔄 Related ${this.getLevelName(levelInfo.level)}s\n<!-- Related ${this.getLevelName(levelInfo.level).toLowerCase()}s will be linked here automatically -->\n\n` : '';

        const content = `---
${Object.entries(frontmatter)
    .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
    .join('\n')}
---

# ${levelInfo.title}

> [!info] Knowledge ${this.getLevelName(levelInfo.level)}
> This MOC represents the **${levelInfo.title}** ${this.getLevelName(levelInfo.level).toLowerCase()} within the **${hierarchy.level1}** domain.
${levelInfo.level === 4 ? `> This is the most specific level for **${hierarchy.level4}** concepts.` : ''}

${navigationSection}${siblingHint}## Learning Paths
${this.generateLearningPaths(hierarchy, levelInfo.level)}

## Core Concepts
${this.generateCoreConcepts(hierarchy, levelInfo.level)}

## Related Topics
<!-- Related topics will be added automatically as new notes are created -->

## Prerequisites
<!-- Prerequisites will be populated from note learning contexts -->

## Notes
<!-- Notes will be added automatically to the most specific level -->

---
*This ${this.getLevelName(levelInfo.level)} MOC was automatically generated and will be updated as new content is added.*`;

        return content;
    }

    private getLevelName(level: number): string {
        switch (level) {
            case 1: return 'Domain';
            case 2: return 'Area';
            case 3: return 'Topic';
            case 4: return 'Concept';
            default: return 'Level';
        }
    }

    private generateLearningPaths(hierarchy: MOCHierarchy, currentLevel: number): string {
        const paths = [];
        if (hierarchy.level2) paths.push(`- [[${hierarchy.level2} Learning Path]]`);
        if (hierarchy.level3 && currentLevel <= 3) paths.push(`- [[${hierarchy.level3} Learning Path]]`);
        if (hierarchy.level4 && currentLevel <= 4) paths.push(`- [[${hierarchy.level4} Learning Path]]`);
        return paths.length > 0 ? paths.join('\n') : '<!-- Learning paths will be added as content grows -->';
    }

    private generateCoreConcepts(hierarchy: MOCHierarchy, currentLevel: number): string {
        const concepts = [];
        if (hierarchy.level2 && currentLevel <= 2) concepts.push(`- [[${hierarchy.level2}]]`);
        if (hierarchy.level3 && currentLevel <= 3) concepts.push(`- [[${hierarchy.level3}]]`);
        if (hierarchy.level4 && currentLevel <= 4) concepts.push(`- [[${hierarchy.level4}]]`);
        return concepts.length > 0 ? concepts.join('\n') : '<!-- Core concepts will be identified as content is added -->';
    }

    async getMOCPath(hierarchy: MOCHierarchy): Promise<string> {
        const mocFolder = this.settings.mocFolder || 'MOCs';
        const domainFolder = hierarchy.level1.replace(/[\\/:*?"<>|]/g, '_');
        const mocFileName = `${hierarchy.level2.replace(/[\\/:*?"<>|]/g, '_')}.md`;
        return `${mocFolder}/${domainFolder}/${mocFileName}`;
    }

    async ensureMOCExists(hierarchy: MOCHierarchy): Promise<string> {
        console.log('[MOCManager] Creating MOC structure for:', `${hierarchy.level1} > ${hierarchy.level2}`);
        
        // Create all MOC levels that exist in the hierarchy
        await this.createAllMOCLevels(hierarchy);
        
        // Return the path of the most specific MOC (where notes will be added)
        const mostSpecificPath = await this.getMostSpecificMOCPath(hierarchy);
        console.log('[MOCManager] Note will be added to:', mostSpecificPath);
        
        return mostSpecificPath;
    }

    private async createAllMOCLevels(hierarchy: MOCHierarchy): Promise<void> {
        // Validate and normalize hierarchy
        const normalizedHierarchy = this.normalizeHierarchy(hierarchy);
        console.log('[MOCManager] Normalized hierarchy:', normalizedHierarchy);

        // Check for existing similar MOCs before creating
        const existingMOCs = await this.findExistingMOCs(normalizedHierarchy);
        console.log('[MOCManager] Found existing MOCs:', existingMOCs);

        // Create directory structure based on hierarchy levels
        const mocStructure = this.createHierarchicalStructure(normalizedHierarchy);
        
        for (const levelInfo of mocStructure) {
            const existingMOC = existingMOCs.find(moc => 
                moc.level === levelInfo.level && 
                this.isSimilarContent(moc.title, levelInfo.title)
            );

            if (existingMOC) {
                console.log(`[MOCManager] Using existing MOC for level ${levelInfo.level}:`, existingMOC.path);
                levelInfo.path = existingMOC.path;
                levelInfo.isExisting = true;
            } else {
                await this.ensureSingleMOCExists(levelInfo, normalizedHierarchy, mocStructure);
            }
        }
    }

    private normalizeHierarchy(hierarchy: MOCHierarchy): MOCHierarchy {
        return {
            level1: this.normalizeTitle(hierarchy.level1),
            level2: this.normalizeTitle(hierarchy.level2),
            level3: hierarchy.level3 ? this.normalizeTitle(hierarchy.level3) : undefined,
            level4: hierarchy.level4 ? this.normalizeTitle(hierarchy.level4) : undefined
        };
    }

    private normalizeTitle(title: string): string {
        return title
            .trim()
            .replace(/[&]/g, 'and')  // & → and
            .replace(/[^\w\s-]/g, '') // Remove special chars except spaces and hyphens
            .replace(/\s+/g, ' ')     // Multiple spaces → single space
            .trim();
    }

    private createHierarchicalStructure(hierarchy: MOCHierarchy): any[] {
        const mocFolder = this.settings.mocFolder || 'MOCs';
        const levels = [];

        // Level 1: Domain (in root MOCs folder)
        levels.push({
            level: 1,
            title: hierarchy.level1,
            path: `${mocFolder}/00-${hierarchy.level1.replace(/[\\/:*?"<>|]/g, '_')} MOC.md`,
            directory: mocFolder
        });

        // Level 2: Area (in domain subfolder)
        const domainDir = `${mocFolder}/${hierarchy.level1.replace(/[\\/:*?"<>|]/g, '_')}`;
        levels.push({
            level: 2,
            title: hierarchy.level2,
            path: `${domainDir}/00-${hierarchy.level2.replace(/[\\/:*?"<>|]/g, '_')} MOC.md`,
            directory: domainDir
        });

        // Level 3: Topic (in area subfolder)
        if (hierarchy.level3) {
            const areaDir = `${domainDir}/${hierarchy.level2.replace(/[\\/:*?"<>|]/g, '_')}`;
            levels.push({
                level: 3,
                title: hierarchy.level3,
                path: `${areaDir}/00-${hierarchy.level3.replace(/[\\/:*?"<>|]/g, '_')} MOC.md`,
                directory: areaDir
            });
        }

        // Level 4: Concept (in topic subfolder)
        if (hierarchy.level4) {
            const topicDir = hierarchy.level3 
                ? `${domainDir}/${hierarchy.level2.replace(/[\\/:*?"<>|]/g, '_')}/${hierarchy.level3.replace(/[\\/:*?"<>|]/g, '_')}`
                : `${domainDir}/${hierarchy.level2.replace(/[\\/:*?"<>|]/g, '_')}`;
            levels.push({
                level: 4,
                title: hierarchy.level4,
                path: `${topicDir}/00-${hierarchy.level4.replace(/[\\/:*?"<>|]/g, '_')} MOC.md`,
                directory: topicDir
            });
        }

        return levels;
    }

    private async findExistingMOCs(hierarchy: MOCHierarchy): Promise<any[]> {
        const existingMOCs = [];
        const mocFolder = this.settings.mocFolder || 'MOCs';
        
        try {
            // Search for existing MOCs that might match our hierarchy
            const allFiles = this.app.vault.getMarkdownFiles();
            const mocFiles = allFiles.filter(file => file.path.startsWith(mocFolder));
            
            for (const file of mocFiles) {
                try {
                    const content = await this.app.vault.read(file);
                    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
                    
                    if (frontmatterMatch) {
                        const frontmatter = frontmatterMatch[1];
                        const typeMatch = frontmatter.match(/type:\s*"?moc"?/);
                        const levelMatch = frontmatter.match(/level:\s*(\d+)/);
                        const titleMatch = frontmatter.match(/title:\s*"([^"]+)"/);
                        
                        if (typeMatch && levelMatch && titleMatch) {
                            existingMOCs.push({
                                path: file.path,
                                level: parseInt(levelMatch[1]),
                                title: titleMatch[1],
                                file: file
                            });
                        }
                    }
                } catch (error) {
                    console.warn('[MOCManager] Could not read file:', file.path, error);
                }
            }
        } catch (error) {
            console.error('[MOCManager] Error finding existing MOCs:', error);
        }
        
        return existingMOCs;
    }

    private isSimilarContent(title1: string, title2: string): boolean {
        const normalize = (str: string) => str.toLowerCase()
            .replace(/[&]/g, 'and')
            .replace(/[^\w\s]/g, '')
            .replace(/\s+/g, ' ')
            .trim();
        
        const norm1 = normalize(title1);
        const norm2 = normalize(title2);
        
        // Exact match
        if (norm1 === norm2) return true;
        
        // Check if one contains the other (for variations)
        if (norm1.includes(norm2) || norm2.includes(norm1)) return true;
        
        // Check for similar words (simple similarity)
        const words1 = norm1.split(' ');
        const words2 = norm2.split(' ');
        const commonWords = words1.filter(word => words2.includes(word));
        
        // If more than 50% of words are common, consider similar
        return commonWords.length >= Math.min(words1.length, words2.length) * 0.5;
    }

    private async ensureSingleMOCExists(levelInfo: any, hierarchy: MOCHierarchy, allLevels: any[]): Promise<void> {
        // Skip if this is an existing MOC we're reusing
        if (levelInfo.isExisting) {
            return;
        }

        try {
            const existingFile = this.app.vault.getAbstractFileByPath(levelInfo.path);
            if (existingFile) {
                console.log('[MOCManager] MOC already exists:', levelInfo.path);
                return;
            }
        } catch (error) {
            // File doesn't exist, continue to create it
        }

        // Ensure directory structure exists
        try {
            const folder = this.app.vault.getAbstractFileByPath(levelInfo.directory);
            if (!folder) {
                await this.app.vault.createFolder(levelInfo.directory);
                console.log('[MOCManager] Created directory:', levelInfo.directory);
            }
        } catch (error) {
            console.error('[MOCManager] Error creating directory:', levelInfo.directory, error);
        }

        // Create MOC content with hierarchical navigation
        const mocContent = await this.createHierarchicalMOCTemplate(levelInfo, hierarchy, allLevels);
        try {
            await this.app.vault.create(levelInfo.path, mocContent);
            console.log('[MOCManager] Created new MOC:', levelInfo.path);
        } catch (error) {
            console.error('[MOCManager] Error creating MOC file:', levelInfo.path, error);
        }
    }

    private async getMostSpecificMOCPath(hierarchy: MOCHierarchy): Promise<string> {
        // Use the same hierarchical structure logic as createHierarchicalStructure
        const mocStructure = this.createHierarchicalStructure(hierarchy);
        
        // Return the path of the most specific level (highest level number)
        const mostSpecific = mocStructure[mocStructure.length - 1];
        console.log('[MOCManager] Most specific MOC path:', mostSpecific.path);
        
        return mostSpecific.path;
    }

    getMostSpecificMOCDirectory(hierarchy: MOCHierarchy): string {
        // Use the same hierarchical structure logic as createHierarchicalStructure
        const mocStructure = this.createHierarchicalStructure(hierarchy);
        
        // Return the directory of the most specific level (for note placement)
        const mostSpecific = mocStructure[mocStructure.length - 1];
        console.log('[MOCManager] Most specific MOC directory for notes:', mostSpecific.directory);
        
        return mostSpecific.directory;
    }

    async updateMOC(mocPath: string, notePath: string, noteTitle: string, learningContext?: LearningContext): Promise<void> {
        console.log('[MOCManager] Adding note to MOC:', noteTitle);
        
        try {
            const mocFile = this.app.vault.getAbstractFileByPath(mocPath) as TFile;
            if (!mocFile) {
                console.error('[MOCManager] MOC file not found:', mocPath);
                return;
            }
            
            const content = await this.app.vault.read(mocFile);
            
            // Parse frontmatter to update note count
            const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
            let updatedContent = content;
            
            if (frontmatterMatch) {
                const frontmatterText = frontmatterMatch[1];
                const noteCountMatch = frontmatterText.match(/note_count:\s*(\d+)/);
                const currentCount = noteCountMatch ? parseInt(noteCountMatch[1]) : 0;
                const newCount = currentCount + 1;
                
                // Update note count and timestamp
                updatedContent = content.replace(
                    /note_count:\s*\d+/,
                    `note_count: ${newCount}`
                ).replace(
                    /updated:\s*"[^"]*"/,
                    `updated: "${new Date().toISOString()}"`
                );
            }

            // Add note to the Notes section - use actual filename for link
            const noteFileName = this.extractFileNameForLink(notePath);
            const noteLink = `- [[${noteFileName}]]${learningContext ? ` (${learningContext.complexity_level})` : ''}`;
            
            const notesSection = updatedContent.match(/## Notes\n([\s\S]*?)(?=\n##|\n---|\n\*|$)/);
            console.log('[MOCManager] Found Notes section:', !!notesSection);
            
            if (notesSection) {
                const duplicateCheck = updatedContent.includes(`[[${noteFileName}]]`);
                
                if (!duplicateCheck) {
                    const existingNotes = notesSection[1].trim();
                    const newNotesSection = existingNotes 
                        ? `${existingNotes}\n${noteLink}`
                        : noteLink;
                    
                    updatedContent = updatedContent.replace(
                        /## Notes\n[\s\S]*?(?=\n##|\n---|\n\*|$)/,
                        `## Notes\n${newNotesSection}\n`
                    );
                    
                    console.log('[MOCManager] Added note to MOC');
                } else {
                    console.log('[MOCManager] Note already exists in MOC');
                }
            } else {
                console.warn('[MOCManager] No ## Notes section found in MOC');
            }

            // Update Prerequisites section if learning context is available
            if (learningContext && learningContext.prerequisites.length > 0) {
                const prerequisitesSection = updatedContent.match(/## Prerequisites\n([\s\S]*?)(?=\n##|\n---|\n\*|$)/);
                if (prerequisitesSection) {
                    const existingPrereqs = prerequisitesSection[1].replace(/<!--[\s\S]*?-->/g, '').trim();
                    const newPrereqs = learningContext.prerequisites.map(p => `- [[${p}]]`).join('\n');
                    
                    // Merge prerequisites without duplicates
                    const allPrereqs = new Set([
                        ...existingPrereqs.split('\n').filter(line => line.trim() && !line.includes('<!--')),
                        ...newPrereqs.split('\n')
                    ]);
                    
                    const mergedPrereqs = Array.from(allPrereqs).join('\n');
                    
                    updatedContent = updatedContent.replace(
                        /## Prerequisites\n[\s\S]*?(?=\n##|\n---|\n\*|$)/,
                        `## Prerequisites\n${mergedPrereqs}\n`
                    );
                }
            }

            await this.app.vault.modify(mocFile, updatedContent);
            console.log('[MOCManager] MOC updated successfully');
        } catch (error) {
            console.error('[MOCManager] Error updating MOC:', error);
        }
    }

    private extractFileNameForLink(notePath: string): string {
        // Extract filename from path and remove .md extension for wiki links
        // e.g., "Summaries/My Note Title.md" → "My Note Title"
        const pathParts = notePath.split('/');
        const fileName = pathParts[pathParts.length - 1];
        
        // Remove .md extension
        const fileNameWithoutExtension = fileName.replace(/\.md$/, '');
        
        console.log('[MOCManager] Extracted filename for link:', fileNameWithoutExtension);
        return fileNameWithoutExtension;
    }
}

class HierarchyAnalyzer {
    async analyzeContent(metadata: any, title: string, content: string): Promise<NoteHierarchyAnalysis> {
        // Extract knowledge domain and hierarchy from metadata and content
        const topics = metadata.topics || [];
        const tags = metadata.tags || [];
        
        // Simple heuristic-based analysis
        let level1 = 'General Knowledge';
        let level2 = 'Miscellaneous';
        
        // Try to determine domain from topics and tags
        if (topics.length > 0) {
            const topic = topics[0];
            
            // Simple domain mapping - can be enhanced with AI later
            if (this.isComputerScience(topic, title, content)) {
                level1 = 'Computer Science';
                level2 = this.determineCSSubdomain(topic, title, content);
            } else if (this.isScience(topic, title, content)) {
                level1 = 'Science';
                level2 = this.determineScienceSubdomain(topic, title, content);
            } else if (this.isBusiness(topic, title, content)) {
                level1 = 'Business';
                level2 = this.determineBusinessSubdomain(topic, title, content);
            } else {
                level1 = 'General Knowledge';
                level2 = topic;
            }
        }

        const hierarchy: MOCHierarchy = {
            level1,
            level2,
            level3: topics[1] || undefined,
            level4: topics[2] || undefined
        };

        const learningContext: LearningContext = {
            prerequisites: metadata.related || [],
            related_concepts: metadata.related || [],
            learning_path: [level2],
            complexity_level: this.determineComplexity(content)
        };

        return {
            hierarchy,
            learning_context: learningContext,
            moc_placement: {
                primary_moc: `${level1}/${level2}`
            }
        };
    }

    private isComputerScience(topic: string, title: string, content: string): boolean {
        const csKeywords = ['programming', 'software', 'algorithm', 'computer', 'coding', 'development', 'tech', 'ai', 'machine learning', 'data science'];
        const text = `${topic} ${title} ${content}`.toLowerCase();
        return csKeywords.some(keyword => text.includes(keyword));
    }

    private isScience(topic: string, title: string, content: string): boolean {
        const scienceKeywords = ['research', 'study', 'experiment', 'theory', 'physics', 'chemistry', 'biology', 'mathematics'];
        const text = `${topic} ${title} ${content}`.toLowerCase();
        return scienceKeywords.some(keyword => text.includes(keyword));
    }

    private isBusiness(topic: string, title: string, content: string): boolean {
        const businessKeywords = ['business', 'management', 'marketing', 'finance', 'strategy', 'leadership', 'entrepreneurship'];
        const text = `${topic} ${title} ${content}`.toLowerCase();
        return businessKeywords.some(keyword => text.includes(keyword));
    }

    private determineCSSubdomain(topic: string, title: string, content: string): string {
        const text = `${topic} ${title} ${content}`.toLowerCase();
        if (text.includes('ai') || text.includes('machine learning') || text.includes('neural')) return 'Artificial Intelligence';
        if (text.includes('web') || text.includes('frontend') || text.includes('backend')) return 'Web Development';
        if (text.includes('data') || text.includes('analytics')) return 'Data Science';
        if (text.includes('mobile') || text.includes('app')) return 'Mobile Development';
        return 'Programming';
    }

    private determineScienceSubdomain(topic: string, title: string, content: string): string {
        const text = `${topic} ${title} ${content}`.toLowerCase();
        if (text.includes('physics')) return 'Physics';
        if (text.includes('chemistry')) return 'Chemistry';
        if (text.includes('biology')) return 'Biology';
        if (text.includes('math')) return 'Mathematics';
        return 'General Science';
    }

    private determineBusinessSubdomain(topic: string, title: string, content: string): string {
        const text = `${topic} ${title} ${content}`.toLowerCase();
        if (text.includes('marketing')) return 'Marketing';
        if (text.includes('finance')) return 'Finance';
        if (text.includes('leadership') || text.includes('management')) return 'Management';
        if (text.includes('entrepreneur')) return 'Entrepreneurship';
        return 'Business Strategy';
    }

    private determineComplexity(content: string): 'beginner' | 'intermediate' | 'advanced' {
        const wordCount = content.split(' ').length;
        if (wordCount < 500) return 'beginner';
        if (wordCount < 1500) return 'intermediate';
        return 'advanced';
    }
}

class AISummarizerPlugin extends Plugin {
    settings: PluginSettings;
    firstRun: boolean = true;
    mocManager: MOCManager;
    hierarchyAnalyzer: HierarchyAnalyzer;

    async onload() {
        await this.loadSettings();

        // Initialize MOC components
        this.mocManager = new MOCManager(this.app, this.settings);
        this.hierarchyAnalyzer = new HierarchyAnalyzer();

        // Check for migration from old structure
        await this.checkForMigrationNeeds();

        // Check if any API key is set
        if (!this.settings.gemini.apiKey && !this.settings.openrouter.apiKey) {
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

    private async checkForMigrationNeeds(): Promise<void> {
        try {
            // Check if there's a legacy "Summaries" folder with notes
            const summariesFolder = this.app.vault.getAbstractFileByPath('Summaries');
            if (summariesFolder) {
                const summaryFiles = this.app.vault.getMarkdownFiles().filter(file => 
                    file.path.startsWith('Summaries/')
                );
                
                if (summaryFiles.length > 0) {
                    console.log(`[Migration] Found ${summaryFiles.length} notes in legacy Summaries folder`);
                    
                    // Show migration notice
                    new Notice(
                        `Found ${summaryFiles.length} notes in the old "Summaries" folder. ` +
                        'New notes will now be organized within the knowledge hierarchy. ' +
                        'Your existing notes remain accessible.',
                        10000
                    );
                }
            }
        } catch (error) {
            console.warn('[Migration] Migration check failed:', error);
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
}

class SettingModal extends Modal {
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
                .addOption('openrouter', 'OpenRouter')
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
        } else if (this.settings.provider === 'openrouter') {
            new Setting(contentEl)
                .setName('OpenRouter API Key')
                .setDesc('Your OpenRouter API key')
                .addText(text => text
                    .setPlaceholder('Enter your API key')
                    .setValue(this.settings.openrouter.apiKey)
                    .onChange(value => {
                        this.settings.openrouter.apiKey = value;
                    }));

            new Setting(contentEl)
                .setName('OpenRouter Model')
                .setDesc('Select the model to use via OpenRouter')
                .addDropdown(dropdown => {
                    this.settings.openrouter.models.forEach((model: OpenRouterModel) => {
                        dropdown.addOption(model.id, `${model.name} (${model.provider}) - ${model.description}`);
                    });
                    return dropdown
                        .setValue(this.settings.openrouter.model)
                        .onChange(value => {
                            this.settings.openrouter.model = value;
                        });
                });

            new Setting(contentEl)
                .setName('OpenRouter Endpoint')
                .setDesc('The OpenRouter API endpoint')
                .addText(text => text
                    .setPlaceholder('Enter endpoint URL')
                    .setValue(this.settings.openrouter.endpoint)
                    .onChange(value => {
                        this.settings.openrouter.endpoint = value;
                    }));
        }

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

    onClose() {
        let { contentEl } = this;
        contentEl.empty();
    }

    populateModelDropdown() {
        this.onOpen();
    }
}

export default AISummarizerPlugin;