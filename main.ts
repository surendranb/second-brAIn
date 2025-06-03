import { Plugin, WorkspaceLeaf, ItemView, Notice, TFolder, Setting, PluginSettingTab, App, TFile, Modal } from 'obsidian';
import { GoogleGenerativeAI, GenerateContentRequest } from '@google/generative-ai';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import { AISummarizerSettingsTab } from './settings';

const VIEW_TYPE_SUMMARY = 'ai-summarizer-summary';
const execPromise = promisify(exec);

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
    notesFolder: string;
    mocFolder: string; // New setting for MOC folder
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
    notesFolder: 'Summaries',
    mocFolder: 'MOCs',
    enableMOC: true
};

class SummaryView extends ItemView {
    private urlInput: HTMLInputElement;
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
    private statusSteps: { label: string, state: 'idle' | 'in-progress' | 'success' | 'error' }[] = [
        { label: 'Fetch Content/Transcript', state: 'idle' },
        { label: 'Generate Note', state: 'idle' }
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

        formContainer.createEl('label', { text: 'Enter the URL (YouTube videos, blogs or a podcast transcript)' });
        this.urlInput = formContainer.createEl('input', { type: 'text', placeholder: 'https://www.youtube.com/watch?v=' }) as HTMLInputElement;
        this.urlInput.setAttribute('aria-label', 'URL input');
        this.urlInput.style.marginBottom = '10px';

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
            if (!this.urlInput.value) {
                urlError.innerText = 'Please enter a URL.';
                urlError.style.display = 'block';
                this.urlInput.focus();
                return;
            }
            this.startNoteGeneration();
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

    private updateStatusSteps(currentStep: number, status: string, error: boolean = false) {
        // Set all states to idle
        for (let i = 0; i < this.statusSteps.length; i++) {
            this.statusSteps[i].state = 'idle';
        }
        // Set states up to currentStep
        for (let i = 0; i < currentStep; i++) {
            this.statusSteps[i].state = 'success';
        }
        if (error) {
            this.statusSteps[currentStep].state = 'error';
        } else if (currentStep < this.statusSteps.length) {
            this.statusSteps[currentStep].state = 'in-progress';
        }
        // Render
        this.progressContainer.innerHTML = '';
        for (let i = 0; i < this.statusSteps.length; i++) {
            const circle = document.createElement('span');
            circle.innerText = '●';
            circle.style.marginRight = '6px';
            switch (this.statusSteps[i].state) {
                case 'idle': circle.style.color = 'gray'; break;
                case 'in-progress': circle.style.color = 'orange'; break;
                case 'success': circle.style.color = 'green'; break;
                case 'error': circle.style.color = 'red'; break;
            }
            this.progressContainer.appendChild(circle);
            const label = document.createElement('span');
            label.innerText = this.statusSteps[i].label;
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

        try {
            console.log('[startNoteGeneration] Clearing UI elements...');
            if (!this.resultArea) {
                console.error('[startNoteGeneration] resultArea is undefined!');
                this.resultArea = this.containerEl.createEl('div', { cls: 'ai-summarizer-result' }) as HTMLDivElement;
            }
            this.resultArea.innerText = '';
            
            let content = '';
            // Step 1: Fetch
            console.log('[startNoteGeneration] Starting content fetch...');
            if (url.includes('youtube.com')) {
                console.log('[startNoteGeneration] Fetching YouTube transcript...');
                content = await this.fetchTranscriptFromPython(url);
                if (content.startsWith('Error:') || content.includes('[ERROR]')) {
                    console.error('[startNoteGeneration] Transcript fetch failed:', content);
                    new Notice('Failed to fetch transcript. ' + content);
                    this.updateStatusSteps(0, 'Failed to fetch transcript. ' + content, true);
                    return;
                }
            } else {
                console.log('[startNoteGeneration] Fetching web content...');
                content = await this.fetchContentFromWebLink(url);
                if (!content || content.startsWith('Error:') || content.includes('[ERROR]')) {
                    console.error('[startNoteGeneration] Content fetch failed');
                    new Notice('Failed to fetch content. Please check the URL.');
                    this.updateStatusSteps(0, 'Failed to fetch content. Please check the URL.', true);
                    return;
                }
            }
            
            // Additional validation to ensure we have meaningful content
            if (!content || content.trim().length < 50) {
                console.error('[startNoteGeneration] Content too short or empty');
                new Notice('Failed to fetch meaningful content. Please check the URL.');
                this.updateStatusSteps(0, 'Failed to fetch meaningful content.', true);
                return;
            }
            
            console.log('[startNoteGeneration] Content fetched successfully, length:', content.length);
            
            this.updateStatusSteps(1, 'Generating note...');
            console.log('[startNoteGeneration] Starting content processing...');
            const result = await this.summarizeContent(content, prompt, url);
            if (!result.summary) {
                console.error('[startNoteGeneration] Note generation failed');
                new Notice('Failed to generate note.');
                this.updateStatusSteps(1, 'Failed to generate note.', true);
                return;
            }
            console.log('[startNoteGeneration] Note generated successfully, length:', result.summary.length);
            console.log('[startNoteGeneration] Metadata:', result.metadata);
            
            this.updateStatusSteps(1, 'Note generated!');
            await new Promise(res => setTimeout(res, 200));
            
            // Store metadata for later use
            this.currentMetadata = result.metadata;
            this.currentTitle = result.title;

            // Create and open the note  
            const newNote = await this.createNoteWithSummary(result.summary, result.title, url, result.metadata, result);
            if (newNote) {
                const leaf = this.app.workspace.getLeaf('tab');
                await leaf.openFile(newNote);
                this.updateStatusSteps(1, 'Note generated!', false);
                new Notice('Note created successfully.');
            }
        } catch (error) {
            console.error('[startNoteGeneration] Error:', error);
            new Notice('An error occurred. Please try again.');
            this.updateStatusSteps(1, 'Error occurred.', true);
        }
    }

    private async fetchContentFromWebLink(url: string): Promise<string> {
        // @ts-ignore
        const vaultPath = this.app.vault.adapter.basePath || '';
        const scriptPath = path.join(vaultPath, '.obsidian', 'plugins', 'second-brAIn', 'fetch_content.py');
        const quotedScriptPath = `"${scriptPath}"`;
        const venvPython = path.join(vaultPath, '.obsidian', 'plugins', 'second-brAIn', 'venv', 'bin', 'python3');
        const quotedVenvPython = `"${venvPython}"`;
        const command = `${quotedVenvPython} ${quotedScriptPath} "${url}"`;
        console.log('[FetchContent] Running command:', command);
        try {
            const { stdout, stderr } = await execPromise(command);
            if (stdout) console.log('[FetchContent] STDOUT:', stdout);
            if (stderr) console.error('[FetchContent] STDERR:', stderr);
            return stdout.trim();
        } catch (error) {
            console.error('[FetchContent] Command failed:', command, error);
            throw new Error(`Failed to fetch content from web link: ${error.message}`);
        }
    }

    private async fetchTranscriptFromPython(url: string): Promise<string> {
        // @ts-ignore
        const vaultPath = this.app.vault.adapter.basePath || '';
        const scriptPath = path.join(vaultPath, '.obsidian', 'plugins', 'second-brAIn', 'fetch_transcript.py');
        const quotedScriptPath = `"${scriptPath}"`;
        const venvPython = path.join(vaultPath, '.obsidian', 'plugins', 'second-brAIn', 'venv', 'bin', 'python3');
        const quotedVenvPython = `"${venvPython}"`;
        const command = `${quotedVenvPython} ${quotedScriptPath} "${url}"`;
        console.log('[FetchTranscript] Running command:', command);
        try {
            const { stdout, stderr } = await execPromise(command);
            if (stdout) console.log('[FetchTranscript] STDOUT:', stdout);
            if (stderr) console.error('[FetchTranscript] STDERR:', stderr);
            return stdout.trim();
        } catch (error) {
            console.error('[FetchTranscript] Command failed:', command, error);
            throw new Error(`Failed to fetch transcript: ${error.message}`);
        }
    }

    private async summarizeContent(text: string, prompt: string, url: string): Promise<{ summary: string, title: string, metadata: any }> {
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
                return { summary: '', title: 'Untitled', metadata: {} };
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
                
                return { 
                    summary: this.formatEnhancedSummary(sections),
                    title: sections.title || 'Untitled',
                    metadata: sections.metadata || {}
                };
            } catch (error) {
                new Notice(`Gemini API Error: ${error.message}`);
                console.error('[SummarizeContent] Gemini API error:', error);
                return { summary: '', title: 'Untitled', metadata: {} };
            }
        } else if (this.plugin.settings.provider === 'openrouter') {
            selectedModel = this.modelDropdown?.value || this.plugin.settings.openrouter.model;
            console.log('[SummarizeContent] Using OpenRouter model:', selectedModel);
            if (!this.plugin.settings.openrouter.apiKey) {
                new Notice('Please set your OpenRouter API key in the settings.');
                console.error('[SummarizeContent] OpenRouter API key missing.');
                return { summary: '', title: 'Untitled', metadata: {} };
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
                
                return { 
                    summary: this.formatEnhancedSummary(sections),
                    title: sections.title || 'Untitled',
                    metadata: sections.metadata || {}
                };
            } catch (error) {
                new Notice(`OpenRouter API Error: ${error.message}`);
                console.error('[SummarizeContent] OpenRouter API error:', error);
                return { summary: '', title: 'Untitled', metadata: {} };
            }
        }
        return { summary: '', title: 'Untitled', metadata: {} };
    }

    private parseSections(responseText: string): any {
        try {
            // First, try to extract JSON from markdown code blocks if present
            const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
            const jsonText = jsonMatch ? jsonMatch[1].trim() : responseText;
            
            // Try to parse the JSON
            const response = JSON.parse(jsonText);
            console.log('[parseSections] Parsed JSON response:', response);
            
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
            console.error('[parseSections] Failed to parse JSON response:', error);
            // Fallback to old parsing method if JSON parsing fails
            const sections: any = {
                title: 'Untitled',
                metadata: {
                    tags: ['#summary'],
                    topics: [],
                    related: [],
                    speakers: []
                }
            };
            
            // Extract title
            const titleMatch = responseText.match(/TITLE:\s*(.*?)(?:\n|$)/i);
            if (titleMatch) {
                sections.title = titleMatch[1].trim();
            }
            
            // Extract metadata
            const metadataMatch = responseText.match(/METADATA:\n([\s\S]*?)(?:\n\n|$)/i);
            if (metadataMatch) {
                sections.metadata = this.parseMetadata(metadataMatch[1].trim());
            }
            
            return sections;
        }
    }

    private formatEnhancedSummary(sections: any): string {
        let formattedContent = '';
        
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
        const folderPath = this.plugin.settings.notesFolder;
        const fileName = this.sanitizeFileName(title + '.md');
        
        // MOC Analysis and Integration
        let mocPath: string | null = null;
        let hierarchyData: NoteHierarchyAnalysis | null = null;
        
        if (this.plugin.settings.enableMOC && metadata) {
            try {
                console.log('[CreateNote] Using AI-generated hierarchy for MOC placement...');
                
                // Use AI-generated hierarchy from the analysis result
                const aiHierarchy = fullResult?.hierarchy;
                const aiLearningContext = fullResult?.learning_context;
                
                if (aiHierarchy && aiHierarchy.level1 && aiHierarchy.level2) {
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
                    
                    console.log('[CreateNote] AI Hierarchy analysis result:', hierarchyData);
                    
                    mocPath = await this.plugin.mocManager.ensureMOCExists(hierarchyData.hierarchy);
                    console.log('[CreateNote] MOC ensured at:', mocPath);
                } else {
                    console.log('[CreateNote] No AI hierarchy found, falling back to heuristic analysis...');
                    hierarchyData = await this.plugin.hierarchyAnalyzer.analyzeContent(metadata, title, summary);
                    mocPath = await this.plugin.mocManager.ensureMOCExists(hierarchyData.hierarchy);
                }
            } catch (error) {
                console.error('[CreateNote] MOC analysis failed:', error);
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
                    console.log('[CreateNote] Updating MOC with new note...');
                    await this.plugin.mocManager.updateMOC(mocPath, newFile.path, title, hierarchyData?.learning_context);
                    console.log('[CreateNote] MOC updated successfully');
                } catch (error) {
                    console.error('[CreateNote] Failed to update MOC:', error);
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

    async getMOCPath(hierarchy: MOCHierarchy): Promise<string> {
        const mocFolder = this.settings.mocFolder || 'MOCs';
        const domainFolder = hierarchy.level1.replace(/[\\/:*?"<>|]/g, '_');
        const mocFileName = `${hierarchy.level2.replace(/[\\/:*?"<>|]/g, '_')}.md`;
        return `${mocFolder}/${domainFolder}/${mocFileName}`;
    }

    async ensureMOCExists(hierarchy: MOCHierarchy): Promise<string> {
        const mocPath = await this.getMOCPath(hierarchy);
        
        try {
            const existingFile = this.app.vault.getAbstractFileByPath(mocPath);
            if (existingFile) {
                console.log('[MOCManager] MOC already exists:', mocPath);
                return mocPath;
            }
        } catch (error) {
            // File doesn't exist, continue to create it
        }

        // Create MOC directory structure if needed
        const mocFolder = this.settings.mocFolder || 'MOCs';
        const domainFolder = hierarchy.level1.replace(/[\\/:*?"<>|]/g, '_');
        const fullDirPath = `${mocFolder}/${domainFolder}`;

        try {
            const folder = this.app.vault.getAbstractFileByPath(fullDirPath);
            if (!folder) {
                await this.app.vault.createFolder(fullDirPath);
                console.log('[MOCManager] Created MOC directory:', fullDirPath);
            }
        } catch (error) {
            console.error('[MOCManager] Error creating MOC directory:', error);
        }

        // Create MOC file
        const mocContent = await this.createMOCTemplate(hierarchy);
        try {
            await this.app.vault.create(mocPath, mocContent);
            console.log('[MOCManager] Created new MOC:', mocPath);
            return mocPath;
        } catch (error) {
            console.error('[MOCManager] Error creating MOC file:', error);
            throw error;
        }
    }

    async updateMOC(mocPath: string, notePath: string, noteTitle: string, learningContext?: LearningContext): Promise<void> {
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

            // Add note to the Notes section
            const noteLink = `- [[${noteTitle}]]${learningContext ? ` (${learningContext.complexity_level})` : ''}`;
            const notesSection = updatedContent.match(/## Notes\n([\s\S]*?)(?=\n##|\n---|\n\*|$)/);
            
            if (notesSection && !updatedContent.includes(`[[${noteTitle}]]`)) {
                const existingNotes = notesSection[1].trim();
                const newNotesSection = existingNotes 
                    ? `${existingNotes}\n${noteLink}`
                    : noteLink;
                
                updatedContent = updatedContent.replace(
                    /## Notes\n[\s\S]*?(?=\n##|\n---|\n\*|$)/,
                    `## Notes\n${newNotesSection}\n`
                );
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
            console.log('[MOCManager] Updated MOC:', mocPath);
        } catch (error) {
            console.error('[MOCManager] Error updating MOC:', error);
        }
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
            .setName('Notes Folder')
            .setDesc('Folder where summarized notes will be saved')
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

    populateModelDropdown() {
        this.onOpen();
    }
}

export default AISummarizerPlugin;