/**
 * Plugin Integration - Handles service initialization and integration with main plugin
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
  
  /**
   * Initialize services from plugin settings
   */
  async initialize(pluginSettings: any): Promise<void> {
    try {
      console.log('🔧 Initializing modular services...');
      
      // Migrate settings if needed
      const migratedSettings = ServiceFactory.migratePluginSettings(pluginSettings);
      
      // Initialize services from plugin configuration
      await this.serviceFactory.initializeFromPluginConfig(migratedSettings);
      
      this.initialized = true;
      console.log('✅ Modular services initialized successfully');
      
    } catch (error) {
      console.error('❌ Failed to initialize modular services:', error);
      throw error;
    }
  }
  
  /**
   * Get the LLM service instance
   */
  getLLMService(): LLMService {
    if (!this.initialized) {
      throw new Error('Services not initialized. Call initialize() first.');
    }
    return this.serviceFactory.getLLMService();
  }
  
  /**
   * Get the trace manager instance
   */
  getTraceManager(): TraceManager {
    if (!this.initialized) {
      throw new Error('Services not initialized. Call initialize() first.');
    }
    return this.serviceFactory.getTraceManager();
  }
  
  /**
   * Check if services are initialized and ready
   */
  isReady(): boolean {
    return this.initialized && this.serviceFactory.isInitialized();
  }
  
  /**
   * Reinitialize services when settings change
   */
  async reinitialize(pluginSettings: any): Promise<void> {
    console.log('🔄 Reinitializing services due to settings change...');
    
    // Clean up existing services
    await this.cleanup();
    
    // Initialize with new settings
    await this.initialize(pluginSettings);
  }
  
  /**
   * Clean up services
   */
  async cleanup(): Promise<void> {
    if (this.serviceFactory) {
      await this.serviceFactory.cleanup();
    }
    this.initialized = false;
    console.log('🧹 Services cleaned up');
  }
  
  /**
   * Get service status for debugging
   */
  getStatus(): {
    initialized: boolean;
    llmServiceReady: boolean;
    traceManagerReady: boolean;
    error?: string;
  } {
    try {
      return {
        initialized: this.initialized,
        llmServiceReady: this.initialized && !!this.serviceFactory.getLLMService(),
        traceManagerReady: this.initialized && !!this.serviceFactory.getTraceManager()
      };
    } catch (error) {
      return {
        initialized: false,
        llmServiceReady: false,
        traceManagerReady: false,
        error: error.message
      };
    }
  }
}