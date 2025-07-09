import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

async function createTestData() {
  try {
    console.log('🔥 Creating test data for referrer portal...');
    
    const shop = 'cats-tests.myshopify.com';
    
    // 1. Create a referral program
    const program = await db.referralProgram.create({
      data: {
        shop,
        name: 'Summer Referral Program',
        description: 'Refer friends and earn 10% commission on their first purchase!',
        isActive: true,
        commissionType: 'percentage',
        commissionValue: 10.0,
        minimumOrderValue: 25.0,
        allowSelfRegistration: true,
        welcomeMessage: 'Welcome to our referral program! Start earning commissions today.'
      }
    });
    console.log('✅ Created referral program:', program.name);
    
    // 2. Create a test referrer account
    const referrer = await db.referrerAccount.create({
      data: {
        shop,
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        phone: '+1234567890',
        isActive: true,
        isEmailVerified: true,
        totalReferrals: 2,
        totalConversions: 1,
        totalCommissionEarned: 15.50,
        totalCommissionPaid: 0
      }
    });
    console.log('✅ Created referrer account:', referrer.email);
    
    // 3. Create referrals for the account
    const referral1 = await db.referral.create({
      data: {
        shop,
        programId: program.id,
        referrerAccountId: referrer.id,
        referrerCustomerId: `account_${referrer.id}`,
        referrerEmail: referrer.email,
        referrerName: `${referrer.firstName} ${referrer.lastName}`,
        referralCode: 'TEST001',
        referralLink: `https://${shop}?ref=TEST001`,
        status: 'converted',
        clickCount: 5,
        orderId: 'order_12345',
        orderValue: 75.00,
        commissionAmount: 7.50,
        commissionPaid: false,
        convertedAt: new Date()
      }
    });
    
    const referral2 = await db.referral.create({
      data: {
        shop,
        programId: program.id,
        referrerAccountId: referrer.id,
        referrerCustomerId: `account_${referrer.id}`,
        referrerEmail: referrer.email,
        referrerName: `${referrer.firstName} ${referrer.lastName}`,
        referralCode: 'TEST002',
        referralLink: `https://${shop}?ref=TEST002`,
        status: 'pending',
        clickCount: 3
      }
    });
    
    console.log('✅ Created referrals:', referral1.referralCode, referral2.referralCode);
    
    // 4. Create some clicks for analytics
    await db.referralClick.create({
      data: {
        referralId: referral1.id,
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0 (compatible test)',
        country: 'US',
        city: 'New York'
      }
    });
    
    await db.referralClick.create({
      data: {
        referralId: referral2.id,
        ipAddress: '192.168.1.2',
        userAgent: 'Mozilla/5.0 (compatible test)',
        country: 'US',
        city: 'Los Angeles'
      }
    });
    
    console.log('✅ Created referral clicks');
    
    console.log('\n🎉 Test data created successfully!');
    console.log('\n📊 Summary:');
    console.log(`   • Shop: ${shop}`);
    console.log(`   • Program: ${program.name}`);
    console.log(`   • Referrer: ${referrer.email}`);
    console.log(`   • Referrals: ${referral1.referralCode}, ${referral2.referralCode}`);
    console.log('\n🔗 Portal URL:');
    console.log(`   http://localhost:53681/portal?shop=${shop}&email=${referrer.email}`);
    console.log('\n🔗 Registration URL:');
    console.log(`   http://localhost:53681/register?shop=${shop}`);
    
  } catch (error) {
    console.error('❌ Error creating test data:', error);
  } finally {
    await db.$disconnect();
  }
}

createTestData(); 