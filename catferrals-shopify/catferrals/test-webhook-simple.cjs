#!/usr/bin/env node
// Simple Shopify CLI Webhook Testing Script
// Tests webhook conversion tracking using real Shopify webhook payloads

const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

async function testWebhookTrigger() {
  console.log('🚀 Testing Shopify CLI Webhook Trigger');
  console.log('====================================');

  try {
    // Detect current server port
    console.log('🔍 Detecting server port...');
    
    let serverPort = 52728; // Default from logs
    try {
      const { stdout } = await execAsync('lsof -i | grep node | grep LISTEN | head -1');
      const portMatch = stdout.match(/:(\d+)/);
      if (portMatch) {
        serverPort = parseInt(portMatch[1]);
        console.log(`✅ Detected server on port: ${serverPort}`);
      }
    } catch (error) {
      console.log(`⚠️  Using default port: ${serverPort}`);
    }

    // Webhook endpoint
    const webhookUrl = `http://localhost:${serverPort}/webhooks/orders/paid`;
    console.log(`🎯 Target webhook: ${webhookUrl}`);

    // Trigger webhook with API version
    console.log('\n🔥 Triggering webhook...');
    const command = `shopify app webhook trigger --topic=orders/paid --address="${webhookUrl}" --delivery-method=http --api-version=2025-04`;
    
    console.log(`📋 Command: ${command}`);
    console.log('⏳ Executing...');

    const { stdout, stderr } = await execAsync(command, { timeout: 30000 });
    
    console.log('\n✅ Webhook trigger completed!');
    
    if (stdout) {
      console.log('📤 Output:');
      console.log(stdout);
    }
    
    if (stderr && !stderr.includes('warning')) {
      console.log('⚠️  Errors:');
      console.log(stderr);
    }

    console.log('\n🔍 Check your server logs for webhook processing details');
    console.log('Look for messages like:');
    console.log('  - "🧪 CLI Test Mode: Processing test webhook"');
    console.log('  - "🎯 Using pending referral: [CODE]"');
    console.log('  - "🎉 Referral conversion recorded"');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Show usage if help requested
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log('Simple Webhook Testing Script');
  console.log('Usage: node test-webhook-simple.cjs');
  console.log('');
  console.log('This script triggers a Shopify CLI webhook to test your conversion tracking.');
  console.log('Make sure you have a pending referral in your database first.');
  process.exit(0);
}

// Run the test
testWebhookTrigger(); 