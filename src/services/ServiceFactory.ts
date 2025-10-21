/**
 * Service Factory - Creates and configures services with dependency injection
 */

import type { LLMProvider, TraceProvider, ServiceConfig, PluginConfig } from '../types';
import { LLMService } from './LLMService';
import { TraceManager } from './TraceManager';
import { GeminiProvider } from '../providers/llm/GeminiProvider';
import { LangfuseProvider } from '../providers/tracing/LangfuseProvider';
import { ConsoleProvider } from '../providers/tracing/ConsoleProvider';

export class ServiceFactory {
  private llmService?: LLMService;
  private traceManager?: TraceManager;
  
  /**
   * Initialize services from plugin configuration
   */
  async initializeFromPluginConfig(pluginConfig: any): Promise<void> {
    // Convert plugin config to service config
    const serviceConfig = this.convertPluginConfigToServiceConfig(pluginConfig);
    
    // Create providers based on configuration
    const llmProvider = this.createLLMProvider(serviceConfig);
    const traceProvider = this.createTraceProvider(serviceConfig);
    
    // Initialize services
    await this.initialize(serviceConfig, llmProvider, traceProvider);
  }
  
  /**
   * Initialize services with the provided configuration
   */
  async initialize(
    config: ServiceConfig,
    llmProvider: LLMProvider,
    traceProvider: TraceProvider
  ): Promise<void> {
    // Validate configuration
    this.validateConfig(config);
    
    // Initialize LLM service
    this.llmService = new LLMService(llmProvider);
    
    // Initialize trace manager with LLM service
    this.traceManager = new TraceManager(this.llmService, traceProvider);
    
    // Validate provider configurations
    if (!llmProvider.isConfigured()) {
      console.warn(`LLM provider ${llmProvider.name} is not properly configured`);
    }
    
    if (!traceProvider.isConfigured()) {
      console.warn(`Trace provider ${traceProvider.name} is not properly configured`);
    }
    
    console.log('🏭 ServiceFactory initialized successfully', {
      llmProvider: llmProvider.name,
      traceProvider: traceProvider.name,
      llmConfigured: llmProvider.isConfigured(),
      traceConfigured: traceProvider.isConfigured()
    });
  }
  
  /**
   * Get the LLM service instance
   */
  getLLMService(): LLMService {
    if (!this.llmService) {
      throw new Error('ServiceFactory not initialized. Call initialize() first.');
    }
    return this.llmService;
  }
  
  /**
   * Get the trace manager instance
   */
  getTraceManager(): TraceManager {
    if (!this.traceManager) {
      throw new Error('ServiceFactory not initialized. Call initialize() first.');
    }
    return this.traceManager;
  }
  
  /**
   * Check if services are initialized
   */
  isInitialized(): boolean {
    return !!(this.llmService && this.traceManager);
  }
  
  /**
   * Clean up services
   */
  async cleanup(): Promise<void> {
    if (this.traceManager) {
      await this.traceManager.flush();
    }
    
    this.llmService = undefined;
    this.traceManager = undefined;
    
    console.log('🏭 ServiceFactory cleaned up');
  }
  
  /**
   * Convert plugin configuration to service configuration
   */
  private convertPluginConfigToServiceConfig(pluginConfig: any): ServiceConfig {
    return {
      llm: {
        provider: pluginConfig.provider || 'gemini',
        apiKey: pluginConfig.gemini?.apiKey,
        model: pluginConfig.gemini?.model || 'gemini-2.5-flash',
        temperature: 0.3, // Default temperature
        maxTokens: 4000 // Default max tokens
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
  
  /**
   * Create LLM provider based on configuration
   */
  private createLLMProvider(config: ServiceConfig): LLMProvider {
    switch (config.llm.provider) {
      case 'gemini':
        return new GeminiProvider(config.llm.apiKey || '');
      default:
        throw new Error(`Unsupported LLM provider: ${config.llm.provider}`);
    }
  }
  
  /**
   * Create trace provider based on configuration
   */
  private createTraceProvider(config: ServiceConfig): TraceProvider {
    if (!config.tracing.enabled) {
      return new ConsoleProvider(false); // Disabled console provider
    }
    
    switch (config.tracing.provider) {
      case 'langfuse':
        return new LangfuseProvider(config.tracing);
      case 'console':
        return new ConsoleProvider(true);
      case 'none':
        return new ConsoleProvider(false);
      default:
        console.warn(`Unsupported tracing provider: ${config.tracing.provider}, falling back to console`);
        return new ConsoleProvider(true);
    }
  }
  
  /**
   * Validate service configuration
   */
  private validateConfig(config: ServiceConfig): void {
    if (!config.llm) {
      throw new Error('LLM configuration is required');
    }
    
    if (!config.tracing) {
      throw new Error('Tracing configuration is required');
    }
    
    // Validate LLM config
    if (!config.llm.provider) {
      throw new Error('LLM provider must be specified');
    }
    
    // Validate tracing config
    if (!config.tracing.provider) {
      throw new Error('Tracing provider must be specified');
    }
  }
  
  /**
   * Migrate existing plugin settings to new format (if needed)
   */
  static migratePluginSettings(settings: any): any {
    // This function ensures backward compatibility
    // Current settings structure is already compatible, so no migration needed
    return settings;
  }
}