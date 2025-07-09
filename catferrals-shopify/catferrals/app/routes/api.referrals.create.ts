import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { nanoid } from "nanoid";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const formData = await request.formData();
    const programId = formData.get("programId") as string;
    const referrerCustomerId = formData.get("referrerCustomerId") as string;
    const referrerEmail = formData.get("referrerEmail") as string;
    const referrerName = formData.get("referrerName") as string;

    // Validate required fields
    if (!programId || !referrerCustomerId || !referrerEmail) {
      return json({ 
        error: "Missing required fields: programId, referrerCustomerId, referrerEmail" 
      }, { status: 400 });
    }

    // Check if program exists and is active
    const program = await db.referralProgram.findFirst({
      where: { 
        id: programId, 
        shop: session.shop,
        isActive: true 
      }
    });

    if (!program) {
      return json({ 
        error: "Program not found or inactive" 
      }, { status: 404 });
    }

    // Check if customer already has a referral for this program
    const existingReferral = await db.referral.findFirst({
      where: {
        programId,
        referrerCustomerId,
        shop: session.shop
      }
    });

    if (existingReferral) {
      return json({ 
        referral: existingReferral,
        message: "Referral already exists for this customer and program"
      });
    }

    // Generate unique referral code
    let referralCode: string;
    let attempts = 0;
    do {
      referralCode = nanoid(8).toUpperCase();
      attempts++;
      
      const existing = await db.referral.findUnique({
        where: { referralCode }
      });
      
      if (!existing) break;
      
      if (attempts > 10) {
        return json({ 
          error: "Unable to generate unique referral code" 
        }, { status: 500 });
      }
    } while (true);

    // Create referral link - this would be your store's URL with the referral code
    const referralLink = `https://${session.shop}?ref=${referralCode}`;

    // Create the referral record
    const referral = await db.referral.create({
      data: {
        shop: session.shop,
        programId,
        referrerCustomerId,
        referrerEmail,
        referrerName: referrerName || null,
        referralCode,
        referralLink,
        status: "pending"
      }
    });

    return json({ 
      success: true,
      referral: {
        id: referral.id,
        referralCode: referral.referralCode,
        referralLink: referral.referralLink,
        programName: program.name,
        commissionType: program.commissionType,
        commissionValue: program.commissionValue
      }
    });

  } catch (error) {
    console.error("Error creating referral:", error);
    return json({ 
      error: "Internal server error" 
    }, { status: 500 });
  }
};

// Handle GET requests for retrieving referrals
export const loader = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  
  const url = new URL(request.url);
  const customerId = url.searchParams.get("customerId");
  const programId = url.searchParams.get("programId");

  try {
    const where: any = { shop: session.shop };
    
    if (customerId) {
      where.referrerCustomerId = customerId;
    }
    
    if (programId) {
      where.programId = programId;
    }

    const referrals = await db.referral.findMany({
      where,
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
    });

    return json({ referrals });

  } catch (error) {
    console.error("Error fetching referrals:", error);
    return json({ 
      error: "Internal server error" 
    }, { status: 500 });
  }
}; 