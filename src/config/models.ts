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
        id: 'gemini-2.5-pro',
        name: 'Gemini 2.5 PRO',
        description: 'Most advanced reasoning and multimodal model'
    },
    {
        id: 'gemini-2.5-flash',
        name: 'Gemini 2.5 Flash',
        description: 'Best price-performance, well-rounded capabilities'
    },
    {
        id: 'gemini-2.5-flash-lite',
        name: 'Gemini 2.5 Flash-Lite',
        description: 'Cost-efficient, low-latency model'
    },
    {
        id: 'gemini-2.0-flash',
        name: 'Gemini 2.0 Flash',
        description: 'Fast, next-gen multimodal model'
    },
    {
        id: 'gemma-3-27b-it',
        name: 'Gemma 3 27B IT',
        description: 'High-performance open model for complex reasoning'
    },
    {
        id: 'gemma-3-12b-it',
        name: 'Gemma 3 12B IT',
        description: 'Efficient open model for speed and capability'
    }
];

// Available OpenRouter Models
export const OPENROUTER_MODELS: GeminiModel[] = [
    {
        id: 'openai/gpt-oss-120b:free',
        name: 'GPT-OSS 120B (Free)',
        description: 'Large open-source model via OpenRouter'
    },
    {
        id: 'google/gemma-3-27b-it:free',
        name: 'Gemma 3 27B IT (Free)',
        description: 'High-performance Gemma 3 via OpenRouter'
    },
    {
        id: 'google/gemini-2.0-flash-exp:free',
        name: 'Gemini 2.0 Flash Exp (Free)',
        description: 'Next-gen fast model via OpenRouter'
    }
];