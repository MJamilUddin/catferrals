import type { LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { Page, Card, Text, Button, Banner } from "@shopify/polaris";
import db from "../db.server";
import { sendWelcomeEmail } from "../lib/email.server";

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  const { code } = params;
  const url = new URL(request.url);
  const verifyToken = url.searchParams.get('verify');
  const shop = url.hostname.includes('.myshopify.com') 
    ? url.hostname 
    : url.searchParams.get('shop');

  if (!code || !shop) {
    throw new Response('Invalid referral link', { status: 400 });
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

  if (!referral) {
    throw new Response('Referral not found', { status: 404 });
  }

  // If this is an email verification link
  if (verifyToken && referral.referrerAccount?.emailVerificationToken === verifyToken) {
    // Verify the email
    await db.referrerAccount.update({
      where: { id: referral.referrerAccount.id },
      data: { 
        isEmailVerified: true,
        emailVerificationToken: null
      }
    });

    // Send welcome email
    try {
      const commissionRate = referral.program?.commissionType === 'percentage' 
        ? `${referral.program.commissionValue}%` 
        : `$${referral.program?.commissionValue}`;

      await sendWelcomeEmail({
        recipientEmail: referral.referrerAccount.email,
        recipientName: `${referral.referrerAccount.firstName || ''} ${referral.referrerAccount.lastName || ''}`.trim() || 'there',
        referralLink: `https://${shop}/refer/${code}`,
        referralCode: code.toUpperCase(),
        programName: referral.program?.name || 'Referral Program',
        commissionRate,
        shopName: shop.replace('.myshopify.com', '').replace('-', ' ').toUpperCase(),
        shopDomain: shop
      });
    } catch (error) {
      console.error('Failed to send welcome email:', error);
    }

    // Redirect to dashboard instead of showing confirmation page
    const dashboardUrl = `https://${shop}/apps/catferrals/portal?shop=${encodeURIComponent(shop)}&email=${encodeURIComponent(referral.referrerAccount.email)}`;
    return redirect(dashboardUrl);
  }

  // Track the referral click
  await db.referralClick.create({
    data: {
      referralId: referral.id,
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
      referrer: request.headers.get('referer') || null
    }
  });

  // Update last clicked timestamp
  await db.referral.update({
    where: { id: referral.id },
    data: { lastClickedAt: new Date() }
  });

  // Redirect to the shop with tracking
  return redirect(`https://${shop}?ref=${code}`);
};

export default function ReferralPage() {
  const data = useLoaderData<typeof loader>();

  if (!data.verified) {
    return null; // Should redirect
  }

  return (
    <Page>
      <Card>
        <div style={{ textAlign: 'center', padding: '40px 20px' }}>
          <div style={{ fontSize: '48px', marginBottom: '20px' }}>🎉</div>
          <Text variant="headingLg" as="h1">
            Welcome to the {data.shop} Referral Program!
          </Text>
          
          <div style={{ marginTop: '30px' }}>
            <Banner status="success">
              <p>
                <strong>Congratulations {data.referrer.name}!</strong> Your account has been verified 
                and you're now part of the {data.program.name}.
              </p>
            </Banner>
          </div>

          <div style={{ marginTop: '30px', padding: '20px', backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
            <Text variant="headingMd" as="h2">
              You're earning {data.program.commissionRate} on every referral!
            </Text>
            <div style={{ marginTop: '20px' }}>
              <Text>
                A welcome email with your referral dashboard link has been sent to {data.referrer.email}.
              </Text>
            </div>
          </div>

          <div style={{ marginTop: '30px' }}>
            <Button 
              variant="primary" 
              size="large"
              url={`https://${data.shopDomain}`}
            >
              Start Shopping at {data.shop}
            </Button>
          </div>

          <div style={{ marginTop: '20px' }}>
            <Text variant="bodyMd" color="subdued">
              Check your email for your referral dashboard access and start earning today!
            </Text>
          </div>
        </div>
      </Card>
    </Page>
  );
} 