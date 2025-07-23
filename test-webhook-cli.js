#!/usr/bin/env node
// Shopify CLI Webhook Testing Script
// Tests webhook conversion tracking using real Shopify webhook payloads
// Usage: node test-webhook-cli.js [referral-code] [order-value]

import { exec } from 'child_process';
import { promisify } from 'util';
import { PrismaClient } from '@prisma/client';

const execAsync = promisify(exec);
const prisma = new PrismaClient();

// Configuration
const WEBHOOK_ENDPOINT = 'http://localhost:52728/webhooks/orders/paid';
const PROXY_ENDPOINT = 'http://localhost:52728'; // Proxy port for tracking

async function detectServerPort() {
  try {
    // Try to detect the current running server port
    const { stdout } = await execAsync('lsof -i | grep node | grep LISTEN | head -1');
    const portMatch = stdout.match(/:(\d+)/);
    if (portMatch) {
      const detectedPort = parseInt(portMatch[1]);
      console.log(`🔍 Detected server running on port: ${detectedPort}`);
      return detectedPort;
    }
  } catch (error) {
    console.log('⚠️  Could not auto-detect server port, using default');
  }
  return 52728; // Default port
}

async function createTestReferral(referralCode) {
  try {
    // Find the first active program
    const program = await prisma.referralProgram.findFirst({
      where: { isActive: true }
    });

    if (!program) {
      console.log('❌ No active referral programs found. Create one in the dashboard first.');
      return null;
    }

    // Check if referral already exists
    const existingReferral = await prisma.referral.findUnique({
      where: { referralCode: referralCode.toUpperCase() }
    });

    if (existingReferral) {
      console.log(`✅ Using existing referral: ${existingReferral.referralCode} (status: ${existingReferral.status})`);
      return existingReferral;
    }

    // Create new referral
    const referral = await prisma.referral.create({
      data: {
        shop: program.shop,
        programId: program.id,
        referrerCustomerId: 'cli-test-referrer',
        referrerEmail: 'cli-test@example.com',
        referrerName: 'CLI Test Referrer',
        referralCode: referralCode.toUpperCase(),
        referralLink: `https://${program.shop}?ref=${referralCode.toUpperCase()}`,
        status: 'pending'
      }
    });

    console.log(`✅ Created test referral: ${referral.referralCode}`);
    return referral;

  } catch (error) {
    console.error('❌ Error creating test referral:', error);
    return null;
  }
}

async function simulateReferralClick(referralCode, serverPort) {
  try {
    const trackingUrl = `http://localhost:${serverPort}/api/track/${referralCode.toUpperCase()}`;
    console.log(`🔗 Simulating referral click: ${trackingUrl}`);
    
    const { stdout, stderr } = await execAsync(`curl -s -L "${trackingUrl}" -w "%{http_code}"`);
    const httpCode = stdout.slice(-3);
    
    if (httpCode === '302' || httpCode === '301') {
      console.log('✅ Referral click tracked successfully (redirect received)');
      return true;
    } else {
      console.log(`⚠️  Referral click response: HTTP ${httpCode}`);
      return false;
    }
  } catch (error) {
    console.error('❌ Error simulating referral click:', error);
    return false;
  }
}

async function triggerWebhook(referralCode, orderValue, serverPort) {
  try {
    const webhookUrl = `http://localhost:${serverPort}/webhooks/orders/paid`;
    console.log(`🔥 Triggering Shopify CLI webhook to: ${webhookUrl}`);
    console.log(`📦 Order value: $${orderValue}`);
    console.log(`🔗 Referral code: ${referralCode}`);

    // Create the webhook trigger command
    const command = `shopify app webhook trigger --topic=orders/paid --address="${webhookUrl}" --delivery-method=http`;
    
    console.log('\n⏳ Executing webhook trigger...');
    console.log(`Command: ${command}`);
    
    const { stdout, stderr } = await execAsync(command, { timeout: 30000 });
    
    if (stderr && !stderr.includes('warning')) {
      console.error('❌ Webhook trigger error:', stderr);
      return false;
    }
    
    console.log('✅ Webhook trigger completed');
    if (stdout) {
      console.log('📋 Output:', stdout);
    }
    
    return true;

  } catch (error) {
    console.error('❌ Error triggering webhook:', error.message);
    return false;
  }
}

async function checkConversionResult(referralCode) {
  try {
    // Wait a moment for webhook processing
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const referral = await prisma.referral.findUnique({
      where: { referralCode: referralCode.toUpperCase() },
      include: { program: true }
    });

    if (!referral) {
      console.log('❌ Referral not found after webhook');
      return false;
    }

    console.log('\n📊 Conversion Result:');
    console.log(`   Code: ${referral.referralCode}`);
    console.log(`   Status: ${referral.status}`);
    console.log(`   Clicks: ${referral.clickCount}`);
    
    if (referral.status === 'converted') {
      console.log(`   ✅ CONVERTED!`);
      console.log(`   Order Value: $${referral.orderValue}`);
      console.log(`   Commission: $${referral.commissionAmount}`);
      console.log(`   Order ID: ${referral.orderId}`);
      return true;
    } else {
      console.log(`   ⚠️  Status: ${referral.status} (not converted)`);
      return false;
    }

  } catch (error) {
    console.error('❌ Error checking conversion result:', error);
    return false;
  }
}

async function runWebhookTest() {
  console.log('🚀 Shopify CLI Webhook Testing');
  console.log('================================');

  // Get parameters
  const referralCode = process.argv[2] || 'WEBHOOK-TEST';
  const orderValue = parseFloat(process.argv[3]) || 100;

  console.log(`📋 Test Parameters:`);
  console.log(`   Referral Code: ${referralCode}`);
  console.log(`   Order Value: $${orderValue}`);

  try {
    // Step 1: Detect server port
    const serverPort = await detectServerPort();
    console.log(`\n🔍 Using server port: ${serverPort}`);

    // Step 2: Create or get test referral
    console.log('\n📝 Step 1: Setting up test referral...');
    const referral = await createTestReferral(referralCode);
    if (!referral) {
      console.log('❌ Failed to create test referral');
      return;
    }

    // Step 3: Simulate referral click (optional, for realistic testing)
    console.log('\n👆 Step 2: Simulating referral click...');
    await simulateReferralClick(referralCode, serverPort);

    // Step 4: Trigger webhook
    console.log('\n🔥 Step 3: Triggering webhook...');
    const webhookSuccess = await triggerWebhook(referralCode, orderValue, serverPort);
    
    if (!webhookSuccess) {
      console.log('❌ Webhook trigger failed');
      return;
    }

    // Step 5: Check results
    console.log('\n📊 Step 4: Checking conversion results...');
    const conversionSuccess = await checkConversionResult(referralCode);

    // Summary
    console.log('\n🎯 Test Summary:');
    console.log(`   Webhook Triggered: ${webhookSuccess ? '✅' : '❌'}`);
    console.log(`   Conversion Tracked: ${conversionSuccess ? '✅' : '❌'}`);
    
    if (conversionSuccess) {
      console.log('\n🎉 SUCCESS: End-to-end webhook conversion tracking works!');
    } else {
      console.log('\n⚠️  PARTIAL: Webhook triggered but conversion not detected');
      console.log('   Check server logs for webhook processing details');
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Helper function to show usage
function showUsage() {
  console.log('Usage: node test-webhook-cli.js [referral-code] [order-value]');
  console.log('');
  console.log('Examples:');
  console.log('  node test-webhook-cli.js                    # Uses defaults');
  console.log('  node test-webhook-cli.js MYCODE            # Custom referral code');
  console.log('  node test-webhook-cli.js MYCODE 150        # Custom code and order value');
  console.log('');
  console.log('This script:');
  console.log('  1. Creates a test referral (if needed)');
  console.log('  2. Simulates a referral click');
  console.log('  3. Triggers a real Shopify webhook using CLI');
  console.log('  4. Checks if conversion was properly tracked');
}

// Check for help flag
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  showUsage();
  process.exit(0);
}

// Run the test
runWebhookTest().catch(console.error); 