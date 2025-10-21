/**
 * Test file for LLM service layer
 * This will be used to verify the implementation works correctly
 */

import { LLMService } from './src/services/LLMService';
import { GeminiProvider } from './src/providers/llm/GeminiProvider';

/**
 * Test the LLM service with Gemini provider
 */
export async function testLLMService(apiKey: string): Promise<void> {
  console.log('🧪 Testing LLM Service Layer...');
  
  try {
    // Create Gemini provider
    const geminiProvider = new GeminiProvider(apiKey);
    
    // Verify provider is configured
    if (!geminiProvider.isConfigured()) {
      throw new Error('Gemini provider not configured properly');
    }
    
    console.log('✅ Gemini provider configured');
    
    // Create LLM service
    const llmService = new LLMService(geminiProvider);
    
    // Test basic text generation
    const request = {
      prompt: 'What is the capital of France? Answer in one sentence.',
      model: 'gemini-2.5-flash',
      temperature: 0.3,
      maxTokens: 50
    };
    
    console.log('🚀 Testing text generation...');
    const response = await llmService.generateText(request);
    
    console.log('✅ LLM Service Response:');
    console.log('  Text:', response.text);
    console.log('  Model:', response.model);
    console.log('  Usage:', response.usage);
    
    // Verify response format
    if (!response.text || typeof response.text !== 'string') {
      throw new Error('Invalid response format - missing or invalid text');
    }
    
    if (!response.model || typeof response.model !== 'string') {
      throw new Error('Invalid response format - missing or invalid model');
    }
    
    console.log('✅ Response format validation passed');
    
    // Test provider info
    const providerInfo = llmService.getProviderInfo();
    console.log('📋 Provider Info:', providerInfo);
    
    if (providerInfo.name !== 'gemini') {
      throw new Error('Provider name mismatch');
    }
    
    if (!Array.isArray(providerInfo.models) || providerInfo.models.length === 0) {
      throw new Error('Provider models not properly configured');
    }
    
    console.log('✅ Provider info validation passed');
    
    // Test configuration validation
    const isValid = await llmService.validateConfig();
    if (!isValid) {
      throw new Error('Configuration validation failed');
    }
    
    console.log('✅ Configuration validation passed');
    
    console.log('🎉 All LLM Service tests passed!');
    
  } catch (error) {
    console.error('❌ LLM Service test failed:', error.message);
    throw error;
  }
}

/**
 * Test streaming functionality
 */
export async function testLLMStreaming(apiKey: string): Promise<void> {
  console.log('🧪 Testing LLM Streaming...');
  
  try {
    const geminiProvider = new GeminiProvider(apiKey);
    const llmService = new LLMService(geminiProvider);
    
    const request = {
      prompt: 'Count from 1 to 5, one number per line.',
      model: 'gemini-2.5-flash',
      temperature: 0.1
    };
    
    console.log('🚀 Testing streaming generation...');
    
    let chunks: string[] = [];
    let completedChunks = 0;
    
    for await (const chunk of llmService.streamText(request)) {
      if (chunk.text) {
        chunks.push(chunk.text);
        process.stdout.write(chunk.text);
      }
      
      if (chunk.isComplete) {
        completedChunks++;
        console.log('\n✅ Stream completed');
        break;
      }
    }
    
    if (chunks.length === 0) {
      throw new Error('No chunks received from streaming');
    }
    
    if (completedChunks !== 1) {
      throw new Error('Stream completion signal not received properly');
    }
    
    console.log('✅ Streaming test passed!');
    
  } catch (error) {
    console.error('❌ Streaming test failed:', error.message);
    throw error;
  }
}