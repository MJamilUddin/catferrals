# Email System Setup Guide

## 🚀 Getting Started with Professional Referral Emails

This guide will help you set up the complete email integration for your Catferrals referral system.

## 📧 Email Service Setup (Resend)

### 1. Create Resend Account
1. Go to [resend.com](https://resend.com)
2. Sign up for a free account (100 emails/day free tier)
3. Verify your email address

### 2. Get Your API Key
1. Go to your Resend dashboard
2. Navigate to "API Keys" section
3. Click "Create API Key"
4. Copy your API key (starts with `re_`)

### 3. Add Environment Variable
Add this to your `.env` file:
```bash
RESEND_API_KEY=re_your_api_key_here
```

## 🎨 Email Features Included

### ✅ **Invitation Emails**
- Professional branded design with gradients
- Personal message support
- Clear call-to-action buttons
- Referral link included
- Commission rate highlighting

### ✅ **Welcome Emails**
- Congratulatory design
- Referral code and link display
- Step-by-step earning guide
- Pro tips for success

### ✅ **Commission Notifications**
- Celebratory design with earnings highlighted
- Order details breakdown
- Encouragement to share more

### ✅ **Bulk Email Support**
- Send to multiple referrers
- Personalized greetings
- Professional formatting

## 🔧 Configuration Options

### Email Settings (in AppSettings)
- `senderEmail`: Your from email address
- `senderName`: Display name for emails
- `brandColor`: Primary color for email themes
- `brandLogo`: Logo URL for emails

### Default Configuration
If not configured, emails will use:
- From: `referrals@{your-shop}.myshopify.com`
- Name: "Referral Team"
- Fallback branding

## 📊 Email Tracking

### Open Tracking
- 1x1 pixel tracking for email opens
- Automatic logging to console
- Route: `/api/email/track/open/{trackingId}`

### Link Tracking
- Referral link clicks tracked in database
- User agent and IP logging
- Conversion attribution

## 🔗 Referral Link Flow

### 1. Invitation Process
```
Admin sends invite → Email with verification link → User clicks → Account verified → Welcome email sent
```

### 2. Link Structure
```
https://your-shop.myshopify.com/refer/ABC123?verify=token_here
```

### 3. Verification & Welcome
- Email verification happens automatically
- Welcome email sent with dashboard link
- Referral tracking begins

## 🎯 Competitor-Level Features

### ✅ **Professional Design**
- Modern gradients and typography
- Mobile-responsive layouts
- Brand consistency

### ✅ **Personalization**
- Recipient name usage
- Personal messages from senders
- Custom commission rates

### ✅ **Engagement Optimization**
- Clear CTAs with hover effects
- Benefit highlighting
- Social proof elements

### ✅ **Technical Excellence**
- HTML + Text versions
- Tracking and analytics
- Error handling with fallbacks

## 🛠️ Usage Examples

### Send Invitation Email
```javascript
await sendInvitationEmail({
  recipientEmail: "friend@example.com",
  recipientName: "John Doe",
  senderName: "Alice Smith",
  personalMessage: "Hey John! I love this store...",
  referralLink: "https://shop.com/refer/ABC123?verify=token",
  programName: "VIP Referral Program",
  commissionRate: "15%",
  shopName: "AWESOME STORE",
  shopDomain: "awesome-store.myshopify.com"
});
```

### Send Welcome Email
```javascript
await sendWelcomeEmail({
  recipientEmail: "new-referrer@example.com",
  recipientName: "Jane Doe",
  referralLink: "https://shop.com/refer/XYZ789",
  referralCode: "XYZ789",
  programName: "VIP Referral Program",
  commissionRate: "15%",
  shopName: "AWESOME STORE",
  shopDomain: "awesome-store.myshopify.com"
});
```

## 🚨 Troubleshooting

### Email Not Sending?
1. Check your `RESEND_API_KEY` is correct
2. Verify domain setup in Resend dashboard
3. Check server logs for error messages
4. Ensure sender email is verified

### Links Not Working?
1. Verify referral code exists in database
2. Check shop domain configuration
3. Ensure verification tokens match

### Styling Issues?
1. HTML emails render differently across clients
2. Test with multiple email providers
3. Use inline CSS for better compatibility

## 📈 Next Steps

1. **Domain Setup**: Configure custom domain in Resend for better deliverability
2. **Analytics**: Add email analytics dashboard
3. **Templates**: Create custom email templates for your brand
4. **Automation**: Set up automated email sequences
5. **A/B Testing**: Test different email designs for better performance

## 🎉 You're Ready!

Your email system now matches enterprise-level referral platforms with:
- Professional email templates
- Automated workflows
- Comprehensive tracking
- Error handling
- Mobile optimization

Start inviting referrers and watch your referral program grow! 🚀 