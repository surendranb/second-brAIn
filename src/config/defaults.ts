/**
 * Default plugin settings
 * Extracted from main.ts for better modularity
 */

import { DEFAULT_SUMMARIZATION_PROMPT } from '../../prompts';
import { GEMINI_MODELS, OPENROUTER_MODELS } from './models';
import type { ProcessingIntent } from './intents';

// Provider Types
export type Provider = 'gemini' | 'openrouter';

// Settings Interfaces
export interface GeminiSettings {
    apiKey: string;
    model: string;
    models: any[];
}

export interface OpenRouterSettings {
    apiKey: string;
    model: string;
    models: any[];
}

export interface LangfuseSettings {
    enabled: boolean;
    publicKey: string;
    secretKey: string;
    baseUrl: string;
}

export interface TopicFolderSettings {
    enabled: boolean;
    rootFolder: string;
    topics: string[];
}

export interface DebugSettings {
    enabled: boolean;
    saveRawContent: boolean;
    savePrompts: boolean;
    saveResponses: boolean;
    debugFolder: string;
    enablePromptTesting: boolean;
    useExperimentalPrompts: boolean;
    generateComparisons: boolean;
}

export interface PluginSettings {
    provider: Provider;
    gemini: GeminiSettings;
    openrouter: OpenRouterSettings;
    defaultPrompt: string;
    mocFolder: string;
    enableMOC: boolean;
    defaultIntent: ProcessingIntent;
    topicFolders: TopicFolderSettings;
    debug: DebugSettings;
    langfuse: LangfuseSettings;
    trackUsage: boolean;
}

// Default Settings
export const DEFAULT_SETTINGS: PluginSettings = {
    provider: 'gemini',
    gemini: {
        apiKey: '',
        model: 'gemini-2.5-flash',
        models: GEMINI_MODELS
    },
    openrouter: {
        apiKey: '',
        model: 'google/gemini-2.0-flash-exp:free',
        models: OPENROUTER_MODELS
    },
    defaultPrompt: DEFAULT_SUMMARIZATION_PROMPT,
    mocFolder: 'MOCs',
    enableMOC: true,
    defaultIntent: 'knowledge_building',
    topicFolders: {
        enabled: true,
        rootFolder: 'Research Topics',
        topics: ['LLM Evals', 'AI Safety', 'Machine Learning', 'Data Science', 'Software Engineering']
    },
    debug: {
        enabled: false,
        saveRawContent: true,
        savePrompts: true,
        saveResponses: true,
        debugFolder: 'Debug',
        enablePromptTesting: false,
        useExperimentalPrompts: false,
        generateComparisons: false
    },
    langfuse: {
        enabled: false,
        publicKey: '',
        secretKey: '',
        baseUrl: 'https://cloud.langfuse.com'
    },
    trackUsage: true
};