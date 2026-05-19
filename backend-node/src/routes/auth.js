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
const { isEmailConfigured } = require('../services/emailService');

const router = express.Router();
router.use(authLimiter);

/** Set REQUIRE_EMAIL_VERIFICATION=true in .env to enforce email codes after signup. */
const requireEmailVerification = process.env.REQUIRE_EMAIL_VERIFICATION === 'true';

function signToken(user) {
  const secret = process.env.JWT_SECRET;
  const expiresIn = process.env.JWT_EXPIRES_IN || '7d';
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role },
    secret,
    { expiresIn }
  );
}

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
      return res.status(409).json({ error: 'Email already registered' });
    }

    const allowedRoles = ['athlete', 'trainer', 'gym'];
    const userRole = role && allowedRoles.includes(role) ? role : 'athlete';

    const passwordHash = await bcrypt.hash(password, 10);

    const verificationCode = requireEmailVerification ? generateVerificationCode() : null;
    const verificationCodeExpiry = requireEmailVerification
      ? new Date(Date.now() + 15 * 60 * 1000)
      : null;

    const user = await prisma.user.create({
      data: {
        email: emailLower,
        passwordHash,
        role: userRole,
        verificationCode,
        verificationCodeExpiry,
        ...(requireEmailVerification ? {} : { emailVerifiedAt: new Date() }),
      },
    });
    await prisma.profile.create({
      data: { userId: user.id },
    });
    await prisma.userSettings.create({
      data: { userId: user.id },
    });

    if (requireEmailVerification) {
      try {
        await sendVerificationEmail(emailLower, verificationCode);
      } catch (emailError) {
        console.error('Failed to send verification email:', emailError);
      }
      return res.status(201).json({
        message: 'Registration successful! Please check your email for verification code.',
        userId: user.id,
        email: user.email,
        requiresVerification: true,
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
    res.status(500).json({ error: 'Registration failed' });
  }
});

// POST /auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
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
        error: 'This account uses Google sign-in. Please continue with Google.',
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
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
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
    
    // Send welcome email
    try {
      const profile = await prisma.profile.findUnique({ where: { userId: user.id } });
      await sendWelcomeEmail(emailLower, profile?.displayName || 'User');
    } catch (emailError) {
      console.error('Failed to send welcome email:', emailError);
    }
    
    // Return token
    const token = signToken(user);
    res.json({
      message: 'Email verified successfully!',
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        emailVerifiedAt: new Date(),
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
    
    // Send email
    await sendVerificationEmail(emailLower, verificationCode);
    
    res.json({
      message: 'Verification code sent! Please check your email.',
    });
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
      },
    });
    if (!user) return res.status(404).json({ error: 'User not found' });
    const { passwordHash, ...safe } = user;
    res.json({
      ...safe,
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

// POST /auth/forgot-password — email a 6-digit reset code
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });
    const emailLower = email.trim().toLowerCase();
    const user = await prisma.user.findUnique({ where: { email: emailLower } });
    const isDev = process.env.NODE_ENV !== 'production';
    const genericMsg = 'If that email exists, a verification code was sent.';

    if (!user) {
      return res.json({ message: genericMsg });
    }

    if (!user.passwordHash) {
      return res.status(400).json({
        error: 'This account uses Google sign-in. Use “Continue sign in with Google” on the login page.',
        code: 'GOOGLE_ACCOUNT',
      });
    }

    const code = generateVerificationCode();
    const expiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
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
        });
      }
      return res.status(503).json({
        error: 'Email service is not configured. Contact support or try again later.',
      });
    }

    try {
      await sendPasswordResetCodeEmail(emailLower, code);
      return res.json({ message: genericMsg, sent: true });
    } catch (err) {
      console.error('Failed to send password reset email:', err);
      if (isDev) {
        console.info(`[dev] Password reset code for ${emailLower}: ${code}`);
        return res.json({
          message: 'Could not send email (check Gmail settings). Use this code instead (development only).',
          devResetCode: code,
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
    const { email, code, password, token } = req.body;
    if (!password) {
      return res.status(400).json({ error: 'New password is required' });
    }
    const pwCheck = validatePassword(password);
    if (!pwCheck.valid) {
      return res.status(400).json({ error: pwCheck.error });
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
  const role = ['athlete', 'trainer', 'gym'].includes(req.query.role) ? req.query.role : 'athlete';
  const flow = req.query.flow === 'signup' ? 'signup' : 'login';

  passport.authenticate('google', {
    scope: ['profile', 'email'],
    state: `${role}|${flow}`,
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
    failureRedirect: `${getFrontendUrl()}#/auth?error=oauth_failed`
  }),
  async (req, res) => {
    try {
      // User is authenticated, create JWT token
      const user = req.user;
      
      const stateRaw = typeof req.query.state === 'string' ? req.query.state : 'athlete|login';
      const [rolePart, flowPart] = stateRaw.includes('|') ? stateRaw.split('|') : [stateRaw, 'login'];
      const role = ['athlete', 'trainer', 'gym'].includes(rolePart) ? rolePart : 'athlete';
      const flow = flowPart === 'signup' ? 'signup' : 'login';

      const updated = await prisma.user.update({
        where: { id: user.id },
        data: { role },
      });
      user.role = updated.role;

      const token = signToken(user);
      
      // Prepare user data to pass to frontend
      const userData = {
        id: user.id,
        email: user.email,
        role: user.role,
        emailVerifiedAt: user.emailVerifiedAt,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      };
      
      // Redirect to frontend with token and user data (using HashRouter format)
      const frontendUrl = getFrontendUrl();
      const userDataEncoded = encodeURIComponent(JSON.stringify(userData));
      res.redirect(
        `${frontendUrl}#/oauth/callback?token=${token}&user=${userDataEncoded}&flow=${encodeURIComponent(flow)}`,
      );
    } catch (err) {
      console.error('Google callback error:', err);
      res.redirect(`${getFrontendUrl()}#/auth?error=oauth_failed`);
    }
  }
);

module.exports = router;
