/**
 * Simple webhook test - doesn't require firm ID
 * Tests if webhook endpoint is working
 */

const https = require('https');
const http = require('http');

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.intakegenie.xyz';

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

function makeRequest(url, options, data = null) {
  return new Promise((resolve, reject) => {
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

async function testWebhookEndpoint() {
  log('\n📞 Testing Webhook Endpoint', 'cyan');
  log('='.repeat(50), 'cyan');

  const testPayload = {
    event: 'conversation.updated',
    conversation_id: `test-${Date.now()}`,
    phoneNumber: '+16592157925',
    phoneNumberId: 'test-phone-id',
    structuredData: {
      full_name: 'Test User',
      callback_number: '+1234567890',
      reason_for_call: 'Integration test call',
    },
  };

  try {
    log(`Testing: ${APP_URL}/api/vapi/webhook`, 'blue');
    const response = await makeRequest(`${APP_URL}/api/vapi/webhook`, {
      method: 'POST',
    }, testPayload);

    log(`Status: ${response.status}`, response.status === 200 ? 'green' : 'yellow');
    log(`Response: ${JSON.stringify(response.data, null, 2)}`, 'blue');

    if (response.status === 200) {
      log('✅ Webhook endpoint is accessible', 'green');
      if (response.data.warning) {
        log(`⚠️  Warning: ${response.data.warning}`, 'yellow');
        log('   (This is expected if firmId cannot be resolved)', 'blue');
      }
      return true;
    } else {
      log('❌ Webhook endpoint returned error', 'red');
      return false;
    }
  } catch (error) {
    log(`❌ Error: ${error.message}`, 'red');
    return false;
  }
}

async function testEndpointsExist() {
  log('\n🔍 Testing API Endpoints Exist', 'cyan');
  log('='.repeat(50), 'cyan');

  const endpoints = [
    { path: '/api/vapi/webhook', method: 'POST', public: true },
    { path: '/api/vapi/update-assistant', method: 'POST', public: false },
    { path: '/api/vapi/provision-number', method: 'POST', public: false },
  ];

  for (const endpoint of endpoints) {
    try {
      log(`Testing ${endpoint.method} ${endpoint.path}...`, 'blue');
      const response = await makeRequest(`${APP_URL}${endpoint.path}`, {
        method: endpoint.method,
      }, endpoint.public ? {} : { firmId: 'test' });

      if (response.status === 200 || response.status === 401 || response.status === 403 || response.status === 400) {
        log(`✅ ${endpoint.path} exists (status: ${response.status})`, 'green');
      } else {
        log(`⚠️  ${endpoint.path} returned unexpected status: ${response.status}`, 'yellow');
      }
    } catch (error) {
      log(`❌ ${endpoint.path} error: ${error.message}`, 'red');
    }
  }
}

async function runTests() {
  log('\n🚀 Starting Vapi Integration Tests', 'cyan');
  log('='.repeat(50), 'cyan');
  log(`App URL: ${APP_URL}`, 'blue');
  log('='.repeat(50), 'cyan');

  const webhookTest = await testWebhookEndpoint();
  await testEndpointsExist();

  log('\n📊 Test Summary', 'cyan');
  log('='.repeat(50), 'cyan');
  
  if (webhookTest) {
    log('✅ Webhook endpoint: WORKING', 'green');
  } else {
    log('❌ Webhook endpoint: FAILED', 'red');
  }

  log('\n📝 Next Steps:', 'cyan');
  log('1. Check your server logs for webhook processing', 'blue');
  log('2. To test with real firm ID, run:', 'blue');
  log('   node scripts/test-vapi-integration.js <your-firm-id>', 'blue');
  log('3. Make a real phone call to test end-to-end', 'blue');
  log('4. Check Calls section after making a call', 'blue');

  log('\n✨ Test completed!', 'green');
}

runTests().catch((error) => {
  log(`\n❌ Fatal error: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});

