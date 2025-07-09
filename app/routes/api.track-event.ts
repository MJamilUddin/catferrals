import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import db from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const eventData = await request.json();
    
    const {
      event,
      shop,
      productId,
      referralCode,
      timestamp,
      platform,
      method
    } = eventData;

    // Validate required fields
    if (!event || !shop) {
      return json({ error: "Event and shop are required" }, { status: 400 });
    }

    // Store analytics event in database
    const analyticsRecord = await db.referralAnalytics.create({
      data: {
        shop,
        eventType: event,
        productId: productId || null,
        referralCode: referralCode || null,
        platform: platform || null,
        method: method || null,
        metadata: JSON.stringify(eventData),
        createdAt: timestamp ? new Date(timestamp) : new Date()
      }
    });

    // If it's a referral link click or copy, update referral metrics
    if ((event === 'referral_link_copied' || event === 'referral_shared') && referralCode) {
      try {
        // Find the referral and update engagement metrics
        const referral = await db.referral.findFirst({
          where: { 
            referralCode: referralCode.toUpperCase(),
            shop 
          }
        });

        if (referral) {
          // Update referral engagement stats
          await db.referral.update({
            where: { id: referral.id },
            data: {
              lastSharedAt: new Date(),
              shareCount: { increment: 1 }
            }
          });
        }
      } catch (error) {
        console.log("Failed to update referral metrics:", error);
        // Continue even if referral update fails
      }
    }

    return json({ 
      success: true, 
      eventId: analyticsRecord.id,
      message: "Event tracked successfully" 
    });

  } catch (error) {
    console.error("Error tracking event:", error);
    return json({ 
      error: "Failed to track event" 
    }, { status: 500 });
  }
}; 