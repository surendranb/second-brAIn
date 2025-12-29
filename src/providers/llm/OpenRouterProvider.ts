/**
 * OpenRouter Provider - OpenAI-compatible implementation for OpenRouter
 */

import { requestUrl } from 'obsidian';
import type { LLMProvider, LLMRequest, LLMResponse, LLMStreamChunk } from '../../types';

export class OpenRouterProvider implements LLMProvider {
  readonly name = 'openrouter';
  readonly supportedModels = [
    'openai/gpt-oss-120b:free',
    'google/gemma-3-27b-it:free',
    'google/gemini-2.0-flash-exp:free'
  ];

  private apiKey: string;
  private baseUrl = 'https://openrouter.ai/api/v1';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  /**
   * Generate text using OpenRouter API
   */
  async generateText(request: LLMRequest): Promise<LLMResponse> {
    if (!this.apiKey) {
      throw new Error('OpenRouter provider not configured - missing API key');
    }

    const model = request.model || 'google/gemini-2.0-flash-exp:free';
    
    const messages = [];
    if (request.systemPrompt) {
      messages.push({ role: 'system', content: request.systemPrompt });
    }
    messages.push({ role: 'user', content: request.prompt });

    try {
      const response = await requestUrl({
        url: `${this.baseUrl}/chat/completions`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'HTTP-Referer': 'https://obsidian.md',
          'X-Title': 'Obsidian second-brAIn'
        },
        body: JSON.stringify({
          model: model,
          messages: messages,
          temperature: request.temperature ?? 0.7,
          max_tokens: request.maxTokens
        })
      });

      const result = response.json;
      const responseText = result.choices[0].message.content;
      
      return {
        text: responseText,
        model: model,
        usage: result.usage ? {
          promptTokens: result.usage.prompt_tokens,
          completionTokens: result.usage.completion_tokens,
          totalTokens: result.usage.total_tokens
        } : undefined,
        metadata: {
          ...request.metadata,
          finishReason: result.choices[0].finish_reason
        }
      };
    } catch (error) {
      throw new Error(`OpenRouter API error: ${error.message}`);
    }
  }

  /**
   * Stream text generation using OpenRouter API
   */
  async *streamText(request: LLMRequest): AsyncIterable<LLMStreamChunk> {
    // Basic implementation for now, OpenRouter supports SSE
    // For simplicity, we'll just yield the full response as a single chunk if streaming is not fully implemented
    const response = await this.generateText(request);
    yield {
      text: response.text,
      isComplete: true,
      metadata: response.metadata
    };
  }

  /**
   * Check if the provider is configured
   */
  isConfigured(): boolean {
    return !!this.apiKey;
  }

  /**
   * Validate the configuration by making a test request
   */
  async validateConfig(): Promise<boolean> {
    if (!this.apiKey) return false;

    try {
      const response = await this.generateText({
        prompt: 'Test',
        model: 'google/gemini-2.0-flash-exp:free',
        maxTokens: 5
      });
      return !!response.text;
    } catch (error) {
      return false;
    }
  }
}