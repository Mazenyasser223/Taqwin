/**
 * Taqwin — Auth routes: register, login, Google OAuth, email verification.
 * JWT returned on success; no password in response.
 */
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { prisma } = require('../db');
const { authMiddleware } = require('../middleware/auth');
const passport = require('../config/passport');
const { generateVerificationCode, sendVerificationEmail, sendWelcomeEmail } = require('../services/emailService');

const router = express.Router();

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
    
    // Generate verification code
    const verificationCode = generateVerificationCode();
    const verificationCodeExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
    
    const user = await prisma.user.create({
      data: {
        email: emailLower,
        passwordHash,
        role: userRole,
        verificationCode,
        verificationCodeExpiry,
      },
    });
    await prisma.profile.create({
      data: { userId: user.id },
    });

    // Send verification email
    try {
      await sendVerificationEmail(emailLower, verificationCode);
    } catch (emailError) {
      console.error('Failed to send verification email:', emailError);
      // Continue registration even if email fails
    }

    // Don't return token yet - user needs to verify email first
    res.status(201).json({
      message: 'Registration successful! Please check your email for verification code.',
      userId: user.id,
      email: user.email,
      requiresVerification: true,
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

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Check if email is verified
    if (!user.emailVerifiedAt) {
      return res.status(403).json({ 
        error: 'Please verify your email before logging in',
        requiresVerification: true,
        email: user.email,
      });
    }

    const token = signToken(user);
    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
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
        createdAt: true,
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

// Google OAuth Routes
// GET /auth/google — initiate Google OAuth
router.get('/google', (req, res, next) => {
  // Store the selected role in session/query if provided
  const role = req.query.role || 'athlete';
  
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    state: role, // Pass role through state parameter
  })(req, res, next);
});

// GET /auth/google/callback — Google OAuth callback
router.get('/google/callback', 
  passport.authenticate('google', { 
    session: false,
    failureRedirect: `${process.env.FRONTEND_URL || 'http://localhost:3000'}#/auth?error=oauth_failed`
  }),
  async (req, res) => {
    try {
      // User is authenticated, create JWT token
      const user = req.user;
      
      // Update role if provided in state
      const role = req.query.state;
      if (role && ['athlete', 'trainer', 'gym'].includes(role)) {
        await prisma.user.update({
          where: { id: user.id },
          data: { role },
        });
        user.role = role;
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
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      const userDataEncoded = encodeURIComponent(JSON.stringify(userData));
      res.redirect(`${frontendUrl}#/oauth/callback?token=${token}&user=${userDataEncoded}`);
    } catch (err) {
      console.error('Google callback error:', err);
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      res.redirect(`${frontendUrl}#/auth?error=oauth_failed`);
    }
  }
);

module.exports = router;
