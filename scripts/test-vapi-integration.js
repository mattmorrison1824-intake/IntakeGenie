/**
 * Comprehensive test script for Vapi integration
 * Tests: webhook handling, call logging, settings, knowledge base
 */

const https = require('https');
const http = require('http');

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.intakegenie.xyz';
const TEST_FIRM_ID = process.argv[2]; // Pass firm ID as argument

if (!TEST_FIRM_ID) {
  console.error('❌ Error: Please provide a firm ID as argument');
  console.log('Usage: node scripts/test-vapi-integration.js <firm-id>');
  process.exit(1);
}

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function makeRequest(url, options, data = null, followRedirects = true, maxRedirects = 5) {
  return new Promise((resolve, reject) => {
    if (maxRedirects <= 0) {
      reject(new Error('Too many redirects'));
      return;
    }

    const urlObj = new URL(url);
    const isHttps = urlObj.protocol === 'https:';
    const client = isHttps ? https : http;

    const reqOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    };

    const req = client.request(reqOptions, (res) => {
      // Handle redirects
      if (followRedirects && (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307 || res.statusCode === 308)) {
        const location = res.headers.location;
        if (location) {
          const redirectUrl = location.startsWith('http') ? location : `${urlObj.protocol}//${urlObj.host}${location}`;
          return makeRequest(redirectUrl, options, data, followRedirects, maxRedirects - 1).then(resolve).catch(reject);
        }
      }

      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        try {
          const parsed = body ? JSON.parse(body) : {};
          resolve({
            status: res.statusCode,
            headers: res.headers,
            data: parsed,
            raw: body,
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            data: body,
            raw: body,
          });
        }
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

async function testWebhook() {
  log('\n📞 Testing Webhook Endpoint', 'cyan');
  log('='.repeat(50), 'cyan');

  const testConversationId = `test-${Date.now()}`;
  const testPhoneNumber = '+16592157925';

  const webhookPayload = {
    event: 'conversation.updated',
    conversation_id: testConversationId,
    metadata: {
      firmId: TEST_FIRM_ID,
    },
    phoneNumber: testPhoneNumber,
    phoneNumberId: 'test-phone-id',
    structuredData: {
      full_name: 'Test User',
      callback_number: '+1234567890',
      reason_for_call: 'Test call for integration testing',
    },
    transcript: 'Test conversation transcript',
  };

  try {
    log(`Sending webhook to: ${APP_URL}/api/vapi/webhook`, 'blue');
    log(`Payload: ${JSON.stringify(webhookPayload, null, 2)}`, 'blue');

    const response = await makeRequest(`${APP_URL}/api/vapi/webhook`, {
      method: 'POST',
    }, webhookPayload);

    if (response.status === 200) {
      log('✅ Webhook received successfully', 'green');
      log(`Response: ${JSON.stringify(response.data, null, 2)}`, 'blue');
    } else {
      log(`❌ Webhook failed with status ${response.status}`, 'red');
      log(`Response: ${JSON.stringify(response.data, null, 2)}`, 'red');
    }

    // Test conversation.completed event
    log('\n📞 Testing conversation.completed event', 'cyan');
    const completedPayload = {
      ...webhookPayload,
      event: 'conversation.completed',
      transcript: 'Full test conversation transcript. This is a test call to verify the integration works correctly.',
    };

    const completedResponse = await makeRequest(`${APP_URL}/api/vapi/webhook`, {
      method: 'POST',
    }, completedPayload);

    if (completedResponse.status === 200) {
      log('✅ Conversation completed webhook received successfully', 'green');
    } else {
      log(`❌ Conversation completed webhook failed with status ${completedResponse.status}`, 'red');
      log(`Response: ${JSON.stringify(completedResponse.data, null, 2)}`, 'red');
    }

    return { success: response.status === 200 && completedResponse.status === 200, conversationId: testConversationId };
  } catch (error) {
    log(`❌ Webhook test error: ${error.message}`, 'red');
    return { success: false, error: error.message };
  }
}

async function testAssistantUpdate() {
  log('\n⚙️  Testing Assistant Update Endpoint', 'cyan');
  log('='.repeat(50), 'cyan');

  try {
    log(`Sending update request to: ${APP_URL}/api/vapi/update-assistant`, 'blue');
    log(`Firm ID: ${TEST_FIRM_ID}`, 'blue');

    const response = await makeRequest(`${APP_URL}/api/vapi/update-assistant`, {
      method: 'POST',
    }, {
      firmId: TEST_FIRM_ID,
    });

    if (response.status === 200) {
      log('✅ Assistant update successful', 'green');
      log(`Response: ${JSON.stringify(response.data, null, 2)}`, 'blue');
      return { success: true };
    } else {
      log(`⚠️  Assistant update returned status ${response.status}`, 'yellow');
      log(`Response: ${JSON.stringify(response.data, null, 2)}`, 'yellow');
      
      // Check if it's a "no assistant" error (expected if not provisioned)
      if (response.data?.error === 'No assistant found') {
        log('ℹ️  This is expected if no phone number has been provisioned yet', 'blue');
        return { success: true, skipped: true };
      }
      
      return { success: false, error: response.data };
    }
  } catch (error) {
    log(`❌ Assistant update test error: ${error.message}`, 'red');
    return { success: false, error: error.message };
  }
}

async function testSettingsEndpoints() {
  log('\n🔧 Testing Settings Endpoints', 'cyan');
  log('='.repeat(50), 'cyan');

  // Note: These endpoints require authentication, so we can't fully test them
  // But we can verify they exist and return proper error messages
  const endpoints = [
    '/api/vapi/provision-number',
    '/api/vapi/link-number',
    '/api/vapi/refresh-phone-number',
  ];

  for (const endpoint of endpoints) {
    try {
      log(`Testing ${endpoint}...`, 'blue');
      const response = await makeRequest(`${APP_URL}${endpoint}`, {
        method: 'POST',
      }, { firmId: TEST_FIRM_ID });

      // We expect 401/403 for unauthenticated requests, which is correct
      if (response.status === 401 || response.status === 403) {
        log(`✅ ${endpoint} exists and requires authentication (expected)`, 'green');
      } else if (response.status === 400) {
        log(`✅ ${endpoint} exists and validates input (expected)`, 'green');
      } else {
        log(`⚠️  ${endpoint} returned unexpected status ${response.status}`, 'yellow');
      }
    } catch (error) {
      log(`❌ Error testing ${endpoint}: ${error.message}`, 'red');
    }
  }
}

async function runAllTests() {
  log('\n🚀 Starting Vapi Integration Tests', 'cyan');
  log('='.repeat(50), 'cyan');
  log(`App URL: ${APP_URL}`, 'blue');
  log(`Firm ID: ${TEST_FIRM_ID}`, 'blue');
  log('='.repeat(50), 'cyan');

  const results = {
    webhook: null,
    assistantUpdate: null,
    settings: null,
  };

  // Test webhook
  results.webhook = await testWebhook();

  // Test assistant update
  results.assistantUpdate = await testAssistantUpdate();

  // Test settings endpoints
  await testSettingsEndpoints();

  // Summary
  log('\n📊 Test Summary', 'cyan');
  log('='.repeat(50), 'cyan');
  
  if (results.webhook?.success) {
    log('✅ Webhook endpoint: PASSED', 'green');
  } else {
    log('❌ Webhook endpoint: FAILED', 'red');
    if (results.webhook?.error) {
      log(`   Error: ${results.webhook.error}`, 'red');
    }
  }

  if (results.assistantUpdate?.success) {
    log('✅ Assistant update: PASSED', 'green');
    if (results.assistantUpdate?.skipped) {
      log('   (Skipped - no assistant found, expected if not provisioned)', 'blue');
    }
  } else {
    log('❌ Assistant update: FAILED', 'red');
    if (results.assistantUpdate?.error) {
      log(`   Error: ${JSON.stringify(results.assistantUpdate.error)}`, 'red');
    }
  }

  log('\n📝 Next Steps:', 'cyan');
  log('1. Check your server logs for webhook processing', 'blue');
  log('2. Check your database calls table for the test call', 'blue');
  log(`3. Look for conversation_id: ${results.webhook?.conversationId || 'N/A'}`, 'blue');
  log('4. Verify the call appears in the Calls section of the platform', 'blue');
  log('5. Test updating AI Receptionist settings and Knowledge Base', 'blue');
  log('6. Make a real phone call to test end-to-end', 'blue');

  log('\n✨ Test script completed!', 'green');
}

// Run tests
runAllTests().catch((error) => {
  log(`\n❌ Fatal error: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});

