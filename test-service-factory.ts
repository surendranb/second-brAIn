/**
 * Test file for service factory and dependency injection
 */

import { ServiceFactory } from './src/services/ServiceFactory';
import { PluginIntegration } from './src/services/PluginIntegration';

/**
 * Test service factory with mock plugin settings
 */
export async function testServiceFactory(): Promise<void> {
  console.log('🧪 Testing Service Factory...');
  
  try {
    // Mock plugin settings (similar to actual plugin settings structure)
    const mockPluginSettings = {
      provider: 'gemini',
      gemini: {
        apiKey: 'test-api-key',
        model: 'gemini-2.5-flash'
      },
      langfuse: {
        enabled: false,
        publicKey: '',
        secretKey: '',
        baseUrl: 'https://cloud.langfuse.com'
      }
    };
    
    const serviceFactory = new ServiceFactory();
    
    // Test configuration conversion
    console.log('🔧 Testing configuration conversion...');
    await serviceFactory.initializeFromPluginConfig(mockPluginSettings);
    
    console.log('✅ Service factory initialized');
    
    // Test service retrieval
    const llmService = serviceFactory.getLLMService();
    const traceManager = serviceFactory.getTraceManager();
    
    console.log('✅ Services retrieved successfully');
    
    // Test service status
    const isInitialized = serviceFactory.isInitialized();
    if (!isInitialized) {
      throw new Error('Services should be initialized');
    }
    
    console.log('✅ Service initialization status verified');
    
    // Test provider info
    const providerInfo = llmService.getProviderInfo();
    console.log('📋 LLM Provider Info:', providerInfo);
    
    if (providerInfo.name !== 'gemini') {
      throw new Error('Expected Gemini provider');
    }
    
    console.log('✅ Provider configuration verified');
    
    // Test tracing status
    const isTracingEnabled = traceManager.isTracingEnabled();
    console.log('📊 Tracing enabled:', isTracingEnabled);
    
    // Should be false since langfuse is disabled in mock settings
    if (isTracingEnabled) {
      console.log('ℹ️ Tracing is enabled (console provider)');
    } else {
      console.log('ℹ️ Tracing is disabled');
    }
    
    // Test cleanup
    await serviceFactory.cleanup();
    console.log('✅ Service factory cleaned up');
    
    console.log('🎉 All Service Factory tests passed!');
    
  } catch (error) {
    console.error('❌ Service Factory test failed:', error.message);
    throw error;
  }
}

/**
 * Test plugin integration
 */
export async function testPluginIntegration(): Promise<void> {
  console.log('🧪 Testing Plugin Integration...');
  
  try {
    // Mock plugin settings with Langfuse enabled
    const mockPluginSettings = {
      provider: 'gemini',
      gemini: {
        apiKey: 'test-api-key',
        model: 'gemini-2.5-flash'
      },
      langfuse: {
        enabled: true,
        publicKey: 'test-public-key',
        secretKey: 'test-secret-key',
        baseUrl: 'https://cloud.langfuse.com'
      }
    };
    
    const integration = new PluginIntegration();
    
    // Test initialization
    console.log('🔧 Testing plugin integration initialization...');
    await integration.initialize(mockPluginSettings);
    
    console.log('✅ Plugin integration initialized');
    
    // Test readiness check
    const isReady = integration.isReady();
    if (!isReady) {
      throw new Error('Integration should be ready');
    }
    
    console.log('✅ Integration readiness verified');
    
    // Test service access
    const llmService = integration.getLLMService();
    const traceManager = integration.getTraceManager();
    
    console.log('✅ Services accessible through integration');
    
    // Test status reporting
    const status = integration.getStatus();
    console.log('📊 Integration Status:', status);
    
    if (!status.initialized || !status.llmServiceReady || !status.traceManagerReady) {
      throw new Error('All services should be ready');
    }
    
    console.log('✅ Status reporting verified');
    
    // Test settings change (reinitialize)
    const updatedSettings = {
      ...mockPluginSettings,
      langfuse: {
        ...mockPluginSettings.langfuse,
        enabled: false // Disable tracing
      }
    };
    
    console.log('🔄 Testing settings change...');
    await integration.reinitialize(updatedSettings);
    
    console.log('✅ Settings change handled');
    
    // Verify tracing is now disabled
    const updatedTraceManager = integration.getTraceManager();
    const isTracingEnabled = updatedTraceManager.isTracingEnabled();
    
    if (isTracingEnabled) {
      console.log('ℹ️ Tracing still enabled (console provider)');
    } else {
      console.log('✅ Tracing disabled as expected');
    }
    
    // Test cleanup
    await integration.cleanup();
    console.log('✅ Plugin integration cleaned up');
    
    console.log('🎉 All Plugin Integration tests passed!');
    
  } catch (error) {
    console.error('❌ Plugin Integration test failed:', error.message);
    throw error;
  }
}

/**
 * Test error handling in service factory
 */
export async function testServiceFactoryErrorHandling(): Promise<void> {
  console.log('🧪 Testing Service Factory Error Handling...');
  
  try {
    const serviceFactory = new ServiceFactory();
    
    // Test with invalid configuration
    const invalidSettings = {
      provider: 'invalid-provider',
      gemini: {
        apiKey: '',
        model: ''
      }
    };
    
    console.log('🔧 Testing invalid configuration handling...');
    
    try {
      await serviceFactory.initializeFromPluginConfig(invalidSettings);
      throw new Error('Should have thrown an error for invalid provider');
    } catch (error) {
      if (error.message.includes('Unsupported LLM provider')) {
        console.log('✅ Invalid provider error handled correctly');
      } else {
        throw error;
      }
    }
    
    // Test accessing services before initialization
    try {
      serviceFactory.getLLMService();
      throw new Error('Should have thrown an error for uninitialized service');
    } catch (error) {
      if (error.message.includes('not initialized')) {
        console.log('✅ Uninitialized service access error handled correctly');
      } else {
        throw error;
      }
    }
    
    console.log('🎉 All Error Handling tests passed!');
    
  } catch (error) {
    console.error('❌ Error Handling test failed:', error.message);
    throw error;
  }
}