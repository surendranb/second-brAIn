/**
 * Simple test runner for LLM service
 * Run with: node run-llm-test.js
 */

const fs = require('fs');
const path = require('path');

// Read the plugin settings to get the API key
function getApiKey() {
  try {
    const dataPath = path.join(__dirname, 'data.json');
    if (fs.existsSync(dataPath)) {
      const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
      return data.gemini?.apiKey;
    }
  } catch (error) {
    console.error('Could not read API key from data.json:', error.message);
  }
  return null;
}

async function runTest() {
  console.log('🧪 LLM Service Test Runner');
  console.log('==========================');
  
  const apiKey = getApiKey();
  if (!apiKey) {
    console.error('❌ No Gemini API key found in data.json');
    console.log('Please configure your Gemini API key in the plugin settings first.');
    return;
  }
  
  console.log('✅ Found API key in plugin settings');
  
  try {
    // Import and run the test (this would need to be compiled first)
    console.log('📝 To run the actual test:');
    console.log('1. Compile TypeScript: npm run build');
    console.log('2. Import the test functions in your plugin');
    console.log('3. Call testLLMService(apiKey) from the plugin console');
    console.log('');
    console.log('Or test manually by:');
    console.log('1. Opening the plugin console');
    console.log('2. Creating a GeminiProvider with your API key');
    console.log('3. Creating an LLMService with the provider');
    console.log('4. Calling generateText() with a simple prompt');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

runTest();