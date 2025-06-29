import { Plugin, WorkspaceLeaf, ItemView, Notice, TFolder, Setting, PluginSettingTab, App, TFile, Modal } from 'obsidian';
import { GoogleGenerativeAI, GenerateContentRequest } from '@google/generative-ai';
// import { exec } from 'child_process'; // No longer using exec for transcript fetching
import { promisify } from 'util';
import * as path from 'path';
import { AISummarizerSettingsTab } from './settings';
import { DEFAULT_SUMMARIZATION_PROMPT, HIERARCHY_ANALYSIS_PROMPT, ENHANCED_SUMMARIZATION_PROMPT } from './prompts';
import { HierarchyManager } from './hierarchy-manager';

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
    analysisPrompts: {
        structure: string;
        content: string;
        perspectives: string;
        connections: string;
        learning: string;
    };
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
    defaultPrompt: DEFAULT_SUMMARIZATION_PROMPT,
    mocFolder: 'MOCs',
    enableMOC: true,
    analysisPrompts: {
        structure: `You are an expert knowledge organizer. Analyze this content and return comprehensive structure and metadata.

EXISTING KNOWLEDGE HIERARCHY:
{HIERARCHY_CONTEXT}

INSTRUCTIONS:
1. Create an optimal title that captures the essence
2. Determine the best hierarchy placement (avoid duplicates, use existing when appropriate)
3. Extract comprehensive metadata (speakers, topics, key concepts, tags)
4. Assess learning context (prerequisites, complexity, reading time)
5. Provide a concise overview (2-3 sentences)

{ADDITIONAL_INSTRUCTIONS}

Content to analyze:
{CONTENT}

Return ONLY valid JSON:
{
  "title": "Comprehensive title",
  "hierarchy": {
    "level1": "Domain",
    "level2": "Area", 
    "level3": "Topic",
    "level4": "Concept"
  },
  "metadata": {
    "speakers": ["speaker1", "speaker2"],
    "topics": ["topic1", "topic2"],
    "key_concepts": ["concept1", "concept2"],
    "tags": ["#tag1", "#tag2"],
    "related": ["related1", "related2"]
  },
  "learning_context": {
    "prerequisites": ["prereq1", "prereq2"],
    "related_concepts": ["concept1", "concept2"],
    "learning_path": ["step1", "step2"],
    "complexity_level": "beginner|intermediate|advanced",
    "estimated_reading_time": "X minutes"
  },
  "overview": "Brief 2-3 sentence overview of the content"
}`,
        content: `You are an expert content analyst. Provide deep, comprehensive analysis of this content.

CONTENT CONTEXT:
Title: {TITLE}
Domain: {DOMAIN}
Topic: {TOPIC}

INSTRUCTIONS:
Create comprehensive analysis sections. Be thorough and detailed - there are no length limits.

{ADDITIONAL_INSTRUCTIONS}

Content to analyze:
{CONTENT}

Return ONLY valid JSON:
{
  "context": "Detailed background and why this matters (200+ words)",
  "key_facts": [
    "Fact 1 with detailed explanation",
    "Fact 2 with detailed explanation",
    "Fact 3 with detailed explanation"
  ],
  "deep_insights": [
    "Insight 1: Deep analysis of patterns, implications, connections",
    "Insight 2: Another profound insight with reasoning",
    "Insight 3: Third insight connecting to broader themes"
  ],
  "core_concepts": [
    "Concept 1: Detailed explanation and significance", 
    "Concept 2: Another key concept with context",
    "Concept 3: Third important concept"
  ],
  "detailed_summary": "Comprehensive 300+ word summary covering all major points"
}`,
        perspectives: `You are an expert at analyzing multiple viewpoints and creating practical examples.

CONTENT CONTEXT:
Title: {TITLE}
Overview: {OVERVIEW}

INSTRUCTIONS:
Analyze different perspectives and create rich examples. Be comprehensive and detailed.

{ADDITIONAL_INSTRUCTIONS}

Content to analyze:
{CONTENT}

Return ONLY valid JSON:
{
  "multiple_perspectives": [
    {
      "viewpoint": "Academic/Research Perspective",
      "analysis": "Detailed analysis from this viewpoint (100+ words)"
    },
    {
      "viewpoint": "Industry/Practical Perspective", 
      "analysis": "Detailed analysis from this viewpoint (100+ words)"
    },
    {
      "viewpoint": "Critical/Skeptical Perspective",
      "analysis": "Detailed analysis from this viewpoint (100+ words)"
    }
  ],
  "analogies_examples": [
    {
      "concept": "Key concept being explained",
      "analogy": "Detailed analogy with clear explanation",
      "real_world_example": "Concrete real-world example with context"
    },
    {
      "concept": "Another key concept",
      "analogy": "Another detailed analogy",
      "real_world_example": "Another concrete example"
    }
  ],
  "case_studies": [
    "Detailed case study 1 showing practical application",
    "Detailed case study 2 with different context",
    "Detailed case study 3 highlighting challenges"
  ]
}`,
        connections: `You are an expert at finding connections and practical applications.

CONTENT CONTEXT:
Title: {TITLE}
Domain: {DOMAIN}
Key Concepts: {KEY_CONCEPTS}

INSTRUCTIONS:
Find deep connections and practical applications. Be thorough and specific.

{ADDITIONAL_INSTRUCTIONS}

Content to analyze:
{CONTENT}

Return ONLY valid JSON:
{
  "knowledge_connections": [
    {
      "related_field": "Connected field/domain",
      "connection_type": "How they connect",
      "detailed_explanation": "Deep explanation of the connection (100+ words)"
    },
    {
      "related_field": "Another connected field",
      "connection_type": "Type of connection",
      "detailed_explanation": "Another detailed explanation"
    }
  ],
  "practical_applications": [
    {
      "domain": "Application domain",
      "application": "Specific application",
      "implementation": "How to implement/use this (100+ words)",
      "benefits": "Expected benefits and outcomes"
    },
    {
      "domain": "Another domain",
      "application": "Another application", 
      "implementation": "Implementation details",
      "benefits": "Benefits and outcomes"
    }
  ],
  "implications_consequences": [
    "Long-term implication 1 with detailed reasoning",
    "Long-term implication 2 with analysis",
    "Potential unintended consequence with explanation"
  ]
}`,
        learning: `You are an expert learning designer and action planner.

CONTENT CONTEXT:
Title: {TITLE}
Complexity: {COMPLEXITY}
Prerequisites: {PREREQUISITES}

INSTRUCTIONS:
Create comprehensive learning paths and actionable next steps.

{ADDITIONAL_INSTRUCTIONS}

Content to analyze:
{CONTENT}

Return ONLY valid JSON:
{
  "knowledge_gaps": [
    "Specific gap 1 with explanation of why it matters",
    "Specific gap 2 with learning strategy",
    "Specific gap 3 with resources needed"
  ],
  "learning_pathways": [
    {
      "pathway_name": "Beginner Path",
      "steps": [
        "Step 1: Detailed description and resources",
        "Step 2: Next step with specific actions",
        "Step 3: Advanced step with outcomes"
      ],
      "estimated_time": "Time estimate",
      "difficulty": "difficulty level"
    },
    {
      "pathway_name": "Advanced Path",
      "steps": [
        "Advanced step 1 with details",
        "Advanced step 2 with specifics",
        "Advanced step 3 with outcomes"
      ],
      "estimated_time": "Time estimate", 
      "difficulty": "difficulty level"
    }
  ],
  "actionable_next_steps": [
    {
      "category": "Immediate Actions",
      "actions": [
        "Specific action 1 with clear instructions",
        "Specific action 2 with expected outcomes",
        "Specific action 3 with timeline"
      ]
    },
    {
      "category": "Medium-term Goals",
      "actions": [
        "Goal 1 with strategy and metrics",
        "Goal 2 with approach and timeline",
        "Goal 3 with resources needed"
      ]
    }
  ],
  "reflection_questions": [
    "Deep question 1 to promote critical thinking",
    "Deep question 2 to connect to personal experience", 
    "Deep question 3 to explore implications"
  ]
}`
    }
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

        // Additional Instructions - Simple text input
        const instructionsLabel = formContainer.createEl('label', { text: 'Additional Instructions (Optional)', cls: 'ai-summarizer-instructions-label' });
        instructionsLabel.style.display = 'block';
        instructionsLabel.style.marginBottom = '4px';
        instructionsLabel.style.fontSize = '0.9em';
        instructionsLabel.style.fontWeight = '500';

        this.promptInput = formContainer.createEl('textarea', { placeholder: 'Add specific focus areas, perspectives, or instructions to customize the analysis...' }) as HTMLTextAreaElement;
        this.promptInput.value = ''; // Start empty, no confusing default prompt
        this.promptInput.setAttribute('aria-label', 'Additional instructions input');
        this.promptInput.rows = 3;
        this.promptInput.style.marginBottom = '12px';
        this.promptInput.style.width = '100%';
        this.promptInput.style.resize = 'vertical';
        this.promptInput.style.fontSize = '14px';

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
        
        // Get existing MOC structure for context-aware analysis
        const mocContext = await this.plugin.hierarchyManager.getHierarchyContextForAI();
        
        // Use the improved hierarchy analysis prompt with existing MOC context
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
        console.log('[SummarizeContent] 🚀 Starting comprehensive multi-pass analysis...');
        
        // Get existing hierarchy context for AI awareness
        const hierarchyContext = await this.plugin.hierarchyManager.getHierarchyContextForAI();
        console.log('[SummarizeContent] Hierarchy context length:', hierarchyContext.length);
        
        try {
            // Multi-pass comprehensive analysis
            const comprehensiveResult = await this.generateComprehensiveNote(text, prompt, url, hierarchyContext);
            
            return {
                summary: this.formatComprehensiveNote(comprehensiveResult),
                title: comprehensiveResult.title,
                metadata: comprehensiveResult.metadata,
                hierarchy: comprehensiveResult.hierarchy,
                learning_context: comprehensiveResult.learning_context
            };
        } catch (error) {
            console.error('[SummarizeContent] Multi-pass analysis failed:', error);
            // Fallback to single-pass for error recovery
            return await this.fallbackSinglePassAnalysis(text, prompt, url, hierarchyContext);
        }
    }

    private async generateComprehensiveNote(text: string, prompt: string, url: string, hierarchyContext: string): Promise<any> {
        console.log('[GenerateComprehensiveNote] 🎯 Starting multi-pass comprehensive analysis');
        
        // Get additional instructions from the UI
        const additionalInstructions = this.promptInput.value;
        console.log('[GenerateComprehensiveNote] 📝 Additional instructions from UI:', additionalInstructions || '(empty)');
        
        // Pass 1: Structure & Metadata (Essential Foundation)
        console.log('[GenerateComprehensiveNote] 📋 Pass 1: Analyzing structure and metadata...');
        const structure = await this.analyzeStructureAndMetadata(text, hierarchyContext, additionalInstructions);
        
        // Pass 2: Deep Content Analysis (Core Knowledge)
        console.log('[GenerateComprehensiveNote] 🧠 Pass 2: Deep content analysis...');
        const coreAnalysis = await this.analyzeContentDepth(text, structure, additionalInstructions);
        
        // Pass 3: Perspectives & Examples (Multiple Viewpoints)
        console.log('[GenerateComprehensiveNote] 👁️ Pass 3: Multiple perspectives and examples...');
        const perspectives = await this.analyzePerspectivesAndExamples(text, structure, additionalInstructions);
        
        // Pass 4: Connections & Applications (Knowledge Integration)
        console.log('[GenerateComprehensiveNote] 🔗 Pass 4: Connections and applications...');
        const connections = await this.analyzeConnectionsAndApplications(text, structure, additionalInstructions);
        
        // Pass 5: Learning & Next Steps (Actionable Knowledge)
        console.log('[GenerateComprehensiveNote] 🎯 Pass 5: Learning paths and next steps...');
        const learning = await this.analyzeLearningAndNextSteps(text, structure, additionalInstructions);
        
        // Merge all passes into comprehensive result
        const comprehensiveResult = this.mergeMultiPassResults(structure, coreAnalysis, perspectives, connections, learning);
        console.log('[GenerateComprehensiveNote] ✅ Multi-pass analysis complete - comprehensive note generated');
        
        return comprehensiveResult;
    }

    private injectAdditionalInstructions(basePrompt: string, additionalInstructions: string, context: any = {}): string {
        let processedPrompt = basePrompt;
        
        // Debug logging
        console.log('[PromptInjection] 🔧 Processing additional instructions...');
        console.log('[PromptInjection] Instructions provided:', additionalInstructions || '(none)');
        
        // Replace placeholders with context values
        processedPrompt = processedPrompt.replace('{HIERARCHY_CONTEXT}', context.hierarchyContext || '');
        processedPrompt = processedPrompt.replace('{CONTENT}', context.content || '{CONTENT}');
        processedPrompt = processedPrompt.replace('{TITLE}', context.title || 'Unknown');
        processedPrompt = processedPrompt.replace('{DOMAIN}', context.domain || 'General');
        processedPrompt = processedPrompt.replace('{TOPIC}', context.topic || 'Miscellaneous');
        processedPrompt = processedPrompt.replace('{OVERVIEW}', context.overview || 'No overview available');
        processedPrompt = processedPrompt.replace('{KEY_CONCEPTS}', context.keyConcepts || 'None identified');
        processedPrompt = processedPrompt.replace('{COMPLEXITY}', context.complexity || 'intermediate');
        processedPrompt = processedPrompt.replace('{PREREQUISITES}', context.prerequisites || 'None specified');
        
        // Inject additional instructions
        if (additionalInstructions && additionalInstructions.trim()) {
            const additionalSection = `\nADDITIONAL FOCUS:\n${additionalInstructions.trim()}\n`;
            processedPrompt = processedPrompt.replace('{ADDITIONAL_INSTRUCTIONS}', additionalSection);
            console.log('[PromptInjection] ✅ Additional instructions injected:', additionalInstructions.trim());
        } else {
            processedPrompt = processedPrompt.replace('{ADDITIONAL_INSTRUCTIONS}', '');
            console.log('[PromptInjection] ℹ️ No additional instructions provided');
        }
        
        return processedPrompt;
    }

    private async analyzeStructureAndMetadata(text: string, hierarchyContext: string, additionalInstructions: string = ''): Promise<any> {
        const basePrompt = this.plugin.settings.analysisPrompts.structure;
        const context = {
            hierarchyContext,
            content: text.substring(0, 6000)
        };
        const structurePrompt = this.injectAdditionalInstructions(basePrompt, additionalInstructions, context);

        return await this.makeAIRequest(structurePrompt);
    }

    private async analyzeContentDepth(text: string, structure: any, additionalInstructions: string = ''): Promise<any> {
        const basePrompt = this.plugin.settings.analysisPrompts.content;
        const context = {
            content: text,
            title: structure.title || 'Unknown',
            domain: structure.hierarchy?.level1 || 'General',
            topic: structure.hierarchy?.level2 || 'Miscellaneous'
        };
        const depthPrompt = this.injectAdditionalInstructions(basePrompt, additionalInstructions, context);

        return await this.makeAIRequest(depthPrompt);
    }

    private async analyzePerspectivesAndExamples(text: string, structure: any, additionalInstructions: string = ''): Promise<any> {
        const basePrompt = this.plugin.settings.analysisPrompts.perspectives;
        const context = {
            content: text,
            title: structure.title || 'Unknown',
            overview: structure.overview || 'No overview available'
        };
        const perspectivesPrompt = this.injectAdditionalInstructions(basePrompt, additionalInstructions, context);

        return await this.makeAIRequest(perspectivesPrompt);
    }

    private async analyzeConnectionsAndApplications(text: string, structure: any, additionalInstructions: string = ''): Promise<any> {
        const basePrompt = this.plugin.settings.analysisPrompts.connections;
        const context = {
            content: text,
            title: structure.title || 'Unknown',
            domain: structure.hierarchy?.level1 || 'General',
            keyConcepts: structure.metadata?.key_concepts?.join(', ') || 'None identified'
        };
        const connectionsPrompt = this.injectAdditionalInstructions(basePrompt, additionalInstructions, context);

        return await this.makeAIRequest(connectionsPrompt);
    }

    private async analyzeLearningAndNextSteps(text: string, structure: any, additionalInstructions: string = ''): Promise<any> {
        const basePrompt = this.plugin.settings.analysisPrompts.learning;
        const context = {
            content: text,
            title: structure.title || 'Unknown',
            complexity: structure.learning_context?.complexity_level || 'intermediate',
            prerequisites: structure.learning_context?.prerequisites?.join(', ') || 'None specified'
        };
        const learningPrompt = this.injectAdditionalInstructions(basePrompt, additionalInstructions, context);

        return await this.makeAIRequest(learningPrompt);
    }

    private async makeAIRequest(prompt: string): Promise<any> {
        if (this.plugin.settings.provider === 'gemini') {
            const selectedModel = this.modelDropdown?.value || this.plugin.settings.gemini.model;
            const model = this.geminiClient!.getGenerativeModel({ model: selectedModel });
            
            const result = await model.generateContent(prompt);
            const responseText = result.response.text();
            
            // Extract JSON from markdown blocks
            const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
            const jsonText = jsonMatch ? jsonMatch[1].trim() : responseText.trim();
            
            return JSON.parse(jsonText);
        } else if (this.plugin.settings.provider === 'openrouter') {
            const selectedModel = this.modelDropdown?.value || this.plugin.settings.openrouter.model;
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
                        { role: 'system', content: 'You are a helpful AI assistant that creates detailed analysis in JSON format.' },
                        { role: 'user', content: prompt }
                    ],
                    temperature: 0.7,
                    max_tokens: 8000,
                    response_format: { type: "json_object" }
                })
            });
            
            const data = await response.json();
            return JSON.parse(data.choices[0].message.content);
        }
        
        throw new Error('No valid AI provider configured');
    }

    private mergeMultiPassResults(structure: any, coreAnalysis: any, perspectives: any, connections: any, learning: any): any {
        return {
            title: structure.title,
            metadata: structure.metadata,
            hierarchy: structure.hierarchy, 
            learning_context: structure.learning_context,
            overview: structure.overview,
            
            // Core content
            context: coreAnalysis.context,
            detailed_summary: coreAnalysis.detailed_summary,
            key_facts: coreAnalysis.key_facts,
            deep_insights: coreAnalysis.deep_insights,
            core_concepts: coreAnalysis.core_concepts,
            
            // Perspectives and examples
            multiple_perspectives: perspectives.multiple_perspectives,
            analogies_examples: perspectives.analogies_examples,
            case_studies: perspectives.case_studies,
            
            // Connections and applications
            knowledge_connections: connections.knowledge_connections,
            practical_applications: connections.practical_applications,
            implications_consequences: connections.implications_consequences,
            
            // Learning and action
            knowledge_gaps: learning.knowledge_gaps,
            learning_pathways: learning.learning_pathways,
            actionable_next_steps: learning.actionable_next_steps,
            reflection_questions: learning.reflection_questions
        };
    }

    private formatComprehensiveNote(result: any): string {
        let content = `# ${result.title}\n\n`;
        
        // Overview
        if (result.overview) {
            content += `## Overview\n${result.overview}\n\n`;
        }
        
        // Context
        if (result.context) {
            content += `## Context & Background\n${result.context}\n\n`;
        }
        
        // Detailed Summary
        if (result.detailed_summary) {
            content += `## Comprehensive Summary\n${result.detailed_summary}\n\n`;
        }
        
        // Key Facts
        if (result.key_facts?.length) {
            content += `## Key Facts\n`;
            result.key_facts.forEach((fact: string) => {
                content += `- ${fact}\n`;
            });
            content += '\n';
        }
        
        // Deep Insights
        if (result.deep_insights?.length) {
            content += `## Deep Insights\n`;
            result.deep_insights.forEach((insight: string, index: number) => {
                content += `### ${index + 1}. ${insight.split(':')[0]}\n${insight}\n\n`;
            });
        }
        
        // Core Concepts
        if (result.core_concepts?.length) {
            content += `## Core Concepts\n`;
            result.core_concepts.forEach((concept: string) => {
                content += `### ${concept.split(':')[0]}\n${concept}\n\n`;
            });
        }
        
        // Multiple Perspectives
        if (result.multiple_perspectives?.length) {
            content += `## Multiple Perspectives\n`;
            result.multiple_perspectives.forEach((perspective: any) => {
                content += `### ${perspective.viewpoint}\n${perspective.analysis}\n\n`;
            });
        }
        
        // Analogies and Examples
        if (result.analogies_examples?.length) {
            content += `## Analogies & Examples\n`;
            result.analogies_examples.forEach((example: any) => {
                content += `### ${example.concept}\n**Analogy**: ${example.analogy}\n\n**Real-World Example**: ${example.real_world_example}\n\n`;
            });
        }
        
        // Case Studies
        if (result.case_studies?.length) {
            content += `## Case Studies\n`;
            result.case_studies.forEach((study: string, index: number) => {
                content += `### Case Study ${index + 1}\n${study}\n\n`;
            });
        }
        
        // Knowledge Connections
        if (result.knowledge_connections?.length) {
            content += `## Knowledge Connections\n`;
            result.knowledge_connections.forEach((connection: any) => {
                content += `### ${connection.related_field}\n**Connection Type**: ${connection.connection_type}\n\n${connection.detailed_explanation}\n\n`;
            });
        }
        
        // Practical Applications
        if (result.practical_applications?.length) {
            content += `## Practical Applications\n`;
            result.practical_applications.forEach((application: any) => {
                content += `### ${application.domain}: ${application.application}\n**Implementation**: ${application.implementation}\n\n**Benefits**: ${application.benefits}\n\n`;
            });
        }
        
        // Implications and Consequences
        if (result.implications_consequences?.length) {
            content += `## Implications & Consequences\n`;
            result.implications_consequences.forEach((implication: string) => {
                content += `- ${implication}\n`;
            });
            content += '\n';
        }
        
        // Learning Pathways
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
        
        // Actionable Next Steps  
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
        
        // Knowledge Gaps
        if (result.knowledge_gaps?.length) {
            content += `> [!gap] Knowledge Gaps to Explore\n`;
            result.knowledge_gaps.forEach((gap: string) => {
                content += `> - [ ] ${gap}\n`;
            });
            content += '\n';
        }
        
        // Reflection Questions
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
        console.log('[SummarizeContent] 🔄 Using fallback single-pass analysis...');
        
        // Use the enhanced summarization prompt that includes learning-focused hierarchy analysis
        // If user has customized the prompt, use it; otherwise use the default
        const basePrompt = prompt === this.plugin.settings.defaultPrompt ? DEFAULT_SUMMARIZATION_PROMPT : prompt;
        const enhancedPrompt = `${basePrompt}\n\n${ENHANCED_SUMMARIZATION_PROMPT.split('\n\n').slice(1).join('\n\n')}\n\nEXISTING KNOWLEDGE HIERARCHY:\n${hierarchyContext}`;
        
        if (this.plugin.settings.provider === 'gemini') {
            const selectedModel = this.modelDropdown?.value || this.plugin.settings.gemini.model;
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
                // Try native JSON mode for Gemini (may not be supported by current SDK)
                const model = this.geminiClient.getGenerativeModel({ 
                    model: selectedModel
                });
                const request: GenerateContentRequest = {
                    contents: [{
                        role: 'user',
                        parts: [{ text: enhancedPrompt + "\n\n" + text }]
                    }]
                };
                console.log('[SummarizeContent] 🚀 Sending JSON mode request to Gemini API');
                const result = await model.generateContent(request);
                const responseText = result.response.text();
                console.log('[SummarizeContent] ✅ Gemini JSON response length:', responseText.length);
                
                // Gemini still returns JSON in markdown blocks, so we need to extract it
                console.log('[SummarizeContent] First 100 chars of response:', responseText.substring(0, 100));
                const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
                const jsonText = jsonMatch ? jsonMatch[1].trim() : responseText.trim();
                console.log('[SummarizeContent] Extracted JSON length:', jsonText.length);
                
                // Parse and validate JSON response structure
                let sections;
                try {
                    sections = this.validateJSONResponse(JSON.parse(jsonText));
                    console.log('[SummarizeContent] ✅ Successfully parsed and validated native JSON response');
                } catch (jsonError) {
                    console.error('[SummarizeContent] ❌ JSON parsing failed:', jsonError.message);
                    console.error('[SummarizeContent] 🔍 Problematic JSON around position', jsonError.message.match(/position (\d+)/)?.[1] || 'unknown');
                    
                    // Show context around the error position
                    if (jsonError.message.includes('position')) {
                        const position = parseInt(jsonError.message.match(/position (\d+)/)?.[1] || '0');
                        const start = Math.max(0, position - 100);
                        const end = Math.min(jsonText.length, position + 100);
                        console.error('[SummarizeContent] 📄 JSON context around error:');
                        console.error('[SummarizeContent] 📄 "...' + jsonText.substring(start, end) + '..."');
                    }
                    
                    // Try to fix common JSON issues
                    console.log('[SummarizeContent] 🔧 Attempting JSON cleanup...');
                    try {
                        const cleanedJson = this.cleanupJSON(jsonText);
                        sections = this.validateJSONResponse(JSON.parse(cleanedJson));
                        console.log('[SummarizeContent] ✅ JSON cleanup successful!');
                    } catch (cleanupError) {
                        console.error('[SummarizeContent] ❌ JSON cleanup also failed:', cleanupError.message);
                        console.log('[SummarizeContent] 🔄 Falling back to raw content preservation...');
                        
                        // Create a fallback structured response to preserve the content
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
                        console.log('[SummarizeContent] ✅ Fallback response created - content preserved');
                    }
                }
                console.log('[SummarizeContent] Hierarchy:', sections.hierarchy);
                console.log('[SummarizeContent] Learning context:', sections.learning_context);
                
                return { 
                    summary: this.formatEnhancedSummary(sections),
                    title: sections.title,
                    metadata: sections.metadata,
                    hierarchy: sections.hierarchy,
                    learning_context: sections.learning_context
                };
            } catch (error) {
                new Notice(`Gemini API Error: ${error.message}`);
                console.error('[SummarizeContent] Gemini API error:', error);
                return { summary: '', title: 'Untitled', metadata: {}, hierarchy: undefined, learning_context: undefined };
            }
        } else if (this.plugin.settings.provider === 'openrouter') {
            const selectedModel = this.modelDropdown?.value || this.plugin.settings.openrouter.model;
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
                        { role: 'system', content: 'You are a helpful AI assistant that creates detailed summaries and notes in JSON format.' },
                        { role: 'user', content: enhancedPrompt + "\n\n" + text }
                    ],
                    temperature: 0.7,
                    max_tokens: 2000,
                    response_format: { type: "json_object" }
                };
                console.log('[SummarizeContent] 🚀 Sending JSON mode request to OpenRouter API');
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
                console.log('[SummarizeContent] ✅ OpenRouter JSON response length:', data.choices[0].message.content.length);
                const responseText = data.choices[0].message.content;
                
                // Parse and validate JSON response structure
                let sections;
                try {
                    sections = this.validateJSONResponse(JSON.parse(responseText));
                } catch (jsonError) {
                    console.error('[SummarizeContent] ❌ OpenRouter JSON parsing failed:', jsonError.message);
                    throw new Error(`OpenRouter returned malformed JSON: ${jsonError.message}`);
                }
                console.log('[SummarizeContent] ✅ Successfully parsed and validated native JSON response');
                console.log('[SummarizeContent] Hierarchy:', sections.hierarchy);
                console.log('[SummarizeContent] Learning context:', sections.learning_context);
                
                return { 
                    summary: this.formatEnhancedSummary(sections),
                    title: sections.title,
                    metadata: sections.metadata,
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
        // Add debug logging to see what AI actually returns
        console.log('[parseSections] Raw AI response length:', responseText.length);
        console.log('[parseSections] First 500 chars:', responseText.substring(0, 500));
        console.log('[parseSections] Last 200 chars:', responseText.substring(responseText.length - 200));
        
        // Extract and prepare JSON text
        const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
        let jsonText = jsonMatch ? jsonMatch[1].trim() : responseText.trim();
        
        console.log('[parseSections] Extracted JSON text length:', jsonText.length);
        console.log('[parseSections] JSON text preview:', jsonText.substring(0, 200));
        
        try {
            // Clean up common JSON issues from AI responses
            jsonText = this.cleanupJSON(jsonText);
            console.log('[parseSections] After cleanup:', jsonText.substring(0, 200));
            
            // Try to parse the JSON
            const response = JSON.parse(jsonText);
            console.log('[parseSections] ✅ Successfully parsed AI response');
            
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
            console.error('[parseSections] ❌ JSON parsing failed:', error.message);
            console.error('[parseSections] Failed JSON text:', jsonText.substring(0, 500));
            
            // Try one more time with aggressive cleanup
            try {
                const aggressivelyCleanedJSON = this.aggressiveJSONCleanup(jsonText);
                console.log('[parseSections] Aggressive cleanup result:', aggressivelyCleanedJSON.substring(0, 200));
                const response = JSON.parse(aggressivelyCleanedJSON);
                console.log('[parseSections] ✅ Successfully parsed with aggressive cleanup');
                
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
                console.error('[parseSections] ❌ Aggressive cleanup also failed:', secondError.message);
                
                // REMOVED FALLBACK PARSING - Now we throw an error instead
                throw new Error(`AI returned malformed JSON response. Please regenerate with a clearer prompt. Original error: ${error.message}, Cleanup error: ${secondError.message}`);
            }
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
            // Fix array element issues (common JSON error)
            .replace(/,(\s*[}\]])/g, '$1') // Remove trailing commas before closing brackets/braces
            .replace(/](\s*[^,}\]\s])/g, '],$1') // Add missing comma after array close
            .replace(/}(\s*[^,}\]\s])/g, '},$1') // Add missing comma after object close
            .replace(/(\w|"|})(\s*\[)/g, '$1,$2') // Add missing comma before array start
            .replace(/(\w|"|})(\s*{)/g, '$1,$2') // Add missing comma before object start
            // Fix escaped quotes in content
            .replace(/\\"/g, '"')
            // Remove any stray backslashes before quotes
            .replace(/\\(?!")/g, '')
            // Fix double-escaped characters
            .replace(/\\\\"/g, '\\"')
            // Fix unescaped quotes inside strings (basic attempt)
            .replace(/:\s*"([^"]*)"([^",}\]]*)"([^",}\]]*)/g, ': "$1\\"$2\\"$3')
            // Fix missing quotes around keys
            .replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":')
            // Clean up any extra spaces around JSON elements
            .trim();
            
        // Ensure it starts and ends with braces
        if (!cleaned.startsWith('{')) {
            const braceIndex = cleaned.indexOf('{');
            if (braceIndex > -1) {
                cleaned = cleaned.substring(braceIndex);
            }
        }
        
        // Try to find and fix the most common array issues
        try {
            // Test if we can parse it, if not, try more aggressive fixes
            JSON.parse(cleaned);
        } catch (e) {
            console.log('[cleanupJSON] Initial cleanup failed, trying quote-specific fixes...');
            // Fix the specific issue seen in the error: unescaped quotes in strings
            // Based on the error: "slow training times.",""Machine Learning is the Second Best Solution\" Quote:"
            
            // Step 1: Fix double quotes that start array elements
            cleaned = cleaned.replace(/,\s*""/g, ',"');
            
            // Step 2: Find and fix unescaped quotes in string content
            // This is tricky, so let's use a more conservative approach
            const lines = cleaned.split('\n');
            for (let i = 0; i < lines.length; i++) {
                let line = lines[i];
                
                // Look for problematic patterns like: "text"unescaped content"more text"
                // and replace with: "text\"unescaped content\"more text"
                if (line.includes('"') && !line.match(/^[\s]*["}]/)) {
                    // Count quotes to find unbalanced strings
                    const quoteCount = (line.match(/"/g) || []).length;
                    if (quoteCount > 2 && quoteCount % 2 === 0) {
                        // Even number of quotes > 2 suggests embedded quotes
                        // Simple heuristic: escape quotes that aren't at start/end of values
                        line = line.replace(/([^:,\[\{]\s*)"([^"]*)"([^,\]\}])/g, '$1\\"$2\\"$3');
                    }
                }
                lines[i] = line;
            }
            cleaned = lines.join('\n');
            
            // Step 3: Basic structural fixes
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

    private validateJSONResponse(response: any): any {
        console.log('[validateJSONResponse] Validating response structure');
        console.log('[validateJSONResponse] Response keys:', Object.keys(response));
        
        // Handle both old and new response structures
        const sections = response.sections || response;
        console.log('[validateJSONResponse] Sections keys:', Object.keys(sections));
        
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
            // Pass through the sections directly for formatting
            ...sections,
            // Ensure we preserve metadata at root level
            sections: sections
        };
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
            
            // Handle file name conflicts by finding a unique name
            const finalFileName = await this.findUniqueFileName(folderPath, fileName);
            if (finalFileName !== fileName) {
                console.log('[CreateNote] File name conflict resolved:', fileName, '→', finalFileName);
            }
            
            const newFile = await this.app.vault.create(`${folderPath}/${finalFileName}`, fileContent);
            console.log('[CreateNote] Note created:', `${folderPath}/${finalFileName}`);
            
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

    private async findUniqueFileName(folderPath: string, fileName: string): Promise<string> {
        // Check if the original filename is available
        const originalPath = `${folderPath}/${fileName}`;
        const existingFile = this.app.vault.getAbstractFileByPath(originalPath);
        
        if (!existingFile) {
            return fileName; // Original name is available
        }

        // Extract name and extension
        const nameParts = fileName.split('.');
        const extension = nameParts.pop() || '';
        const baseName = nameParts.join('.');

        // Try numbered variants
        let counter = 1;
        while (counter <= 999) { // Prevent infinite loops
            const numberedName = `${baseName} (${counter}).${extension}`;
            const numberedPath = `${folderPath}/${numberedName}`;
            const conflictFile = this.app.vault.getAbstractFileByPath(numberedPath);
            
            if (!conflictFile) {
                console.log('[CreateNote] Found unique filename:', numberedName);
                return numberedName;
            }
            
            counter++;
        }

        // If we get here, fall back to timestamp-based naming
        const timestamp = new Date().getTime();
        const timestampName = `${baseName}_${timestamp}.${extension}`;
        console.log('[CreateNote] Using timestamp-based filename:', timestampName);
        return timestampName;
    }

    private formatMOCContextForAI(existingMOCs: any[]): string {
        if (existingMOCs.length === 0) {
            return "No existing MOCs. Create first hierarchy.";
        }

        // Create compact summary by domain only
        const domains = new Set<string>();
        existingMOCs.forEach(moc => {
            if (moc.domain) domains.add(moc.domain);
        });

        return `Existing domains: ${Array.from(domains).join(', ')}`;
    }
}

// MOC Management Classes
class MOCManager {
    private app: App;
    private settings: PluginSettings;
    private hierarchyManager?: any;

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
            navigationSection += `## 🔼 Parent Level\n- [[00-${parentLevel.title} MOC]] (${this.getLevelName(parentLevel.level)})\n\n`;
        }

        // Add child navigation (if has children)
        if (childLevels.length > 0) {
            navigationSection += `## 🔽 Sub-Levels\n`;
            childLevels.forEach(child => {
                navigationSection += `- [[00-${child.title} MOC]] (${this.getLevelName(child.level)})\n`;
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
        if (hierarchy.level2 && currentLevel <= 2) concepts.push(`- [[00-${hierarchy.level2} MOC]]`);
        if (hierarchy.level3 && currentLevel <= 3) concepts.push(`- [[00-${hierarchy.level3} MOC]]`);
        if (hierarchy.level4 && currentLevel <= 4) concepts.push(`- [[00-${hierarchy.level4} MOC]]`);
        return concepts.length > 0 ? concepts.join('\n') : '<!-- Core concepts will be identified as content is added -->';
    }

    async getMOCPath(hierarchy: MOCHierarchy): Promise<string> {
        const mocFolder = this.settings.mocFolder || 'MOCs';
        const domainFolder = hierarchy.level1.replace(/[\\/:*?"<>|]/g, '_');
        const mocFileName = `${hierarchy.level2.replace(/[\\/:*?"<>|]/g, '_')}.md`;
        return `${mocFolder}/${domainFolder}/${mocFileName}`;
    }

    async ensureMOCExists(hierarchy: MOCHierarchy): Promise<string> {
        console.log('[MOCManager] 🚀 Starting MOC creation process for:', `${hierarchy.level1} > ${hierarchy.level2}`);
        console.log('[MOCManager] 🚀 Full hierarchy:', hierarchy);
        
        // Validate hierarchy first
        if (!hierarchy.level1 || !hierarchy.level2) {
            throw new Error(`Invalid hierarchy - missing required levels. Level1: ${hierarchy.level1}, Level2: ${hierarchy.level2}`);
        }
        
        // Log the expected structure for debugging
        const expectedStructure = this.createHierarchicalStructure(this.normalizeHierarchy(hierarchy));
        console.log('[MOCManager] 🗂️ Expected MOC structure:');
        expectedStructure.forEach(level => {
            console.log(`[MOCManager]   Level ${level.level}: ${level.path}`);
        });
        
        // Create all MOC levels that exist in the hierarchy
        console.log('[MOCManager] 🔄 Creating all MOC levels...');
        try {
            await this.createAllMOCLevels(hierarchy);
            console.log('[MOCManager] ✅ MOC level creation completed');
            
            // CRITICAL: Verify that the expected files actually exist after creation
            console.log('[MOCManager] 🔍 Post-creation verification...');
            for (const level of expectedStructure) {
                const file = this.app.vault.getAbstractFileByPath(level.path);
                console.log(`[MOCManager] 📋 Level ${level.level} file check:`, {
                    expectedPath: level.path,
                    fileExists: !!file,
                    fileName: file?.name || 'NOT FOUND'
                });
                
                if (!file) {
                    console.error(`[MOCManager] ❌ CRITICAL: Expected MOC file missing after creation: ${level.path}`);
                    
                    // Try to create the missing file now
                    console.log(`[MOCManager] 🛠️ Attempting emergency MOC creation for level ${level.level}...`);
                    try {
                        await this.emergencyCreateMOC(level, hierarchy, expectedStructure);
                        console.log(`[MOCManager] ✅ Emergency MOC creation successful for level ${level.level}`);
                    } catch (emergencyError) {
                        console.error(`[MOCManager] ❌ Emergency MOC creation failed:`, emergencyError);
                        throw new Error(`MOC creation completely failed for level ${level.level}: ${emergencyError.message}`);
                    }
                }
            }
            
        } catch (error) {
            console.error('[MOCManager] ❌ MOC level creation failed:', error);
            console.error('[MOCManager] ❌ Full error details:', {
                message: error.message,
                stack: error.stack,
                hierarchy: hierarchy,
                expectedStructure: expectedStructure
            });
            throw new Error(`MOC creation failed for hierarchy "${hierarchy.level1} > ${hierarchy.level2}": ${error.message}`);
        }
        
        // Return the path of the most specific MOC (where notes will be added)
        let mostSpecificPath: string;
        try {
            mostSpecificPath = await this.getMostSpecificMOCPath(hierarchy);
            console.log('[MOCManager] 🎯 Most specific MOC path for note addition:', mostSpecificPath);
            
            // CRITICAL: Final verification that the MOC file actually exists before returning the path
            const finalMocFile = this.app.vault.getAbstractFileByPath(mostSpecificPath);
            if (!finalMocFile) {
                console.error('[MOCManager] ❌ FINAL CHECK FAILED: MOC file not found after successful creation:', mostSpecificPath);
                
                // List what's actually in the directory
                const dirPath = mostSpecificPath.substring(0, mostSpecificPath.lastIndexOf('/'));
                console.log('[MOCManager] 📁 Directory contents:', dirPath);
                try {
                    const folder = this.app.vault.getAbstractFileByPath(dirPath) as TFolder;
                    if (folder && folder.children) {
                        folder.children.forEach((child: any) => {
                            console.log(`[MOCManager] 📄 Found file: ${child.path}`);
                        });
                    }
                } catch (listError) {
                    console.error('[MOCManager] ❌ Could not list directory contents:', listError);
                }
                
                throw new Error(`CRITICAL: MOC file not found after creation: ${mostSpecificPath}`);
            }
            
            console.log('[MOCManager] ✅ Final verification passed - MOC file exists and is accessible');
            
        } catch (error) {
            console.error('[MOCManager] ❌ Error getting most specific MOC path:', error);
            throw new Error(`Failed to get most specific MOC path: ${error.message}`);
        }
        
        return mostSpecificPath;
    }

    private async emergencyCreateMOC(levelInfo: any, hierarchy: MOCHierarchy, allLevels: any[]): Promise<void> {
        console.log(`[MOCManager] 🚨 Emergency MOC creation for level ${levelInfo.level}:`, levelInfo.path);
        
        // Ensure directory exists
        try {
            const dirPath = levelInfo.directory;
            const folder = this.app.vault.getAbstractFileByPath(dirPath);
            if (!folder) {
                console.log(`[MOCManager] 📁 Creating missing directory: ${dirPath}`);
                await this.app.vault.createFolder(dirPath);
            }
        } catch (dirError) {
            console.error(`[MOCManager] ❌ Emergency directory creation failed:`, dirError);
            throw dirError;
        }
        
        // Create fallback MOC content
        const mocContent = this.createFallbackMOCContent(levelInfo, hierarchy);
        console.log(`[MOCManager] 📝 Emergency MOC content length: ${mocContent.length}`);
        
        // Create the file
        try {
            console.log(`[MOCManager] 💾 Creating emergency MOC file: ${levelInfo.path}`);
            const createdFile = await this.app.vault.create(levelInfo.path, mocContent);
            console.log(`[MOCManager] ✅ Emergency MOC file created successfully:`, createdFile.path);
            
            // Verify it exists
            const verifyFile = this.app.vault.getAbstractFileByPath(levelInfo.path);
            if (!verifyFile) {
                throw new Error('File creation reported success but file not found');
            }
            
        } catch (createError) {
            console.error(`[MOCManager] ❌ Emergency file creation failed:`, createError);
            throw new Error(`Emergency MOC creation failed: ${createError.message}`);
        }
    }

    // Add method to set hierarchyManager reference
    setHierarchyManager(hierarchyManager: any): void {
        this.hierarchyManager = hierarchyManager;
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
        console.log('[MOCManager] MOC structure to create:', mocStructure);
        
        for (let i = 0; i < mocStructure.length; i++) {
            const levelInfo = mocStructure[i];
            console.log(`[MOCManager] 🔄 Processing level ${levelInfo.level}/${mocStructure.length}:`, levelInfo);
            console.log(`[MOCManager] 🔍 Level details:`, {
                level: levelInfo.level,
                title: levelInfo.title,
                path: levelInfo.path,
                directory: levelInfo.directory
            });
            
            const existingMOC = existingMOCs.find(moc => 
                moc.level === levelInfo.level && 
                this.isSimilarContent(moc.title, levelInfo.title) &&
                this.isInCorrectHierarchyPath(moc.path, levelInfo, normalizedHierarchy)
            );

            if (existingMOC) {
                console.log(`[MOCManager] ✅ Using existing MOC for level ${levelInfo.level}:`, existingMOC.path);
                levelInfo.path = existingMOC.path;
                levelInfo.isExisting = true;
            } else {
                console.log(`[MOCManager] 🔄 Creating new MOC for level ${levelInfo.level}:`, levelInfo.path);
                try {
                    await this.ensureSingleMOCExists(levelInfo, normalizedHierarchy, mocStructure);
                    console.log(`[MOCManager] ✅ Completed MOC creation for level ${levelInfo.level}`);
                    
                    // Immediately verify the file was created
                    const verifyFile = this.app.vault.getAbstractFileByPath(levelInfo.path);
                    if (verifyFile) {
                        console.log(`[MOCManager] ✅ Verification: MOC file exists for level ${levelInfo.level}`);
                    } else {
                        console.error(`[MOCManager] ❌ Verification FAILED: MOC file missing for level ${levelInfo.level}: ${levelInfo.path}`);
                        throw new Error(`MOC file creation verification failed for level ${levelInfo.level}`);
                    }
                } catch (levelError) {
                    console.error(`[MOCManager] ❌ MOC creation failed for level ${levelInfo.level}:`, levelError);
                    throw new Error(`Level ${levelInfo.level} MOC creation failed: ${levelError.message}`);
                }
            }
        }
        console.log('[MOCManager] 🎉 All MOC levels processed');
        
        // Update central hierarchy
        if (this.hierarchyManager) {
            await this.hierarchyManager.addToHierarchy(normalizedHierarchy);
            console.log('[MOCManager] ✅ Central hierarchy updated');
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
        let normalized = title
            .trim()
            .replace(/[&]/g, 'and')  // & → and
            .replace(/[^\w\s-]/g, '') // Remove special chars except spaces and hyphens
            .replace(/\s+/g, ' ')     // Multiple spaces → single space
            .trim();
        
        // Handle common plural forms for academic domains
        normalized = normalized
            .replace(/\bSciences\b/g, 'Science')     // Sciences → Science
            .replace(/\bStudies\b/g, 'Study')        // Studies → Study  
            .replace(/\bTechnologies\b/g, 'Technology') // Technologies → Technology
            .replace(/\bHistories\b/g, 'History')    // Histories → History
            .replace(/\bMathematics\b/g, 'Mathematics') // Keep Mathematics as is (it's already standard)
            // Add more specific domain normalizations as needed
            ;
        
        return normalized;
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
        const normalize = (str: string) => {
            let normalized = str.toLowerCase()
                .replace(/[&]/g, 'and')
                .replace(/[^\w\s]/g, '')
                .replace(/\s+/g, ' ')
                .trim();
            
            // Handle plural variations in similarity check
            normalized = normalized
                .replace(/\bsciences\b/g, 'science')
                .replace(/\bstudies\b/g, 'study')  
                .replace(/\btechnologies\b/g, 'technology')
                .replace(/\bhistories\b/g, 'history');
                
            return normalized;
        };
        
        const norm1 = normalize(title1);
        const norm2 = normalize(title2);
        
        // Exact match
        if (norm1 === norm2) return true;
        
        // Check if one contains the other (for variations)
        if (norm1.includes(norm2) || norm2.includes(norm1)) return true;
        
        // Check for similar words with stricter criteria
        const words1 = norm1.split(' ');
        const words2 = norm2.split(' ');
        const commonWords = words1.filter(word => words2.includes(word));
        
        // For similarity, require:
        // 1. At least 75% of words in common (instead of 50%)
        // 2. At least 2 words in common for multi-word titles
        const minCommonWords = Math.max(2, Math.ceil(Math.min(words1.length, words2.length) * 0.75));
        const hasEnoughCommon = commonWords.length >= minCommonWords;
        
        // Special case: if both titles have only 1 word, they must be identical
        if (words1.length === 1 && words2.length === 1) {
            return norm1 === norm2;
        }
        
        return hasEnoughCommon;
    }

    private isInCorrectHierarchyPath(existingPath: string, targetLevelInfo: any, hierarchy: MOCHierarchy): boolean {
        console.log(`[MOCManager] 🔍 Checking hierarchy path match:`);
        console.log(`[MOCManager] 🔍   Existing path: ${existingPath}`);
        console.log(`[MOCManager] 🔍   Target path: ${targetLevelInfo.path}`);
        console.log(`[MOCManager] 🔍   Target level: ${targetLevelInfo.level}`);
        
        // For level 1 (domain), just check if it's in the MOCs root
        if (targetLevelInfo.level === 1) {
            const isRootLevel = existingPath.split('/').length === 2; // MOCs/00-Domain MOC.md
            const domainMatch = existingPath.includes(hierarchy.level1.replace(/[\\/:*?"<>|]/g, '_'));
            console.log(`[MOCManager] 🔍   Level 1 check: isRootLevel=${isRootLevel}, domainMatch=${domainMatch}`);
            return isRootLevel && domainMatch;
        }
        
        // For level 2 (area), check if it's under the correct domain
        if (targetLevelInfo.level === 2) {
            const expectedDomainPath = `MOCs/${hierarchy.level1.replace(/[\\/:*?"<>|]/g, '_')}/`;
            const isCorrectDomain = existingPath.startsWith(expectedDomainPath);
            const pathDepth = existingPath.split('/').length;
            const isCorrectDepth = pathDepth === 3; // MOCs/Domain/00-Area MOC.md
            console.log(`[MOCManager] 🔍   Level 2 check: isCorrectDomain=${isCorrectDomain}, isCorrectDepth=${isCorrectDepth}`);
            return isCorrectDomain && isCorrectDepth;
        }
        
        // For level 3 (topic), check if it's under the correct domain/area
        if (targetLevelInfo.level === 3) {
            const expectedAreaPath = `MOCs/${hierarchy.level1.replace(/[\\/:*?"<>|]/g, '_')}/${hierarchy.level2.replace(/[\\/:*?"<>|]/g, '_')}/`;
            const isCorrectArea = existingPath.startsWith(expectedAreaPath);
            const pathDepth = existingPath.split('/').length;
            const isCorrectDepth = pathDepth === 4; // MOCs/Domain/Area/00-Topic MOC.md
            console.log(`[MOCManager] 🔍   Level 3 check: isCorrectArea=${isCorrectArea}, isCorrectDepth=${isCorrectDepth}`);
            return isCorrectArea && isCorrectDepth;
        }
        
        // For level 4 (concept), check if it's under the correct domain/area/topic
        if (targetLevelInfo.level === 4) {
            const expectedTopicPath = `MOCs/${hierarchy.level1.replace(/[\\/:*?"<>|]/g, '_')}/${hierarchy.level2.replace(/[\\/:*?"<>|]/g, '_')}/${hierarchy.level3?.replace(/[\\/:*?"<>|]/g, '_') || 'Unknown'}/`;
            const isCorrectTopic = existingPath.startsWith(expectedTopicPath);
            const pathDepth = existingPath.split('/').length;
            const isCorrectDepth = pathDepth === 5; // MOCs/Domain/Area/Topic/00-Concept MOC.md
            console.log(`[MOCManager] 🔍   Level 4 check: isCorrectTopic=${isCorrectTopic}, isCorrectDepth=${isCorrectDepth}`);
            return isCorrectTopic && isCorrectDepth;
        }
        
        console.log(`[MOCManager] 🔍   Unknown level: ${targetLevelInfo.level}, defaulting to false`);
        return false;
    }

    private async ensureSingleMOCExists(levelInfo: any, hierarchy: MOCHierarchy, allLevels: any[]): Promise<void> {
        console.log(`[MOCManager] 🔍 ensureSingleMOCExists called for level ${levelInfo.level}:`, levelInfo);
        console.log(`[MOCManager] 🔍 Target path: ${levelInfo.path}`);
        console.log(`[MOCManager] 🔍 Target directory: ${levelInfo.directory}`);
        
        // Skip if this is an existing MOC we're reusing
        if (levelInfo.isExisting) {
            console.log(`[MOCManager] ⏭️ Skipping level ${levelInfo.level} - marked as existing`);
            return;
        }

        // Check if file already exists
        try {
            const existingFile = this.app.vault.getAbstractFileByPath(levelInfo.path);
            if (existingFile) {
                console.log(`[MOCManager] ⏭️ MOC file already exists at: ${levelInfo.path}`);
                return;
            }
            console.log(`[MOCManager] 📁 File doesn't exist, proceeding with creation: ${levelInfo.path}`);
        } catch (error) {
            console.log(`[MOCManager] 📁 File check error (likely doesn't exist), will create: ${levelInfo.path}`, error.message);
        }

        // Ensure directory structure exists with comprehensive error handling
        console.log(`[MOCManager] 📂 Checking/creating directory: ${levelInfo.directory}`);
        try {
            const folder = this.app.vault.getAbstractFileByPath(levelInfo.directory);
            if (!folder) {
                console.log(`[MOCManager] 🔨 Creating directory: ${levelInfo.directory}`);
                await this.app.vault.createFolder(levelInfo.directory);
                console.log(`[MOCManager] ✅ Directory created: ${levelInfo.directory}`);
                
                // Verify directory was actually created
                const verifyFolder = this.app.vault.getAbstractFileByPath(levelInfo.directory);
                if (!verifyFolder) {
                    throw new Error(`Directory creation failed - folder not found after creation: ${levelInfo.directory}`);
                }
            } else {
                console.log(`[MOCManager] ✅ Directory already exists: ${levelInfo.directory}`);
            }
        } catch (error) {
            console.error(`[MOCManager] ❌ Error creating directory ${levelInfo.directory}:`, error);
            
            // Try alternative directory creation strategies
            try {
                console.log(`[MOCManager] 🔄 Attempting alternative directory creation strategy...`);
                await this.createDirectoryRecursively(levelInfo.directory);
                console.log(`[MOCManager] ✅ Alternative directory creation successful`);
            } catch (altError) {
                console.error(`[MOCManager] ❌ Alternative directory creation also failed:`, altError);
                throw new Error(`Failed to create directory ${levelInfo.directory}: ${error.message}. Alternative strategy also failed: ${altError.message}`);
            }
        }

        // Create MOC content with hierarchical navigation
        console.log(`[MOCManager] 📝 Generating MOC content for level ${levelInfo.level}`);
        let mocContent: string;
        try {
            mocContent = await this.createHierarchicalMOCTemplate(levelInfo, hierarchy, allLevels);
            console.log(`[MOCManager] 📝 MOC content generated, length: ${mocContent.length}`);
            
            if (!mocContent || mocContent.length < 10) {
                throw new Error('MOC content is empty or too short');
            }
        } catch (contentError) {
            console.error(`[MOCManager] ❌ Error generating MOC content:`, contentError);
            // Create fallback content
            mocContent = this.createFallbackMOCContent(levelInfo, hierarchy);
            console.log(`[MOCManager] 🔄 Using fallback MOC content, length: ${mocContent.length}`);
        }
        
        // Create the MOC file with retry mechanism
        console.log(`[MOCManager] 💾 Creating MOC file: ${levelInfo.path}`);
        let attempts = 0;
        const maxAttempts = 3;
        
        while (attempts < maxAttempts) {
            try {
                // Verify the path is valid before attempting to create
                if (!levelInfo.path || levelInfo.path.trim() === '') {
                    throw new Error('Invalid MOC path - path is empty');
                }
                
                if (!levelInfo.path.endsWith('.md')) {
                    throw new Error(`Invalid MOC path - does not end with .md: ${levelInfo.path}`);
                }
                
                console.log(`[MOCManager] 🎯 Attempt ${attempts + 1}/${maxAttempts} to create MOC file: ${levelInfo.path}`);
                const createdFile = await this.app.vault.create(levelInfo.path, mocContent);
                console.log(`[MOCManager] ✅ Successfully created MOC file:`, createdFile.path);
                
                // Verify the file was actually created and is readable
                try {
                    const verifyContent = await this.app.vault.read(createdFile);
                    if (!verifyContent || verifyContent.length === 0) {
                        throw new Error('Created file is empty or unreadable');
                    }
                    console.log(`[MOCManager] ✅ MOC file verification successful - content length: ${verifyContent.length}`);
                } catch (verifyError) {
                    console.error(`[MOCManager] ❌ MOC file verification failed:`, verifyError);
                    throw new Error(`MOC file created but verification failed: ${verifyError.message}`);
                }
                
                return; // Success - exit the retry loop
                
            } catch (error) {
                attempts++;
                console.error(`[MOCManager] ❌ Attempt ${attempts} failed to create MOC file ${levelInfo.path}:`, error);
                console.error(`[MOCManager] ❌ Error details:`, {
                    message: error.message,
                    code: error.code,
                    path: levelInfo.path,
                    directory: levelInfo.directory,
                    attempt: attempts,
                    maxAttempts: maxAttempts
                });
                
                if (attempts < maxAttempts) {
                    console.log(`[MOCManager] 🔄 Retrying in 1 second... (attempt ${attempts + 1}/${maxAttempts})`);
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    
                    // Try alternative file path on retry
                    if (attempts === 2) {
                        const originalPath = levelInfo.path;
                        levelInfo.path = this.generateAlternativePath(levelInfo);
                        console.log(`[MOCManager] 🔄 Trying alternative path: ${originalPath} → ${levelInfo.path}`);
                    }
                } else {
                    // Final attempt failed - provide comprehensive error information
                    const detailedError = await this.generateDetailedErrorInfo(levelInfo, error);
                    throw new Error(`Failed to create MOC file after ${maxAttempts} attempts at ${levelInfo.path}: ${error.message}\n\nDetailed Error Info:\n${detailedError}`);
                }
            }
        }
    }

    private async createDirectoryRecursively(directoryPath: string): Promise<void> {
        const parts = directoryPath.split('/');
        let currentPath = '';
        
        for (const part of parts) {
            if (part.trim() === '') continue;
            
            currentPath = currentPath ? `${currentPath}/${part}` : part;
            
            try {
                const folder = this.app.vault.getAbstractFileByPath(currentPath);
                if (!folder) {
                    console.log(`[MOCManager] 🔨 Creating directory part: ${currentPath}`);
                    await this.app.vault.createFolder(currentPath);
                }
            } catch (error) {
                console.log(`[MOCManager] ⚠️ Could not create directory part ${currentPath}:`, error);
                // Continue anyway - sometimes folders exist but can't be detected
            }
        }
    }

    private createFallbackMOCContent(levelInfo: any, hierarchy: MOCHierarchy): string {
        const levelName = this.getLevelName(levelInfo.level);
        const timestamp = new Date().toISOString();
        
        return `---
title: "${levelInfo.title}"
type: "moc"
level: ${levelInfo.level}
domain: "${hierarchy.level1}"
created: "${timestamp}"
updated: "${timestamp}"
tags: ["#moc", "#${hierarchy.level1.toLowerCase().replace(/\s+/g, '-')}"]
note_count: 0
status: "auto-generated-fallback"
---

# ${levelInfo.title}

> [!info] Auto-Generated ${levelName}
> This MOC was automatically created as a fallback when the primary template generation failed.

## Overview
This is a ${levelName.toLowerCase()} for organizing knowledge related to **${levelInfo.title}**.

## Core Concepts
<!-- Key concepts will be added here as notes are organized -->

## Learning Paths  
<!-- Learning pathways will be developed as content grows -->

## Prerequisites
<!-- Prerequisites will be identified as the knowledge structure develops -->

## Notes
<!-- Notes will be automatically added here -->

---
*Last updated: ${timestamp}*
`;
    }

    private generateAlternativePath(levelInfo: any): string {
        const timestamp = Date.now();
        const originalPath = levelInfo.path;
        const pathParts = originalPath.split('/');
        const fileName = pathParts[pathParts.length - 1];
        const fileNameWithoutExt = fileName.replace('.md', '');
        const directory = pathParts.slice(0, -1).join('/');
        
        // Create alternative filename with timestamp
        const alternativeFileName = `${fileNameWithoutExt}-${timestamp}.md`;
        return `${directory}/${alternativeFileName}`;
    }

    private async generateDetailedErrorInfo(levelInfo: any, error: any): Promise<string> {
        let errorInfo = `Original Error: ${error.message}\n`;
        errorInfo += `Error Code: ${error.code || 'N/A'}\n`;
        errorInfo += `Attempted Path: ${levelInfo.path}\n`;
        errorInfo += `Directory: ${levelInfo.directory}\n`;
        errorInfo += `Level Info: ${JSON.stringify(levelInfo, null, 2)}\n`;
        
        // Check directory existence
        try {
            const folder = this.app.vault.getAbstractFileByPath(levelInfo.directory);
            errorInfo += `Directory Exists: ${!!folder}\n`;
            
            if (folder) {
                const children = (folder as any).children || [];
                errorInfo += `Directory Contents (${children.length} items):\n`;
                children.forEach((child: any, index: number) => {
                    errorInfo += `  ${index + 1}. ${child.name} (${child.path})\n`;
                });
            }
        } catch (dirError) {
            errorInfo += `Directory Check Error: ${dirError.message}\n`;
        }
        
        // Check vault state
        try {
            const allFiles = this.app.vault.getAllLoadedFiles();
            errorInfo += `Total Vault Files: ${allFiles.length}\n`;
            
            const mocFiles = allFiles.filter(f => f.path.includes('MOC'));
            errorInfo += `Existing MOC Files: ${mocFiles.length}\n`;
            mocFiles.slice(0, 5).forEach((f, index) => {
                errorInfo += `  ${index + 1}. ${f.path}\n`;
            });
        } catch (vaultError) {
            errorInfo += `Vault State Check Error: ${vaultError.message}\n`;
        }
        
        return errorInfo;
    }

    private async getMostSpecificMOCPath(hierarchy: MOCHierarchy): Promise<string> {
        // Use the same normalized hierarchical structure logic as createHierarchicalStructure
        const normalizedHierarchy = this.normalizeHierarchy(hierarchy);
        const mocStructure = this.createHierarchicalStructure(normalizedHierarchy);
        
        // Return the path of the most specific level (highest level number)
        const mostSpecific = mocStructure[mocStructure.length - 1];
        console.log('[MOCManager] Most specific MOC path:', mostSpecific.path);
        
        return mostSpecific.path;
    }

    getMostSpecificMOCDirectory(hierarchy: MOCHierarchy): string {
        // Use the same normalized hierarchical structure logic as createHierarchicalStructure
        const normalizedHierarchy = this.normalizeHierarchy(hierarchy);
        const mocStructure = this.createHierarchicalStructure(normalizedHierarchy);
        
        // Return the directory of the most specific level (for note placement)
        const mostSpecific = mocStructure[mocStructure.length - 1];
        console.log('[MOCManager] Most specific MOC directory for notes:', mostSpecific.directory);
        
        return mostSpecific.directory;
    }

    async updateMOC(mocPath: string, notePath: string, noteTitle: string, learningContext?: LearningContext): Promise<void> {
        console.log('[MOCManager] Adding note to MOC:', noteTitle);
        console.log('[MOCManager] MOC path:', mocPath);
        
        try {
            const mocFile = this.app.vault.getAbstractFileByPath(mocPath) as TFile;
            if (!mocFile) {
                console.error('[MOCManager] ❌ MOC file not found:', mocPath);
                console.error('[MOCManager] 🔍 Available files in that directory:');
                
                // Debug: List files in the directory to help diagnose the issue
                const dirPath = mocPath.substring(0, mocPath.lastIndexOf('/'));
                try {
                    const folder = this.app.vault.getAbstractFileByPath(dirPath) as TFolder;
                    if (folder && folder.children) {
                        folder.children.forEach((child: any) => {
                            console.error('[MOCManager] 📁', child.path);
                        });
                    } else {
                        console.error('[MOCManager] 📁 Directory not found:', dirPath);
                    }
                } catch (debugError) {
                    console.error('[MOCManager] 🐛 Debug listing failed:', debugError);
                }
                
                throw new Error(`MOC file not found at ${mocPath}. This suggests MOC creation failed silently.`);
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
            
            // Update note count in central hierarchy
            if (this.hierarchyManager) {
                // Extract hierarchy from the MOC path - this is a simplified approach
                // In a full implementation, you'd want to store hierarchy metadata with the note
                const pathParts = mocPath.split('/');
                if (pathParts.length >= 2) {
                    const domainFolder = pathParts[pathParts.length - 2];
                    const mockHierarchy: MOCHierarchy = {
                        level1: domainFolder.replace(/_/g, ' '),
                        level2: 'Unknown' // This would need proper hierarchy tracking
                    };
                    await this.hierarchyManager.incrementNoteCount(mockHierarchy);
                }
            }
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

    async getAllExistingMOCs(): Promise<any[]> {
        console.log('[MOCManager] Getting all existing MOCs for context');
        const allFiles = this.app.vault.getMarkdownFiles();
        const mocFolder = this.settings.mocFolder || 'MOCs';
        const mocFiles = allFiles.filter(file => 
            file.path.startsWith(mocFolder) && 
            file.name.startsWith('00-') && 
            file.name.endsWith(' MOC.md')
        );

        const existingMOCs = [];
        
        for (const file of mocFiles) {
            try {
                const content = await this.app.vault.read(file);
                const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
                
                if (frontmatterMatch) {
                    const frontmatter = frontmatterMatch[1];
                    const typeMatch = frontmatter.match(/type:\s*"?moc"?/);
                    const levelMatch = frontmatter.match(/level:\s*(\d+)/);
                    const titleMatch = frontmatter.match(/title:\s*"([^"]+)"/);
                    const domainMatch = frontmatter.match(/domain:\s*"([^"]+)"/);
                    
                    if (typeMatch && levelMatch && titleMatch) {
                        existingMOCs.push({
                            path: file.path,
                            level: parseInt(levelMatch[1]),
                            title: titleMatch[1],
                            domain: domainMatch ? domainMatch[1] : '',
                            directory: file.path.substring(0, file.path.lastIndexOf('/'))
                        });
                    }
                }
            } catch (error) {
                console.warn('[MOCManager] Could not read MOC file:', file.path, error);
            }
        }
        
        // Sort by level and title for better organization
        existingMOCs.sort((a, b) => {
            if (a.level !== b.level) return a.level - b.level;
            return a.title.localeCompare(b.title);
        });
        
        console.log('[MOCManager] Found existing MOCs:', existingMOCs.length);
        return existingMOCs;
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
    hierarchyManager: HierarchyManager;

    async onload() {
        await this.loadSettings();

        // Initialize MOC components
        this.mocManager = new MOCManager(this.app, this.settings);
        this.hierarchyAnalyzer = new HierarchyAnalyzer();
        this.hierarchyManager = new HierarchyManager(this.app, this.settings);
        
        // Connect managers
        this.mocManager.setHierarchyManager(this.hierarchyManager);

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