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

// Main Plugin Settings
export interface PluginSettings {
    provider: Provider;
    gemini: GeminiSettings;
    openrouter: OpenRouterSettings;
    defaultPrompt: string;
    notesFolder: string;
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
    defaultPrompt: 'You are an expert knowledge creator, skilled at transforming information into actionable insights for a second brain. Your goal is to create a comprehensive and well-structured note from the provided content.\n\nAnalyze the content and:\n\n1.  Provide a concise summary of the main points.\n2.  Identify and extract the key concepts and ideas.\n3.  Include relevant supporting details, examples, and evidence.\n4.  Extract and include direct quotes or excerpts that are particularly insightful or important, clearly attributing them to the source.\n5.  Identify and list related topics or concepts that are relevant to the content.\n6.  Include your own personal insights, reflections, and questions about the content.\n7.  Suggest specific actionable takeaways or steps that can be taken based on the content.\n8.  Structure the note with clear headings, subheadings, and bullet points for easy readability.\n9.  Include the source URL at the end of the note.\n10. Add relevant keywords and tags that will help with future retrieval.',
    notesFolder: 'Summaries'
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
    private modelDropdown: HTMLSelectElement;
    private progressContainer: HTMLDivElement;
    private statusMessage: HTMLDivElement;
    private retryButton: HTMLButtonElement;
    private currentStep: number = 0;
    private steps: string[] = ['Fetch', 'Summarize', 'Create Note'];
    private statusSteps: { label: string, state: 'idle' | 'in-progress' | 'success' | 'error' }[] = [
        { label: 'Fetch Content/Transcript', state: 'idle' },
        { label: 'Prepare Request', state: 'idle' },
        { label: 'Call Gemini/OpenRouter', state: 'idle' },
        { label: 'Summary Generated', state: 'idle' }
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

        contentEl.createEl('h2', { text: 'your second brAIn' });

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

        this.resultArea = contentEl.createEl('div', { cls: 'ai-summarizer-result' }) as HTMLDivElement;
        this.resultArea.style.display = 'none';

        this.geminiClient = new GoogleGenerativeAI(this.plugin.settings.gemini.apiKey);

        // Model Dropdown
        const modelContainer = contentEl.createEl('div', { cls: 'ai-summarizer-model-container' });
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

        // Status Circles Indicator
        this.progressContainer = contentEl.createEl('div', { cls: 'ai-summarizer-progress-container' });
        this.statusMessage = contentEl.createEl('div', { cls: 'ai-summarizer-status-message' });
        this.retryButton = contentEl.createEl('button', { text: 'Retry', cls: 'ai-summarizer-retry-button' }) as HTMLButtonElement;
        this.retryButton.style.display = 'none';
        this.retryButton.onclick = () => {
            this.retryButton.style.display = 'none';
            this.statusMessage.innerText = '';
            this.startSummarizationFlow();
        };
        this.updateStatusSteps(0, 'Idle');

        this.summarizeButton.addEventListener('click', async () => {
            this.startSummarizationFlow();
        });

        this.createNoteButton.addEventListener('click', () => {
            this.handleCreateNoteButtonClick();
        });

        // Place status tracker below Summarize button
        buttonContainer.appendChild(this.summarizeButton);
        // Remove any old progress/loading indicator from the UI
        if (this.loadingIndicator) this.loadingIndicator.remove();
        if (this.progressContainer) this.progressContainer.remove();
        if (this.statusMessage) this.statusMessage.remove();
        if (this.retryButton) this.retryButton.remove();
        // Add the new status tracker below the Summarize button
        contentEl.appendChild(this.progressContainer);
        contentEl.appendChild(this.statusMessage);
        contentEl.appendChild(this.retryButton);
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

    private async startSummarizationFlow() {
        console.log('[startSummarizationFlow] Starting flow...');
        const url = this.urlInput.value;
        const prompt = this.promptInput.value;
        console.log('[startSummarizationFlow] URL:', url);
        console.log('[startSummarizationFlow] Prompt:', prompt);
        
        this.updateStatusSteps(0, 'Fetching content/transcript...');
        if (!url) {
            console.error('[startSummarizationFlow] URL is empty');
            new Notice('URL cannot be empty.');
            this.updateStatusSteps(0, 'URL cannot be empty.', true);
            return;
        }
        if (!prompt) {
            console.error('[startSummarizationFlow] Prompt is empty');
            new Notice('Prompt cannot be empty.');
            this.updateStatusSteps(0, 'Prompt cannot be empty.', true);
            return;
        }
        try {
            console.log('[startSummarizationFlow] Clearing UI elements...');
            if (!this.resultArea) {
                console.error('[startSummarizationFlow] resultArea is undefined!');
                this.resultArea = this.containerEl.createEl('div', { cls: 'ai-summarizer-result' }) as HTMLDivElement;
            }
            this.resultArea.innerText = '';
            this.summaryTextArea.style.display = 'none';
            this.createNoteButton.style.display = 'none';
            
            let content = '';
            // Step 1: Fetch
            console.log('[startSummarizationFlow] Starting content fetch...');
            if (url.includes('youtube.com')) {
                console.log('[startSummarizationFlow] Fetching YouTube transcript...');
                content = await this.fetchTranscriptFromPython(url);
                if (content.startsWith('Error:') || content.includes('[ERROR]')) {
                    console.error('[startSummarizationFlow] Transcript fetch failed:', content);
                    new Notice('Failed to fetch transcript. ' + content);
                    this.updateStatusSteps(0, 'Failed to fetch transcript. ' + content, true);
                    return;
                }
            } else {
                console.log('[startSummarizationFlow] Fetching web content...');
                content = await this.fetchContentFromWebLink(url);
                if (!content || content.startsWith('Error:') || content.includes('[ERROR]')) {
                    console.error('[startSummarizationFlow] Content fetch failed');
                    new Notice('Failed to fetch content. Please check the URL.');
                    this.updateStatusSteps(0, 'Failed to fetch content. Please check the URL.', true);
                    return;
                }
            }
            
            // Additional validation to ensure we have meaningful content
            if (!content || content.trim().length < 50) {
                console.error('[startSummarizationFlow] Content too short or empty');
                new Notice('Failed to fetch meaningful content. Please check the URL.');
                this.updateStatusSteps(0, 'Failed to fetch meaningful content.', true);
                return;
            }
            
            console.log('[startSummarizationFlow] Content fetched successfully, length:', content.length);
            
            this.updateStatusSteps(1, 'Preparing request...');
            await new Promise(res => setTimeout(res, 200));
            
            this.updateStatusSteps(2, 'Calling Gemini/OpenRouter...');
            console.log('[startSummarizationFlow] Starting content summarization...');
            const result = await this.summarizeContent(content, prompt, url);
            if (!result.summary) {
                console.error('[startSummarizationFlow] Summary generation failed');
                new Notice('Failed to generate summary.');
                this.updateStatusSteps(2, 'Failed to generate summary.', true);
                return;
            }
            console.log('[startSummarizationFlow] Summary generated successfully, length:', result.summary.length);
            
            this.updateStatusSteps(3, 'Summary generated!');
            await new Promise(res => setTimeout(res, 200));
            
            console.log('[startSummarizationFlow] Updating UI with summary...');
            this.summaryTextArea.value = result.summary;
            this.summaryTextArea.style.display = 'block';
            this.createNoteButton.style.display = 'block';
            
            // Store metadata for later use
            this.currentMetadata = result.metadata;
            this.currentTitle = result.title;
            
            console.log('[startSummarizationFlow] Flow completed successfully');
        } catch (error) {
            console.error('[startSummarizationFlow] Error in flow:', error);
            new Notice(`Error: ${error.message}`);
            this.updateStatusSteps(this.statusSteps.findIndex(s => s.state === 'in-progress'), `Error: ${error.message}`, true);
        }
    }

    private async handleCreateNoteButtonClick() {
        const summary = this.summaryTextArea.value;
        const url = this.urlInput.value;

        if (summary) {
            try {
                const title = this.currentTitle || 'Untitled';
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
        
        // Enhanced prompt that includes metadata generation
        const enhancedPrompt = `${prompt}\n\nPlease structure your response in the following format:\n\nTITLE: [Your concise, descriptive title here]\n\nMETADATA:\n- Author: [Author name if available]\n- Key Topics: [3-5 main topics]\n- Tags: [3 relevant hashtags]\n- Related Concepts: [2-3 related concepts]\n\nSUMMARY:\n[Your detailed summary here]\n\nKEY INSIGHTS:\n- [Important insight 1]\n- [Important insight 2]\n- [Important insight 3]\n\nACTION ITEMS:\n- [Actionable item 1]\n- [Actionable item 2]`;
        
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
                
                // Parse the response to extract title, metadata, and summary
                const titleMatch = responseText.match(/TITLE:\s*(.*?)(?:\n|$)/i);
                const title = titleMatch ? titleMatch[1].trim() : 'Untitled';
                
                // Extract metadata
                const metadataMatch = responseText.match(/METADATA:\n([\s\S]*?)(?:\n\n|$)/i);
                const metadataText = metadataMatch ? metadataMatch[1].trim() : '';
                const metadata = this.parseMetadata(metadataText);
                
                // Extract summary and other sections
                const summaryMatch = responseText.match(/SUMMARY:\n([\s\S]*?)(?:\n\nKEY INSIGHTS:|$)/i);
                const summary = summaryMatch ? summaryMatch[1].trim() : '';
                
                const insightsMatch = responseText.match(/KEY INSIGHTS:\n([\s\S]*?)(?:\n\nACTION ITEMS:|$)/i);
                const insights = insightsMatch ? insightsMatch[1].trim() : '';
                
                const actionsMatch = responseText.match(/ACTION ITEMS:\n([\s\S]*?)(?:\n\n|$)/i);
                const actions = actionsMatch ? actionsMatch[1].trim() : '';
                
                return { 
                    summary: this.formatSummary(summary, insights, actions),
                    title,
                    metadata
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
                
                // Parse the response to extract title, metadata, and summary
                const titleMatch = responseText.match(/TITLE:\s*(.*?)(?:\n|$)/i);
                const title = titleMatch ? titleMatch[1].trim() : 'Untitled';
                
                // Extract metadata
                const metadataMatch = responseText.match(/METADATA:\n([\s\S]*?)(?:\n\n|$)/i);
                const metadataText = metadataMatch ? metadataMatch[1].trim() : '';
                const metadata = this.parseMetadata(metadataText);
                
                // Extract summary and other sections
                const summaryMatch = responseText.match(/SUMMARY:\n([\s\S]*?)(?:\n\nKEY INSIGHTS:|$)/i);
                const summary = summaryMatch ? summaryMatch[1].trim() : '';
                
                const insightsMatch = responseText.match(/KEY INSIGHTS:\n([\s\S]*?)(?:\n\nACTION ITEMS:|$)/i);
                const insights = insightsMatch ? insightsMatch[1].trim() : '';
                
                const actionsMatch = responseText.match(/ACTION ITEMS:\n([\s\S]*?)(?:\n\n|$)/i);
                const actions = actionsMatch ? actionsMatch[1].trim() : '';
                
                return { 
                    summary: this.formatSummary(summary, insights, actions),
                    title,
                    metadata
                };
            } catch (error) {
                new Notice(`OpenRouter API Error: ${error.message}`);
                console.error('[SummarizeContent] OpenRouter API error:', error);
                return { summary: '', title: 'Untitled', metadata: {} };
            }
        }
        return { summary: '', title: 'Untitled', metadata: {} };
    }

    private parseMetadata(metadataText: string): any {
        const metadata: any = {};
        const lines = metadataText.split('\n');
        
        for (const line of lines) {
            const [key, value] = line.split(':').map(s => s.trim());
            if (key && value) {
                switch (key.toLowerCase()) {
                    case 'author':
                        metadata.author = value;
                        break;
                    case 'key topics':
                        metadata.topics = value.split(',').map(t => t.trim());
                        break;
                    case 'tags':
                        metadata.tags = value.split(',').map(t => t.trim());
                        break;
                    case 'related concepts':
                        metadata.related = value.split(',').map(t => t.trim());
                        break;
                }
            }
        }
        
        return metadata;
    }

    private formatSummary(summary: string, insights: string, actions: string): string {
        let formattedContent = '';
        
        // Add summary section with callout
        formattedContent += `> [!summary] Summary\n> ${summary.replace(/\n/g, '\n> ')}\n\n`;
        
        // Add key insights section with callout
        if (insights) {
            formattedContent += `> [!insight] Key Insights\n> ${insights.replace(/\n/g, '\n> ')}\n\n`;
        }
        
        // Add action items section with callout and convert to checkboxes
        if (actions) {
            formattedContent += `> [!todo] Action Items\n`;
            // Convert each action item to a checkbox
            const actionItems = actions.split('\n').filter(line => line.trim().startsWith('-'));
            actionItems.forEach(item => {
                // Remove the leading dash and trim
                const cleanItem = item.replace(/^-\s*/, '').trim();
                formattedContent += `> - [ ] ${cleanItem}\n`;
            });
            formattedContent += '\n';
        }
        
        return formattedContent;
    }

    private async createNoteWithSummary(summary: string, title: string, url: string): Promise<TFile | null> {
        const folderPath = this.plugin.settings.notesFolder;
        const fileName = this.sanitizeFileName(title + '.md');
        
        // Create YAML frontmatter
        const frontmatter = {
            title: title,
            date: new Date().toISOString().split('T')[0],
            type: 'summary',
            source: {
                type: url.includes('youtube.com') ? 'youtube' : 'web',
                url: url
            },
            tags: this.currentMetadata?.tags || [],
            topics: this.currentMetadata?.topics || [],
            related: this.currentMetadata?.related || [],
            status: 'draft',
            created: new Date().toISOString(),
            modified: new Date().toISOString()
        };

        // Format the content with YAML frontmatter
        const fileContent = `---
${Object.entries(frontmatter).map(([key, value]) => {
    if (typeof value === 'object') {
        return `${key}:\n${Object.entries(value).map(([k, v]) => `  ${k}: ${v}`).join('\n')}`;
    }
    return `${key}: ${value}`;
}).join('\n')}
---

${summary}

> [!source] Source
> ${url}

${this.currentMetadata?.author ? `> [!author] Author\n> ${this.currentMetadata.author}\n\n` : ''}`;

        console.log('[CreateNote] Creating note. Folder:', folderPath, 'File:', fileName);
        try {
            const folder = this.app.vault.getAbstractFileByPath(folderPath) as TFolder;
            if (!folder) {
                await this.app.vault.createFolder(folderPath);
                console.log('[CreateNote] Folder created:', folderPath);
            }
            const newFile = await this.app.vault.create(`${folderPath}/${fileName}`, fileContent);
            console.log('[CreateNote] Note created:', `${folderPath}/${fileName}`);
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

class AISummarizerPlugin extends Plugin {
    settings: PluginSettings;
    firstRun: boolean = true;

    async onload() {
        await this.loadSettings();

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