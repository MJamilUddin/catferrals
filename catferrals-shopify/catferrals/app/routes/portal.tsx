import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { useState } from "react";
import db from "../db.server";
import { getTrackingUrl } from "../utils/url-helper";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const shop = url.searchParams.get("shop");
  const email = url.searchParams.get("email");

  if (!shop || !email) {
    return json({ error: "Missing shop or email parameter", referrer: null, shop });
  }

  try {
    const referrer = await db.referrerAccount.findFirst({
      where: { shop, email: email.toLowerCase(), isActive: true },
      include: {
        referrals: {
          include: { program: true },
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    // ✅ FIXED: Generate tracking URLs in loader using URL helper
    if (referrer) {
      const referralsWithUrls = referrer.referrals.map(referral => ({
        ...referral,
        trackingUrl: getTrackingUrl(request, referral.referralCode)
      }));
      
      return json({ 
        referrer: {
          ...referrer,
          referrals: referralsWithUrls
        }, 
        error: null, 
        shop 
      });
    }

    return json({ referrer, error: null, shop });
  } catch (error) {
    console.error("Error loading portal:", error);
    return json({ error: "Failed to load portal", referrer: null, shop });
  }
};

const styles = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { 
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: #f7fafc;
    color: #2d3748;
    line-height: 1.6;
  }
  .portal-container {
    min-height: 100vh;
    background: #f7fafc;
  }
  .header { 
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 40px 20px;
    text-align: center;
  }
  .header h1 { font-size: 32px; margin-bottom: 10px; }
  .header p { opacity: 0.9; font-size: 18px; }
  .container { 
    max-width: 1200px;
    margin: -20px auto 40px;
    padding: 0 20px;
  }
  .stats-grid { 
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 20px;
    margin-bottom: 40px;
  }
  .stat-card { 
    background: white;
    border-radius: 12px;
    padding: 30px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.05);
    text-align: center;
    border-left: 4px solid #667eea;
  }
  .stat-number { 
    font-size: 36px;
    font-weight: bold;
    color: #667eea;
    margin-bottom: 5px;
  }
  .stat-label { 
    color: #718096;
    font-size: 14px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .section { 
    background: white;
    border-radius: 12px;
    padding: 30px;
    margin-bottom: 30px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.05);
  }
  .section h2 { 
    margin-bottom: 20px;
    color: #2d3748;
    font-size: 24px;
  }
  .referral-card { 
    background: #f8f9fa;
    border-radius: 8px;
    padding: 20px;
    margin-bottom: 20px;
    border-left: 4px solid #48bb78;
  }
  .referral-header { 
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 15px;
  }
  .program-name { 
    font-weight: 600;
    font-size: 18px;
  }
  .status-badge { 
    padding: 4px 12px;
    border-radius: 20px;
    font-size: 12px;
    font-weight: 600;
  }
  .status-converted { 
    background: #c6f6d5;
    color: #276749;
  }
  .status-active { 
    background: #bee3f8;
    color: #2c5282;
  }
  .link-container { 
    background: white;
    border: 2px solid #e2e8f0;
    border-radius: 8px;
    padding: 12px;
    margin: 15px 0;
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .link-input { 
    flex: 1;
    border: none;
    background: none;
    font-family: monospace;
    font-size: 14px;
    color: #4a5568;
  }
  .btn { 
    background: #667eea;
    color: white;
    border: none;
    padding: 8px 16px;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: background-color 0.2s;
  }
  .btn:hover { background: #5a67d8; }
  .btn-secondary { 
    background: #48bb78;
  }
  .btn-secondary:hover { background: #38a169; }
  .btn.copied { 
    background: #38a169;
  }
  .referral-meta { 
    color: #718096;
    font-size: 14px;
    margin-top: 10px;
  }
  .actions { 
    display: flex;
    gap: 10px;
    margin-top: 15px;
  }
  .login-container {
    min-height: 100vh;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
  }
  .login-card { 
    background: white;
    border-radius: 16px;
    box-shadow: 0 20px 40px rgba(0,0,0,0.1);
    padding: 40px;
    max-width: 400px;
    width: 100%;
  }
  .login-card h1 { 
    color: #2d3748;
    margin-bottom: 20px;
    text-align: center;
    font-size: 24px;
  }
  .error { 
    background: #fed7d7;
    color: #c53030;
    padding: 12px;
    border-radius: 8px;
    margin-bottom: 20px;
    text-align: center;
  }
  .form-group { margin-bottom: 20px; }
  .form-group label { 
    display: block;
    margin-bottom: 8px;
    color: #4a5568;
    font-weight: 500;
  }
  .form-group input { 
    width: 100%;
    padding: 12px;
    border: 2px solid #e2e8f0;
    border-radius: 8px;
    font-size: 16px;
    transition: border-color 0.2s;
  }
  .form-group input:focus { 
    outline: none;
    border-color: #667eea;
  }
  .login-btn { 
    width: 100%;
    background: #667eea;
    color: white;
    border: none;
    padding: 14px;
    border-radius: 8px;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
    transition: background-color 0.2s;
  }
  .login-btn:hover { background: #5a67d8; }
  .login-btn:disabled { 
    background: #a0aec0;
    cursor: not-allowed;
  }
  @media (max-width: 768px) {
    .header h1 { font-size: 24px; }
    .stat-number { font-size: 24px; }
    .stats-grid { grid-template-columns: 1fr; }
    .referral-header { 
      flex-direction: column;
      align-items: flex-start;
      gap: 10px;
    }
    .actions { 
      flex-direction: column;
    }
  }
`;

export default function ReferrerPortal() {
  const { referrer, error, shop } = useLoaderData<typeof loader>();
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [loginForm, setLoginForm] = useState({
    email: "",
    shop: shop || ""
  });

  const copyToClipboard = (text: string, code: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  if (error || !referrer) {
    return (
      <>
        <style dangerouslySetInnerHTML={{ __html: styles }} />
        <div className="login-container">
          <div className="login-card">
            <h1>Referrer Portal</h1>
            
            {error && (
              <div className="error">{error}</div>
            )}

            <form 
              onSubmit={(e) => {
                e.preventDefault();
                const params = new URLSearchParams({
                  shop: loginForm.shop,
                  email: loginForm.email
                });
                window.location.href = `/portal?${params.toString()}`;
              }}
            >
              <div className="form-group">
                <label>Store URL</label>
                <input
                  type="text"
                  value={loginForm.shop}
                  onChange={(e) => setLoginForm({...loginForm, shop: e.target.value})}
                  placeholder="your-store.myshopify.com"
                  required
                />
              </div>

              <div className="form-group">
                <label>Email Address</label>
                <input
                  type="email"
                  value={loginForm.email}
                  onChange={(e) => setLoginForm({...loginForm, email: e.target.value})}
                  placeholder="your-email@example.com"
                  required
                />
              </div>

              <button 
                type="submit"
                className="login-btn"
                disabled={!loginForm.shop || !loginForm.email}
              >
                Access Portal
              </button>
            </form>
          </div>
        </div>
      </>
    );
  }

  const totalClicks = referrer.referrals.reduce((sum: number, ref: any) => sum + (ref.clickCount || 0), 0);
  const totalConversions = referrer.referrals.filter((ref: any) => ref.status === 'converted').length;
  const totalEarnings = referrer.referrals.reduce((sum: number, ref: any) => sum + (ref.commissionAmount || 0), 0);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: styles }} />
      <div className="portal-container">
        <div className="header">
          <h1>Welcome back, {referrer.firstName || 'Referrer'}!</h1>
          <p>Track your referrals and earnings</p>
        </div>

        <div className="container">
          {/* Stats Overview */}
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-number">{referrer.referrals.length}</div>
              <div className="stat-label">Total Referrals</div>
            </div>
            <div className="stat-card">
              <div className="stat-number">{totalClicks}</div>
              <div className="stat-label">Total Clicks</div>
            </div>
            <div className="stat-card">
              <div className="stat-number">{totalConversions}</div>
              <div className="stat-label">Conversions</div>
            </div>
            <div className="stat-card">
              <div className="stat-number">${totalEarnings.toFixed(2)}</div>
              <div className="stat-label">Total Earnings</div>
            </div>
          </div>

          {/* Referral Links */}
          <div className="section">
            <h2>Your Referral Links</h2>
            
            {referrer.referrals.map((referral: any) => {
              // ✅ FIXED: Use pre-generated tracking URL from loader
              const trackingLink = referral.trackingUrl;
              
              return (
              <div key={referral.id} className="referral-card">
                <div className="referral-header">
                  <div className="program-name">{referral.program.name}</div>
                  <div className={`status-badge ${referral.status === 'converted' ? 'status-converted' : 'status-active'}`}>
                    {referral.status === 'converted' ? '✅ Converted' : '⏳ Active'}
                  </div>
                </div>

                <div className="link-container">
                  <input
                    type="text"
                    value={trackingLink}
                    readOnly
                    className="link-input"
                  />
                </div>

                <div className="actions">
                  <button 
                    className={`btn ${copiedCode === referral.referralCode ? 'copied' : ''}`}
                    onClick={() => copyToClipboard(trackingLink, referral.referralCode)}
                  >
                    {copiedCode === referral.referralCode ? '✓ Copied!' : '📋 Copy Link'}
                  </button>
                  <button 
                    className="btn btn-secondary"
                    onClick={() => {
                      const subject = encodeURIComponent(`Join ${referral.program.name}`);
                      const body = encodeURIComponent(`Check this out: ${trackingLink}`);
                      window.open(`mailto:?subject=${subject}&body=${body}`);
                    }}
                  >
                    📧 Share via Email
                  </button>
                </div>

                <div className="referral-meta">
                  Code: <strong>{referral.referralCode}</strong> • 
                  Clicks: <strong>{referral.clickCount || 0}</strong>
                  {referral.commissionAmount && (
                    <> • Earned: <strong>${referral.commissionAmount.toFixed(2)}</strong></>
                  )}
                </div>
              </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
} 