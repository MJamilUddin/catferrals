// Simple test to verify email functionality
import 'dotenv/config';

console.log('🧪 Testing Email Configuration...');

// Test environment variables
console.log('RESEND_API_KEY:', process.env.RESEND_API_KEY ? 'Set ✅' : 'Missing ❌');

// Test Resend import
try {
  const { Resend } = await import('resend');
  const resend = new Resend(process.env.RESEND_API_KEY);
  console.log('Resend import: ✅');
  
  // Test basic email sending
  const result = await resend.emails.send({
    from: 'onboarding@resend.dev',
    to: 'delivered@resend.dev',
    subject: 'Test Email from Catferrals',
    text: 'This is a test email to verify Resend is working.',
    tags: [
      { name: 'category', value: 'test' },
      { name: 'source', value: 'catferrals' }
    ]
  });
  
  console.log('Email test result:', result);
  
  if (result.id) {
    console.log('✅ Email sent successfully! Message ID:', result.id);
  } else {
    console.log('❌ Email sending failed');
  }
  
} catch (error) {
  console.error('❌ Error:', error.message);
}

console.log('�� Test completed!'); 