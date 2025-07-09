import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { sendCommissionNotificationEmail } from "../lib/email.server";

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

    // If we found a referral code, process the conversion
    if (referralCode) {
      console.log(`Processing referral conversion for code: ${referralCode}`);
      
      const referral = await db.referral.findFirst({
        where: { 
          referralCode: referralCode.toUpperCase(),
          shop 
        },
        include: {
          program: true,
          referrerAccount: true
        }
      });

      if (referral && referral.program) {
        // Calculate commission
        let commissionAmount = 0;
        if (referral.program.commissionType === 'percentage') {
          commissionAmount = (orderTotal * referral.program.commissionValue) / 100;
        } else {
          commissionAmount = referral.program.commissionValue;
        }

        // Apply maximum commission limit if set
        if (referral.program.maximumCommission && commissionAmount > referral.program.maximumCommission) {
          commissionAmount = referral.program.maximumCommission;
        }

        // Check minimum order value if set
        if (referral.program.minimumOrderValue && orderTotal < referral.program.minimumOrderValue) {
          console.log(`Order ${orderId} below minimum value (${referral.program.minimumOrderValue}), skipping commission`);
          return json({ message: "Order below minimum value" }, { status: 200 });
        }

        // Update referral status and add conversion data
        await db.referral.update({
          where: { id: referral.id },
          data: {
            status: "converted",
            conversionDate: new Date(),
            conversionOrderId: orderId,
            conversionValue: orderTotal,
            commissionAmount,
            refereeEmail: customerEmail,
            refereeName: customerName || null
          }
        });

        // Update referrer account statistics
        if (referral.referrerAccount) {
          await db.referrerAccount.update({
            where: { id: referral.referrerAccount.id },
            data: {
              totalConversions: { increment: 1 },
              totalCommissionEarned: { increment: commissionAmount }
            }
          });

          // Send commission notification email
          try {
            const emailResult = await sendCommissionNotificationEmail({
              recipientEmail: referral.referrerAccount.email,
              recipientName: `${referral.referrerAccount.firstName || ''} ${referral.referrerAccount.lastName || ''}`.trim() || 'there',
              commissionAmount,
              orderValue: orderTotal,
              customerName: customerName || 'A customer',
              programName: referral.program.name,
              shopName: shop
            });

            if (emailResult.success) {
              console.log(`Commission notification email sent to ${referral.referrerAccount.email}`);
            } else {
              console.error(`Failed to send commission email: ${emailResult.error}`);
            }
          } catch (error) {
            console.error('Error sending commission notification email:', error);
          }
        }

        console.log(`Referral conversion processed: ${referralCode} -> $${commissionAmount} commission`);
      } else {
        console.log(`Referral found but no program configured: ${referralCode}`);
      }
    } else {
      console.log(`No referral code found for order ${orderId}`);
    }

    return json({ message: "Webhook processed successfully" }, { status: 200 });

  } catch (error) {
    console.error("Webhook processing error:", error);
    return json({ message: "Webhook processing failed" }, { status: 500 });
  }
}; 