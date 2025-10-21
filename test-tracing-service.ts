/**
 * Test file for tracing service layer
 * This will be used to verify the implementation works correctly
 */

import { LLMService } from './src/services/LLMService';
import { TraceManager } from './src/services/TraceManager';
import { GeminiProvider } from './src/providers/llm/GeminiProvider';
import { LangfuseProvider } from './src/providers/tracing/LangfuseProvider';
import { ConsoleProvider } from './src/providers/tracing/ConsoleProvider';
import type { TracingConfig } from './src/types';

/**
 * Test the tracing service with console provider (for development)
 */
export async function testTracingServiceConsole(): Promise<void> {
  console.log('🧪 Testing Tracing Service Layer (Console Provider)...');
  
  try {
    // Create providers
    const geminiProvider = new GeminiProvider('dummy-key'); // Won't actually call API
    const consoleProvider = new ConsoleProvider(true);
    
    // Create services
    const llmService = new LLMService(geminiProvider);
    const traceManager = new TraceManager(llmService, consoleProvider);
    
    console.log('✅ Services created');
    
    // Test basic tracing operations
    const traceId = await traceManager.startTrace({
      name: 'test-trace',
      userId: 'test-user',
      metadata: { test: true }
    });
    
    console.log('✅ Trace started:', traceId);
    
    // Test span operations
    const result = await traceManager.withSpan(
      'test-operation',
      async (spanId) => {
        console.log('✅ Span started:', spanId);
        
        // Simulate some work
        await new Promise(resolve => setTimeout(resolve, 100));
        
        return { success: true, data: 'test-result' };
      },
      traceId,
      { input: 'test-input' }
    );
    
    console.log('✅ Span operation completed:', result);
    
    // End trace
    await traceManager.endTrace(traceId, { 
      output: result,
      metadata: { status: 'completed' }
    });
    
    console.log('✅ Trace ended');
    
    // Test tracing enabled check
    const isEnabled = traceManager.isTracingEnabled();
    console.log('✅ Tracing enabled:', isEnabled);
    
    // Flush traces
    await traceManager.flush();
    console.log('✅ Traces flushed');
    
    console.log('🎉 All Console Tracing tests passed!');
    
  } catch (error) {
    console.error('❌ Console Tracing test failed:', error.message);
    throw error;
  }
}

/**
 * Test the tracing service with Langfuse provider
 */
export async function testTracingServiceLangfuse(
  publicKey: string, 
  secretKey: string, 
  geminiApiKey: string
): Promise<void> {
  console.log('🧪 Testing Tracing Service Layer (Langfuse Provider)...');
  
  try {
    // Create tracing config
    const tracingConfig: TracingConfig = {
      provider: 'langfuse',
      enabled: true,
      langfuse: {
        publicKey,
        secretKey,
        baseUrl: 'https://cloud.langfuse.com'
      }
    };
    
    // Create providers
    const geminiProvider = new GeminiProvider(geminiApiKey);
    const langfuseProvider = new LangfuseProvider(tracingConfig);
    
    // Verify providers are configured
    if (!geminiProvider.isConfigured()) {
      throw new Error('Gemini provider not configured');
    }
    
    if (!langfuseProvider.isConfigured()) {
      throw new Error('Langfuse provider not configured');
    }
    
    console.log('✅ Providers configured');
    
    // Create services
    const llmService = new LLMService(geminiProvider);
    const traceManager = new TraceManager(llmService, langfuseProvider);
    
    console.log('✅ Services created');
    
    // Test traced LLM generation
    const request = {
      prompt: 'What is 2+2? Answer briefly.',
      model: 'gemini-2.5-flash',
      temperature: 0.1,
      maxTokens: 20
    };
    
    console.log('🚀 Testing traced LLM generation...');
    
    const response = await traceManager.generateText(request);
    
    console.log('✅ Traced LLM Response:');
    console.log('  Text:', response.text);
    console.log('  Model:', response.model);
    console.log('  Usage:', response.usage);
    
    // Verify response format
    if (!response.text || typeof response.text !== 'string') {
      throw new Error('Invalid response format - missing or invalid text');
    }
    
    console.log('✅ Response format validation passed');
    
    // Test manual trace with span
    const traceId = await traceManager.startTrace({
      name: 'manual-test-trace',
      metadata: { 
        test: true,
        timestamp: new Date().toISOString()
      }
    });
    
    console.log('✅ Manual trace started:', traceId);
    
    const spanResult = await traceManager.withSpan(
      'data-processing',
      async (spanId) => {
        console.log('✅ Span started:', spanId);
        
        // Simulate processing
        await new Promise(resolve => setTimeout(resolve, 200));
        
        return { processed: true, items: 42 };
      },
      traceId,
      { 
        input: { data: 'test-data' },
        metadata: { operation: 'test-processing' }
      }
    );
    
    console.log('✅ Span operation completed:', spanResult);
    
    await traceManager.endTrace(traceId, {
      output: spanResult,
      metadata: { status: 'success' }
    });
    
    console.log('✅ Manual trace ended');
    
    // Flush to ensure all traces are sent
    await traceManager.flush();
    console.log('✅ Traces flushed');
    
    console.log('🎉 All Langfuse Tracing tests passed!');
    console.log('📊 Check your Langfuse dashboard to verify traces were captured');
    
  } catch (error) {
    console.error('❌ Langfuse Tracing test failed:', error.message);
    throw error;
  }
}

/**
 * Test error handling in tracing
 */
export async function testTracingErrorHandling(): Promise<void> {
  console.log('🧪 Testing Tracing Error Handling...');
  
  try {
    // Test with invalid Langfuse config
    const invalidConfig: TracingConfig = {
      provider: 'langfuse',
      enabled: true,
      langfuse: {
        publicKey: 'invalid',
        secretKey: 'invalid',
        baseUrl: 'https://invalid.example.com'
      }
    };
    
    const geminiProvider = new GeminiProvider('dummy-key');
    const langfuseProvider = new LangfuseProvider(invalidConfig);
    const llmService = new LLMService(geminiProvider);
    const traceManager = new TraceManager(llmService, langfuseProvider);
    
    // This should not throw, but should handle errors gracefully
    const traceId = await traceManager.startTrace({
      name: 'error-test-trace'
    });
    
    console.log('✅ Error handling test - trace started (should be no-trace):', traceId);
    
    await traceManager.endTrace(traceId);
    console.log('✅ Error handling test - trace ended gracefully');
    
    // Test with disabled tracing
    const disabledConfig: TracingConfig = {
      provider: 'langfuse',
      enabled: false,
      langfuse: {
        publicKey: '',
        secretKey: '',
        baseUrl: ''
      }
    };
    
    const disabledProvider = new LangfuseProvider(disabledConfig);
    const disabledTraceManager = new TraceManager(llmService, disabledProvider);
    
    const isEnabled = disabledTraceManager.isTracingEnabled();
    console.log('✅ Disabled tracing check:', isEnabled);
    
    if (isEnabled) {
      throw new Error('Tracing should be disabled');
    }
    
    console.log('🎉 All Error Handling tests passed!');
    
  } catch (error) {
    console.error('❌ Error Handling test failed:', error.message);
    throw error;
  }
}