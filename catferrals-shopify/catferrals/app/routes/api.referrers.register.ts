import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import db from "../db.server";
import { nanoid } from "nanoid";

export const action = async ({ request }: ActionFunctionArgs) => {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const formData = await request.formData();
    const shop = formData.get("shop") as string;
    const email = formData.get("email") as string;
    const firstName = formData.get("firstName") as string;
    const lastName = formData.get("lastName") as string;
    const phone = formData.get("phone") as string;
    const shopifyCustomerId = formData.get("shopifyCustomerId") as string;

    // Validate required fields
    if (!shop || !email) {
      return json({ 
        error: "Shop and email are required" 
      }, { status: 400 });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return json({ 
        error: "Invalid email format" 
      }, { status: 400 });
    }

    // Check if referrer already exists
    const existingReferrer = await db.referrerAccount.findFirst({
      where: { 
        shop, 
        email: email.toLowerCase()
      }
    });

    if (existingReferrer) {
      return json({ 
        error: "An account with this email already exists" 
      }, { status: 409 });
    }

    // Check if there's an active referral program
    const activeProgram = await db.referralProgram.findFirst({
      where: { 
        shop, 
        isActive: true,
        allowSelfRegistration: true
      }
    });

    if (!activeProgram) {
      return json({ 
        error: "No active referral program allows registration at this time" 
      }, { status: 404 });
    }

    // Create email verification token
    const emailVerificationToken = nanoid(32);

    // Create referrer account
    const referrerAccount = await db.referrerAccount.create({
      data: {
        shop,
        email: email.toLowerCase(),
        firstName: firstName || null,
        lastName: lastName || null,
        phone: phone || null,
        shopifyCustomerId: shopifyCustomerId || null,
        emailVerificationToken,
        isEmailVerified: false // Will be verified via email or admin approval
      }
    });

    // Create initial referral for the default program
    const referralCode = nanoid(8).toUpperCase();
    const referralLink = `https://${shop}?ref=${referralCode}`;

    const referral = await db.referral.create({
      data: {
        shop,
        programId: activeProgram.id,
        referrerAccountId: referrerAccount.id,
        // Legacy fields for backward compatibility
        referrerCustomerId: shopifyCustomerId || `account_${referrerAccount.id}`,
        referrerEmail: email.toLowerCase(),
        referrerName: `${firstName || ''} ${lastName || ''}`.trim() || null,
        referralCode,
        referralLink,
        status: "pending"
      }
    });

    return json({ 
      success: true,
      message: "Registration successful! You can now start referring customers.",
      referrer: {
        id: referrerAccount.id,
        email: referrerAccount.email,
        firstName: referrerAccount.firstName,
        lastName: referrerAccount.lastName,
        isEmailVerified: referrerAccount.isEmailVerified
      },
      referral: {
        id: referral.id,
        referralCode: referral.referralCode,
        referralLink: referral.referralLink,
        programName: activeProgram.name
      }
    });

  } catch (error) {
    console.error("Error registering referrer:", error);
    return json({ 
      error: "Registration failed. Please try again." 
    }, { status: 500 });
  }
};

// Handle GET requests for referrer info
export const loader = async ({ request }: ActionFunctionArgs) => {
  const url = new URL(request.url);
  const shop = url.searchParams.get("shop");
  const email = url.searchParams.get("email");

  if (!shop || !email) {
    return json({ error: "Shop and email parameters required" }, { status: 400 });
  }

  try {
    const referrerAccount = await db.referrerAccount.findFirst({
      where: { 
        shop, 
        email: email.toLowerCase() 
      },
      include: {
        referrals: {
          include: {
            program: {
              select: {
                name: true,
                commissionType: true,
                commissionValue: true
              }
            }
          },
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!referrerAccount) {
      return json({ error: "Referrer account not found" }, { status: 404 });
    }

    return json({ referrer: referrerAccount });

  } catch (error) {
    console.error("Error fetching referrer:", error);
    return json({ 
      error: "Failed to fetch referrer information" 
    }, { status: 500 });
  }
}; 