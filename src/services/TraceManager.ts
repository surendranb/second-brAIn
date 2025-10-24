/**
 * Trace Manager - Provider-agnostic tracing service that wraps LLM service
 * Enhanced to serve as the single source of truth for token usage and cost tracking
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
import { calculateCost, formatTokens } from '../utils';

// Usage event for UI consumption
export interface UsageEvent {
  type: 'generation' | 'analysis' | 'research';
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cost: number;
  model: string;
  intent?: string;
  pass?: string;
  duration?: number;
}

// Usage callback type for UI updates
export type UsageCallback = (event: UsageEvent) => void;

export class TraceManager {
  private provider: TraceProvider;
  private llmService: LLMService;
  private activeTraces: Map<string, string> = new Map();
  
  // Usage tracking
  private usageCallbacks: UsageCallback[] = [];
  private currentNoteUsage: { tokens: number; cost: number } = { tokens: 0, cost: 0 };
  
  constructor(llmService: LLMService, provider: TraceProvider) {
    this.llmService = llmService;
    this.provider = provider;
  }
  
  /**
   * Generate text with automatic tracing
   */
  async generateText(request: LLMRequest, traceContext?: TraceContext): Promise<LLMResponse> {
    // If we have a trace context, use it for structured tracing
    if (traceContext?.traceId) {
      return this.generateTextWithinTrace(request, traceContext);
    }
    
    // Otherwise, create a simple auto-trace (legacy behavior)
    const traceId = await this.startTrace({
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
      
      await this.endTrace(traceId, { output: response.text });
      
      // Emit usage event for UI consumption
      this.emitUsageEvent({
        type: 'generation',
        promptTokens: response.usage?.promptTokens || 0,
        completionTokens: response.usage?.completionTokens || 0,
        totalTokens: response.usage?.totalTokens || 0,
        cost: this.calculateCost(
          response.usage?.promptTokens || 0,
          response.usage?.completionTokens || 0,
          request.model || 'gemini-2.5-flash'
        ),
        model: request.model || 'gemini-2.5-flash',
        intent: request.metadata?.intent,
        pass: request.metadata?.pass
      });
      
      return response;
    } catch (error) {
      await this.provider.endGeneration(generationId, {
        metadata: { error: error.message }
      });
      
      await this.endTrace(traceId, { 
        metadata: { error: error.message, status: 'error' }
      });
      
      throw error;
    }
  }

  /**
   * Generate text within an existing trace (for structured multi-pass analysis)
   */
  async generateTextWithinTrace(request: LLMRequest, traceContext: TraceContext): Promise<LLMResponse> {
    const startTime = Date.now();
    
    const generationId = await this.provider.startGeneration(traceContext.traceId, {
      name: traceContext.generationName || 'ai-generation',
      model: request.model,
      prompt: request.prompt,
      modelParameters: {
        temperature: request.temperature,
        maxTokens: request.maxTokens
      },
      metadata: {
        pass: traceContext.pass,
        intent: traceContext.intent,
        ...request.metadata
      }
    });
    
    try {
      const response = await this.llmService.generateText(request);
      const duration = Date.now() - startTime;
      
      // Calculate cost if not provided
      const cost = this.calculateCost(
        response.usage?.promptTokens || 0,
        response.usage?.completionTokens || 0,
        request.model || 'gemini-2.5-flash'
      );
      
      await this.provider.endGeneration(generationId, {
        completion: response.text,
        usage: response.usage,
        cost: cost,
        metadata: {
          duration_ms: duration,
          cost_usd: cost,
          pass: traceContext.pass,
          intent: traceContext.intent,
          status: 'completed'
        }
      });
      
      console.log(`[TraceManager] Generation completed - Pass: ${traceContext.pass}, Duration: ${duration}ms, Cost: $${cost.toFixed(4)}`);
      
      return response;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      await this.provider.endGeneration(generationId, {
        metadata: { 
          error: error.message,
          duration_ms: duration,
          pass: traceContext.pass,
          intent: traceContext.intent,
          status: 'error'
        }
      });
      
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

  /**
   * Calculate cost for token usage (enhanced with proper pricing tiers)
   */
  private calculateCost(promptTokens: number, completionTokens: number, model: string): number {
    // Use the enhanced cost calculation from utils (which has the pricing bug fixed)
    return calculateCost(promptTokens, completionTokens, model);
  }

  // ===== USAGE TRACKING METHODS =====

  /**
   * Add a callback to listen for usage events
   */
  onUsage(callback: UsageCallback): void {
    this.usageCallbacks.push(callback);
  }

  /**
   * Remove a usage callback
   */
  offUsage(callback: UsageCallback): void {
    const index = this.usageCallbacks.indexOf(callback);
    if (index > -1) {
      this.usageCallbacks.splice(index, 1);
    }
  }

  /**
   * Emit usage event to all listeners
   */
  private emitUsageEvent(event: UsageEvent): void {
    // Update current note usage
    this.currentNoteUsage.tokens += event.totalTokens;
    this.currentNoteUsage.cost += event.cost;

    // Notify all listeners
    this.usageCallbacks.forEach(callback => {
      try {
        callback(event);
      } catch (error) {
        console.error('[TraceManager] Error in usage callback:', error);
      }
    });

    console.log(`[TraceManager] Usage tracked - ${event.totalTokens} tokens, $${event.cost.toFixed(4)} (${event.model})`);
  }

  /**
   * Get current note usage stats
   */
  getCurrentNoteUsage(): { tokens: number; cost: number } {
    return { ...this.currentNoteUsage };
  }

  /**
   * Reset current note usage (call when starting a new note)
   */
  resetCurrentNoteUsage(): void {
    this.currentNoteUsage = { tokens: 0, cost: 0 };
  }

  /**
   * Format token count for display
   */
  formatTokens(tokens: number): string {
    return formatTokens(tokens);
  }
}