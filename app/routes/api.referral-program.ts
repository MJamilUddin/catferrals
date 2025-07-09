import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import db from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const shop = url.searchParams.get("shop");

  if (!shop) {
    return json({ error: "Shop parameter required" }, { status: 400 });
  }

  try {
    // Get active referral program for the shop
    const program = await db.referralProgram.findFirst({
      where: { 
        shop: shop,
        isActive: true 
      },
      select: {
        id: true,
        name: true,
        description: true,
        commissionType: true,
        commissionValue: true,
        minimumOrderValue: true,
        isActive: true,
        allowSelfRegistration: true
      }
    });

    if (!program) {
      return json({ error: "No active referral program found" }, { status: 404 });
    }

    return json({
      id: program.id,
      name: program.name,
      description: program.description,
      commissionType: program.commissionType,
      commissionValue: program.commissionValue,
      minimumOrderValue: program.minimumOrderValue,
      isActive: program.isActive,
      allowSelfRegistration: program.allowSelfRegistration
    });

  } catch (error) {
    console.error("Error fetching referral program:", error);
    return json({ error: "Failed to fetch referral program" }, { status: 500 });
  }
}; 