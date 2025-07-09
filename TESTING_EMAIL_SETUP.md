# Testing Email Setup with Resend

## 🧪 Testing Email Addresses (Always Work)

Use these Resend testing emails for immediate testing:

### **Testing Recipients:**
- ✅ `delivered@resend.dev` - Always delivers
- ✅ `bounced@resend.dev` - Always bounces 
- ✅ `complained@resend.dev` - Always complains

### **Testing Senders:**
- ✅ `onboarding@resend.dev` - Default sender
- ✅ `noreply@resend.dev` - No-reply sender

## 🎯 How to Test Right Now:

1. **Go to your Catferrals app**
2. **Navigate to Referrer Management**
3. **Click "Invite Referrers"**
4. **Use this email: `delivered@resend.dev`**
5. **Send the invitation**
6. **Check your Resend dashboard** to see the sent email

## 📧 For Real Email Addresses:

### **Option A: Add Your Email to Verified Recipients**
1. Go to [resend.com/emails](https://resend.com/emails)
2. Add your email address to verified recipients
3. Now you can send to your own email

### **Option B: Verify Your Domain**
1. Go to [resend.com/domains](https://resend.com/domains)
2. Add your domain (e.g., `yourdomain.com`)
3. Add DNS records they provide
4. Once verified, send from `referrals@yourdomain.com`

### **Option C: Use Your Current Setup**
- Send from: `onboarding@resend.dev` 
- Send to: Your email address (after verifying it)

## 🚀 Quick Test Command:
```bash
curl -X POST "https://api.resend.com/emails" \
  -H "Authorization: Bearer re_3G3oF777_JvhtMjfCJzRpsaizbtAaSv26" \
  -H "Content-Type: application/json" \
  -d '{
    "from": "onboarding@resend.dev",
    "to": ["delivered@resend.dev"],
    "subject": "Catferrals Test",
    "text": "Your referral system is working!"
  }'
```

## 📊 Next Steps:
1. **Test immediately** with `delivered@resend.dev`
2. **Verify your personal email** in Resend dashboard
3. **Consider domain verification** for production use 