/**
 * Langfuse Provider - Langfuse tracing implementation
 */

import { requestUrl } from 'obsidian';
import type { 
  TraceProvider, 
  TraceMetadata, 
  GenerationMetadata, 
  SpanMetadata,
  TracingConfig 
} from '../../types';

export class LangfuseProvider implements TraceProvider {
  readonly name = 'langfuse';

  private config: TracingConfig['langfuse'];
  private baseUrl: string;

  constructor(config: TracingConfig) {
    this.config = config.langfuse;
    this.baseUrl = this.config?.baseUrl || 'https://cloud.langfuse.com';
  }

  /**
   * Start a new trace
   */
  async startTrace(metadata: TraceMetadata): Promise<string> {
    if (!this.isConfigured()) {
      return 'no-trace';
    }

    const traceId = this.generateId();
    
    try {
      await this.sendToLangfuse('traces', {
        id: traceId,
        name: metadata.name || 'ai-operation',
        userId: metadata.userId,
        sessionId: metadata.sessionId,
        input: metadata.input,
        metadata: {
          ...metadata.metadata,
          tags: metadata.tags,
          timestamp: new Date().toISOString()
        },
        timestamp: new Date().toISOString()
      });

      console.log(`[Langfuse] Started trace: ${traceId}`);
      return traceId;
    } catch (error) {
      console.warn('[Langfuse] Failed to create trace:', error);
      return 'no-trace';
    }
  }

  /**
   * End a trace
   */
  async endTrace(traceId: string, metadata?: TraceMetadata): Promise<void> {
    if (traceId === 'no-trace' || !this.isConfigured()) {
      return;
    }

    try {
      const updateData: any = {
        endTime: new Date().toISOString()
      };

      if (metadata?.output !== undefined) {
        updateData.output = metadata.output;
      }

      if (metadata?.metadata) {
        updateData.metadata = {
          ...updateData.metadata,
          ...metadata.metadata
        };
      }

      await this.sendToLangfuse(`traces/${traceId}`, updateData, 'PATCH');
      console.log(`[Langfuse] Ended trace: ${traceId}`);
    } catch (error) {
      console.warn('[Langfuse] Failed to end trace:', error);
    }
  }

  /**
   * Update a trace with additional metadata
   */
  async updateTrace(traceId: string, metadata: TraceMetadata): Promise<void> {
    if (traceId === 'no-trace' || !this.isConfigured()) {
      return;
    }

    try {
      const updateData: any = {};

      if (metadata.name) updateData.name = metadata.name;
      if (metadata.userId) updateData.userId = metadata.userId;
      if (metadata.sessionId) updateData.sessionId = metadata.sessionId;
      if (metadata.input !== undefined) updateData.input = metadata.input;
      if (metadata.output !== undefined) updateData.output = metadata.output;
      if (metadata.metadata) updateData.metadata = metadata.metadata;
      if (metadata.tags) updateData.tags = metadata.tags;

      await this.sendToLangfuse(`traces/${traceId}`, updateData, 'PATCH');
      console.log(`[Langfuse] Updated trace: ${traceId}`);
    } catch (error) {
      console.warn('[Langfuse] Failed to update trace:', error);
    }
  }

  /**
   * Start a generation (LLM call) within a trace
   */
  async startGeneration(traceId: string, metadata: GenerationMetadata): Promise<string> {
    if (traceId === 'no-trace' || !this.isConfigured()) {
      return 'no-generation';
    }

    const generationId = this.generateId();
    
    try {
      await this.sendToLangfuse('generations', {
        id: generationId,
        traceId: traceId,
        name: metadata.name || 'llm-generation',
        model: metadata.model,
        modelParameters: metadata.modelParameters,
        input: this.truncateForPrivacy(metadata.prompt),
        startTime: new Date().toISOString(),
        metadata: {
          ...metadata.metadata,
          tags: metadata.tags
        }
      });

      console.log(`[Langfuse] Started generation: ${generationId}`);
      return generationId;
    } catch (error) {
      console.warn('[Langfuse] Failed to create generation:', error);
      return 'no-generation';
    }
  }

  /**
   * End a generation with completion data
   */
  async endGeneration(generationId: string, metadata?: GenerationMetadata): Promise<void> {
    if (generationId === 'no-generation' || !this.isConfigured()) {
      return;
    }

    try {
      const updateData: any = {
        endTime: new Date().toISOString()
      };

      if (metadata?.completion) {
        updateData.output = this.truncateForPrivacy(metadata.completion);
      }

      if (metadata?.usage) {
        updateData.usage = {
          promptTokens: metadata.usage.promptTokens,
          completionTokens: metadata.usage.completionTokens,
          totalTokens: metadata.usage.totalTokens
        };
      }

      if (metadata?.cost !== undefined) {
        updateData.metadata = {
          ...updateData.metadata,
          cost_usd: metadata.cost
        };
      }

      if (metadata?.metadata) {
        updateData.metadata = {
          ...updateData.metadata,
          ...metadata.metadata
        };
      }

      await this.sendToLangfuse(`generations/${generationId}`, updateData, 'PATCH');
      console.log(`[Langfuse] Ended generation: ${generationId}`);
    } catch (error) {
      console.warn('[Langfuse] Failed to end generation:', error);
    }
  }

  /**
   * Update a generation with additional metadata
   */
  async updateGeneration(generationId: string, metadata: GenerationMetadata): Promise<void> {
    if (generationId === 'no-generation' || !this.isConfigured()) {
      return;
    }

    try {
      const updateData: any = {};

      if (metadata.name) updateData.name = metadata.name;
      if (metadata.model) updateData.model = metadata.model;
      if (metadata.modelParameters) updateData.modelParameters = metadata.modelParameters;
      if (metadata.prompt) updateData.input = this.truncateForPrivacy(metadata.prompt);
      if (metadata.completion) updateData.output = this.truncateForPrivacy(metadata.completion);
      if (metadata.usage) updateData.usage = metadata.usage;
      if (metadata.cost !== undefined) {
        updateData.metadata = { ...updateData.metadata, cost_usd: metadata.cost };
      }
      if (metadata.metadata) {
        updateData.metadata = { ...updateData.metadata, ...metadata.metadata };
      }

      await this.sendToLangfuse(`generations/${generationId}`, updateData, 'PATCH');
      console.log(`[Langfuse] Updated generation: ${generationId}`);
    } catch (error) {
      console.warn('[Langfuse] Failed to update generation:', error);
    }
  }

  /**
   * Start a span (general operation) within a trace
   */
  async startSpan(traceId: string, name: string, metadata?: SpanMetadata): Promise<string> {
    if (traceId === 'no-trace' || !this.isConfigured()) {
      return 'no-span';
    }

    const spanId = this.generateId();
    
    try {
      await this.sendToLangfuse('spans', {
        id: spanId,
        traceId: traceId,
        name: name,
        input: metadata?.input,
        startTime: new Date().toISOString(),
        metadata: metadata?.metadata
      });

      console.log(`[Langfuse] Started span: ${spanId} (${name})`);
      return spanId;
    } catch (error) {
      console.warn('[Langfuse] Failed to create span:', error);
      return 'no-span';
    }
  }

  /**
   * End a span with completion data
   */
  async endSpan(spanId: string, metadata?: SpanMetadata): Promise<void> {
    if (spanId === 'no-span' || !this.isConfigured()) {
      return;
    }

    try {
      const updateData: any = {
        endTime: new Date().toISOString()
      };

      if (metadata?.output !== undefined) {
        updateData.output = metadata.output;
      }

      if (metadata?.metadata) {
        updateData.metadata = {
          ...updateData.metadata,
          ...metadata.metadata
        };
      }

      await this.sendToLangfuse(`spans/${spanId}`, updateData, 'PATCH');
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
   * Send data to Langfuse API
   */
  private async sendToLangfuse(endpoint: string, data: any, method: string = 'POST'): Promise<void> {
    const url = `${this.baseUrl}/api/public/${endpoint}`;

    try {
      console.log(`[Langfuse] Sending ${method} to ${endpoint}`, {
        url,
        dataKeys: Object.keys(data),
        hasAuth: !!this.config?.publicKey
      });

      const response = await requestUrl({
        url: url,
        method: method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${btoa(this.config!.publicKey + ':' + this.config!.secretKey)}`
        },
        body: JSON.stringify(data)
      });

      console.log(`[Langfuse] Successfully sent ${method} to ${endpoint}`, response.status);
    } catch (error) {
      console.error(`[Langfuse] API error for ${method} ${endpoint}:`, {
        error: error.message || error,
        status: (error as any).status,
        url: url,
        dataKeys: Object.keys(data)
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

  /**
   * Truncate text for privacy and API limits
   */
  private truncateForPrivacy(text?: string): string | undefined {
    if (!text) return undefined;
    return text.length > 500 ? text.substring(0, 500) + '...' : text;
  }
}