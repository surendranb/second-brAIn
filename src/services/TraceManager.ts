/**
 * Trace Manager - Provider-agnostic tracing service that wraps LLM service
 */

import type { 
  TraceProvider, 
  TraceMetadata, 
  GenerationMetadata, 
  SpanMetadata,
  TraceContext,
  LLMRequest,
  LLMResponse
} from '../types';
import { LLMService } from './LLMService';

export class TraceManager {
  private provider: TraceProvider;
  private llmService: LLMService;
  private activeTraces: Map<string, string> = new Map();
  
  constructor(llmService: LLMService, provider: TraceProvider) {
    this.llmService = llmService;
    this.provider = provider;
  }
  
  /**
   * Generate text with automatic tracing
   */
  async generateText(request: LLMRequest, traceContext?: TraceContext): Promise<LLMResponse> {
    const traceId = traceContext?.traceId || await this.startTrace({
      name: 'llm-generation',
      input: { prompt: request.prompt, model: request.model },
      metadata: request.metadata
    });
    
    const generationId = await this.provider.startGeneration(traceId, {
      model: request.model,
      prompt: request.prompt,
      modelParameters: {
        temperature: request.temperature,
        maxTokens: request.maxTokens
      }
    });
    
    try {
      const response = await this.llmService.generateText(request);
      
      await this.provider.endGeneration(generationId, {
        completion: response.text,
        usage: response.usage,
        metadata: response.metadata
      });
      
      if (!traceContext?.traceId) {
        await this.endTrace(traceId, { output: response.text });
      }
      
      return response;
    } catch (error) {
      await this.provider.endGeneration(generationId, {
        metadata: { error: error.message }
      });
      
      if (!traceContext?.traceId) {
        await this.endTrace(traceId, { 
          metadata: { error: error.message, status: 'error' }
        });
      }
      
      throw error;
    }
  }
  
  /**
   * Start a new trace
   */
  async startTrace(metadata: TraceMetadata): Promise<string> {
    if (!this.provider.isConfigured()) {
      return 'no-trace'; // Return dummy ID when tracing disabled
    }
    
    return await this.provider.startTrace(metadata);
  }
  
  /**
   * End a trace
   */
  async endTrace(traceId: string, metadata?: TraceMetadata): Promise<void> {
    if (traceId === 'no-trace') return;
    
    await this.provider.endTrace(traceId, metadata);
    this.activeTraces.delete(traceId);
  }
  
  /**
   * Execute an operation within a span for tracking
   */
  async withSpan<T>(
    name: string, 
    operation: (spanId: string) => Promise<T>,
    traceId?: string,
    metadata?: SpanMetadata
  ): Promise<T> {
    if (!this.provider.isConfigured()) {
      return await operation('no-span');
    }
    
    const actualTraceId = traceId || await this.startTrace({ name });
    const spanId = await this.provider.startSpan(actualTraceId, name, metadata);
    
    try {
      const result = await operation(spanId);
      await this.provider.endSpan(spanId, { metadata: { status: 'success' } });
      
      if (!traceId) {
        await this.endTrace(actualTraceId);
      }
      
      return result;
    } catch (error) {
      await this.provider.endSpan(spanId, { 
        metadata: { error: error.message, status: 'error' } 
      });
      
      if (!traceId) {
        await this.endTrace(actualTraceId, { 
          metadata: { error: error.message, status: 'error' }
        });
      }
      
      throw error;
    }
  }
  
  /**
   * Check if tracing is configured and available
   */
  isTracingEnabled(): boolean {
    return this.provider.isConfigured();
  }
  
  /**
   * Flush any pending traces
   */
  async flush(): Promise<void> {
    if (this.provider.isConfigured()) {
      await this.provider.flush();
    }
  }
}