/**
 * Taqwin — Auth routes: register, login, Google OAuth, email verification.
 * JWT returned on success; no password in response.
 */
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { prisma } = require('../db');
const { authMiddleware } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimitAuth');
const passport = require('../config/passport');
const {
  generateVerificationCode,
  sendVerificationEmail,
  sendWelcomeEmail,
  sendPasswordResetCodeEmail,
} = require('../services/emailService');
const { verifyTwoFactorToken } = require('../lib/twoFactor');
const { validatePassword } = require('../lib/passwordPolicy');
const { getFrontendUrl } = require('../lib/frontendUrl');
const { resolveOAuthOrigin, buildOAuthState, parseOAuthState } = require('../lib/oauthRedirect');
const { getOrCreateProfile } = require('../lib/profile');
const { isEmailConfigured } = require('../services/emailService');
const {
  isTwilioConfigured,
  sendVerificationSms,
  checkVerificationSms,
  normalizePhoneE164,
  getTwilioUserMessage,
} = require('../services/smsService');

const router = express.Router();
router.use(authLimiter);

/** Email verification after signup (set REQUIRE_EMAIL_VERIFICATION=false to disable). */
const requireEmailVerification =
  process.env.REQUIRE_EMAIL_VERIFICATION !== 'false' &&
  (process.env.REQUIRE_EMAIL_VERIFICATION === 'true' || isEmailConfigured());

function signToken(user, expiresInOverride) {
  const secret = process.env.JWT_SECRET;
  const expiresIn = expiresInOverride || process.env.JWT_EXPIRES_IN || '7d';
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role },
    secret,
    { expiresIn },
  );
}

// POST /auth/check-email — signup: verify email is available before role selection
router.post('/check-email', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'Email is required' });
    }
    const emailLower = email.trim().toLowerCase();
    if (emailLower.length < 3 || !emailLower.includes('@')) {
      return res.status(400).json({ error: 'Invalid email' });
    }

    const existing = await prisma.user.findUnique({ where: { email: emailLower } });
    if (!existing) {
      return res.json({ available: true });
    }
    if (!existing.passwordHash) {
      return res.json({
        available: false,
        code: 'GOOGLE_SIGNUP_INCOMPLETE',
      });
    }
    return res.json({
      available: false,
      code: 'EMAIL_ALREADY_REGISTERED',
    });
  } catch (err) {
    console.error('Check-email error:', err);
    res.status(500).json({ error: 'Could not verify email' });
  }
});

// POST /auth/register
router.post('/register', async (req, res) => {
  try {
    const { email, password, role } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    const emailLower = email.trim().toLowerCase();
    if (emailLower.length < 3) {
      return res.status(400).json({ error: 'Invalid email' });
    }
    const pwCheck = validatePassword(password);
    if (!pwCheck.valid) {
      return res.status(400).json({ error: pwCheck.error });
    }

    const existing = await prisma.user.findUnique({ where: { email: emailLower } });
    if (existing) {
      if (!existing.passwordHash) {
        return res.status(409).json({
          error:
            'This email started sign-up with Google. Continue with Google on the sign-up page, then set a password.',
          code: 'GOOGLE_SIGNUP_INCOMPLETE',
        });
      }
      return res.status(409).json({
        error: 'This email is already registered. Sign in with your email and password.',
        code: 'EMAIL_ALREADY_REGISTERED',
      });
    }

    const allowedRoles = ['athlete', 'trainer', 'gym'];
    const userRole = role && allowedRoles.includes(role) ? role : 'athlete';

    const passwordHash = await bcrypt.hash(password, 10);

    const verificationCode = requireEmailVerification ? generateVerificationCode() : null;
    const verificationCodeExpiry = requireEmailVerification
      ? new Date(Date.now() + 15 * 60 * 1000)
      : null;

    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email: emailLower,
          passwordHash,
          role: userRole,
          verificationCode,
          verificationCodeExpiry,
          ...(requireEmailVerification ? {} : { emailVerifiedAt: new Date() }),
        },
      });
      await tx.profile.create({ data: { userId: created.id } });
      await tx.userSettings.create({ data: { userId: created.id } });
      return created;
    });

    if (requireEmailVerification) {
      const isDev = process.env.NODE_ENV !== 'production';
      let devVerificationCode;
      let emailDeliveryFailed = false;
      if (isEmailConfigured()) {
        try {
          await sendVerificationEmail(emailLower, verificationCode);
        } catch (emailError) {
          emailDeliveryFailed = true;
          console.error('Failed to send verification email:', emailError);
          if (isDev) {
            devVerificationCode = verificationCode;
            console.info(`[dev] Signup verification code for ${emailLower}: ${verificationCode}`);
          }
        }
      } else {
        emailDeliveryFailed = true;
        if (isDev) {
          devVerificationCode = verificationCode;
          console.info(`[dev] Signup verification code for ${emailLower}: ${verificationCode}`);
        }
      }
      const message = emailDeliveryFailed
        ? isDev
          ? 'Account created. Email could not be sent — use the code below (development only).'
          : 'Account created but the verification email could not be sent. Tap “Resend code” to try again.'
        : 'Registration successful! Please check your email for the verification code.';
      return res.status(201).json({
        message,
        userId: user.id,
        email: user.email,
        requiresVerification: true,
        ...(emailDeliveryFailed ? { emailDeliveryFailed: true } : {}),
        ...(devVerificationCode ? { devVerificationCode } : {}),
      });
    }

    try {
      await sendWelcomeEmail(emailLower, 'Athlete');
    } catch (emailError) {
      console.error('Failed to send welcome email:', emailError);
    }

    const token = signToken(user);
    res.status(201).json({
      message: 'Registration successful',
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        emailVerifiedAt: user.emailVerifiedAt,
      },
    });
  } catch (err) {
    console.error('Register error:', err);
    if (err?.code === 'P2002') {
      return res.status(409).json({ error: 'Email already registered' });
    }
    if (err?.code === 'P1001' || err?.code === 'P1002' || err?.code === 'P1008') {
      return res.status(503).json({
        error: 'Database is temporarily unavailable. Wait a moment and try again.',
      });
    }
    res.status(500).json({
      error:
        process.env.NODE_ENV !== 'production' && err?.message
          ? `Registration failed: ${err.message}`
          : 'Registration failed. Please try again.',
    });
  }
});

// POST /auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password, rememberMe } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    const emailLower = email.trim().toLowerCase();

    const user = await prisma.user.findUnique({ where: { email: emailLower } });
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    if (!user.passwordHash) {
      return res.status(401).json({
        error:
          'No password set for this account. Sign up with Google to finish registration, then choose a password.',
      });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    if (requireEmailVerification && !user.emailVerifiedAt) {
      return res.status(403).json({
        error: 'Please verify your email before logging in',
        requiresVerification: true,
        email: user.email,
      });
    }

    if (user.twoFactorEnabled && user.twoFactorSecret) {
      const secret = process.env.JWT_SECRET;
      const tempToken = jwt.sign(
        { sub: user.id, purpose: '2fa' },
        secret,
        { expiresIn: '5m' },
      );
      return res.json({
        requiresTwoFactor: true,
        tempToken,
        user: { id: user.id, email: user.email, role: user.role },
      });
    }

    const tokenExpiry = rememberMe ? '30d' : '1d';
    const token = signToken(user, tokenExpiry);
    const fullUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        email: true,
        role: true,
        emailVerifiedAt: true,
        createdAt: true,
        updatedAt: true,
        profile: true,
      },
    });
    res.json({
      token,
      user: {
        id: fullUser.id,
        email: fullUser.email,
        role: fullUser.role,
        emailVerifiedAt: fullUser.emailVerifiedAt,
        profile: fullUser.profile,
        twoFactorEnabled: user.twoFactorEnabled,
        hasPassword: Boolean(user.passwordHash),
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// POST /auth/signup-role — choose role after Google sign-up + password (email users set role at register)
router.post('/signup-role', authMiddleware, async (req, res) => {
  try {
    const { role } = req.body;
    const allowedRoles = ['athlete', 'trainer', 'gym'];
    if (!role || !allowedRoles.includes(role)) {
      return res.status(400).json({ error: 'Valid role is required (athlete, trainer, or gym)' });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { googleId: true, passwordHash: true },
    });
    if (!user?.googleId) {
      return res.status(400).json({ error: 'Role selection is only for Google sign-up accounts' });
    }
    if (!user.passwordHash) {
      return res.status(400).json({ error: 'Set your password before choosing a role' });
    }

    const fullUser = await prisma.user.update({
      where: { id: req.user.id },
      data: { role },
      select: {
        id: true,
        email: true,
        role: true,
        emailVerifiedAt: true,
        createdAt: true,
        updatedAt: true,
        profile: true,
        passwordHash: true,
      },
    });
    const { passwordHash: _ph, ...safe } = fullUser;
    res.json({
      user: { ...safe, hasPassword: true },
    });
  } catch (err) {
    console.error('Signup-role error:', err);
    res.status(500).json({ error: 'Failed to save role' });
  }
});

// POST /auth/set-initial-password — Google sign-up users set password for email login
router.post('/set-initial-password', authMiddleware, async (req, res) => {
  try {
    const { password } = req.body;
    if (!password) {
      return res.status(400).json({ error: 'Password is required' });
    }
    const pwCheck = validatePassword(password);
    if (!pwCheck.valid) {
      return res.status(400).json({ error: pwCheck.error });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { passwordHash: true },
    });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    if (user.passwordHash) {
      return res.status(400).json({
        error: 'Password already set. Use change password in settings.',
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    await prisma.user.update({
      where: { id: req.user.id },
      data: { passwordHash },
    });

    const fullUser = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        role: true,
        emailVerifiedAt: true,
        createdAt: true,
        updatedAt: true,
        profile: true,
        passwordHash: true,
      },
    });
    if (!fullUser) {
      return res.status(404).json({ error: 'User not found' });
    }
    const { passwordHash: _ph, ...safe } = fullUser;
    res.json({
      message: 'Password set successfully',
      user: { ...safe, hasPassword: true },
    });
  } catch (err) {
    console.error('Set-initial-password error:', err);
    res.status(500).json({ error: 'Failed to set password' });
  }
});

// POST /auth/2fa/verify — complete login after TOTP
router.post('/2fa/verify', async (req, res) => {
  try {
    const { tempToken, code } = req.body;
    if (!tempToken || !code) {
      return res.status(400).json({ error: 'tempToken and code are required' });
    }
    const secret = process.env.JWT_SECRET;
    let decoded;
    try {
      decoded = jwt.verify(tempToken, secret);
    } catch {
      return res.status(401).json({ error: 'Session expired. Please sign in again.' });
    }
    if (decoded.purpose !== '2fa' || !decoded.sub) {
      return res.status(401).json({ error: 'Invalid session' });
    }

    const user = await prisma.user.findUnique({ where: { id: decoded.sub } });
    if (!user?.twoFactorEnabled || !user.twoFactorSecret) {
      return res.status(400).json({ error: 'Two-factor authentication is not enabled' });
    }
    if (!verifyTwoFactorToken(user.twoFactorSecret, code)) {
      return res.status(401).json({ error: 'Invalid authenticator code' });
    }

    const token = signToken(user);
    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        twoFactorEnabled: true,
      },
    });
  } catch (err) {
    console.error('2FA verify error:', err);
    res.status(500).json({ error: 'Verification failed' });
  }
});

// POST /auth/verify-email — verify email with code
router.post('/verify-email', async (req, res) => {
  try {
    const { email, code } = req.body;
    
    if (!email || !code) {
      return res.status(400).json({ error: 'Email and verification code are required' });
    }
    
    const emailLower = email.trim().toLowerCase();
    const user = await prisma.user.findUnique({ where: { email: emailLower } });
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    if (user.emailVerifiedAt) {
      return res.status(400).json({ error: 'Email already verified' });
    }
    
    if (!user.verificationCode) {
      return res.status(400).json({ error: 'No verification code found. Please request a new one.' });
    }
    
    if (user.verificationCodeExpiry < new Date()) {
      return res.status(400).json({ error: 'Verification code expired. Please request a new one.' });
    }
    
    if (user.verificationCode !== code.trim()) {
      return res.status(400).json({ error: 'Invalid verification code' });
    }
    
    // Mark email as verified
    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerifiedAt: new Date(),
        verificationCode: null,
        verificationCodeExpiry: null,
      },
    });

    await getOrCreateProfile(user.id);

    // Send welcome email
    try {
      const profile = await prisma.profile.findUnique({ where: { userId: user.id } });
      await sendWelcomeEmail(emailLower, profile?.displayName || 'User');
    } catch (emailError) {
      console.error('Failed to send welcome email:', emailError);
    }
    
    const token = signToken(user);
    const fullUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        email: true,
        role: true,
        emailVerifiedAt: true,
        createdAt: true,
        updatedAt: true,
        profile: true,
        passwordHash: true,
      },
    });
    res.json({
      message: 'Email verified successfully!',
      token,
      user: {
        ...fullUser,
        emailVerifiedAt: fullUser.emailVerifiedAt ?? new Date(),
        hasPassword: Boolean(fullUser.passwordHash),
      },
    });
  } catch (err) {
    console.error('Verification error:', err);
    res.status(500).json({ error: 'Verification failed' });
  }
});

// POST /auth/resend-verification — resend verification code
router.post('/resend-verification', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }
    
    const emailLower = email.trim().toLowerCase();
    const user = await prisma.user.findUnique({ where: { email: emailLower } });
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    if (user.emailVerifiedAt) {
      return res.status(400).json({ error: 'Email already verified' });
    }
    
    // Generate new code
    const verificationCode = generateVerificationCode();
    const verificationCodeExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
    
    await prisma.user.update({
      where: { id: user.id },
      data: {
        verificationCode,
        verificationCodeExpiry,
      },
    });
    
    const isDev = process.env.NODE_ENV !== 'production';
    if (!isEmailConfigured()) {
      if (isDev) {
        console.info(`[dev] Signup verification code for ${emailLower}: ${verificationCode}`);
        return res.json({
          message: 'Email is not configured. Use the code below (development only).',
          devVerificationCode: verificationCode,
        });
      }
      return res.status(503).json({
        error: 'Email service is not configured. Contact support or try again later.',
      });
    }

    try {
      await sendVerificationEmail(emailLower, verificationCode);
      return res.json({ message: 'Verification code sent! Please check your email.' });
    } catch (emailError) {
      console.error('Resend verification email failed:', emailError);
      if (isDev) {
        console.info(`[dev] Signup verification code for ${emailLower}: ${verificationCode}`);
        return res.json({
          message: 'Could not send email. Use this code instead (development only).',
          devVerificationCode: verificationCode,
        });
      }
      return res.status(503).json({ error: 'Failed to send verification email. Try again later.' });
    }
  } catch (err) {
    console.error('Resend verification error:', err);
    res.status(500).json({ error: 'Failed to resend verification code' });
  }
});

// GET /auth/me — current user (requires Bearer token)
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        role: true,
        emailVerifiedAt: true,
        createdAt: true,
        updatedAt: true,
        profile: true,
        passwordHash: true,
        twoFactorEnabled: true,
        pendingEmail: true,
        phone: true,
        phoneVerifiedAt: true,
      },
    });
    if (!user) return res.status(404).json({ error: 'User not found' });
    const { passwordHash, ...safe } = user;
    let profile = safe.profile;
    if (!profile) {
      profile = await getOrCreateProfile(user.id);
    }
    res.json({
      ...safe,
      profile,
      hasPassword: Boolean(passwordHash),
      hasPendingEmailChange: Boolean(safe.pendingEmail),
    });
  } catch (err) {
    console.error('Me error:', err);
    res.status(500).json({ error: 'Failed to load user' });
  }
});

// POST /auth/verify-password — confirm current password before change
router.post('/verify-password', authMiddleware, async (req, res) => {
  try {
    const { currentPassword } = req.body;
    if (!currentPassword) {
      return res.status(400).json({ error: 'Current password is required' });
    }
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { passwordHash: true },
    });
    if (!user?.passwordHash) {
      return res.status(400).json({
        error: 'This account uses Google sign-in. Password cannot be changed here.',
      });
    }
    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('Verify-password error:', err);
    res.status(500).json({ error: 'Failed to verify password' });
  }
});

// POST /auth/change-password — set a new password (requires current password)
router.post('/change-password', authMiddleware, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new password are required' });
    }
    const newPwCheck = validatePassword(newPassword);
    if (!newPwCheck.valid) {
      return res.status(400).json({ error: newPwCheck.error });
    }
    if (currentPassword === newPassword) {
      return res.status(400).json({ error: 'New password must be different from the current password' });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { passwordHash: true, email: true },
    });
    if (!user?.passwordHash) {
      return res.status(400).json({
        error: 'This account uses Google sign-in. Password cannot be changed here.',
      });
    }

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: req.user.id },
      data: { passwordHash },
    });

    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    console.error('Change-password error:', err);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

function googleAccountNoPasswordError() {
  return {
    error:
      'No password on this account yet. Sign up with Google to complete registration and set a password.',
  };
}

// POST /auth/forgot-password — send reset code via email or SMS (Twilio Verify)
router.post('/forgot-password', async (req, res) => {
  try {
    const channel = req.body.channel === 'sms' ? 'sms' : 'email';
    const isDev = process.env.NODE_ENV !== 'production';

    if (channel === 'sms') {
      const phone = normalizePhoneE164(req.body.phone);
      if (!phone) {
        return res.status(400).json({ error: 'Valid phone number is required (e.g. 01012345678)' });
      }
      const genericSms = 'If that phone number is registered, a verification code was sent.';
      const user = await prisma.user.findUnique({ where: { phone } });

      if (!user) {
        return res.json({ message: genericSms, channel: 'sms' });
      }
      if (!user.passwordHash) {
        return res.status(400).json(googleAccountNoPasswordError());
      }

      if (!isTwilioConfigured()) {
        return res.status(503).json({
          error: 'SMS service is not configured. Set TWILIO_* variables in backend-node/.env',
        });
      }

      try {
        await sendVerificationSms(phone);
        return res.json({ message: genericSms, channel: 'sms', sent: true });
      } catch (err) {
        console.error('Twilio send verification failed:', err);
        return res.status(503).json({
          error: getTwilioUserMessage(err),
          twilioCode: err?.code,
        });
      }
    }

    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });
    const emailLower = email.trim().toLowerCase();
    const user = await prisma.user.findUnique({ where: { email: emailLower } });
    const genericMsg = 'If that email exists, a verification code was sent.';

    if (!user) {
      return res.json({ message: genericMsg, channel: 'email' });
    }

    if (!user.passwordHash) {
      return res.status(400).json(googleAccountNoPasswordError());
    }

    const code = generateVerificationCode();
    const expiry = new Date(Date.now() + 15 * 60 * 1000);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordResetToken: code, passwordResetExpiry: expiry },
    });

    if (!isEmailConfigured()) {
      if (isDev) {
        console.info(`[dev] Password reset code for ${emailLower}: ${code}`);
        return res.json({
          message: 'Email is not configured. Use the code below (development only).',
          devResetCode: code,
          channel: 'email',
        });
      }
      return res.status(503).json({
        error: 'Email service is not configured. Contact support or try again later.',
      });
    }

    try {
      await sendPasswordResetCodeEmail(emailLower, code);
      return res.json({ message: genericMsg, channel: 'email', sent: true });
    } catch (err) {
      console.error('Failed to send password reset email:', err);
      if (isDev) {
        console.info(`[dev] Password reset code for ${emailLower}: ${code}`);
        return res.json({
          message: 'Could not send email (check Gmail settings). Use this code instead (development only).',
          devResetCode: code,
          channel: 'email',
        });
      }
      return res.status(503).json({
        error: 'Failed to send reset email. Check spam or try again later.',
      });
    }
  } catch (err) {
    console.error('Forgot-password error:', err);
    res.status(500).json({ error: 'Failed to process request' });
  }
});

// POST /auth/reset-password — verify code and set a new password
router.post('/reset-password', async (req, res) => {
  try {
    const { email, phone, code, password, token, channel } = req.body;
    if (!password) {
      return res.status(400).json({ error: 'New password is required' });
    }
    const pwCheck = validatePassword(password);
    if (!pwCheck.valid) {
      return res.status(400).json({ error: pwCheck.error });
    }

    const useSms = channel === 'sms' || (phone && !email);

    if (useSms) {
      const phoneE164 = normalizePhoneE164(phone);
      if (!phoneE164 || !code) {
        return res.status(400).json({ error: 'Phone, verification code, and new password are required' });
      }
      if (!isTwilioConfigured()) {
        return res.status(503).json({ error: 'SMS verification is not configured' });
      }
      let approved = false;
      try {
        approved = await checkVerificationSms(phoneE164, code);
      } catch (err) {
        console.error('Twilio verification check failed:', err);
        return res.status(400).json({ error: 'Invalid or expired verification code' });
      }
      if (!approved) {
        return res.status(400).json({ error: 'Invalid or expired verification code' });
      }
      const user = await prisma.user.findUnique({ where: { phone: phoneE164 } });
      if (!user?.passwordHash) {
        return res.status(400).json({ error: 'Account not found or cannot reset password' });
      }
      const passwordHash = await bcrypt.hash(password, 10);
      await prisma.user.update({
        where: { id: user.id },
        data: {
          passwordHash,
          passwordResetToken: null,
          passwordResetExpiry: null,
        },
      });
      return res.json({ message: 'Password updated. You can now sign in.' });
    }

    let user;
    if (email && code) {
      const emailLower = email.trim().toLowerCase();
      user = await prisma.user.findUnique({ where: { email: emailLower } });
      if (!user || !user.passwordResetToken || user.passwordResetToken !== String(code).trim()) {
        return res.status(400).json({ error: 'Invalid or expired verification code' });
      }
    } else if (token) {
      user = await prisma.user.findUnique({ where: { passwordResetToken: token } });
    } else {
      return res.status(400).json({ error: 'Email, verification code, and new password are required' });
    }

    if (!user || !user.passwordResetExpiry || user.passwordResetExpiry < new Date()) {
      return res.status(400).json({ error: 'Verification code is invalid or expired' });
    }
    const passwordHash = await bcrypt.hash(password, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        passwordResetToken: null,
        passwordResetExpiry: null,
      },
    });
    res.json({ message: 'Password updated. You can now sign in.' });
  } catch (err) {
    console.error('Reset-password error:', err);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

function googleOAuthEnabled() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

// Google OAuth Routes
// GET /auth/google — initiate Google OAuth
router.get('/google', (req, res, next) => {
  if (!googleOAuthEnabled()) {
    return res.status(503).json({ error: 'Google sign-in is not configured on this server.' });
  }
  const flow = req.query.flow === 'signup' ? 'signup' : 'login';

  if (flow !== 'signup') {
    const base = resolveOAuthOrigin(req);
    return res.redirect(`${base}/#/auth?mode=signin&error=google_signup_only`);
  }

  const origin = resolveOAuthOrigin(req);
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    state: buildOAuthState(flow, origin),
  })(req, res, next);
});

// GET /auth/google/callback — Google OAuth callback
router.get('/google/callback', (req, res, next) => {
  if (!googleOAuthEnabled()) {
    return res.status(503).json({ error: 'Google sign-in is not configured on this server.' });
  }
  next();
},
  passport.authenticate('google', { 
    session: false,
    failureRedirect: `${getFrontendUrl().replace(/\/$/, '')}/#/auth?mode=signup&error=oauth_failed`
  }),
  async (req, res) => {
    try {
      // User is authenticated, create JWT token
      const user = req.user;
      
      const { flow, origin: frontendOrigin } = parseOAuthState(
        typeof req.query.state === 'string' ? req.query.state : 'login',
      );

      const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { passwordHash: true },
      });

      if (flow === 'signup' && dbUser?.passwordHash) {
        const emailQ = encodeURIComponent(user.email);
        return res.redirect(
          `${frontendOrigin}/#/auth?mode=signup&error=account_exists&email=${emailQ}`,
        );
      }

      await getOrCreateProfile(user.id);

      const token = signToken(user);

      const userData = {
        id: user.id,
        email: user.email,
        role: user.role,
        emailVerifiedAt: user.emailVerifiedAt,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        hasPassword: Boolean(dbUser?.passwordHash),
      };
      
      // Redirect to frontend with token and user data (using HashRouter format)
      const userDataEncoded = encodeURIComponent(JSON.stringify(userData));
      res.redirect(
        `${frontendOrigin}#/oauth/callback?token=${token}&user=${userDataEncoded}&flow=${encodeURIComponent(flow)}`,
      );
    } catch (err) {
      console.error('Google callback error:', err);
      res.redirect(`${getFrontendUrl().replace(/\/$/, '')}/#/auth?mode=signup&error=oauth_failed`);
    }
  }
);

module.exports = router;
