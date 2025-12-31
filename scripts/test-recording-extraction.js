#!/usr/bin/env node

/**
 * Test script to verify call recording extraction from Vapi
 * This script fetches recent calls and checks if recordings are being extracted correctly
 * 
 * Usage: node scripts/test-recording-extraction.js
 * (Reads VAPI_API_KEY from .env.local)
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');

// Read VAPI_API_KEY from .env.local or environment
let VAPI_API_KEY = process.env.VAPI_API_KEY;

if (!VAPI_API_KEY) {
  try {
    const envPath = path.join(__dirname, '..', '.env.local');
    if (fs.existsSync(envPath)) {
      const envFile = fs.readFileSync(envPath, 'utf8');
      // Match VAPI_API_KEY=value (handles quoted and unquoted values)
      const match = envFile.match(/^VAPI_API_KEY\s*=\s*(.+)$/m);
      if (match) {
        VAPI_API_KEY = match[1].trim().replace(/^["']|["']$/g, '');
      }
    }
  } catch (error) {
    // .env.local doesn't exist or can't be read, continue
  }
}

const VAPI_API_URL = 'https://api.vapi.ai';

if (!VAPI_API_KEY) {
  console.error('❌ VAPI_API_KEY not found!');
  console.error('\nPlease set it using one of these methods:');
  console.error('  1. Export in shell: export VAPI_API_KEY=your_key');
  console.error('  2. Run with: VAPI_API_KEY=your_key node scripts/test-recording-extraction.js');
  console.error('  3. Ensure .env.local exists in project root with: VAPI_API_KEY=your_key');
  process.exit(1);
}

const vapi = axios.create({
  baseURL: VAPI_API_URL,
  headers: {
    Authorization: `Bearer ${VAPI_API_KEY}`,
    'Content-Type': 'application/json',
  },
});

/**
 * Extract recording URL from call data (mimics webhook extraction logic)
 */
function extractRecordingUrl(callData) {
  let recordingUrl = undefined;

  // Check message.artifact.recording (webhook format)
  if (callData.message?.artifact?.recording) {
    recordingUrl = typeof callData.message.artifact.recording === 'string' 
      ? callData.message.artifact.recording 
      : callData.message.artifact.recording.url || callData.message.artifact.recording.recordingUrl;
  } 
  // Check call.artifact.recording (webhook format alternative)
  else if (callData.message?.call?.artifact?.recording) {
    recordingUrl = typeof callData.message.call.artifact.recording === 'string'
      ? callData.message.call.artifact.recording
      : callData.message.call.artifact.recording.url || callData.message.call.artifact.recording.recordingUrl;
  }
  // Check artifact.recordingUrl first (direct string URL - easiest to use)
  else if (callData.artifact?.recordingUrl) {
    recordingUrl = callData.artifact.recordingUrl;
  }
  // Check artifact.recording (can be string or object)
  else if (callData.artifact?.recording) {
    if (typeof callData.artifact.recording === 'string') {
      recordingUrl = callData.artifact.recording;
    } else {
      // Object format: check stereoUrl, mono.combinedUrl, or url properties
      recordingUrl = callData.artifact.recording.stereoUrl
        || callData.artifact.recording.mono?.combinedUrl
        || callData.artifact.recording.url
        || callData.artifact.recording.recordingUrl;
    }
  }
  // Fallback locations
  else if (callData.recordingUrl) {
    recordingUrl = callData.recordingUrl;
  } else if (callData.recording?.url) {
    recordingUrl = callData.recording.url;
  }

  return recordingUrl;
}

async function testRecordingExtraction() {
  console.log('🔍 Testing Vapi Call Recording Extraction\n');
  console.log('='.repeat(60));

  try {
    // Fetch recent calls from Vapi
    console.log('\n📞 Fetching recent calls from Vapi...');
    const callsResponse = await vapi.get('/call', {
      params: {
        limit: 5, // Get last 5 calls
      },
    });

    const calls = callsResponse.data.calls || callsResponse.data || [];
    
    if (!Array.isArray(calls) || calls.length === 0) {
      console.log('⚠️  No calls found. Make a test call first.');
      return;
    }

    console.log(`✅ Found ${calls.length} call(s)\n`);

    // Test each call
    for (let i = 0; i < calls.length; i++) {
      const call = calls[i];
      const callId = call.id || call.callId;
      
      console.log(`\n📋 Testing Call ${i + 1}: ${callId}`);
      console.log('-'.repeat(60));

      // Get full call details
      try {
        console.log('📥 Fetching full call details...');
        const callDetailResponse = await vapi.get(`/call/${callId}`);
        const callData = callDetailResponse.data;

        console.log('\n🔍 Call Data Structure:');
        console.log('  - Has artifact:', !!callData.artifact);
        console.log('  - Has recording:', !!callData.recording);
        console.log('  - Has message:', !!callData.message);
        
        if (callData.artifact) {
          console.log('  - Artifact keys:', Object.keys(callData.artifact));
          console.log('  - artifact.recording:', callData.artifact.recording ? 'EXISTS' : 'NOT FOUND');
          console.log('  - artifact.recordingUrl:', callData.artifact.recordingUrl ? 'EXISTS' : 'NOT FOUND');
          
          if (callData.artifact.recording) {
            console.log('  - artifact.recording type:', typeof callData.artifact.recording);
            if (typeof callData.artifact.recording === 'object') {
              console.log('  - artifact.recording keys:', Object.keys(callData.artifact.recording));
            }
          }
        }

        // Extract recording URL using our logic
        console.log('\n🎯 Testing Recording Extraction:');
        const recordingUrl = extractRecordingUrl(callData);

        if (recordingUrl) {
          console.log('  ✅ Recording URL extracted successfully!');
          console.log('  📎 URL:', recordingUrl);
          console.log('  📏 URL Length:', recordingUrl.length);
          console.log('  🔗 URL Type:', recordingUrl.startsWith('http') ? 'Valid HTTP URL' : 'Not an HTTP URL');
          
          // Test if URL is accessible (HEAD request)
          try {
            const headResponse = await axios.head(recordingUrl, { timeout: 5000 });
            console.log('  ✅ Recording URL is accessible!');
            console.log('  📊 Status:', headResponse.status);
            console.log('  📦 Content-Type:', headResponse.headers['content-type']);
            console.log('  📏 Content-Length:', headResponse.headers['content-length'] || 'unknown');
          } catch (headError) {
            console.log('  ⚠️  Recording URL may not be accessible yet (this is normal if call just ended)');
            console.log('  📊 Error:', headError.response?.status || headError.message);
          }
        } else {
          console.log('  ❌ No recording URL found!');
          console.log('\n  🔍 Available data paths:');
          console.log('    - callData.artifact:', !!callData.artifact);
          console.log('    - callData.artifact?.recording:', !!callData.artifact?.recording);
          console.log('    - callData.recording:', !!callData.recording);
          console.log('    - callData.recordingUrl:', !!callData.recordingUrl);
          
          if (callData.artifact) {
            console.log('\n  📋 artifact object structure:');
            console.log('    ', JSON.stringify(callData.artifact, null, 2).substring(0, 500));
          }
        }

        // Show call metadata
        console.log('\n📊 Call Metadata:');
        console.log('  - Status:', callData.status || 'unknown');
        console.log('  - Created:', callData.createdAt || 'unknown');
        console.log('  - Ended:', callData.endedAt || 'not ended yet');
        console.log('  - Duration:', callData.endedAt && callData.createdAt 
          ? `${Math.round((new Date(callData.endedAt) - new Date(callData.createdAt)) / 1000)}s`
          : 'N/A');

      } catch (callError) {
        console.error(`  ❌ Error fetching call details:`, callError.response?.data || callError.message);
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('\n✅ Test completed!\n');

  } catch (error) {
    console.error('\n❌ Error:', error.response?.data || error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }
}

// Run the test
testRecordingExtraction().catch(console.error);

