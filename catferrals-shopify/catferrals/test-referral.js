// Test script to create referral links for testing
// Run with: node test-referral.js

import { PrismaClient } from '@prisma/client';
import { nanoid } from 'nanoid';

const prisma = new PrismaClient();

async function createTestReferral() {
  try {
    // Find the first active program
    const program = await prisma.referralProgram.findFirst({
      where: { isActive: true }
    });

    if (!program) {
      console.log('❌ No active referral programs found. Create one in the dashboard first.');
      return;
    }

    console.log(`✅ Found program: ${program.name} (ID: ${program.id})`);

    // Generate unique referral code
    const referralCode = nanoid(8).toUpperCase();
    const referralLink = `https://${program.shop}?ref=${referralCode}`;

    // Create test referral
    const referral = await prisma.referral.create({
      data: {
        shop: program.shop,
        programId: program.id,
        referrerCustomerId: 'test-referrer-123',
        referrerEmail: 'john.referrer@example.com',
        referrerName: 'John Referrer',
        referralCode,
        referralLink,
        status: 'pending'
      }
    });

    console.log('\n🎉 Test Referral Created:');
    console.log(`   Referral Code: ${referralCode}`);
    console.log(`   Referral Link: ${referralLink}`);
    console.log(`   Tracking URL: http://localhost:53608/api/track/${referralCode}`);
    
    console.log('\n📋 Next Steps:');
    console.log('1. Copy the Tracking URL above (use the localhost one for testing)');
    console.log('2. Open it in an incognito browser window');
    console.log('3. Add products to cart and checkout');
    console.log('4. Complete the purchase');
    console.log('5. Check Prisma Studio to see the conversion');

    return referral;

  } catch (error) {
    console.error('❌ Error creating test referral:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Also create a function to check referral status
async function checkReferralStatus(code) {
  try {
    const referral = await prisma.referral.findUnique({
      where: { referralCode: code.toUpperCase() },
      include: {
        program: true,
        clicks: true
      }
    });

    if (!referral) {
      console.log(`❌ No referral found with code: ${code}`);
      return;
    }

    console.log('\n📊 Referral Status:');
    console.log(`   Code: ${referral.referralCode}`);
    console.log(`   Status: ${referral.status}`);
    console.log(`   Clicks: ${referral.clickCount}`);
    console.log(`   Conversions: ${referral.status === 'converted' ? 1 : 0}`);
    
    if (referral.status === 'converted') {
      console.log(`   Order ID: ${referral.orderId}`);
      console.log(`   Order Value: $${referral.orderValue}`);
      console.log(`   Commission: $${referral.commissionAmount}`);
    }

  } catch (error) {
    console.error('❌ Error checking referral:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run based on command line arguments
async function main() {
  const command = process.argv[2];
  const code = process.argv[3];

  if (command === 'create') {
    await createTestReferral();
  } else if (command === 'check' && code) {
    await checkReferralStatus(code);
  } else {
    console.log('Usage:');
    console.log('  node test-referral.js create          # Create a new test referral');
    console.log('  node test-referral.js check CODE      # Check referral status');
  }
}

main().catch(console.error); 