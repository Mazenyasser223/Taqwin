/**
 * Taqwin — Email Service
 * Handles sending emails via Gmail SMTP
 */
const nodemailer = require('nodemailer');
const crypto = require('crypto');

function isEmailConfigured() {
  return Boolean(process.env.GMAIL_USER?.trim() && process.env.GMAIL_APP_PASSWORD?.trim());
}

// Create transporter
const createTransporter = () => {
  if (!isEmailConfigured()) {
    throw new Error('Email service is not configured (GMAIL_USER / GMAIL_APP_PASSWORD)');
  }
  const user = process.env.GMAIL_USER.trim();
  const pass = process.env.GMAIL_APP_PASSWORD.replace(/\s/g, '');
  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass },
  });
};

// Generate cryptographically-secure 6-digit verification code
const generateVerificationCode = () => {
  return crypto.randomInt(100000, 1000000).toString();
};

// Send verification email
async function sendVerificationEmail(email, code, userName = 'User') {
  const transporter = createTransporter();

  const mailOptions = {
    from: `"Taqwin Fitness" <${process.env.GMAIL_USER}>`,
    to: email,
    subject: '🎉 Welcome to Taqwin - Verify Your Email',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body {
            font-family: 'Arial', sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .header {
            background: linear-gradient(135deg, #0d9488 0%, #14b8a6 100%);
            padding: 30px;
            text-align: center;
            border-radius: 10px 10px 0 0;
          }
          .header h1 {
            color: white;
            margin: 0;
            font-size: 28px;
          }
          .content {
            background: #f9fafb;
            padding: 40px 30px;
            border-radius: 0 0 10px 10px;
          }
          .verification-box {
            background: white;
            border: 2px solid #14b8a6;
            border-radius: 10px;
            padding: 30px;
            text-align: center;
            margin: 30px 0;
          }
          .verification-code {
            font-size: 36px;
            font-weight: bold;
            color: #0d9488;
            letter-spacing: 8px;
            margin: 20px 0;
          }
          .footer {
            text-align: center;
            color: #6b7280;
            font-size: 14px;
            margin-top: 30px;
          }
          .button {
            display: inline-block;
            background: #14b8a6;
            color: white;
            padding: 12px 30px;
            text-decoration: none;
            border-radius: 8px;
            font-weight: bold;
            margin-top: 20px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>🏋️ Welcome to Taqwin!</h1>
        </div>
        <div class="content">
          <h2>Hello ${userName}! 👋</h2>
          <p>Thank you for joining Taqwin, your AI-powered fitness companion. We're excited to help you achieve your fitness goals!</p>
          
          <p><strong>To complete your registration, please verify your email address with the code below:</strong></p>
          
          <div class="verification-box">
            <p style="margin: 0; color: #6b7280; font-size: 14px;">Your Verification Code</p>
            <div class="verification-code">${code}</div>
            <p style="margin: 0; color: #6b7280; font-size: 12px;">This code will expire in 15 minutes</p>
          </div>
          
          <p>Simply enter this code on the verification page to activate your account.</p>
          
          <p><strong>What's Next?</strong></p>
          <ul>
            <li>Complete your fitness profile</li>
            <li>Get personalized AI coaching</li>
            <li>Track your workouts and progress</li>
            <li>Join our vibrant fitness community</li>
          </ul>
          
          <div class="footer">
            <p>If you didn't create an account with Taqwin, please ignore this email.</p>
            <p>Need help? Contact us at support@taqwin.com</p>
            <p style="margin-top: 20px;">&copy; 2026 Taqwin. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`✅ Verification email sent to ${email}`);
    return true;
  } catch (error) {
    const detail = error?.response || error?.message || String(error);
    console.error('❌ Error sending email:', detail);
    throw new Error('Failed to send verification email');
  }
}

// Send welcome email (after verification)
async function sendWelcomeEmail(email, userName) {
  const transporter = createTransporter();

  const mailOptions = {
    from: `"Taqwin Fitness" <${process.env.GMAIL_USER}>`,
    to: email,
    subject: '🎉 Welcome to Taqwin - Let\'s Get Started!',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body {
            font-family: 'Arial', sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .header {
            background: linear-gradient(135deg, #0d9488 0%, #14b8a6 100%);
            padding: 30px;
            text-align: center;
            border-radius: 10px 10px 0 0;
          }
          .header h1 {
            color: white;
            margin: 0;
            font-size: 28px;
          }
          .content {
            background: #f9fafb;
            padding: 40px 30px;
            border-radius: 0 0 10px 10px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>🏋️ You're All Set!</h1>
        </div>
        <div class="content">
          <h2>Welcome aboard, ${userName}! 🎉</h2>
          <p>Your email has been verified successfully. You're now part of the Taqwin community!</p>
          
          <p><strong>What you can do now:</strong></p>
          <ul>
            <li>📊 Set up your fitness goals</li>
            <li>🤖 Get AI-powered workout recommendations</li>
            <li>📈 Track your progress with detailed analytics</li>
            <li>💪 Join challenges and connect with others</li>
          </ul>
          
          <p>Ready to transform your fitness journey? Let's go!</p>
          
          <div style="text-align: center; margin-top: 30px;">
            <a href="${process.env.FRONTEND_URL}/dashboard" style="display: inline-block; background: #14b8a6; color: white; padding: 12px 30px; text-decoration: none; border-radius: 8px; font-weight: bold;">Go to Dashboard</a>
          </div>
          
          <div style="text-align: center; color: #6b7280; font-size: 14px; margin-top: 30px;">
            <p>Need help getting started? Check out our <a href="${process.env.FRONTEND_URL}/help" style="color: #14b8a6;">Quick Start Guide</a></p>
            <p>&copy; 2026 Taqwin. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`✅ Welcome email sent to ${email}`);
    return true;
  } catch (error) {
    console.error('❌ Error sending welcome email:', error);
    // Don't throw error for welcome email - it's not critical
    return false;
  }
}

async function sendPasswordResetCodeEmail(email, code) {
  const transporter = createTransporter();
  const mailOptions = {
    from: `"Taqwin Fitness" <${process.env.GMAIL_USER}>`,
    to: email,
    subject: 'Your Taqwin password reset code',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1f2937;">
        <h2 style="color: #0d9488;">Reset your password</h2>
        <p>We received a request to reset your Taqwin password. Enter this verification code in the app:</p>
        <div style="background: #f0fdfa; border: 2px solid #14b8a6; border-radius: 10px; padding: 24px; text-align: center; margin: 28px 0;">
          <p style="margin: 0 0 8px; color: #6b7280; font-size: 14px;">Your reset code</p>
          <p style="margin: 0; font-size: 36px; font-weight: bold; color: #0d9488; letter-spacing: 8px;">${code}</p>
          <p style="margin: 12px 0 0; color: #6b7280; font-size: 12px;">Expires in 15 minutes</p>
        </div>
        <p style="font-size: 12px; color: #6b7280;">If you didn't request this, you can safely ignore this email.</p>
      </div>
    `,
  };
  try {
    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error('Error sending password reset email:', error);
    throw new Error('Failed to send password reset email');
  }
}

async function sendSupportTicketEmail({
  userEmail,
  userName,
  category,
  subject,
  description,
  imageUrl,
  ticketId,
}) {
  const transporter = createTransporter();
  const supportInbox = process.env.SUPPORT_EMAIL || process.env.GMAIL_USER;

  const mailOptions = {
    from: `"Taqwin Support" <${process.env.GMAIL_USER}>`,
    to: supportInbox,
    replyTo: userEmail,
    subject: `[Support #${ticketId.slice(0, 8)}] ${subject}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1f2937;">
        <h2 style="color: #0d9488;">New support request</h2>
        <p><strong>From:</strong> ${userName} &lt;${userEmail}&gt;</p>
        <p><strong>Category:</strong> ${category || 'other'}</p>
        <p><strong>Subject:</strong> ${subject}</p>
        <p><strong>Ticket ID:</strong> ${ticketId}</p>
        ${imageUrl ? `<p><strong>Screenshot:</strong> <a href="${imageUrl}">View attachment</a></p>` : ''}
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
        <p style="white-space: pre-wrap;">${description.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>
      </div>
    `,
  };

  const userConfirmation = {
    from: `"Taqwin Fitness" <${process.env.GMAIL_USER}>`,
    to: userEmail,
    subject: 'We received your support request',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1f2937;">
        <h2 style="color: #0d9488;">Thanks for contacting Taqwin</h2>
        <p>Hi ${userName},</p>
        <p>We received your message about <strong>${subject}</strong> and will get back to you soon.</p>
        <p style="font-size: 12px; color: #6b7280;">Reference: ${ticketId}</p>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    await transporter.sendMail(userConfirmation);
    return true;
  } catch (error) {
    console.error('Error sending support ticket email:', error);
    throw new Error('Failed to send support email');
  }
}

async function sendEmailChangeCode(email, code) {
  const transporter = createTransporter();
  const mailOptions = {
    from: `"Taqwin Fitness" <${process.env.GMAIL_USER}>`,
    to: email,
    subject: 'Confirm your new Taqwin email',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1f2937;">
        <h2 style="color: #0d9488;">Confirm email change</h2>
        <p>Use this code to confirm your new email address on Taqwin:</p>
        <p style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #0d9488;">${code}</p>
        <p style="font-size: 12px; color: #6b7280;">Expires in 15 minutes. If you did not request this, ignore this email.</p>
      </div>
    `,
  };
  try {
    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error('Error sending email change code:', error);
    throw new Error('Failed to send verification email');
  }
}
module.exports = {
  isEmailConfigured,
  generateVerificationCode,
  sendVerificationEmail,
  sendWelcomeEmail,
  sendPasswordResetCodeEmail,
  sendSupportTicketEmail,
  sendEmailChangeCode,
};
