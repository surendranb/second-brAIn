/**
 * LLM Service - Provider-agnostic LLM service layer
 */

import type { LLMProvider, LLMRequest, LLMResponse, LLMStreamChunk } from '../types';

export class LLMService {
  private provider: LLMProvider;
  
  constructor(provider: LLMProvider) {
    this.provider = provider;
  }
  
  /**
   * Generate text using the configured LLM provider
   */
  async generateText(request: LLMRequest): Promise<LLMResponse> {
    if (!this.provider.isConfigured()) {
      throw new Error(`LLM provider ${this.provider.name} is not configured`);
    }
    
    return await this.provider.generateText(request);
  }
  
  /**
   * Stream text generation using the configured LLM provider
   */
  async *streamText(request: LLMRequest): AsyncIterable<LLMStreamChunk> {
    if (!this.provider.isConfigured()) {
      throw new Error(`LLM provider ${this.provider.name} is not configured`);
    }
    
    yield* this.provider.streamText(request);
  }
  
  /**
   * Get information about the current provider
   */
  getProviderInfo(): { name: string; models: string[] } {
    return {
      name: this.provider.name,
      models: this.provider.supportedModels
    };
  }
  
  /**
   * Check if the current provider is properly configured
   */
  isConfigured(): boolean {
    return this.provider.isConfigured();
  }
  
  /**
   * Validate the current provider configuration
   */
  async validateConfig(): Promise<boolean> {
    return await this.provider.validateConfig();
  }
}