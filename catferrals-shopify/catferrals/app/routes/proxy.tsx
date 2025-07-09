import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { sendWelcomeEmail } from "../../../../app/lib/email.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const path = url.pathname.replace('/proxy', '');
  
  // Handle dashboard requests
  if (path === '/dashboard') {
    const email = url.searchParams.get('email');
    if (!email) {
      return json({ success: false, error: 'Email parameter required' });
    }
    
    try {
      // Find referrer account
      const referrerAccount = await db.referrerAccount.findFirst({
        where: { email },
        include: {
          referrals: {
            include: {
              program: {
                select: { name: true, commissionType: true, commissionValue: true }
              }
            }
          }
        }
      });
      
      if (!referrerAccount) {
        return json({ success: false, error: 'Referrer account not found' });
      }
      
      // Calculate dashboard data
      const totalReferrals = referrerAccount.referrals.length;
      const totalClicks = referrerAccount.referrals.reduce((sum, r) => sum + r.clickCount, 0);
      const conversions = referrerAccount.referrals.filter(r => r.status === 'converted').length;
      const totalCommissions = referrerAccount.referrals.reduce((sum, r) => sum + (r.commissionAmount || 0), 0);
      
      // Get primary referral link
      const primaryReferral = referrerAccount.referrals[0];
      const referralLink = primaryReferral?.referralLink || null;
      
      return json({
        success: true,
        data: {
          name: `${referrerAccount.firstName || ''} ${referrerAccount.lastName || ''}`.trim(),
          email: referrerAccount.email,
          totalReferrals,
          totalClicks,
          conversions,
          totalCommissions,
          referralLink
        }
      });
    } catch (error) {
      console.error('Dashboard error:', error);
      return json({ success: false, error: 'Failed to load dashboard data' });
    }
  }
  
  return json({ success: false, error: 'Invalid path' });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const formData = await request.formData();
  const body = Object.fromEntries(formData);
  
  // Handle verification requests
  if (body.code && body.verify) {
    const { code, verify: token, shop } = body;
    
    try {
      // Find referrer account by verification token
      const referrerAccount = await db.referrerAccount.findFirst({
        where: { 
          emailVerificationToken: token as string,
          shop: shop as string
        }
      });
      
      if (!referrerAccount) {
        return json({ success: false, error: 'Invalid verification token' });
      }
      
      // Find referral by code
      const referral = await db.referral.findFirst({
        where: { 
          referralCode: code as string,
          referrerAccountId: referrerAccount.id
        },
        include: {
          program: {
            select: { name: true, commissionType: true, commissionValue: true }
          }
        }
      });
      
      if (!referral) {
        return json({ success: false, error: 'Invalid referral code' });
      }
      
      // Mark email as verified
      await db.referrerAccount.update({
        where: { id: referrerAccount.id },
        data: { 
          isEmailVerified: true,
          emailVerificationToken: null // Clear token after use
        }
      });
      
      // Send welcome email
      const commissionRate = referral.program.commissionType === 'percentage'
        ? `${referral.program.commissionValue}%`
        : `$${referral.program.commissionValue}`;
      
      await sendWelcomeEmail({
        recipientEmail: referrerAccount.email,
        recipientName: `${referrerAccount.firstName || ''} ${referrerAccount.lastName || ''}`.trim(),
        referralLink: referral.referralLink,
        referralCode: referral.referralCode,
        programName: referral.program.name || 'Referral Program',
        commissionRate,
        shopName: shop as string,
        shopDomain: shop as string
      });
      
      return json({ 
        success: true, 
        email: referrerAccount.email,
        commissionRate 
      });
    } catch (error) {
      console.error('Verification error:', error);
      return json({ success: false, error: 'Verification failed' });
    }
  }
  
  return json({ success: false, error: 'Invalid request' });
}; 