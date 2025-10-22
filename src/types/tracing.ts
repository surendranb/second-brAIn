/**
 * Core types and interfaces for tracing providers
 */

export interface TraceMetadata {
  name?: string;
  userId?: string;
  sessionId?: string;
  tags?: string[];
  input?: any;
  output?: any;
  metadata?: Record<string, any>;
}

export interface GenerationMetadata extends TraceMetadata {
  model?: string;
  modelParameters?: Record<string, any>;
  prompt?: string;
  completion?: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
  cost?: number;
}

export interface SpanMetadata {
  name?: string;
  input?: any;
  output?: any;
  metadata?: Record<string, any>;
}

export interface TraceProvider {
  readonly name: string;
  
  // Trace management
  startTrace(metadata: TraceMetadata): Promise<string>;
  endTrace(traceId: string, metadata?: TraceMetadata): Promise<void>;
  updateTrace(traceId: string, metadata: TraceMetadata): Promise<void>;
  
  // Generation tracking (for LLM calls)
  startGeneration(traceId: string, metadata: GenerationMetadata): Promise<string>;
  endGeneration(generationId: string, metadata?: GenerationMetadata): Promise<void>;
  updateGeneration(generationId: string, metadata: GenerationMetadata): Promise<void>;
  
  // Span tracking (for general operations)
  startSpan(traceId: string, name: string, metadata?: SpanMetadata): Promise<string>;
  endSpan(spanId: string, metadata?: SpanMetadata): Promise<void>;
  
  // Configuration
  isConfigured(): boolean;
  flush(): Promise<void>;
}

export interface TracingConfig {
  provider: 'langfuse' | 'otel' | 'console' | 'none';
  langfuse?: {
    publicKey: string;
    secretKey: string;
    baseUrl?: string;
  };
  otel?: {
    endpoint: string;
    headers?: Record<string, string>;
  };
  enabled: boolean;
}

export interface TraceContext {
  traceId: string;
  spanId?: string;
  generationName?: string;
  pass?: string;
  intent?: string;
  metadata?: Record<string, any>;
}

export interface ProcessingContext {
  intent: 'url-processing' | 'note-generation' | 'moc-update';
  url?: string;
  noteTitle?: string;
  userSettings?: any;
  trace?: TraceContext;
}