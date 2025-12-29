/**
 * Service Factory - Creates and configures services with dependency injection
 */

import type { LLMProvider, TraceProvider, ServiceConfig } from '../types';
import { LLMService } from './LLMService';
import { TraceManager } from './TraceManager';
import { GeminiProvider } from '../providers/llm/GeminiProvider';
import { OpenRouterProvider } from '../providers/llm/OpenRouterProvider';
import { LangfuseProvider } from '../providers/tracing/LangfuseProvider';
import { ConsoleProvider } from '../providers/tracing/ConsoleProvider';

export class ServiceFactory {
  private llmService?: LLMService;
  private traceManager?: TraceManager;
  
  async initializeFromPluginConfig(pluginConfig: any): Promise<void> {
    const serviceConfig = this.convertPluginConfigToServiceConfig(pluginConfig);
    const llmProvider = this.createLLMProvider(serviceConfig);
    const traceProvider = this.createTraceProvider(serviceConfig);
    await this.initialize(serviceConfig, llmProvider, traceProvider);
  }
  
  async initialize(
    config: ServiceConfig,
    llmProvider: LLMProvider,
    traceProvider: TraceProvider
  ): Promise<void> {
    this.validateConfig(config);
    this.llmService = new LLMService(llmProvider);
    this.traceManager = new TraceManager(this.llmService, traceProvider);
  }
  
  getLLMService(): LLMService {
    if (!this.llmService) throw new Error('ServiceFactory not initialized');
    return this.llmService;
  }
  
  getTraceManager(): TraceManager {
    if (!this.traceManager) throw new Error('ServiceFactory not initialized');
    return this.traceManager;
  }
  
  isInitialized(): boolean {
    return !!(this.llmService && this.traceManager);
  }
  
  async cleanup(): Promise<void> {
    if (this.traceManager) await this.traceManager.flush();
    this.llmService = undefined;
    this.traceManager = undefined;
  }
  
  private convertPluginConfigToServiceConfig(pluginConfig: any): ServiceConfig {
    const provider = pluginConfig.provider || 'gemini';
    let apiKey = '';
    let model = '';

    if (provider === 'gemini') {
      apiKey = pluginConfig.gemini?.apiKey || '';
      model = pluginConfig.gemini?.model || 'gemini-2.5-flash';
    } else if (provider === 'openrouter') {
      apiKey = pluginConfig.openrouter?.apiKey || '';
      model = pluginConfig.openrouter?.model || 'google/gemini-2.0-flash-exp:free';
    }

    return {
      llm: {
        provider: provider,
        apiKey: apiKey,
        model: model,
        temperature: 0.3,
        maxTokens: 4000
      },
      tracing: {
        provider: pluginConfig.langfuse?.enabled ? 'langfuse' : 'console',
        enabled: pluginConfig.langfuse?.enabled || false,
        langfuse: pluginConfig.langfuse?.enabled ? {
          publicKey: pluginConfig.langfuse.publicKey || '',
          secretKey: pluginConfig.langfuse.secretKey || '',
          baseUrl: pluginConfig.langfuse.baseUrl || 'https://cloud.langfuse.com'
        } : undefined
      }
    };
  }
  
  private createLLMProvider(config: ServiceConfig): LLMProvider {
    switch (config.llm.provider) {
      case 'gemini': return new GeminiProvider(config.llm.apiKey || '');
      case 'openrouter': return new OpenRouterProvider(config.llm.apiKey || '');
      default: throw new Error(`Unsupported LLM provider: ${config.llm.provider}`);
    }
  }
  
  private createTraceProvider(config: ServiceConfig): TraceProvider {
    if (!config.tracing.enabled) return new ConsoleProvider(false);
    switch (config.tracing.provider) {
      case 'langfuse': return new LangfuseProvider(config.tracing);
      case 'console': return new ConsoleProvider(true);
      case 'none': return new ConsoleProvider(false);
      default: return new ConsoleProvider(true);
    }
  }
  
  private validateConfig(config: ServiceConfig): void {
    if (!config.llm || !config.tracing) throw new Error('Configuration required');
  }
  
  static migratePluginSettings(settings: any): any {
    return settings;
  }
}