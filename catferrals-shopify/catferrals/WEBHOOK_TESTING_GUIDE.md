# 🚀 Shopify CLI Webhook Testing Guide

## **Professional Webhook Testing for Catferrals**

This guide shows you how to test webhook conversion tracking using **Shopify's standard CLI approach** - the same method used by professional Shopify developers worldwide.

---

## **🎯 Quick Start**

### **1. Run the Test**
```bash
cd catferrals-shopify/catferrals
node test-webhook-simple.cjs
```

### **2. Check Results**
```bash
node test-referral.js check IKRJ5N-C
```

---

## **📋 Complete Testing Workflow**

### **Step 1: Ensure You Have Test Data**
```bash
# Check existing pending referrals
node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.referral.findMany({
  where: { status: 'pending' },
  select: { referralCode: true, status: true }
}).then(refs => {
  console.log('Pending referrals:', refs);
  prisma.\$disconnect();
});
"
```

### **Step 2: Reset a Referral for Testing (if needed)**
```bash
# Reset IKRJ5N-C to pending status
node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.referral.update({
  where: { referralCode: 'IKRJ5N-C' },
  data: {
    status: 'pending',
    orderId: null,
    orderValue: null,
    commissionAmount: null,
    convertedAt: null
  }
}).then(() => {
  console.log('✅ Reset referral to pending');
  prisma.\$disconnect();
});
"
```

### **Step 3: Trigger Webhook Test**
```bash
node test-webhook-simple.cjs
```

**Expected Output:**
```
🚀 Testing Shopify CLI Webhook Trigger
====================================
🔍 Detecting server port...
✅ Detected server on port: 52728
🎯 Target webhook: http://localhost:52728/webhooks/orders/paid

🔥 Triggering webhook...
⏳ Executing...
✅ Webhook trigger completed!
✅ Success! Localhost delivery sucessful.
```

### **Step 4: Check Server Logs**
Look for these messages in your `shopify app dev` terminal:
```
🧪 CLI Test Mode: Processing test webhook
🎯 Using pending referral: IKRJ5N-C
🎉 Referral conversion recorded: IKRJ5N-C -> $10 commission
```

### **Step 5: Verify Conversion**
```bash
node test-referral.js check IKRJ5N-C
```

**Expected Output:**
```
📊 Referral Status:
   Code: IKRJ5N-C
   Status: converted  ✅
   Clicks: 6
   Conversions: 1
   Order ID: cli_test_1752xxxxx
   Order Value: $100
   Commission: $10
```

---

## **🔧 How It Works**

### **Enhanced Webhook Handler**
The webhook handler (`app/routes/webhooks.orders.paid.tsx`) now includes:

1. **CLI Test Detection**: Automatically detects CLI-triggered webhooks
2. **Test Mode Processing**: Uses mock order data with real referral codes
3. **Automatic Referral Selection**: Picks the most recent pending referral
4. **Full Conversion Logic**: Processes commissions exactly like real orders

### **CLI Integration**
- Uses `shopify app webhook trigger` command
- Sends **real Shopify webhook payloads** with proper headers
- Tests **actual webhook authentication** and processing logic
- Works with **any local development server port**

---

## **🧪 Advanced Testing Scenarios**

### **Test Different Order Values**
Modify the mock order in the webhook handler:
```javascript
const mockOrder = {
  id: \`cli_test_\${Date.now()}\`,
  total_price: "150.00", // Change this value
  // ... rest of mock data
};
```

### **Test Multiple Referrals**
```bash
# Create multiple pending referrals
node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function createTestReferrals() {
  // Reset multiple referrals to pending
  await prisma.referral.updateMany({
    where: { referralCode: { in: ['TEST001', 'TEST002', 'IKRJ5N-C'] } },
    data: { status: 'pending' }
  });
  console.log('✅ Reset multiple referrals');
  await prisma.\$disconnect();
}

createTestReferrals().catch(console.error);
"

# Test each one
node test-webhook-simple.cjs  # Converts most recent
node test-webhook-simple.cjs  # Converts next most recent
```

### **Test Commission Calculations**
The webhook uses your real program settings:
- **Percentage commissions**: Calculated from order total
- **Fixed commissions**: Uses program commission value
- **Minimum order values**: Enforced during processing
- **Maximum commissions**: Applied if configured

---

## **🚨 Troubleshooting**

### **"No pending referrals found"**
```bash
# Check what referrals exist
node test-referral.js check IKRJ5N-C

# Reset one to pending if needed
node -e "/* reset script above */"
```

### **"Webhook trigger failed"**
- Ensure your `shopify app dev` server is running
- Check the detected port matches your server
- Verify webhook endpoint responds: `curl http://localhost:52728/webhooks/orders/paid`

### **"Conversion not processed"**
- Check server logs for webhook processing messages
- Verify referral program is active
- Ensure order value meets minimum requirements

---

## **🎯 Production Considerations**

### **For Production Apps:**
1. **Apply for Protected Customer Data Access**:
   - Partner Dashboard → Your App → API Access
   - Request `read_orders` scope approval
   - Explain your referral tracking use case

2. **Use Real Webhook Subscriptions**:
   - Remove CLI test mode detection
   - Deploy with `shopify app deploy`
   - Test with real store purchases

3. **Implement Webhook Queuing**:
   - Use Redis or database queues
   - Handle webhook retries
   - Monitor webhook delivery failures

---

## **📚 Related Resources**

- [Shopify CLI Webhook Documentation](https://shopify.dev/docs/api/shopify-cli/app/app-webhook-trigger)
- [Webhook Best Practices](https://shopify.dev/docs/apps/webhooks)
- [Protected Customer Data](https://shopify.dev/docs/apps/store/data-protection/protected-customer-data)

---

## **✅ Next Steps**

1. **Test the workflow** using the steps above
2. **Integrate into your development process**
3. **Apply for production webhook access** when ready
4. **Consider implementing webhook queuing** for scale

**You now have a professional-grade webhook testing system! 🎉** 