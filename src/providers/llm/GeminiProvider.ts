/**
 * Gemini Provider - Google Generative AI implementation
 */

import { GoogleGenerativeAI, GenerateContentRequest } from '@google/generative-ai';
import type { LLMProvider, LLMRequest, LLMResponse, LLMStreamChunk } from '../../types';

export class GeminiProvider implements LLMProvider {
  readonly name = 'gemini';
  readonly supportedModels = [
    'gemini-flash-lite-latest',
    'gemini-flash-latest',
    'gemini-pro-latest'
  ];

  private client: GoogleGenerativeAI | null = null;
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    if (apiKey) {
      this.client = new GoogleGenerativeAI(apiKey);
    }
  }

  /**
   * Generate text using Gemini API
   */
  async generateText(request: LLMRequest): Promise<LLMResponse> {
    if (!this.client) {
      throw new Error('Gemini provider not configured - missing API key');
    }

    const model = this.client.getGenerativeModel({ 
      model: request.model || 'gemini-flash-lite-latest' 
    }, { apiVersion: 'v1beta' });

    const geminiRequest: GenerateContentRequest = {
      contents: [{
        role: 'user',
        parts: [{ text: this.buildPrompt(request) }]
      }]
    };

    // Add generation config if specified
    if (request.temperature !== undefined || request.maxTokens !== undefined) {
      geminiRequest.generationConfig = {};
      if (request.temperature !== undefined) {
        geminiRequest.generationConfig.temperature = request.temperature;
      }
      if (request.maxTokens !== undefined) {
        geminiRequest.generationConfig.maxOutputTokens = request.maxTokens;
      }
    }

    let lastError: Error | null = null;
    const maxRetries = 3;
    
    for (let i = 0; i < maxRetries; i++) {
        try {
            const result = await model.generateContent(geminiRequest);
            const responseText = result.response.text();
            
            // Extract usage information if available
            const usageMetadata = (result.response as unknown as Record<string, unknown>).usageMetadata as Record<string, unknown> | undefined;
            const usage = usageMetadata ? {
                promptTokens: (usageMetadata.promptTokenCount as number) || 0,
                completionTokens: (usageMetadata.candidatesTokenCount as number) || 0,
                totalTokens: (usageMetadata.totalTokenCount as number) || 0
            } : undefined;

            return {
                text: responseText,
                model: request.model || 'gemini-flash-lite-latest',
                usage,
                metadata: {
                    ...request.metadata,
                    finishReason: result.response.candidates?.[0]?.finishReason
                }
            };
        } catch (error) {
            lastError = error as Error;
            const errorMsg = (error as Error).message?.toLowerCase() || '';
            if (errorMsg.includes('429') || errorMsg.includes('too many requests')) {
                const waitTime = Math.pow(2, i + 1) * 1000 + Math.random() * 1000;
                console.warn(`[GeminiProvider] Rate limited (429). Retrying in ${Math.round(waitTime)}ms... (Attempt ${i + 1}/${maxRetries})`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
                continue;
            }
            throw error;
        }
    }
    throw new Error(`Gemini API error after ${maxRetries} retries: ${lastError?.message || 'Unknown error'}`);
  }

  /**
   * Stream text generation using Gemini API
   */
  async *streamText(request: LLMRequest): AsyncIterable<LLMStreamChunk> {
    if (!this.client) {
      throw new Error('Gemini provider not configured - missing API key');
    }

    const model = this.client.getGenerativeModel({ 
      model: request.model || 'gemini-flash-lite-latest' 
    }, { apiVersion: 'v1beta' });

    const geminiRequest: GenerateContentRequest = {
      contents: [{
        role: 'user',
        parts: [{ text: this.buildPrompt(request) }]
      }]
    };

    // Add generation config if specified
    if (request.temperature !== undefined || request.maxTokens !== undefined) {
      geminiRequest.generationConfig = {};
      if (request.temperature !== undefined) {
        geminiRequest.generationConfig.temperature = request.temperature;
      }
      if (request.maxTokens !== undefined) {
        geminiRequest.generationConfig.maxOutputTokens = request.maxTokens;
      }
    }

    try {
      const result = await model.generateContentStream(geminiRequest);
      
      for await (const chunk of result.stream) {
        const text = chunk.text();
        if (text) {
          yield {
            text,
            isComplete: false,
            metadata: request.metadata
          };
        }
      }

      // Final chunk to indicate completion
      yield {
        text: '',
        isComplete: true,
        metadata: request.metadata
      };
    } catch (error) {
      throw new Error(`Gemini streaming error: ${error.message}`);
    }
  }

  /**
   * Count tokens for the given text using Gemini's native API
   */
  async countTokens(text: string, modelId?: string): Promise<number> {
    if (!this.client) {
      return Math.ceil(text.length / 4);
    }

    try {
      const model = this.client.getGenerativeModel({ 
        model: modelId || 'gemini-flash-lite-latest' 
      }, { apiVersion: 'v1beta' });
      
      const result = await model.countTokens(text);
      return result.totalTokens;
    } catch (error) {
      console.warn('[GeminiProvider] countTokens failed, falling back to estimate:', error);
      return Math.ceil(text.length / 4);
    }
  }

  /**
   * Check if the provider is configured
   */
  isConfigured(): boolean {
    return !!(this.apiKey && this.client);
  }

  /**
   * Validate the configuration by making a test request
   */
  async validateConfig(): Promise<boolean> {
    if (!this.isConfigured()) {
      return false;
    }

    try {
      const model = this.client!.getGenerativeModel({ model: 'gemini-flash-lite-latest' }, { apiVersion: 'v1beta' });
      const result = await model.generateContent({
        contents: [{
          role: 'user',
          parts: [{ text: 'Test' }]
        }]
      });
      
      return !!result.response.text();
    } catch {
      return false;
    }
  }

  /**
   * Build the complete prompt including system prompt if provided
   */
  private buildPrompt(request: LLMRequest): string {
    if (request.systemPrompt) {
      return `${request.systemPrompt}\n\n${request.prompt}`;
    }
    return request.prompt;
  }
}