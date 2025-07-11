import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import db from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const email = url.searchParams.get("email");
  const shop = url.searchParams.get("shop");
  
  // Extract shop from hostname if not provided
  const shopDomain = shop || url.hostname;

  if (!email || !shopDomain) {
    return json({ 
      success: false, 
      error: "Email and shop parameters required" 
    }, { 
      status: 400,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      }
    });
  }

  try {
    // Find referrer account by email
    const referrerAccount = await db.referrerAccount.findFirst({
      where: { 
        email: email.toLowerCase(), 
        shop: shopDomain 
      }
    });

    if (!referrerAccount) {
      return json({ 
        success: false, 
        error: "Referrer account not found" 
      }, { 
        status: 404,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        }
      });
    }

    // Get referral data with performance metrics
    const referrals = await db.referral.findMany({
      where: { 
        referrerAccountId: referrerAccount.id,
        shop: shopDomain 
      },
      include: {
        program: true,
        clicks: {
          orderBy: { clickedAt: 'desc' },
          take: 10
        }
      }
    });

    // Calculate totals
    const totalReferrals = referrals.length;
    const totalClicks = referrals.reduce((sum, referral) => sum + (referral.clickCount || 0), 0);
    const totalCommissions = referrals.reduce((sum, referral) => sum + (referral.commissionAmount || 0), 0);
    const convertedReferrals = referrals.filter(r => r.status === 'converted');

    // Get primary referral link (first active referral)
    const primaryReferral = referrals.find(r => r.status !== 'expired') || referrals[0];
    const referralLink = primaryReferral?.referralCode ? 
      `http://localhost:55891/api/track/${primaryReferral.referralCode}` : 
      `http://localhost:55891/api/track/DEFAULT_CODE`;
    const referralCode = primaryReferral?.referralCode;

    // Recent activity (last 10 conversions)
    const recentActivity = convertedReferrals
      .sort((a, b) => new Date(b.convertedAt || b.createdAt).getTime() - new Date(a.convertedAt || a.createdAt).getTime())
      .slice(0, 10)
      .map(referral => ({
        type: "Referral Conversion",
        amount: referral.commissionAmount || 0,
        date: referral.convertedAt || referral.createdAt,
        customerName: referral.refereeName || "Customer",
        orderValue: referral.orderValue || 0
      }));

    // Fix the dashboard URL - use the correct portal route
    const dashboardUrl = `/portal?shop=${encodeURIComponent(shopDomain)}&email=${encodeURIComponent(email)}`;

    return json({
      success: true,
      data: {
        totalReferrals,
        totalClicks,
        totalCommissions,
        totalConversions: convertedReferrals.length,
        referralLink,
        code: referralCode,
        recentActivity,
        dashboardUrl,
        referrerName: `${referrerAccount.firstName || ''} ${referrerAccount.lastName || ''}`.trim() || referrerAccount.email.split('@')[0],
        email: referrerAccount.email,
        program: primaryReferral?.program ? {
          name: primaryReferral.program.name,
          commissionType: primaryReferral.program.commissionType,
          commissionValue: primaryReferral.program.commissionValue
        } : null
      }
    }, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      }
    });

  } catch (error) {
    console.error("Dashboard API error:", error);
    return json({ 
      success: false, 
      error: "Failed to load dashboard data" 
    }, { 
      status: 500,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      }
    });
  }
};

// Handle OPTIONS preflight requests
export const OPTIONS = () => {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}; 