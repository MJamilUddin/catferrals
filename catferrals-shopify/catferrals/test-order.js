// Test script to simulate order conversion for referral testing
// Run with: node test-order.js REFERRAL_CODE

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function simulateOrderConversion(referralCode, orderValue = 50) {
  try {
    // Find the referral
    const referral = await prisma.referral.findUnique({
      where: { referralCode: referralCode.toUpperCase() },
      include: {
        program: true
      }
    });

    if (!referral) {
      console.log(`❌ No referral found with code: ${referralCode}`);
      return;
    }

    if (referral.status === 'converted') {
      console.log(`⚠️  Referral ${referralCode} is already converted`);
      return;
    }

    console.log(`✅ Found referral: ${referralCode}`);
    console.log(`📦 Simulating order with value: $${orderValue}`);

    // Calculate commission
    let commissionAmount = 0;
    if (referral.program.commissionType === "percentage") {
      commissionAmount = (orderValue * referral.program.commissionValue) / 100;
    } else {
      commissionAmount = referral.program.commissionValue;
    }

    // Apply maximum commission if set
    if (referral.program.maximumCommission && commissionAmount > referral.program.maximumCommission) {
      commissionAmount = referral.program.maximumCommission;
    }

    // Generate fake order ID
    const orderId = `test_order_${Date.now()}`;

    // Update referral with conversion data
    const updatedReferral = await prisma.referral.update({
      where: { id: referral.id },
      data: {
        status: "converted",
        orderId,
        orderValue: orderValue,
        commissionAmount,
        convertedAt: new Date(),
        refereeCustomerId: 'test-customer-456',
        refereeEmail: 'customer@example.com',
        refereeName: 'Test Customer'
      }
    });

    console.log('\n🎉 Order Conversion Simulated:');
    console.log(`   Order ID: ${orderId}`);
    console.log(`   Order Value: $${orderValue}`);
    console.log(`   Commission: $${commissionAmount}`);
    console.log(`   Status: ${updatedReferral.status}`);
    
    console.log('\n📋 Next Steps:');
    console.log('1. Check your dashboard for updated metrics');
    console.log('2. View Prisma Studio to see the conversion data');
    console.log('3. Run: node test-referral.js check ' + referralCode);

  } catch (error) {
    console.error('❌ Error simulating order:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the simulation
const referralCode = process.argv[2];
const orderValue = parseFloat(process.argv[3]) || 50;

if (!referralCode) {
  console.log('Usage: node test-order.js REFERRAL_CODE [ORDER_VALUE]');
  console.log('Example: node test-order.js ZYPUOTET 75');
} else {
  await simulateOrderConversion(referralCode, orderValue);
} 