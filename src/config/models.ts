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
    }
];