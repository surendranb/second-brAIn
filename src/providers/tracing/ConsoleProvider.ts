/**
 * Console Provider - Local console-based tracing implementation
 */

import type { 
  TraceProvider, 
  TraceMetadata, 
  GenerationMetadata, 
  SpanMetadata 
} from '../../types';

export class ConsoleProvider implements TraceProvider {
  readonly name = 'console';
  private enabled: boolean;

  constructor(enabled: boolean = true) {
    this.enabled = enabled;
  }

  async startTrace(metadata: TraceMetadata): Promise<string> {
    return this.generateId();
  }

  async endTrace(traceId: string, metadata?: TraceMetadata): Promise<void> {}

  async updateTrace(traceId: string, metadata: TraceMetadata): Promise<void> {}

  async startGeneration(traceId: string, metadata: GenerationMetadata): Promise<string> {
    return this.generateId();
  }

  async endGeneration(generationId: string, metadata?: GenerationMetadata): Promise<void> {}

  async updateGeneration(generationId: string, metadata: GenerationMetadata): Promise<void> {}

  async startSpan(traceId: string, name: string, metadata?: SpanMetadata): Promise<string> {
    return this.generateId();
  }

  async endSpan(spanId: string, metadata?: SpanMetadata): Promise<void> {}

  isConfigured(): boolean {
    return true;
  }

  async flush(): Promise<void> {}

  private generateId(): string {
    return Math.random().toString(36).substring(2, 15);
  }
}