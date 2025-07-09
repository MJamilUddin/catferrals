import { Resend } from "resend";
import db from "../../catferrals-shopify/catferrals/app/db.server";
import { nanoid } from "nanoid";

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      RESEND_API_KEY: string;
    }
  }
}

const resend = new Resend(process.env.RESEND_API_KEY);

interface EmailConfig {
  from: string;
  fromName: string;
  replyTo?: string;
}

interface InvitationEmailData {
  recipientEmail: string;
  recipientName: string;
  senderName: string;
  personalMessage?: string;
  referralLink: string;
  programName: string;
  commissionRate: string;
  shopName: string;
  shopDomain: string;
}

interface WelcomeEmailData {
  recipientEmail: string;
  recipientName: string;
  referralLink: string;
  referralCode: string;
  programName: string;
  commissionRate: string;
  shopName: string;
  shopDomain: string;
}

interface CommissionNotificationData {
  recipientEmail: string;
  recipientName: string;
  commissionAmount: number;
  orderValue: number;
  customerName: string;
  programName: string;
  shopName: string;
}

// Get email configuration for a shop
export async function getEmailConfig(shop: string): Promise<EmailConfig> {
  const settings = await db.appSettings.findUnique({
    where: { shop }
  });

  return {
    // Use Resend's testing sender address by default for immediate functionality
    from: settings?.senderEmail || `onboarding@resend.dev`,
    fromName: settings?.senderName || "Catferrals Referral Team",
    replyTo: settings?.senderEmail || undefined
  };
}

// Generate professional invitation email template
function createInvitationEmailTemplate(data: InvitationEmailData): { html: string; text: string; subject: string } {
  const subject = `You're invited to join ${data.shopName}'s referral program!`;
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${subject}</title>
        <style>
            body { font-family: 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f8f9fa; }
            .container { max-width: 600px; margin: 0 auto; background-color: white; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px 30px; text-align: center; }
            .header h1 { margin: 0; font-size: 28px; font-weight: 300; }
            .content { padding: 40px 30px; }
            .highlight-box { background-color: #f8f9ff; border-left: 4px solid #667eea; padding: 20px; margin: 25px 0; border-radius: 0 8px 8px 0; }
            .cta-button { display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 20px 0; transition: transform 0.2s; }
            .cta-button:hover { transform: translateY(-2px); }
            .benefits { background-color: #f8f9ff; padding: 25px; border-radius: 8px; margin: 25px 0; }
            .benefit-item { display: flex; align-items: center; margin: 15px 0; }
            .benefit-icon { width: 24px; height: 24px; background-color: #667eea; border-radius: 50%; margin-right: 15px; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; }
            .footer { background-color: #f8f9fa; padding: 30px; text-align: center; color: #666; font-size: 14px; }
            .personal-message { background-color: #fff9e6; border: 1px solid #ffeaa7; padding: 20px; border-radius: 8px; margin: 20px 0; font-style: italic; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🎉 You're Invited!</h1>
                <p>Join ${data.shopName}'s exclusive referral program</p>
            </div>
            
            <div class="content">
                <h2>Hi ${data.recipientName || 'there'}!</h2>
                
                <p><strong>${data.senderName}</strong> has invited you to join <strong>${data.shopName}</strong>'s referral program. Start earning money by sharing products you love!</p>
                
                ${data.personalMessage ? `
                    <div class="personal-message">
                        <strong>Personal message from ${data.senderName}:</strong><br>
                        "${data.personalMessage}"
                    </div>
                ` : ''}
                
                <div class="highlight-box">
                    <h3>💰 Earn ${data.commissionRate} on every sale!</h3>
                    <p>Share your unique link and earn commission when friends make purchases.</p>
                </div>
                
                <div class="benefits">
                    <h3>Why join our referral program?</h3>
                    <div class="benefit-item">
                        <div class="benefit-icon">💰</div>
                        <span>Earn ${data.commissionRate} commission on every successful referral</span>
                    </div>
                    <div class="benefit-item">
                        <div class="benefit-icon">📊</div>
                        <span>Track your earnings with real-time analytics</span>
                    </div>
                    <div class="benefit-item">
                        <div class="benefit-icon">🚀</div>
                        <span>Get paid automatically when referrals convert</span>
                    </div>
                    <div class="benefit-item">
                        <div class="benefit-icon">🎯</div>
                        <span>Share products you genuinely love and use</span>
                    </div>
                </div>
                
                <center>
                    <a href="${data.referralLink}" class="cta-button">Access Your Referral Dashboard</a>
                </center>
                
                <p><small>Your unique referral link: <br><code>${data.referralLink}</code></small></p>
                
                <p>Click the button above to verify your email and access your personalized referral dashboard where you can:</p>
                <ul>
                    <li>Get your unique referral links</li>
                    <li>Track your earnings and commissions</li>
                    <li>Monitor your referral performance</li>
                    <li>Access marketing materials and resources</li>
                </ul>
            </div>
            
            <div class="footer">
                <p>© ${new Date().getFullYear()} ${data.shopName}. All rights reserved.</p>
                <p>You received this email because ${data.senderName} invited you to join our referral program.</p>
                <p><a href="https://${data.shopDomain}" style="color: #667eea;">Visit Store</a></p>
            </div>
        </div>
    </body>
    </html>
  `;

  const text = `
    You're invited to join ${data.shopName}'s referral program!
    
    Hi ${data.recipientName || 'there'}!
    
    ${data.senderName} has invited you to join ${data.shopName}'s referral program.
    
    ${data.personalMessage ? `Personal message: "${data.personalMessage}"` : ''}
    
    EARN ${data.commissionRate} ON EVERY SALE!
    
    Benefits:
    • Earn ${data.commissionRate} commission on every successful referral
    • Track your earnings with real-time analytics  
    • Get paid automatically when referrals convert
    • Share products you genuinely love and use
    
    Get started: ${data.referralLink}
    
    Ready to start earning? Click the link above to activate your account!
    
    © ${new Date().getFullYear()} ${data.shopName}
  `;

  return { html, text, subject };
}

// Generate welcome email template
function createWelcomeEmailTemplate(data: WelcomeEmailData): { html: string; text: string; subject: string } {
  const subject = `Welcome to ${data.shopName}'s referral program! 🎉`;
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${subject}</title>
        <style>
            body { font-family: 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f8f9fa; }
            .container { max-width: 600px; margin: 0 auto; background-color: white; }
            .header { background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 40px 30px; text-align: center; }
            .header h1 { margin: 0; font-size: 28px; font-weight: 300; }
            .content { padding: 40px 30px; }
            .referral-box { background: linear-gradient(135deg, #e8f5e8 0%, #d4edda 100%); border: 1px solid #c3e6cb; padding: 25px; border-radius: 8px; text-align: center; margin: 25px 0; }
            .referral-code { font-size: 24px; font-weight: bold; color: #28a745; font-family: monospace; margin: 10px 0; }
            .referral-link { background-color: #f8f9fa; padding: 15px; border-radius: 5px; font-family: monospace; word-break: break-all; border: 1px solid #dee2e6; }
            .copy-button { background-color: #28a745; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; margin: 10px; }
            .steps { background-color: #f8f9ff; padding: 25px; border-radius: 8px; margin: 25px 0; }
            .step { display: flex; align-items: flex-start; margin: 20px 0; }
            .step-number { width: 30px; height: 30px; background-color: #28a745; border-radius: 50%; color: white; font-weight: bold; display: flex; align-items: center; justify-content: center; margin-right: 15px; }
            .footer { background-color: #f8f9fa; padding: 30px; text-align: center; color: #666; font-size: 14px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🎉 Welcome aboard!</h1>
                <p>You're now part of ${data.shopName}'s referral program</p>
            </div>
            
            <div class="content">
                <h2>Hi ${data.recipientName}!</h2>
                
                <p>Congratulations! You've successfully joined the <strong>${data.programName}</strong> and you're ready to start earning <strong>${data.commissionRate}</strong> on every referral.</p>
                
                <div class="referral-box">
                    <h3>Your Referral Details</h3>
                    <p><strong>Your Referral Code:</strong></p>
                    <div class="referral-code">${data.referralCode}</div>
                    <p><strong>Your Referral Link:</strong></p>
                    <div class="referral-link">${data.referralLink}</div>
                </div>
                
                <div class="steps">
                    <h3>How to start earning in 3 easy steps:</h3>
                    
                    <div class="step">
                        <div class="step-number">1</div>
                        <div>
                            <strong>Share your link</strong><br>
                            Copy your referral link and share it with friends via social media, email, or any platform you prefer.
                        </div>
                    </div>
                    
                    <div class="step">
                        <div class="step-number">2</div>
                        <div>
                            <strong>Friends shop & save</strong><br>
                            Your friends click your link, discover amazing products, and make purchases from ${data.shopName}.
                        </div>
                    </div>
                    
                    <div class="step">
                        <div class="step-number">3</div>
                        <div>
                            <strong>You earn money</strong><br>
                            Earn ${data.commissionRate} commission on every successful purchase. Track your earnings in real-time!
                        </div>
                    </div>
                </div>
                
                <h3>💡 Pro Tips for Success:</h3>
                <ul>
                    <li>Share products you genuinely love and have used</li>
                    <li>Add personal recommendations when sharing</li>
                    <li>Use multiple channels: social media, email, word-of-mouth</li>
                    <li>Check your dashboard regularly to track performance</li>
                </ul>
                
                <p>Questions? Reply to this email and we'll help you get started!</p>
            </div>
            
            <div class="footer">
                <p>© ${new Date().getFullYear()} ${data.shopName}. All rights reserved.</p>
                <p><a href="https://${data.shopDomain}" style="color: #28a745;">Visit Store</a> | <a href="${data.referralLink.replace('/refer/', '/dashboard/')}" style="color: #28a745;">View Dashboard</a></p>
            </div>
        </div>
    </body>
    </html>
  `;

  const text = `
    Welcome to ${data.shopName}'s referral program! 🎉
    
    Hi ${data.recipientName}!
    
    Congratulations! You've joined the ${data.programName} and you're ready to start earning ${data.commissionRate} on every referral.
    
    YOUR REFERRAL DETAILS:
    Code: ${data.referralCode}
    Link: ${data.referralLink}
    
    HOW TO START EARNING:
    1. Share your link with friends via social media, email, or any platform
    2. Friends click your link and make purchases from ${data.shopName}  
    3. You earn ${data.commissionRate} commission on every successful purchase
    
    PRO TIPS:
    • Share products you genuinely love and have used
    • Add personal recommendations when sharing
    • Use multiple channels: social media, email, word-of-mouth
    • Check your dashboard regularly to track performance
    
    Questions? Reply to this email and we'll help you get started!
    
    © ${new Date().getFullYear()} ${data.shopName}
  `;

  return { html, text, subject };
}

// Generate commission notification email template
function createCommissionNotificationTemplate(data: CommissionNotificationData): { html: string; text: string; subject: string } {
  const subject = `💰 You earned $${data.commissionAmount.toFixed(2)} from your referral!`;
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${subject}</title>
        <style>
            body { font-family: 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f8f9fa; }
            .container { max-width: 600px; margin: 0 auto; background-color: white; }
            .header { background: linear-gradient(135deg, #ffc107 0%, #ff8906 100%); color: white; padding: 40px 30px; text-align: center; }
            .header h1 { margin: 0; font-size: 32px; font-weight: 300; }
            .content { padding: 40px 30px; }
            .commission-box { background: linear-gradient(135deg, #fff3cd 0%, #ffeaa7 100%); border: 1px solid #ffc107; padding: 30px; border-radius: 8px; text-align: center; margin: 25px 0; }
            .commission-amount { font-size: 36px; font-weight: bold; color: #ff8906; margin: 15px 0; }
            .order-details { background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; }
            .detail-row { display: flex; justify-content: space-between; margin: 10px 0; padding: 5px 0; border-bottom: 1px solid #dee2e6; }
            .footer { background-color: #f8f9fa; padding: 30px; text-align: center; color: #666; font-size: 14px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>💰 Congratulations!</h1>
                <p>You just earned a commission from your referral</p>
            </div>
            
            <div class="content">
                <h2>Hi ${data.recipientName}!</h2>
                
                <p>Great news! One of your referrals just made a purchase and you've earned a commission. Keep up the great work!</p>
                
                <div class="commission-box">
                    <h3>Your Commission</h3>
                    <div class="commission-amount">$${data.commissionAmount.toFixed(2)}</div>
                    <p>Added to your account balance</p>
                </div>
                
                <div class="order-details">
                    <h3>Order Details</h3>
                    <div class="detail-row">
                        <span><strong>Customer:</strong></span>
                        <span>${data.customerName}</span>
                    </div>
                    <div class="detail-row">
                        <span><strong>Order Value:</strong></span>
                        <span>$${data.orderValue.toFixed(2)}</span>
                    </div>
                    <div class="detail-row">
                        <span><strong>Program:</strong></span>
                        <span>${data.programName}</span>
                    </div>
                    <div class="detail-row">
                        <span><strong>Commission:</strong></span>
                        <span>$${data.commissionAmount.toFixed(2)}</span>
                    </div>
                </div>
                
                <p>Your commission will be processed with the next payout cycle. Keep sharing your link to earn even more!</p>
                
                <p><strong>Want to earn more?</strong> Share your referral link with more friends and family to increase your earnings.</p>
            </div>
            
            <div class="footer">
                <p>© ${new Date().getFullYear()} ${data.shopName}. All rights reserved.</p>
                <p><a href="#" style="color: #ff8906;">View Dashboard</a> | <a href="#" style="color: #ff8906;">Payment Settings</a></p>
            </div>
        </div>
    </body>
    </html>
  `;

  const text = `
    💰 Congratulations! You earned $${data.commissionAmount.toFixed(2)}
    
    Hi ${data.recipientName}!
    
    Great news! One of your referrals just made a purchase and you've earned a commission.
    
    ORDER DETAILS:
    Customer: ${data.customerName}
    Order Value: $${data.orderValue.toFixed(2)}
    Program: ${data.programName}
    Your Commission: $${data.commissionAmount.toFixed(2)}
    
    Your commission will be processed with the next payout cycle. Keep sharing your link to earn even more!
    
    © ${new Date().getFullYear()} ${data.shopName}
  `;

  return { html, text, subject };
}

// Track email opens and clicks
export async function createEmailTracker(emailType: string, recipientEmail: string, shop: string) {
  const trackingId = nanoid(12);
  
  // In a real implementation, you might want to store this in a database
  // For now, we'll use a simple in-memory tracking
  
  return {
    trackingPixel: `<img src="https://${shop}/api/email/track/open/${trackingId}" width="1" height="1" style="display:none;">`,
    trackingId
  };
}

// Send invitation email
export async function sendInvitationEmail(data: InvitationEmailData): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    console.log("🔍 Starting sendInvitationEmail function");
    
    const config = await getEmailConfig(data.shopDomain);
    console.log("📧 Email config:", config);
    
    const template = createInvitationEmailTemplate(data);
    console.log("📧 Template created, subject:", template.subject);
    
    const tracker = await createEmailTracker('invitation', data.recipientEmail, data.shopDomain);
    console.log("📧 Tracker created");
    
    // Clean tag values to only contain ASCII letters, numbers, underscores, or dashes
    const cleanShopDomain = data.shopDomain.replace(/[^a-zA-Z0-9_-]/g, '_');
    const cleanProgramName = data.programName.replace(/[^a-zA-Z0-9_-]/g, '_');
    
    console.log("📧 About to call resend.emails.send with:", {
      from: `${config.fromName} <${config.from}>`,
      to: [data.recipientEmail],
      subject: template.subject,
      hasHtml: !!template.html,
      hasText: !!template.text,
      replyTo: config.replyTo,
      tags: [
        { name: 'type', value: 'invitation' },
        { name: 'shop', value: cleanShopDomain },
        { name: 'program', value: cleanProgramName }
      ]
    });
    
    const response = await resend.emails.send({
      from: `${config.fromName} <${config.from}>`,
      to: [data.recipientEmail],
      subject: template.subject,
      html: template.html + tracker.trackingPixel,
      text: template.text,
      replyTo: config.replyTo,
      tags: [
        { name: 'type', value: 'invitation' },
        { name: 'shop', value: cleanShopDomain },
        { name: 'program', value: cleanProgramName }
      ]
    });

    console.log("📧 Full Resend response:", JSON.stringify(response, null, 2));
    console.log("📧 Response.data:", response.data);
    console.log("📧 Response.data?.id:", response.data?.id);
    console.log("📧 Response.error:", response.error);

    if (response.error) {
      console.error("❌ Resend API error:", response.error);
      return { success: false, error: response.error.message };
    }

    return { success: true, messageId: response.data?.id };
  } catch (error) {
    console.error('❌ Failed to send invitation email:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// Send welcome email
export async function sendWelcomeEmail(data: WelcomeEmailData): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const config = await getEmailConfig(data.shopDomain);
    const template = createWelcomeEmailTemplate(data);
    const tracker = await createEmailTracker('welcome', data.recipientEmail, data.shopDomain);
    
    // Clean tag values
    const cleanShopDomain = data.shopDomain.replace(/[^a-zA-Z0-9_-]/g, '_');
    const cleanProgramName = data.programName.replace(/[^a-zA-Z0-9_-]/g, '_');
    
    const response = await resend.emails.send({
      from: `${config.fromName} <${config.from}>`,
      to: [data.recipientEmail],
      subject: template.subject,
      html: template.html + tracker.trackingPixel,
      text: template.text,
      replyTo: config.replyTo,
      tags: [
        { name: 'type', value: 'welcome' },
        { name: 'shop', value: cleanShopDomain },
        { name: 'program', value: cleanProgramName }
      ]
    });

    if (response.error) {
      return { success: false, error: response.error.message };
    }

    return { success: true, messageId: response.data?.id };
  } catch (error) {
    console.error('Failed to send welcome email:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// Send commission notification email
export async function sendCommissionNotificationEmail(data: CommissionNotificationData): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const config = await getEmailConfig(data.shopName);
    const template = createCommissionNotificationTemplate(data);
    const tracker = await createEmailTracker('commission', data.recipientEmail, data.shopName);
    
    // Clean tag values
    const cleanShopName = data.shopName.replace(/[^a-zA-Z0-9_-]/g, '_');
    const cleanProgramName = data.programName.replace(/[^a-zA-Z0-9_-]/g, '_');
    
    const response = await resend.emails.send({
      from: `${config.fromName} <${config.from}>`,
      to: [data.recipientEmail],
      subject: template.subject,
      html: template.html + tracker.trackingPixel,
      text: template.text,
      replyTo: config.replyTo,
      tags: [
        { name: 'type', value: 'commission' },
        { name: 'shop', value: cleanShopName },
        { name: 'program', value: cleanProgramName }
      ]
    });

    if (response.error) {
      return { success: false, error: response.error.message };
    }

    return { success: true, messageId: response.data?.id };
  } catch (error) {
    console.error('Failed to send commission email:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// Send bulk email to multiple referrers
export async function sendBulkEmail(
  emails: Array<{ email: string; name: string }>, 
  subject: string, 
  message: string, 
  shop: string
): Promise<{ success: boolean; sent: number; failed: number; errors: string[] }> {
  const config = await getEmailConfig(shop);
  let sent = 0;
  let failed = 0;
  const errors: string[] = [];

  // Clean tag values
  const cleanShop = shop.replace(/[^a-zA-Z0-9_-]/g, '_');

  for (const recipient of emails) {
    try {
      const response = await resend.emails.send({
        from: `${config.fromName} <${config.from}>`,
        to: [recipient.email],
        subject: subject,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2>Hello ${recipient.name}!</h2>
            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
              ${message.replace(/\n/g, '<br>')}
            </div>
            <p>Best regards,<br>${config.fromName}</p>
            <hr style="margin: 30px 0; border: none; border-top: 1px solid #dee2e6;">
            <p style="color: #666; font-size: 12px;">This email was sent from ${shop}'s referral program.</p>
          </div>
        `,
        text: `Hello ${recipient.name}!\n\n${message}\n\nBest regards,\n${config.fromName}`,
        replyTo: config.replyTo,
        tags: [
          { name: 'type', value: 'bulk' },
          { name: 'shop', value: cleanShop }
        ]
      });

      if (response.error) {
        failed++;
        errors.push(`Failed to send to ${recipient.email}: ${response.error.message}`);
      } else {
        sent++;
      }
    } catch (error) {
      failed++;
      errors.push(`Failed to send to ${recipient.email}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  return { success: sent > 0, sent, failed, errors };
} 