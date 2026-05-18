/**
 * Taqwin — Email Service
 * Handles sending emails via Gmail SMTP
 */
const nodemailer = require('nodemailer');
const crypto = require('crypto');

// Create transporter
const createTransporter = () => {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
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
    console.error('❌ Error sending email:', error);
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

async function sendPasswordResetEmail(email, resetUrl) {
  const transporter = createTransporter();
  const mailOptions = {
    from: `"Taqwin Fitness" <${process.env.GMAIL_USER}>`,
    to: email,
    subject: 'Reset your Taqwin password',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1f2937;">
        <h2 style="color: #0d9488;">Reset your password</h2>
        <p>We received a request to reset your Taqwin password. Click the button below to choose a new one. This link expires in 60 minutes.</p>
        <p style="text-align: center; margin: 32px 0;">
          <a href="${resetUrl}" style="display: inline-block; background: #14b8a6; color: white; padding: 12px 32px; text-decoration: none; border-radius: 8px; font-weight: bold;">Reset Password</a>
        </p>
        <p style="font-size: 12px; color: #6b7280;">If you didn't request this, you can safely ignore this email.</p>
        <p style="font-size: 12px; color: #6b7280; word-break: break-all;">Or paste this link into your browser: <br/> ${resetUrl}</p>
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

module.exports = {
  generateVerificationCode,
  sendVerificationEmail,
  sendWelcomeEmail,
  sendPasswordResetEmail,
};
