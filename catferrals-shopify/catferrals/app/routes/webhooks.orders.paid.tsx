import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  try {
    const { topic, shop, session, admin, payload } = await authenticate.webhook(request);

    if (topic !== "orders/paid") {
      return json({ message: "Webhook topic not supported" }, { status: 200 });
    }

    console.log(`Processing order webhook for shop: ${shop}`);

    // Extract order data
    const order = payload;
    const orderId = order.id.toString();
    const orderTotal = parseFloat(order.total_price) || 0;
    const customerId = order.customer?.id?.toString();
    const customerEmail = order.customer?.email;
    const customerName = `${order.customer?.first_name || ''} ${order.customer?.last_name || ''}`.trim();

    // Look for referral tracking in order attributes or note attributes
    let referralCode: string | null = null;
    
    // Check note attributes for referral code
    if (order.note_attributes && Array.isArray(order.note_attributes)) {
      const refAttribute = order.note_attributes.find((attr: any) => 
        attr.name === "referral_code" || attr.name === "ref"
      );
      if (refAttribute) {
        referralCode = refAttribute.value;
      }
    }

    // Also check order tags or landing site
    if (!referralCode && order.landing_site) {
      const urlParams = new URLSearchParams(order.landing_site.split('?')[1] || '');
      referralCode = urlParams.get('ref');
    }

    // Check customer metafields for referral attribution (if stored during checkout)
    if (!referralCode && customerId && admin) {
      try {
        const customerQuery = `
          query getCustomer($id: ID!) {
            customer(id: $id) {
              metafields(namespace: "catferrals", first: 5) {
                edges {
                  node {
                    key
                    value
                  }
                }
              }
            }
          }
        `;
        
        const customerResponse = await admin.graphql(customerQuery, {
          variables: { id: `gid://shopify/Customer/${customerId}` }
        });
        
        const customerData = await customerResponse.json();
        const metafields = customerData.data?.customer?.metafields?.edges || [];
        
        const refMetafield = metafields.find((edge: any) => 
          edge.node.key === "referral_code" || edge.node.key === "last_referral"
        );
        
        if (refMetafield) {
          referralCode = refMetafield.node.value;
        }
      } catch (error) {
        console.log("Could not fetch customer metafields:", error);
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

    console.log(`Referral conversion recorded: ${referralCode} -> $${commissionAmount} commission`);

    // Here you could also:
    // 1. Send notification emails
    // 2. Create discount codes for the referrer
    // 3. Update customer metafields
    // 4. Trigger other automated actions

    return json({ 
      message: "Referral conversion processed successfully",
      referralId: updatedReferral.id,
      commission: commissionAmount
    }, { status: 200 });

  } catch (error) {
    console.error("Error processing order webhook:", error);
    return json({ 
      error: "Failed to process webhook" 
    }, { status: 500 });
  }
}; 