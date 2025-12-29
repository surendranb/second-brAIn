/**
 * Langfuse Provider - Langfuse tracing implementation using batch ingestion API
 */

import { requestUrl } from 'obsidian';
import type { 
  TraceProvider, 
  TraceMetadata, 
  GenerationMetadata, 
  SpanMetadata,
  TracingConfig 
} from '../../types';

interface LangfuseEvent {
  id: string;
  timestamp: string;
  type: string;
  body: any;
  metadata?: any;
}

export class LangfuseProvider implements TraceProvider {
  readonly name = 'langfuse';
  private config: TracingConfig['langfuse'];
  private baseUrl: string;

  constructor(config: TracingConfig) {
    this.config = config.langfuse;
    this.baseUrl = this.config?.baseUrl || 'https://cloud.langfuse.com';
  }

  async startTrace(metadata: TraceMetadata): Promise<string> {
    if (!this.isConfigured()) return 'no-trace';
    const traceId = this.generateId();
    const eventId = this.generateId();
    try {
      const event: LangfuseEvent = {
        id: eventId,
        timestamp: new Date().toISOString(),
        type: 'trace-create',
        body: {
          id: traceId,
          name: metadata.name || 'ai-operation',
          userId: metadata.userId,
          sessionId: metadata.sessionId,
          input: metadata.input,
          metadata: metadata.metadata,
          tags: metadata.tags,
          timestamp: new Date().toISOString()
        }
      };
      await this.sendBatchToLangfuse([event]);
      return traceId;
    } catch (error) {
      return 'no-trace';
    }
  }

  async endTrace(traceId: string, metadata?: TraceMetadata): Promise<void> {
    if (traceId === 'no-trace' || !this.isConfigured()) return;
    try {
      const eventId = this.generateId();
      const event: LangfuseEvent = {
        id: eventId,
        timestamp: new Date().toISOString(),
        type: 'trace-update',
        body: {
          id: traceId,
          output: metadata?.output,
          metadata: metadata?.metadata
        }
      };
      await this.sendBatchToLangfuse([event]);
    } catch (error) {}
  }

  async updateTrace(traceId: string, metadata: TraceMetadata): Promise<void> {
    if (traceId === 'no-trace' || !this.isConfigured()) return;
    try {
      const eventId = this.generateId();
      const event: LangfuseEvent = {
        id: eventId,
        timestamp: new Date().toISOString(),
        type: 'trace-update',
        body: {
          id: traceId,
          name: metadata.name,
          userId: metadata.userId,
          sessionId: metadata.sessionId,
          input: metadata.input,
          output: metadata.output,
          metadata: metadata.metadata,
          tags: metadata.tags
        }
      };
      await this.sendBatchToLangfuse([event]);
    } catch (error) {}
  }

  async startGeneration(traceId: string, metadata: GenerationMetadata): Promise<string> {
    if (traceId === 'no-trace' || !this.isConfigured()) return 'no-generation';
    const generationId = this.generateId();
    const eventId = this.generateId();
    try {
      const event: LangfuseEvent = {
        id: eventId,
        timestamp: new Date().toISOString(),
        type: 'generation-create',
        body: {
          id: generationId,
          traceId: traceId,
          name: metadata.name || 'llm-generation',
          model: metadata.model,
          modelParameters: metadata.modelParameters,
          input: metadata.prompt,
          startTime: new Date().toISOString(),
          metadata: { ...metadata.metadata, tags: metadata.tags }
        }
      };
      await this.sendBatchToLangfuse([event]);
      return generationId;
    } catch (error) {
      return 'no-generation';
    }
  }

  async endGeneration(generationId: string, metadata?: GenerationMetadata): Promise<void> {
    if (generationId === 'no-generation' || !this.isConfigured()) return;
    try {
      const eventId = this.generateId();
      const event: LangfuseEvent = {
        id: eventId,
        timestamp: new Date().toISOString(),
        type: 'generation-update',
        body: {
          id: generationId,
          endTime: new Date().toISOString(),
          output: metadata?.completion,
          usage: metadata?.usage ? {
            input: metadata.usage.promptTokens,
            output: metadata.usage.completionTokens,
            total: metadata.usage.totalTokens,
            unit: 'TOKENS'
          } : undefined,
          metadata: { ...metadata?.metadata, cost_usd: metadata?.cost }
        }
      };
      await this.sendBatchToLangfuse([event]);
    } catch (error) {}
  }

  async updateGeneration(generationId: string, metadata: GenerationMetadata): Promise<void> {
    if (generationId === 'no-generation' || !this.isConfigured()) return;
    try {
      const eventId = this.generateId();
      const event: LangfuseEvent = {
        id: eventId,
        timestamp: new Date().toISOString(),
        type: 'generation-update',
        body: {
          id: generationId,
          name: metadata.name,
          model: metadata.model,
          modelParameters: metadata.modelParameters,
          input: metadata.prompt,
          output: metadata.completion,
          usage: metadata.usage ? {
            input: metadata.usage.promptTokens,
            output: metadata.usage.completionTokens,
            total: metadata.usage.totalTokens,
            unit: 'TOKENS'
          } : undefined,
          metadata: { ...metadata.metadata, cost_usd: metadata.cost }
        }
      };
      await this.sendBatchToLangfuse([event]);
    } catch (error) {}
  }

  async startSpan(traceId: string, name: string, metadata?: SpanMetadata): Promise<string> {
    if (traceId === 'no-trace' || !this.isConfigured()) return 'no-span';
    const spanId = this.generateId();
    const eventId = this.generateId();
    try {
      const event: LangfuseEvent = {
        id: eventId,
        timestamp: new Date().toISOString(),
        type: 'span-create',
        body: {
          id: spanId,
          traceId: traceId,
          name: name,
          input: metadata?.input,
          startTime: new Date().toISOString(),
          metadata: metadata?.metadata
        }
      };
      await this.sendBatchToLangfuse([event]);
      return spanId;
    } catch (error) {
      return 'no-span';
    }
  }

  async endSpan(spanId: string, metadata?: SpanMetadata): Promise<void> {
    if (spanId === 'no-span' || !this.isConfigured()) return;
    try {
      const eventId = this.generateId();
      const event: LangfuseEvent = {
        id: eventId,
        timestamp: new Date().toISOString(),
        type: 'span-update',
        body: {
          id: spanId,
          endTime: new Date().toISOString(),
          output: metadata?.output,
          metadata: metadata?.metadata
        }
      };
      await this.sendBatchToLangfuse([event]);
    } catch (error) {}
  }

  isConfigured(): boolean {
    return !!(this.config?.publicKey && this.config?.secretKey && this.baseUrl);
  }

  async flush(): Promise<void> {}

  private async sendBatchToLangfuse(events: LangfuseEvent[]): Promise<void> {
    const url = `${this.baseUrl}/api/public/ingestion`;
    try {
      await requestUrl({
        url: url,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${btoa(this.config!.publicKey + ':' + this.config!.secretKey)}`
        },
        body: JSON.stringify({
          batch: events,
          metadata: { sdk_name: 'obsidian-second-brain', sdk_version: '1.0.0' }
        })
      });
    } catch (error) {}
  }

  private generateId(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = Math.random() * 16 | 0;
      const v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
}