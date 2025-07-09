import React, { useState } from "react";
import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, Link } from "@remix-run/react";
import db from "../db.server";

interface ReferralData {
  id: string;
  referralCode: string;
  referralLink: string;
  totalClicks: number;
  totalConversions: number;
  totalEarnings: number;
  program: {
    name: string;
    commissionType: string;
    commissionValue: number;
  };
  recentReferrals: Array<{
    id: string;
    customerName: string;
    orderValue: number;
    commissionAmount: number;
    date: string;
  }>;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const shop = url.searchParams.get("shop");
  const email = url.searchParams.get("email");
  const code = url.searchParams.get("code");

  if (!shop) {
    throw new Response("Shop parameter required", { status: 400 });
  }

  // Find referrer account by email or referral code
  let referrerAccount;
  if (email) {
    referrerAccount = await db.referrerAccount.findFirst({
      where: { email: email.toLowerCase(), shop }
    });
  } else if (code) {
    const referral = await db.referral.findFirst({
      where: { referralCode: code.toUpperCase(), shop },
      include: { referrerAccount: true }
    });
    referrerAccount = referral?.referrerAccount;
  }

  if (!referrerAccount) {
    return json({ error: "Referrer account not found", shop });
  }

  // Get referral data with performance metrics
  const referrals = await db.referral.findMany({
    where: { 
      referrerAccountId: referrerAccount.id,
      shop 
    },
    include: {
      program: true,
      clicks: {
        orderBy: { createdAt: 'desc' },
        take: 10
      }
    }
  });

  const referralData = referrals.map(referral => {
    const conversions = referral.status === 'converted' ? 1 : 0;
    const earnings = referral.commissionAmount || 0;
    const recentReferrals = referral.status === 'converted' ? [{
      id: referral.id,
      customerName: referral.refereeName || 'Customer',
      orderValue: referral.conversionValue || 0,
      commissionAmount: referral.commissionAmount || 0,
      date: referral.conversionDate?.toISOString() || referral.createdAt.toISOString()
    }] : [];

    return {
      id: referral.id,
      referralCode: referral.referralCode,
      referralLink: referral.referralLink,
      totalClicks: referral.clickCount || 0,
      totalConversions: conversions,
      totalEarnings: earnings,
      program: {
        name: referral.program?.name || 'Referral Program',
        commissionType: referral.program?.commissionType || 'percentage',
        commissionValue: referral.program?.commissionValue || 0
      },
      recentReferrals
    };
  });

  const totalStats = referralData.reduce((acc, ref) => ({
    totalClicks: acc.totalClicks + ref.totalClicks,
    totalConversions: acc.totalConversions + ref.totalConversions,
    totalEarnings: acc.totalEarnings + ref.totalEarnings
  }), { totalClicks: 0, totalConversions: 0, totalEarnings: 0 });

  return json({
    referrer: {
      name: `${referrerAccount.firstName || ''} ${referrerAccount.lastName || ''}`.trim() || 'Referrer',
      email: referrerAccount.email,
      totalEarnings: referrerAccount.totalCommissionEarned,
      totalConversions: referrerAccount.totalConversions
    },
    referralData,
    totalStats,
    shop
  });
};

export default function CustomerPortal() {
  const { referrer, referralData, totalStats, shop, error } = useLoaderData<typeof loader>();
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  if (error) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px'
      }}>
        <div style={{
          background: 'white',
          borderRadius: '12px',
          padding: '40px',
          maxWidth: '500px',
          textAlign: 'center',
          boxShadow: '0 20px 40px rgba(0,0,0,0.1)'
        }}>
          <h1>Referrer Account Not Found</h1>
          <p>We couldn't find your referral account. Please check your link or contact support.</p>
          <Link 
            to={`/register?shop=${shop}`}
            style={{
              display: 'inline-block',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              padding: '12px 24px',
              borderRadius: '8px',
              textDecoration: 'none',
              marginTop: '20px'
            }}
          >
            Join Referral Program
          </Link>
        </div>
      </div>
    );
  }

  const copyToClipboard = (text: string, code: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const formatCurrency = (amount: number) => `$${amount.toFixed(2)}`;
  const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString();

  return (
    <div style={{ 
      minHeight: '100vh', 
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      {/* Header */}
      <div style={{ padding: '40px 20px', textAlign: 'center', color: 'white' }}>
        <h1 style={{ fontSize: '2.5rem', margin: '0 0 10px 0', fontWeight: '300' }}>
          🎉 Welcome back, {referrer.name}!
        </h1>
        <p style={{ fontSize: '1.2rem', opacity: 0.9, margin: 0 }}>
          Your referral dashboard and earnings tracker
        </p>
      </div>

      <div style={{ padding: '0 20px 40px', maxWidth: '1200px', margin: '0 auto' }}>
        {/* Stats Overview */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', 
          gap: '20px',
          marginBottom: '40px'
        }}>
          <div style={{
            background: 'rgba(255,255,255,0.95)',
            borderRadius: '12px',
            padding: '30px',
            textAlign: 'center',
            boxShadow: '0 10px 30px rgba(0,0,0,0.1)'
          }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '10px' }}>💰</div>
            <h3 style={{ margin: '0 0 5px 0', color: '#333' }}>Total Earnings</h3>
            <p style={{ fontSize: '2rem', fontWeight: 'bold', color: '#28a745', margin: 0 }}>
              {formatCurrency(totalStats.totalEarnings)}
            </p>
          </div>

          <div style={{
            background: 'rgba(255,255,255,0.95)',
            borderRadius: '12px',
            padding: '30px',
            textAlign: 'center',
            boxShadow: '0 10px 30px rgba(0,0,0,0.1)'
          }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '10px' }}>👥</div>
            <h3 style={{ margin: '0 0 5px 0', color: '#333' }}>Total Referrals</h3>
            <p style={{ fontSize: '2rem', fontWeight: 'bold', color: '#007bff', margin: 0 }}>
              {totalStats.totalConversions}
            </p>
          </div>

          <div style={{
            background: 'rgba(255,255,255,0.95)',
            borderRadius: '12px',
            padding: '30px',
            textAlign: 'center',
            boxShadow: '0 10px 30px rgba(0,0,0,0.1)'
          }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '10px' }}>👆</div>
            <h3 style={{ margin: '0 0 5px 0', color: '#333' }}>Total Clicks</h3>
            <p style={{ fontSize: '2rem', fontWeight: 'bold', color: '#ff6b6b', margin: 0 }}>
              {totalStats.totalClicks}
            </p>
          </div>
        </div>

        {/* Referral Links Section */}
        <div style={{
          background: 'rgba(255,255,255,0.95)',
          borderRadius: '12px',
          padding: '30px',
          marginBottom: '40px',
          boxShadow: '0 10px 30px rgba(0,0,0,0.1)'
        }}>
          <h2 style={{ color: '#333', marginBottom: '20px' }}>🔗 Your Referral Links</h2>
          
          {referralData.map((referral) => (
            <div key={referral.id} style={{
              border: '1px solid #e1e5e9',
              borderRadius: '8px',
              padding: '20px',
              marginBottom: '20px',
              background: '#f8f9fa'
            }}>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                marginBottom: '15px'
              }}>
                <h3 style={{ margin: 0, color: '#333' }}>{referral.program.name}</h3>
                <span style={{
                  background: 'linear-gradient(135deg, #28a745 0%, #20c997 100%)',
                  color: 'white',
                  padding: '5px 12px',
                  borderRadius: '20px',
                  fontSize: '0.9rem'
                }}>
                  Earn {referral.program.commissionType === 'percentage' 
                    ? `${referral.program.commissionValue}%` 
                    : `$${referral.program.commissionValue}`}
                </span>
              </div>

              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px', color: '#555' }}>
                  Referral Code:
                </label>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <code style={{
                    background: '#fff',
                    padding: '10px 15px',
                    borderRadius: '6px',
                    border: '1px solid #ddd',
                    fontSize: '1.1rem',
                    fontWeight: 'bold',
                    flex: 1
                  }}>
                    {referral.referralCode}
                  </code>
                  <button
                    onClick={() => copyToClipboard(referral.referralCode, referral.referralCode)}
                    style={{
                      background: copiedCode === referral.referralCode ? '#28a745' : '#007bff',
                      color: 'white',
                      border: 'none',
                      padding: '10px 20px',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    {copiedCode === referral.referralCode ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>

              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px', color: '#555' }}>
                  Referral Link:
                </label>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <input
                    type="text"
                    value={referral.referralLink}
                    readOnly
                    style={{
                      padding: '10px 15px',
                      borderRadius: '6px',
                      border: '1px solid #ddd',
                      fontSize: '0.9rem',
                      flex: 1,
                      background: '#fff'
                    }}
                  />
                  <button
                    onClick={() => copyToClipboard(referral.referralLink, referral.id)}
                    style={{
                      background: copiedCode === referral.id ? '#28a745' : '#007bff',
                      color: 'white',
                      border: 'none',
                      padding: '10px 20px',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    {copiedCode === referral.id ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>

              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', 
                gap: '15px',
                marginTop: '15px'
              }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#ff6b6b' }}>
                    {referral.totalClicks}
                  </div>
                  <div style={{ fontSize: '0.9rem', color: '#666' }}>Clicks</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#007bff' }}>
                    {referral.totalConversions}
                  </div>
                  <div style={{ fontSize: '0.9rem', color: '#666' }}>Conversions</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#28a745' }}>
                    {formatCurrency(referral.totalEarnings)}
                  </div>
                  <div style={{ fontSize: '0.9rem', color: '#666' }}>Earned</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Social Sharing Section */}
        <div style={{
          background: 'rgba(255,255,255,0.95)',
          borderRadius: '12px',
          padding: '30px',
          marginBottom: '40px',
          boxShadow: '0 10px 30px rgba(0,0,0,0.1)'
        }}>
          <h2 style={{ color: '#333', marginBottom: '20px' }}>📱 Share & Earn More</h2>
          <p style={{ color: '#666', marginBottom: '20px' }}>
            Share your referral links on social media to maximize your earnings!
          </p>
          
          {referralData.length > 0 && (
            <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
              <a
                href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(referralData[0].referralLink)}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  background: '#1877f2',
                  color: 'white',
                  padding: '12px 20px',
                  borderRadius: '8px',
                  textDecoration: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                📘 Share on Facebook
              </a>
              
              <a
                href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(referralData[0].referralLink)}&text=Check out this amazing store!`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  background: '#1da1f2',
                  color: 'white',
                  padding: '12px 20px',
                  borderRadius: '8px',
                  textDecoration: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                🐦 Share on Twitter
              </a>
              
              <a
                href={`https://wa.me/?text=Check out this amazing store! ${encodeURIComponent(referralData[0].referralLink)}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  background: '#25d366',
                  color: 'white',
                  padding: '12px 20px',
                  borderRadius: '8px',
                  textDecoration: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                💬 Share on WhatsApp
              </a>
            </div>
          )}
        </div>

        {/* Recent Referrals */}
        {referralData.some(r => r.recentReferrals.length > 0) && (
          <div style={{
            background: 'rgba(255,255,255,0.95)',
            borderRadius: '12px',
            padding: '30px',
            boxShadow: '0 10px 30px rgba(0,0,0,0.1)'
          }}>
            <h2 style={{ color: '#333', marginBottom: '20px' }}>🎉 Recent Referrals</h2>
            
            {referralData.map(referral => 
              referral.recentReferrals.map(recent => (
                <div key={recent.id} style={{
                  border: '1px solid #e1e5e9',
                  borderRadius: '8px',
                  padding: '15px',
                  marginBottom: '10px',
                  background: '#f8f9fa',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div>
                    <strong>{recent.customerName}</strong> made a purchase
                    <div style={{ fontSize: '0.9rem', color: '#666' }}>
                      Order value: {formatCurrency(recent.orderValue)} • {formatDate(recent.date)}
                    </div>
                  </div>
                  <div style={{
                    background: 'linear-gradient(135deg, #28a745 0%, #20c997 100%)',
                    color: 'white',
                    padding: '8px 16px',
                    borderRadius: '20px',
                    fontWeight: 'bold'
                  }}>
                    +{formatCurrency(recent.commissionAmount)}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
} 