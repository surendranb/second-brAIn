/**
 * Plugin Integration - Handles service initialization
 */

import { ServiceFactory } from './ServiceFactory';
import { LLMService } from './LLMService';
import { TraceManager } from './TraceManager';

export class PluginIntegration {
  private serviceFactory: ServiceFactory;
  private initialized: boolean = false;
  
  constructor() {
    this.serviceFactory = new ServiceFactory();
  }
  
  async initialize(pluginSettings: Record<string, unknown>): Promise<void> {
    try {
      const migratedSettings = ServiceFactory.migratePluginSettings(pluginSettings);
      await this.serviceFactory.initializeFromPluginConfig(migratedSettings);
      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize services:', error);
      throw error;
    }
  }
  
  getLLMService(): LLMService {
    if (!this.initialized) throw new Error('Services not initialized');
    return this.serviceFactory.getLLMService();
  }
  
  getTraceManager(): TraceManager {
    if (!this.initialized) throw new Error('Services not initialized');
    return this.serviceFactory.getTraceManager();
  }
  
  async cleanup(): Promise<void> {
    if (this.serviceFactory) await this.serviceFactory.cleanup();
    this.initialized = false;
  }
  
  getStatus() {
    try {
      return {
        initialized: this.initialized,
        llmServiceReady: this.initialized && !!this.serviceFactory.getLLMService(),
        traceManagerReady: this.initialized && !!this.serviceFactory.getTraceManager()
      };
    } catch (error) {
      return { initialized: false, error: error.message };
    }
  }
}