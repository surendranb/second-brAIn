/**
 * Console Provider - Development/debugging tracing implementation
 */

import type { 
  TraceProvider, 
  TraceMetadata, 
  GenerationMetadata, 
  SpanMetadata 
} from '../../types';

interface TraceData {
  id: string;
  name: string;
  startTime: number;
  endTime?: number;
  metadata?: any;
  generations: GenerationData[];
  spans: SpanData[];
}

interface GenerationData {
  id: string;
  name: string;
  model?: string;
  startTime: number;
  endTime?: number;
  prompt?: string;
  completion?: string;
  usage?: any;
  metadata?: any;
}

interface SpanData {
  id: string;
  name: string;
  startTime: number;
  endTime?: number;
  input?: any;
  output?: any;
  metadata?: any;
}

export class ConsoleProvider implements TraceProvider {
  readonly name = 'console';

  private traces: Map<string, TraceData> = new Map();
  private generations: Map<string, GenerationData> = new Map();
  private spans: Map<string, SpanData> = new Map();
  private enabled: boolean = true;

  constructor(enabled: boolean = true) {
    this.enabled = enabled;
  }

  /**
   * Start a new trace
   */
  async startTrace(metadata: TraceMetadata): Promise<string> {
    if (!this.enabled) {
      return 'no-trace';
    }

    const traceId = this.generateId();
    const trace: TraceData = {
      id: traceId,
      name: metadata.name || 'trace',
      startTime: Date.now(),
      metadata: {
        userId: metadata.userId,
        sessionId: metadata.sessionId,
        tags: metadata.tags,
        input: metadata.input,
        ...metadata.metadata
      },
      generations: [],
      spans: []
    };

    this.traces.set(traceId, trace);

    console.log(`🔍 [Trace] Started: ${traceId}`, {
      name: trace.name,
      metadata: trace.metadata
    });

    return traceId;
  }

  /**
   * End a trace
   */
  async endTrace(traceId: string, metadata?: TraceMetadata): Promise<void> {
    if (traceId === 'no-trace' || !this.enabled) {
      return;
    }

    const trace = this.traces.get(traceId);
    if (!trace) {
      console.warn(`🔍 [Trace] Trace not found: ${traceId}`);
      return;
    }

    trace.endTime = Date.now();
    const duration = trace.endTime - trace.startTime;

    if (metadata?.output !== undefined) {
      trace.metadata = { ...trace.metadata, output: metadata.output };
    }

    if (metadata?.metadata) {
      trace.metadata = { ...trace.metadata, ...metadata.metadata };
    }

    console.log(`🔍 [Trace] Ended: ${traceId}`, {
      name: trace.name,
      duration: `${duration}ms`,
      generations: trace.generations.length,
      spans: trace.spans.length,
      metadata: trace.metadata
    });

    // Log summary of all operations in this trace
    if (trace.generations.length > 0 || trace.spans.length > 0) {
      console.group(`🔍 [Trace Summary] ${traceId}`);
      
      trace.generations.forEach(gen => {
        const genDuration = gen.endTime ? gen.endTime - gen.startTime : 'ongoing';
        console.log(`  🤖 Generation: ${gen.name} (${genDuration}ms)`, {
          model: gen.model,
          usage: gen.usage,
          prompt: gen.prompt ? `${gen.prompt.substring(0, 100)}...` : undefined,
          completion: gen.completion ? `${gen.completion.substring(0, 100)}...` : undefined
        });
      });

      trace.spans.forEach(span => {
        const spanDuration = span.endTime ? span.endTime - span.startTime : 'ongoing';
        console.log(`  📊 Span: ${span.name} (${spanDuration}ms)`, {
          input: span.input,
          output: span.output,
          metadata: span.metadata
        });
      });

      console.groupEnd();
    }
  }

  /**
   * Update a trace with additional metadata
   */
  async updateTrace(traceId: string, metadata: TraceMetadata): Promise<void> {
    if (traceId === 'no-trace' || !this.enabled) {
      return;
    }

    const trace = this.traces.get(traceId);
    if (!trace) {
      console.warn(`🔍 [Trace] Trace not found for update: ${traceId}`);
      return;
    }

    if (metadata.name) trace.name = metadata.name;
    if (metadata.metadata) {
      trace.metadata = { ...trace.metadata, ...metadata.metadata };
    }

    console.log(`🔍 [Trace] Updated: ${traceId}`, {
      name: trace.name,
      metadata: trace.metadata
    });
  }

  /**
   * Start a generation (LLM call) within a trace
   */
  async startGeneration(traceId: string, metadata: GenerationMetadata): Promise<string> {
    if (traceId === 'no-trace' || !this.enabled) {
      return 'no-generation';
    }

    const generationId = this.generateId();
    const generation: GenerationData = {
      id: generationId,
      name: metadata.name || 'generation',
      model: metadata.model,
      startTime: Date.now(),
      prompt: metadata.prompt,
      metadata: {
        modelParameters: metadata.modelParameters,
        tags: metadata.tags,
        ...metadata.metadata
      }
    };

    this.generations.set(generationId, generation);

    // Add to trace
    const trace = this.traces.get(traceId);
    if (trace) {
      trace.generations.push(generation);
    }

    console.log(`🤖 [Generation] Started: ${generationId}`, {
      name: generation.name,
      model: generation.model,
      traceId: traceId,
      prompt: generation.prompt ? `${generation.prompt.substring(0, 100)}...` : undefined
    });

    return generationId;
  }

  /**
   * End a generation with completion data
   */
  async endGeneration(generationId: string, metadata?: GenerationMetadata): Promise<void> {
    if (generationId === 'no-generation' || !this.enabled) {
      return;
    }

    const generation = this.generations.get(generationId);
    if (!generation) {
      console.warn(`🤖 [Generation] Generation not found: ${generationId}`);
      return;
    }

    generation.endTime = Date.now();
    const duration = generation.endTime - generation.startTime;

    if (metadata?.completion) {
      generation.completion = metadata.completion;
    }

    if (metadata?.usage) {
      generation.usage = metadata.usage;
    }

    if (metadata?.metadata) {
      generation.metadata = { ...generation.metadata, ...metadata.metadata };
    }

    console.log(`🤖 [Generation] Ended: ${generationId}`, {
      name: generation.name,
      model: generation.model,
      duration: `${duration}ms`,
      usage: generation.usage,
      completion: generation.completion ? `${generation.completion.substring(0, 100)}...` : undefined,
      metadata: generation.metadata
    });
  }

  /**
   * Update a generation with additional metadata
   */
  async updateGeneration(generationId: string, metadata: GenerationMetadata): Promise<void> {
    if (generationId === 'no-generation' || !this.enabled) {
      return;
    }

    const generation = this.generations.get(generationId);
    if (!generation) {
      console.warn(`🤖 [Generation] Generation not found for update: ${generationId}`);
      return;
    }

    if (metadata.name) generation.name = metadata.name;
    if (metadata.model) generation.model = metadata.model;
    if (metadata.prompt) generation.prompt = metadata.prompt;
    if (metadata.completion) generation.completion = metadata.completion;
    if (metadata.usage) generation.usage = metadata.usage;
    if (metadata.metadata) {
      generation.metadata = { ...generation.metadata, ...metadata.metadata };
    }

    console.log(`🤖 [Generation] Updated: ${generationId}`, {
      name: generation.name,
      model: generation.model,
      usage: generation.usage
    });
  }

  /**
   * Start a span (general operation) within a trace
   */
  async startSpan(traceId: string, name: string, metadata?: SpanMetadata): Promise<string> {
    if (traceId === 'no-trace' || !this.enabled) {
      return 'no-span';
    }

    const spanId = this.generateId();
    const span: SpanData = {
      id: spanId,
      name: name,
      startTime: Date.now(),
      input: metadata?.input,
      metadata: metadata?.metadata
    };

    this.spans.set(spanId, span);

    // Add to trace
    const trace = this.traces.get(traceId);
    if (trace) {
      trace.spans.push(span);
    }

    console.log(`📊 [Span] Started: ${spanId}`, {
      name: span.name,
      traceId: traceId,
      input: span.input,
      metadata: span.metadata
    });

    return spanId;
  }

  /**
   * End a span with completion data
   */
  async endSpan(spanId: string, metadata?: SpanMetadata): Promise<void> {
    if (spanId === 'no-span' || !this.enabled) {
      return;
    }

    const span = this.spans.get(spanId);
    if (!span) {
      console.warn(`📊 [Span] Span not found: ${spanId}`);
      return;
    }

    span.endTime = Date.now();
    const duration = span.endTime - span.startTime;

    if (metadata?.output !== undefined) {
      span.output = metadata.output;
    }

    if (metadata?.metadata) {
      span.metadata = { ...span.metadata, ...metadata.metadata };
    }

    console.log(`📊 [Span] Ended: ${spanId}`, {
      name: span.name,
      duration: `${duration}ms`,
      input: span.input,
      output: span.output,
      metadata: span.metadata
    });
  }

  /**
   * Check if the provider is configured
   */
  isConfigured(): boolean {
    return this.enabled;
  }

  /**
   * Flush any pending traces
   */
  async flush(): Promise<void> {
    if (!this.enabled) {
      return;
    }

    console.log('🔍 [Console Provider] Flush requested');
    
    // Log summary of all active traces
    const activeTraces = Array.from(this.traces.values()).filter(t => !t.endTime);
    const completedTraces = Array.from(this.traces.values()).filter(t => t.endTime);

    console.log(`🔍 [Console Provider] Summary:`, {
      activeTraces: activeTraces.length,
      completedTraces: completedTraces.length,
      totalGenerations: this.generations.size,
      totalSpans: this.spans.size
    });

    if (activeTraces.length > 0) {
      console.warn('🔍 [Console Provider] Warning: Active traces found during flush:', 
        activeTraces.map(t => ({ id: t.id, name: t.name }))
      );
    }
  }

  /**
   * Enable or disable console logging
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    console.log(`🔍 [Console Provider] ${enabled ? 'Enabled' : 'Disabled'}`);
  }

  /**
   * Clear all stored trace data
   */
  clear(): void {
    this.traces.clear();
    this.generations.clear();
    this.spans.clear();
    console.log('🔍 [Console Provider] Cleared all trace data');
  }

  /**
   * Get statistics about traced operations
   */
  getStats(): { traces: number; generations: number; spans: number } {
    return {
      traces: this.traces.size,
      generations: this.generations.size,
      spans: this.spans.size
    };
  }

  /**
   * Generate a simple ID for traces, generations, and spans
   */
  private generateId(): string {
    return Math.random().toString(36).substring(2, 15);
  }
}