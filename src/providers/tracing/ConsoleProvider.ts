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
    await Promise.resolve();
    return this.generateId();
  }

  async endTrace(traceId: string, metadata?: TraceMetadata): Promise<void> {
    await Promise.resolve();
  }

  async updateTrace(traceId: string, metadata: TraceMetadata): Promise<void> {
    await Promise.resolve();
  }

  async startGeneration(traceId: string, metadata: GenerationMetadata): Promise<string> {
    await Promise.resolve();
    return this.generateId();
  }

  async endGeneration(generationId: string, metadata?: GenerationMetadata): Promise<void> {
    await Promise.resolve();
  }

  async updateGeneration(generationId: string, metadata: GenerationMetadata): Promise<void> {
    await Promise.resolve();
  }

  async startSpan(traceId: string, name: string, metadata?: SpanMetadata): Promise<string> {
    await Promise.resolve();
    return this.generateId();
  }

  async endSpan(spanId: string, metadata?: SpanMetadata): Promise<void> {
    await Promise.resolve();
  }

  isConfigured(): boolean {
    return true;
  }

  async flush(): Promise<void> {
    await Promise.resolve();
  }

  private generateId(): string {
    return Math.random().toString(36).substring(2, 15);
  }
}