/**
 * Token and cost calculation utilities
 * Extracted from main.ts for better modularity
 */

/**
 * Estimates token count from text (rough approximation)
 */
export function estimateTokens(text: string): number {
    // Rough estimation: ~4 characters per token
    return Math.ceil(text.length / 4);
}

/**
 * Calculates cost for Gemini API usage
 */
export function calculateCost(inputTokens: number, outputTokens: number, model: string): number {
    // Gemini pricing per million tokens
    const pricing: Record<string, {
        input: { small: number; large: number; threshold: number };
        output: { small: number; large: number; threshold: number };
    }> = {
        'gemini-2.5-pro': {
            input: { small: 1.25, large: 2.50, threshold: 200000 },
            output: { small: 10.00, large: 15.00, threshold: 200000 }
        },
        'gemini-2.5-flash': {
            input: { small: 0.30, large: 0.30, threshold: Infinity },
            output: { small: 2.50, large: 2.50, threshold: Infinity }
        },
        'gemini-2.5-flash-lite': {
            input: { small: 0.10, large: 0.10, threshold: Infinity },
            output: { small: 0.40, large: 0.40, threshold: Infinity }
        },
        'gemini-2.0-flash': {
            input: { small: 0.10, large: 0.10, threshold: Infinity },
            output: { small: 0.40, large: 0.40, threshold: Infinity }
        },
        'gemma-3-27b-it': {
            input: { small: 0.20, large: 0.20, threshold: Infinity },
            output: { small: 0.20, large: 0.20, threshold: Infinity }
        },
        'gemma-3-12b-it': {
            input: { small: 0.10, large: 0.10, threshold: Infinity },
            output: { small: 0.10, large: 0.10, threshold: Infinity }
        },
        'openai/gpt-oss-120b:free': {
            input: { small: 0, large: 0, threshold: Infinity },
            output: { small: 0, large: 0, threshold: Infinity }
        },
        'google/gemma-3-27b-it:free': {
            input: { small: 0, large: 0, threshold: Infinity },
            output: { small: 0, large: 0, threshold: Infinity }
        },
        'google/gemini-2.0-flash-exp:free': {
            input: { small: 0, large: 0, threshold: Infinity },
            output: { small: 0, large: 0, threshold: Infinity }
        }
    };

    const modelPricing = pricing[model] || pricing['gemini-2.5-flash']; // Default fallback

    // Calculate input cost
    const inputRate = inputTokens > modelPricing.input.threshold
        ? modelPricing.input.large
        : modelPricing.input.small;
    const inputCost = (inputTokens / 1000000) * inputRate;

    // Calculate output cost (FIXED: use outputTokens for threshold check)
    const outputRate = outputTokens > modelPricing.output.threshold
        ? modelPricing.output.large
        : modelPricing.output.small;
    const outputCost = (outputTokens / 1000000) * outputRate;

    return inputCost + outputCost;
}

/**
 * Formats token count for display
 */
export function formatTokens(tokens: number): string {
    if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(1)}M`;
    if (tokens >= 1000) return `${(tokens / 1000).toFixed(0)}K`;
    return `${tokens}`;
}