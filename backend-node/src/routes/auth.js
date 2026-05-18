/**
 * Taqwin — Auth routes: register, login, Google OAuth, email verification.
 * JWT returned on success; no password in response.
 */
const express = require('express');
const crypto = require('crypto');
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
  sendPasswordResetEmail,
} = require('../services/emailService');

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
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
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
      user: fullUser,
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
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
      },
    });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    console.error('Me error:', err);
    res.status(500).json({ error: 'Failed to load user' });
  }
});

// POST /auth/forgot-password — issue a reset link if the email exists
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });
    const emailLower = email.trim().toLowerCase();
    const user = await prisma.user.findUnique({ where: { email: emailLower } });
    // Always 200 to avoid leaking which emails exist
    if (user && user.passwordHash) {
      const token = crypto.randomBytes(32).toString('hex');
      const expiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
      await prisma.user.update({
        where: { id: user.id },
        data: { passwordResetToken: token, passwordResetExpiry: expiry },
      });
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      const resetUrl = `${frontendUrl}#/auth?reset=${token}`;
      try {
        await sendPasswordResetEmail(emailLower, resetUrl);
      } catch (err) {
        console.error('Failed to send password reset email:', err);
      }
    }
    res.json({ message: 'If that email exists, a password reset link was sent.' });
  } catch (err) {
    console.error('Forgot-password error:', err);
    res.status(500).json({ error: 'Failed to process request' });
  }
});

// POST /auth/reset-password — consume token and set a new password
router.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) {
      return res.status(400).json({ error: 'Token and new password are required' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }
    const user = await prisma.user.findUnique({ where: { passwordResetToken: token } });
    if (!user || !user.passwordResetExpiry || user.passwordResetExpiry < new Date()) {
      return res.status(400).json({ error: 'Reset token is invalid or expired' });
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
  // Store the selected role in session/query if provided
  const role = req.query.role || 'athlete';

  passport.authenticate('google', {
    scope: ['profile', 'email'],
    state: role, // Pass role through state parameter
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
    failureRedirect: `${process.env.FRONTEND_URL || 'http://localhost:5173'}#/auth?error=oauth_failed`
  }),
  async (req, res) => {
    try {
      // User is authenticated, create JWT token
      const user = req.user;
      
      // Role chosen on frontend is echoed back in OAuth `state`
      const role = req.query.state;
      if (role && ['athlete', 'trainer', 'gym'].includes(role)) {
        const updated = await prisma.user.update({
          where: { id: user.id },
          data: { role },
        });
        user.role = updated.role;
      }

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
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      const userDataEncoded = encodeURIComponent(JSON.stringify(userData));
      res.redirect(`${frontendUrl}#/oauth/callback?token=${token}&user=${userDataEncoded}`);
    } catch (err) {
      console.error('Google callback error:', err);
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      res.redirect(`${frontendUrl}#/auth?error=oauth_failed`);
    }
  }
);

module.exports = router;
