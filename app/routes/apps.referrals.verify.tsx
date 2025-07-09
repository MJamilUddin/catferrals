import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import db from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { 
      status: 405,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      }
    });
  }

  try {
    const body = await request.json();
    const { code, verify, shop } = body;

    if (!code || !verify || !shop) {
      return json({ 
        success: false, 
        error: "Missing required parameters" 
      }, { 
        status: 400,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        }
      });
    }

    // Find the referral
    const referral = await db.referral.findFirst({
      where: { 
        referralCode: code.toUpperCase(),
        shop: shop
      },
      include: {
        program: true,
        referrerAccount: true
      }
    });

    if (!referral || !referral.referrerAccount) {
      return json({ 
        success: false, 
        error: "Referral not found" 
      }, { 
        status: 404,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        }
      });
    }

    // Check if verification token matches
    if (referral.referrerAccount.emailVerificationToken !== verify) {
      return json({ 
        success: false, 
        error: "Invalid verification token" 
      }, { 
        status: 400,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        }
      });
    }

    // Check if already verified
    if (referral.referrerAccount.isEmailVerified) {
      return json({ 
        success: true, 
        message: "Email already verified",
        referrer: {
          email: referral.referrerAccount.email,
          name: `${referral.referrerAccount.firstName || ''} ${referral.referrerAccount.lastName || ''}`.trim() || 'Referrer'
        }
      }, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        }
      });
    }

    // Verify the email
    await db.referrerAccount.update({
      where: { id: referral.referrerAccount.id },
      data: { 
        isEmailVerified: true,
        emailVerificationToken: null
      }
    });

    return json({ 
      success: true, 
      message: "Email verified successfully",
      referrer: {
        email: referral.referrerAccount.email,
        name: `${referral.referrerAccount.firstName || ''} ${referral.referrerAccount.lastName || ''}`.trim() || 'Referrer'
      }
    }, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      }
    });

  } catch (error) {
    console.error("Verification error:", error);
    return json({ 
      success: false, 
      error: "Verification failed" 
    }, { 
      status: 500,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
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
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}; 