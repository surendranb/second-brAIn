/**
 * Token and cost calculation utilities
 * Extracted from main.ts for better modularity
 */

/**
 * Estimates token count from text with higher precision than length/4.
 * Uses a word-based heuristic (approx 1.3 tokens per word for English)
 */
export function estimateTokens(text: string): number {
    if (!text) return 0;
    const wordCount = text.trim().split(/\s+/).length;
    return Math.ceil(wordCount * 1.35); // Heuristic for Gemini/GPT models
}

/**
 * Normalizes model names to canonical versions for pricing
 */
export function normalizeModelName(model: string): string {
    const m = model.toLowerCase();
    if (m.includes('flash-lite')) return 'gemini-flash-lite-latest';
    if (m.includes('pro')) return 'gemini-pro-latest';
    if (m.includes('flash')) return 'gemini-flash-latest';
    return model;
}

/**
 * Calculates cost for Gemini API usage based on specific user-defined rates
 */
export function calculateCost(inputTokens: number, outputTokens: number, model: string): number {
    const normalizedModel = normalizeModelName(model);
    const totalTokens = inputTokens + outputTokens;
    
    let inputRate = 0;
    let outputRate = 0;

    switch (normalizedModel) {
        case 'gemini-flash-lite-latest':
            inputRate = 0.1;
            outputRate = 0.4;
            break;
        case 'gemini-flash-latest':
            inputRate = 0.3;
            outputRate = 2.5;
            break;
        case 'gemini-pro-latest':
            // Pro pricing shifts at 200K tokens
            if (totalTokens > 200000) {
                inputRate = 2.5;
                outputRate = 15.0;
            } else {
                inputRate = 1.25;
                outputRate = 10.0;
            }
            break;
        default:
            // Fallback to Flash pricing
            inputRate = 0.3;
            outputRate = 2.5;
    }

    const inputCost = (inputTokens / 1000000) * inputRate;
    const outputCost = (outputTokens / 1000000) * outputRate;

    return inputCost + outputCost;
}

/**
 * Formats token count for display
 */
export function formatTokens(tokens: number): string {
    if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(1)}M`;
    if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}K`;
    return `${tokens}`;
}