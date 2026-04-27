/**
 * Gemini model configurations
 * Extracted from main.ts for better modularity
 */

export interface GeminiModel {
    id: string;
    name: string;
    description: string;
}

// Available Gemini Models
export const GEMINI_MODELS: GeminiModel[] = [
    {
        id: 'gemini-flash-lite-latest',
        name: 'Gemini 3 Flash-Lite',
        description: 'Fastest and most cost-efficient'
    },
    {
        id: 'gemini-flash-latest',
        name: 'Gemini 3 Flash',
        description: 'Balanced speed and intelligence'
    },
    {
        id: 'gemini-pro-latest',
        name: 'Gemini 3 Pro',
        description: 'Deep reasoning and complex synthesis'
    }
];

// Available OpenRouter Models
export const OPENROUTER_MODELS: GeminiModel[] = [
    {
        id: 'openai/gpt-oss-120b:free',
        name: 'GPT-OSS 120B (free)',
        description: 'Large open-source model via OpenRouter'
    },
    {
        id: 'google/gemma-3-27b-it:free',
        name: 'Gemma 3 27B IT (free)',
        description: 'High-performance Gemma 3 via OpenRouter'
    },
    {
        id: 'google/gemini-2.0-flash-exp:free',
        name: 'Gemini 2.0 Flash Exp (free)',
        description: 'Next-gen fast model via OpenRouter'
    }
];