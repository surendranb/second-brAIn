/**
 * Trace Manager - Provider-agnostic tracing service that wraps LLM service
 */

import type { 
  TraceProvider, 
  TraceMetadata, 
  SpanMetadata,
  TraceContext,
  LLMRequest,
  LLMResponse
} from '../types';
import { LLMService } from './LLMService';
import { UsageHistoryManager, type UsageRecord } from './UsageHistoryManager';
import { calculateCost, formatTokens } from '../utils';

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

export type UsageCallback = (event: UsageEvent) => void;

export class TraceManager {
  private provider: TraceProvider;
  private llmService: LLMService;
  private usageCallbacks: UsageCallback[] = [];
  private usageHistoryManager: UsageHistoryManager | null = null;
  private currentNoteUsage: { 
    noteId: string | null;
    inputTokens: number; 
    outputTokens: number; 
    cost: number;
    model: string | null;
  } = { 
    noteId: null,
    inputTokens: 0, 
    outputTokens: 0, 
    cost: 0,
    model: null
  };
  
  constructor(llmService: LLMService, provider: TraceProvider) {
    this.llmService = llmService;
    this.provider = provider;
  }

  setUsageHistoryManager(manager: UsageHistoryManager): void {
    this.usageHistoryManager = manager;
  }
  
  async generateText(request: LLMRequest, traceContext?: TraceContext): Promise<LLMResponse> {
    if (traceContext?.traceId) {
      return this.generateTextWithinTrace(request, traceContext);
    }
    
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
      
      const cost = calculateCost(
        response.usage?.promptTokens || 0,
        response.usage?.completionTokens || 0,
        request.model || 'gemini-2.5-flash'
      );

      await this.provider.endGeneration(generationId, {
        completion: response.text,
        usage: response.usage,
        metadata: response.metadata
      });
      
      await this.endTrace(traceId, { output: response.text });
      
      this.emitUsageEvent({
        type: 'generation',
        promptTokens: response.usage?.promptTokens || 0,
        completionTokens: response.usage?.completionTokens || 0,
        totalTokens: response.usage?.totalTokens || 0,
        cost,
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
      const cost = calculateCost(
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
      
      this.emitUsageEvent({
        type: 'generation',
        promptTokens: response.usage?.promptTokens || 0,
        completionTokens: response.usage?.completionTokens || 0,
        totalTokens: response.usage?.totalTokens || 0,
        cost: cost,
        model: request.model || 'gemini-2.5-flash',
        intent: request.metadata?.intent,
        pass: traceContext.pass,
        duration: duration
      });
      
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
  
  async startTrace(metadata: TraceMetadata): Promise<string> {
    if (!this.provider.isConfigured()) return 'no-trace';
    return await this.provider.startTrace(metadata);
  }
  
  async endTrace(traceId: string, metadata?: TraceMetadata): Promise<void> {
    if (traceId === 'no-trace') return;
    await this.provider.endTrace(traceId, metadata);
  }
  
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
      if (!traceId) await this.endTrace(actualTraceId);
      return result;
    } catch (error) {
      await this.provider.endSpan(spanId, { metadata: { error: error.message, status: 'error' } });
      if (!traceId) await this.endTrace(actualTraceId, { metadata: { error: error.message, status: 'error' } });
      throw error;
    }
  }
  
  isTracingEnabled(): boolean {
    return this.provider.isConfigured();
  }
  
  async flush(): Promise<void> {
    if (this.provider.isConfigured()) await this.provider.flush();
  }

  onUsage(callback: UsageCallback): void {
    this.usageCallbacks.push(callback);
  }

  offUsage(callback: UsageCallback): void {
    const index = this.usageCallbacks.indexOf(callback);
    if (index > -1) this.usageCallbacks.splice(index, 1);
  }

  private emitUsageEvent(event: UsageEvent): void {
    this.currentNoteUsage.inputTokens += event.promptTokens;
    this.currentNoteUsage.outputTokens += event.completionTokens;
    this.currentNoteUsage.cost += event.cost;
    this.currentNoteUsage.model = event.model;

    this.usageCallbacks.forEach(callback => {
      try {
        callback(event);
      } catch (error) {
        console.error('Error in usage callback:', error);
      }
    });
  }

  startNoteTracking(noteId: string): void {
    this.currentNoteUsage = {
      noteId: noteId,
      inputTokens: 0,
      outputTokens: 0,
      cost: 0,
      model: null
    };
  }

  async completeNoteTracking(): Promise<UsageRecord | null> {
    if (!this.currentNoteUsage.noteId || !this.usageHistoryManager) return null;

    const record: UsageRecord = {
      noteId: this.currentNoteUsage.noteId,
      timestamp: new Date().toISOString(),
      inputTokens: this.currentNoteUsage.inputTokens,
      outputTokens: this.currentNoteUsage.outputTokens,
      cost: this.currentNoteUsage.cost,
      model: this.currentNoteUsage.model || 'unknown'
    };

    await this.usageHistoryManager.addRecord(record);
    this.resetCurrentNoteUsage();
    return record;
  }

  getCurrentNoteUsage(): { inputTokens: number; outputTokens: number; cost: number } {
    return {
      inputTokens: this.currentNoteUsage.inputTokens,
      outputTokens: this.currentNoteUsage.outputTokens,
      cost: this.currentNoteUsage.cost
    };
  }

  async getUsageMetrics() {
    if (!this.usageHistoryManager) {
      return {
        lifetime: { notes: 0, inputTokens: 0, outputTokens: 0, totalTokens: 0, cost: 0 },
        today: { notes: 0, inputTokens: 0, outputTokens: 0, totalTokens: 0, cost: 0 }
      };
    }
    return await this.usageHistoryManager.getMetrics();
  }

  resetCurrentNoteUsage(): void {
    this.currentNoteUsage = {
      noteId: null,
      inputTokens: 0,
      outputTokens: 0,
      cost: 0,
      model: null
    };
  }

  formatTokens(tokens: number): string {
    return formatTokens(tokens);
  }
}