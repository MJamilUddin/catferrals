import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { sendCommissionNotificationEmail } from "../lib/email.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  console.log("🔍 Webhook received - Starting authentication debug");
  
  // Log all headers for debugging
  const headers: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    headers[key] = value;
  });
  console.log("📋 Webhook headers:", headers);
  
  // Log request method and URL
  console.log("🌐 Request method:", request.method);
  console.log("🌐 Request URL:", request.url);
  
  // Check if this is a CLI test webhook (no X-Shopify-Shop-Domain or generic user-agent)
  const isCliTest = !headers['x-shopify-shop-domain'] || 
                   headers['user-agent']?.includes('curl') ||
                   headers['user-agent']?.includes('node') ||
                   headers['x-shopify-shop-domain'] === 'shop.myshopify.com';
  
  if (isCliTest) {
    console.log("🧪 CLI Test Mode: Processing test webhook");
    return await handleTestWebhook(request);
  }
  
  try {
    console.log("🔐 Starting Shopify webhook authentication...");
    const { topic, shop, session, admin, payload } = await authenticate.webhook(request);
    console.log("✅ Authentication successful!");
    console.log("📦 Topic:", topic);
    console.log("🏪 Shop:", shop);
    console.log("🔍 About to start webhook processing...");

    try {
      if (topic !== "orders/paid" && topic !== "ORDERS_PAID") {
        console.log("❌ Topic not supported:", topic);
        return json({ message: "Webhook topic not supported" }, { status: 200 });
      }

      console.log("🔍 Checking if test shop...");
      // If this is a test shop, use CLI test mode
      if (shop === 'shop.myshopify.com') {
        console.log("🧪 Test shop detected, using CLI test mode");
        return await handleTestWebhook(request);
      }
      
      console.log("🏪 Processing as real shop:", shop);
      return await processOrderWebhook(payload, shop);
    } catch (processingError: any) {
      console.log("❌ Error during webhook processing:");
      console.log("🔍 Processing error details:", processingError);
      console.log("🔍 Processing error message:", processingError?.message);
      throw processingError; // Re-throw to be caught by outer catch
    }

  } catch (error: any) {
    console.log("❌ Webhook processing failed!");
    console.log("🔍 Error details:", error);
    console.log("🔍 Error message:", error?.message);
    console.log("🔍 Error name:", error?.name);
    console.log("🔍 Error stack:", error?.stack);
    
    // Check if this is an authentication error
    if (error?.message?.includes('authenticate') || error?.message?.includes('HMAC') || error?.message?.includes('webhook')) {
      console.log("🔐 Authentication-specific error detected");
      return json({ 
        error: "Webhook authentication failed",
        details: error?.message,
        type: "authentication_error"
      }, { status: 401 });
    }
    
    // Generic error response
    return json({ 
      error: "Failed to process webhook",
      details: error?.message || "Unknown error",
      type: "processing_error"
    }, { status: 500 });
  }
};

async function handleTestWebhook(request: Request) {
  try {
    console.log("🧪 Processing CLI test webhook");
    
    // For CLI tests, we'll use the most recent pending referral
    const pendingReferral = await db.referral.findFirst({
      where: { 
        status: 'pending',
        shop: 'cats-tests.myshopify.com' // Your test shop
      },
      include: { program: true },
      orderBy: { createdAt: 'desc' }
    });

    if (!pendingReferral) {
      console.log("⚠️  No pending referrals found for CLI test");
      return json({ message: "No pending referrals for testing" }, { status: 200 });
    }

    console.log(`🎯 Using pending referral: ${pendingReferral.referralCode}`);

    // Create a mock order payload for testing
    const mockOrder = {
      id: `cli_test_${Date.now()}`,
      total_price: "100.00",
      customer: {
        id: "cli_test_customer",
        email: "cli-test@example.com",
        first_name: "CLI",
        last_name: "Test"
      },
      note_attributes: [
        {
          name: "referral_code",
          value: pendingReferral.referralCode
        }
      ]
    };

    return await processOrderWebhook(mockOrder, pendingReferral.shop);

  } catch (error: any) {
    console.error("❌ CLI test webhook failed:", error);
    return json({ error: "CLI test failed" }, { status: 500 });
  }
}

async function processOrderWebhook(order: any, shop: string) {
  console.log(`Processing order webhook for shop: ${shop}`);
  console.log(`Order data:`, {
    orderId: order.id,
    total: order.total_price,
    noteAttributes: order.note_attributes,
    customerEmail: order.customer?.email,
    rawPayload: JSON.stringify(order, null, 2)
  });

  // Extract order data
  const orderId = order.id.toString();
  const orderTotal = parseFloat(order.total_price) || 0;
  const customerId = order.customer?.id?.toString();
  const customerEmail = order.customer?.email;
  const customerName = `${order.customer?.first_name || ''} ${order.customer?.last_name || ''}`.trim();

  // Look for referral tracking in order attributes or note attributes
  let referralCode: string | null = null;
  
  // Check note attributes for referral code (including cart attributes that become note_attributes)
  if (order.note_attributes && Array.isArray(order.note_attributes)) {
    console.log('Found note_attributes:', order.note_attributes);
    const refAttribute = order.note_attributes.find((attr: any) => {
      console.log('Checking attribute:', attr);
      return attr.name === "_referral_code" || attr.name === "referral_code" || attr.name === "ref";
    });
    if (refAttribute) {
      referralCode = refAttribute.value;
      console.log(`Found referral code in order attributes: ${referralCode}`);
    } else {
      console.log('No referral code found in note_attributes:', order.note_attributes);
    }
  } else {
    console.log('No note_attributes found in order');
  }

  // Also check order tags or landing site
  if (!referralCode && order.landing_site) {
    const urlParams = new URLSearchParams(order.landing_site.split('?')[1] || '');
    referralCode = urlParams.get('ref');
  }

  // Check customer metafields for referral tracking
  if (!referralCode && order.customer?.metafields) {
    const referralMetafield = order.customer.metafields.find((field: any) => 
      field.namespace === "catferrals" && field.key === "referral_code"
    );
    if (referralMetafield) {
      referralCode = referralMetafield.value;
    }
  }

  // Fallback: Check if there's a recent referral click from same customer email
  if (!referralCode && customerEmail) {
    const recentReferral = await db.referral.findFirst({
      where: {
        shop,
        OR: [
          { referrerEmail: customerEmail },
          { refereeEmail: customerEmail }
        ],
        lastClickedAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Within last 30 days
        }
      },
      orderBy: { lastClickedAt: 'desc' }
    });
    
    if (recentReferral) {
      referralCode = recentReferral.referralCode;
      console.log(`Found referral via customer email lookup: ${referralCode}`);
    }
  }

  if (!referralCode) {
    console.log("No referral code found in order");
    return json({ message: "No referral tracking found" }, { status: 200 });
  }

  console.log(`🎯 Processing referral: ${referralCode}`);

  // Find the referral
  const referral = await db.referral.findUnique({
    where: { referralCode: referralCode.toUpperCase() },
    include: {
      program: true
    }
  });

  if (!referral || !referral.program.isActive) {
    console.log(`Referral not found or inactive: ${referralCode}`);
    return json({ message: "Referral not found or inactive" }, { status: 200 });
  }

  // Check if already converted
  if (referral.status === 'converted') {
    console.log(`Referral ${referralCode} already converted`);
    return json({ message: "Referral already converted" }, { status: 200 });
  }

  // Check minimum order value if set
  if (referral.program.minimumOrderValue && orderTotal < referral.program.minimumOrderValue) {
    console.log(`Order value ${orderTotal} below minimum ${referral.program.minimumOrderValue}`);
    return json({ message: "Order below minimum value" }, { status: 200 });
  }

  // Calculate commission
  let commissionAmount = 0;
  if (referral.program.commissionType === "percentage") {
    commissionAmount = (orderTotal * referral.program.commissionValue) / 100;
  } else {
    commissionAmount = referral.program.commissionValue;
  }

  // Apply maximum commission if set
  if (referral.program.maximumCommission && commissionAmount > referral.program.maximumCommission) {
    commissionAmount = referral.program.maximumCommission;
  }

  // Update referral with conversion data
  const updatedReferral = await db.referral.update({
    where: { id: referral.id },
    data: {
      status: "converted",
      orderId,
      orderValue: orderTotal,
      commissionAmount,
      convertedAt: new Date(),
      refereeCustomerId: customerId,
      refereeEmail: customerEmail,
      refereeName: customerName
    }
  });

  console.log(`🎉 Referral conversion recorded: ${referralCode} -> $${commissionAmount} commission`);

  // Here you could also:
  // 1. Send notification emails
  // 2. Create discount codes for the referrer
  // 3. Update customer metafields
  // 4. Trigger other automated actions

  return json({ 
    message: "Referral conversion processed successfully",
    referralId: updatedReferral.id,
    commission: commissionAmount,
    orderId: orderId,
    referralCode: referralCode
  }, { status: 200 });
} 