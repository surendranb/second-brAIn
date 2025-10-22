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

// Langfuse ingestion event types
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

  /**
   * Start a new trace using batch ingestion API
   */
  async startTrace(metadata: TraceMetadata): Promise<string> {
    if (!this.isConfigured()) {
      return 'no-trace';
    }

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
      console.log(`[Langfuse] Started trace: ${traceId}`);
      return traceId;
    } catch (error) {
      console.warn('[Langfuse] Failed to create trace:', error);
      return 'no-trace';
    }
  }

  /**
   * End a trace using batch ingestion API
   */
  async endTrace(traceId: string, metadata?: TraceMetadata): Promise<void> {
    if (traceId === 'no-trace' || !this.isConfigured()) {
      return;
    }

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
      console.log(`[Langfuse] Ended trace: ${traceId}`);
    } catch (error) {
      // Langfuse API errors shouldn't break the flow - just log and continue  
      console.warn('[Langfuse] Failed to end trace (continuing):', error.message || error);
    }
  }

  /**
   * Update a trace with additional metadata using batch ingestion API
   */
  async updateTrace(traceId: string, metadata: TraceMetadata): Promise<void> {
    if (traceId === 'no-trace' || !this.isConfigured()) {
      return;
    }

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
      console.log(`[Langfuse] Updated trace: ${traceId}`);
    } catch (error) {
      console.warn('[Langfuse] Failed to update trace:', error);
    }
  }

  /**
   * Start a generation (LLM call) within a trace using batch ingestion API
   */
  async startGeneration(traceId: string, metadata: GenerationMetadata): Promise<string> {
    if (traceId === 'no-trace' || !this.isConfigured()) {
      return 'no-generation';
    }

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
          metadata: {
            ...metadata.metadata,
            tags: metadata.tags
          }
        }
      };

      await this.sendBatchToLangfuse([event]);
      console.log(`[Langfuse] Started generation: ${generationId}`);
      return generationId;
    } catch (error) {
      console.warn('[Langfuse] Failed to create generation:', error);
      return 'no-generation';
    }
  }

  /**
   * End a generation with completion data using batch ingestion API
   */
  async endGeneration(generationId: string, metadata?: GenerationMetadata): Promise<void> {
    if (generationId === 'no-generation' || !this.isConfigured()) {
      return;
    }

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
          metadata: {
            ...metadata?.metadata,
            cost_usd: metadata?.cost
          }
        }
      };

      await this.sendBatchToLangfuse([event]);
      console.log(`[Langfuse] Ended generation: ${generationId}`);
    } catch (error) {
      // Langfuse API errors shouldn't break the flow - just log and continue
      console.warn('[Langfuse] Failed to end generation (continuing):', error.message || error);
    }
  }

  /**
   * Update a generation with additional metadata using batch ingestion API
   */
  async updateGeneration(generationId: string, metadata: GenerationMetadata): Promise<void> {
    if (generationId === 'no-generation' || !this.isConfigured()) {
      return;
    }

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
          metadata: {
            ...metadata.metadata,
            cost_usd: metadata.cost
          }
        }
      };

      await this.sendBatchToLangfuse([event]);
      console.log(`[Langfuse] Updated generation: ${generationId}`);
    } catch (error) {
      console.warn('[Langfuse] Failed to update generation:', error);
    }
  }

  /**
   * Start a span (general operation) within a trace using batch ingestion API
   */
  async startSpan(traceId: string, name: string, metadata?: SpanMetadata): Promise<string> {
    if (traceId === 'no-trace' || !this.isConfigured()) {
      return 'no-span';
    }

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
      console.log(`[Langfuse] Started span: ${spanId} (${name})`);
      return spanId;
    } catch (error) {
      console.warn('[Langfuse] Failed to create span:', error);
      return 'no-span';
    }
  }

  /**
   * End a span with completion data using batch ingestion API
   */
  async endSpan(spanId: string, metadata?: SpanMetadata): Promise<void> {
    if (spanId === 'no-span' || !this.isConfigured()) {
      return;
    }

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
      console.log(`[Langfuse] Ended span: ${spanId}`);
    } catch (error) {
      console.warn('[Langfuse] Failed to end span:', error);
    }
  }

  /**
   * Check if the provider is configured
   */
  isConfigured(): boolean {
    return !!(
      this.config?.publicKey && 
      this.config?.secretKey && 
      this.baseUrl
    );
  }

  /**
   * Flush any pending traces (no-op for HTTP-based provider)
   */
  async flush(): Promise<void> {
    // HTTP-based provider doesn't need explicit flushing
    console.log('[Langfuse] Flush requested (no-op for HTTP provider)');
  }

  /**
   * Send batch of events to Langfuse ingestion API
   */
  private async sendBatchToLangfuse(events: LangfuseEvent[]): Promise<void> {
    const url = `${this.baseUrl}/api/public/ingestion`;

    try {
      console.log(`[Langfuse] Sending batch to ingestion API`, {
        url,
        eventCount: events.length,
        eventTypes: events.map(e => e.type),
        hasAuth: !!this.config?.publicKey
      });

      const response = await requestUrl({
        url: url,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${btoa(this.config!.publicKey + ':' + this.config!.secretKey)}`
        },
        body: JSON.stringify({
          batch: events,
          metadata: {
            sdk_name: 'obsidian-second-brain',
            sdk_version: '1.0.0'
          }
        })
      });

      console.log(`[Langfuse] Successfully sent batch to ingestion API`, {
        status: response.status,
        eventCount: events.length
      });
    } catch (error) {
      console.error(`[Langfuse] Batch ingestion API error:`, {
        error: error.message || error,
        status: (error as any).status,
        url: url,
        eventCount: events.length,
        eventTypes: events.map(e => e.type)
      });
      // Don't throw - just log the error so it doesn't break operations
      console.warn(`[Langfuse] Continuing without tracing due to API error`);
    }
  }

  /**
   * Generate a UUID for traces, generations, and spans
   */
  private generateId(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = Math.random() * 16 | 0;
      const v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  // Removed truncateForPrivacy() - using inputs/outputs directly for complete eval data
}