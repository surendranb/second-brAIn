/**
 * Service Factory - Creates and configures services with dependency injection
 */

import type { LLMProvider, TraceProvider, ServiceConfig } from '../types';
import { LLMService } from './LLMService';
import { TraceManager } from './TraceManager';

export class ServiceFactory {
  private llmService?: LLMService;
  private traceManager?: TraceManager;
  
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
}