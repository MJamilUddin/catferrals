import type { LoaderFunctionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import db from "../db.server";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const referralCode = params.code;
  
  if (!referralCode) {
    // Redirect to home if no code provided
    return redirect("/");
  }

  try {
    // Find the referral by code
    const referral = await db.referral.findUnique({
      where: { referralCode: referralCode.toUpperCase() },
      include: {
        program: {
          select: {
            shop: true,
            isActive: true
          }
        }
      }
    });

    if (!referral || !referral.program.isActive) {
      // Redirect to home if referral not found or program inactive
      return redirect(`https://${referral?.program.shop || "example.myshopify.com"}`);
    }

    // Get visitor info from request
    const url = new URL(request.url);
    const userAgent = request.headers.get("user-agent") || "";
    const referrer = request.headers.get("referer") || "";
    const forwardedFor = request.headers.get("x-forwarded-for");
    const ipAddress = forwardedFor?.split(',')[0] || 
                     request.headers.get("x-real-ip") || 
                     "unknown";

    // Record the click
    await db.referralClick.create({
      data: {
        referralId: referral.id,
        ipAddress,
        userAgent,
        referrer
      }
    });

    // Update click count on referral
    await db.referral.update({
      where: { id: referral.id },
      data: { 
        clickCount: { increment: 1 },
        lastClickedAt: new Date()
      }
    });

    // Create the redirect URL with tracking parameters
    const shopUrl = `https://${referral.program.shop}`;
    const redirectUrl = new URL(shopUrl);
    
    // Add tracking parameters
    redirectUrl.searchParams.set("ref", referralCode);
    redirectUrl.searchParams.set("utm_source", "referral");
    redirectUrl.searchParams.set("utm_medium", "link");
    redirectUrl.searchParams.set("utm_campaign", "referral_program");
    redirectUrl.searchParams.set("utm_content", referral.id);
    
    // Add any additional query parameters from the original request
    url.searchParams.forEach((value, key) => {
      if (key !== "ref") {
        redirectUrl.searchParams.set(key, value);
      }
    });

    // Set a cookie to persist the referral attribution
    const headers = new Headers();
    headers.append("Set-Cookie", `catferrals_ref=${referralCode}; Path=/; Max-Age=2592000; SameSite=Lax`); // 30 days
    headers.append("Location", redirectUrl.toString());

    // Redirect to the store with tracking
    return new Response(null, { 
      status: 302, 
      headers 
    });

  } catch (error) {
    console.error("Error tracking referral click:", error);
    // Even if tracking fails, redirect to a default store
    return redirect("https://example.myshopify.com");
  }
}; 