/**
 * Configuration types for the plugin
 */

import { LLMConfig } from './llm';
import { TracingConfig } from './tracing';

export interface PluginConfig {
  llm: LLMConfig;
  tracing: TracingConfig;
  // Existing config fields will be preserved during migration
}

export interface ServiceConfig {
  llm: LLMConfig;
  tracing: TracingConfig;
}

export * from './llm';
export * from './tracing';