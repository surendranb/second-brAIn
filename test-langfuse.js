/**
 * Simple test script to verify Langfuse batch ingestion API
 * Run with: node test-langfuse.js
 */

const https = require('https');

// Test configuration - replace with your actual keys
const config = {
  baseUrl: 'https://cloud.langfuse.com',
  publicKey: 'pk-lf-your-public-key',  // Replace with actual key
  secretKey: 'sk-lf-your-secret-key'   // Replace with actual key
};

function generateId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = Math.random() * 16 | 0;
    const v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

async function testLangfuseIngestion() {
  const traceId = generateId();
  const generationId = generateId();
  
  const events = [
    {
      id: generateId(),
      timestamp: new Date().toISOString(),
      type: 'trace-create',
      body: {
        id: traceId,
        name: 'test-trace',
        input: { test: 'input' },
        metadata: { source: 'test-script' },
        timestamp: new Date().toISOString()
      }
    },
    {
      id: generateId(),
      timestamp: new Date().toISOString(),
      type: 'generation-create',
      body: {
        id: generationId,
        traceId: traceId,
        name: 'test-generation',
        model: 'test-model',
        input: 'test prompt',
        startTime: new Date().toISOString()
      }
    },
    {
      id: generateId(),
      timestamp: new Date().toISOString(),
      type: 'generation-update',
      body: {
        id: generationId,
        endTime: new Date().toISOString(),
        output: 'test response',
        usage: {
          input: 10,
          output: 20,
          total: 30,
          unit: 'TOKENS'
        }
      }
    }
  ];

  const payload = {
    batch: events,
    metadata: {
      sdk_name: 'obsidian-second-brain-test',
      sdk_version: '1.0.0'
    }
  };

  const auth = Buffer.from(`${config.publicKey}:${config.secretKey}`).toString('base64');
  
  const options = {
    hostname: 'cloud.langfuse.com',
    port: 443,
    path: '/api/public/ingestion',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${auth}`,
      'Content-Length': Buffer.byteLength(JSON.stringify(payload))
    }
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        console.log('Status Code:', res.statusCode);
        console.log('Response Headers:', res.headers);
        console.log('Response Body:', data);
        
        if (res.statusCode === 207 || res.statusCode === 200) {
          resolve({ success: true, data: JSON.parse(data) });
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.write(JSON.stringify(payload));
    req.end();
  });
}

// Only run test if keys are provided
if (config.publicKey.startsWith('pk-lf-') && config.secretKey.startsWith('sk-lf-')) {
  console.log('Testing Langfuse batch ingestion API...');
  console.log('NOTE: Replace the publicKey and secretKey in this file with your actual Langfuse keys');
  console.log('Keys should start with pk-lf- and sk-lf- respectively');
} else {
  console.log('🚀 Testing Langfuse batch ingestion API...');
  
  testLangfuseIngestion()
    .then(result => {
      console.log('✅ Test successful!');
      console.log('Response:', JSON.stringify(result, null, 2));
    })
    .catch(error => {
      console.error('❌ Test failed:', error.message);
      
      if (error.message.includes('401')) {
        console.log('💡 This is likely an authentication error. Check your API keys.');
      } else if (error.message.includes('404')) {
        console.log('💡 This suggests the endpoint URL is incorrect.');
      } else if (error.message.includes('405')) {
        console.log('💡 This suggests the HTTP method is not allowed.');
      }
    });
}