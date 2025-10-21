/**
 * Gemini Provider - Google Generative AI implementation
 */

import { GoogleGenerativeAI, GenerateContentRequest } from '@google/generative-ai';
import type { LLMProvider, LLMRequest, LLMResponse, LLMStreamChunk } from '../../types';

export class GeminiProvider implements LLMProvider {
  readonly name = 'gemini';
  readonly supportedModels = [
    'gemini-2.5-pro',
    'gemini-2.5-flash', 
    'gemini-2.5-flash-lite',
    'gemini-2.0-flash'
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
      model: request.model || 'gemini-2.5-flash' 
    });

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
      const result = await model.generateContent(geminiRequest);
      const responseText = result.response.text();
      
      // Extract usage information if available
      const usage = (result.response as any).usageMetadata ? {
        promptTokens: (result.response as any).usageMetadata.promptTokenCount || 0,
        completionTokens: (result.response as any).usageMetadata.candidatesTokenCount || 0,
        totalTokens: (result.response as any).usageMetadata.totalTokenCount || 0
      } : undefined;

      return {
        text: responseText,
        model: request.model || 'gemini-2.5-flash',
        usage,
        metadata: {
          ...request.metadata,
          finishReason: result.response.candidates?.[0]?.finishReason
        }
      };
    } catch (error) {
      throw new Error(`Gemini API error: ${error.message}`);
    }
  }

  /**
   * Stream text generation using Gemini API
   */
  async *streamText(request: LLMRequest): AsyncIterable<LLMStreamChunk> {
    if (!this.client) {
      throw new Error('Gemini provider not configured - missing API key');
    }

    const model = this.client.getGenerativeModel({ 
      model: request.model || 'gemini-2.5-flash' 
    });

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
      const model = this.client!.getGenerativeModel({ model: 'gemini-2.5-flash' });
      const result = await model.generateContent({
        contents: [{
          role: 'user',
          parts: [{ text: 'Test' }]
        }]
      });
      
      return !!result.response.text();
    } catch (error) {
      console.error('Gemini config validation failed:', error);
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