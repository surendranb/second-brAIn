/**
 * Core types and interfaces for LLM providers
 */

export interface LLMRequest {
  prompt: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  metadata?: Record<string, any>;
}

export interface LLMResponse {
  text: string;
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  metadata?: Record<string, any>;
}

export interface LLMStreamChunk {
  text: string;
  isComplete: boolean;
  metadata?: Record<string, any>;
}

export interface LLMProvider {
  readonly name: string;
  readonly supportedModels: string[];
  
  generateText(request: LLMRequest): Promise<LLMResponse>;
  streamText(request: LLMRequest): AsyncIterable<LLMStreamChunk>;
  isConfigured(): boolean;
  validateConfig(): Promise<boolean>;
}

export interface LLMConfig {
  provider: 'gemini' | 'openai' | 'claude' | 'local';
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}