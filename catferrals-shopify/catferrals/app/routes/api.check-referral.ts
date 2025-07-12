import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import db from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  
  if (!code) {
    return json({
      success: false,
      error: "code parameter is required"
    }, { status: 400 });
  }
  
  console.log(`🔍 Checking referral details for code: ${code}`);
  
  try {
    const referral = await db.referral.findUnique({
      where: { referralCode: code.toUpperCase() },
      include: {
        program: true
      }
    });
    
    if (!referral) {
      return json({
        success: false,
        error: `Referral not found: ${code}`
      }, { status: 404 });
    }
    
    console.log("📋 Referral details:", {
      id: referral.id,
      code: referral.referralCode,
      referrerEmail: referral.referrerEmail,
      status: referral.status,
      orderValue: referral.orderValue,
      commissionAmount: referral.commissionAmount,
      convertedAt: referral.convertedAt,
      program: referral.program.name
    });
    
    return json({
      success: true,
      data: {
        referralId: referral.id,
        referralCode: referral.referralCode,
        referrerEmail: referral.referrerEmail,
        referrerName: referral.referrerName,
        status: referral.status,
        orderValue: referral.orderValue,
        commissionAmount: referral.commissionAmount,
        convertedAt: referral.convertedAt,
        program: {
          name: referral.program.name,
          commissionType: referral.program.commissionType,
          commissionValue: referral.program.commissionValue
        }
      }
    });
    
  } catch (error: any) {
    console.error("❌ Failed to check referral:", error);
    return json({
      success: false,
      error: error.message || "Failed to check referral"
    }, { status: 500 });
  }
}; 