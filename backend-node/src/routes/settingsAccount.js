/**
 * Account settings — export, delete, email change, 2FA
 */
const express = require('express');
const bcrypt = require('bcryptjs');
const { z } = require('zod');
const { prisma } = require('../db');
const { authMiddleware } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { accountSettingsLimiter } = require('../middleware/rateLimitAuth');
const {
  generateVerificationCode,
  sendEmailChangeCode,
  isEmailConfigured,
} = require('../services/emailService');
const {
  generateTwoFactorSecret,
  verifyTwoFactorToken,
  getOtpAuthUrl,
  qrDataUrl,
} = require('../lib/twoFactor');
const { normalizePhoneE164 } = require('../lib/phoneNormalize');
const { prepareAccountDeletion, recordAccountAudit } = require('../lib/accountSecurity');
const { gatherAccountExportData } = require('../lib/accountDataExport');
const { buildAccountExportPdf } = require('../lib/accountDataExportPdf');

const router = express.Router();
router.use(authMiddleware);
router.use(accountSettingsLimiter);

const deleteAccountSchema = {
  body: z.object({
    currentPassword: z.string().optional(),
    confirmDelete: z.literal('DELETE').optional(),
    token: z.string().min(6).max(8).optional(),
  }),
};

const emailChangeRequestSchema = {
  body: z.object({
    newEmail: z.string().email(),
    currentPassword: z.string().min(1),
  }),
};

const emailConfirmSchema = {
  body: z.object({ code: z.string().min(4).max(10) }),
};

const tokenBody = {
  body: z.object({ token: z.string().min(6).max(8) }),
};

const disable2faSchema = {
  body: z.object({
    token: z.string().min(6).max(8),
    currentPassword: z.string().min(1),
  }),
};

const phoneSchema = {
  body: z.object({
    phone: z.string().min(8).max(20),
  }),
};

router.get('/export', async (req, res, next) => {
  try {
    const userId = req.user.id;
    const payload = await gatherAccountExportData(userId, req.user.role);
    const pdf = await buildAccountExportPdf(payload);

    await recordAccountAudit({
      userId,
      email: payload.user?.email,
      action: 'account.export',
      metadata: {
        format: 'pdf',
        notifications: payload.notifications.length,
        workoutLogs: payload.workoutLogs.length,
      },
      req,
    });

    const stamp = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="taqwin-export-${stamp}.pdf"`);
    res.send(pdf);
  } catch (err) {
    next(err);
  }
});

router.delete('/', validate(deleteAccountSchema), async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (user.twoFactorEnabled) {
      if (!req.body.token || !user.twoFactorSecret) {
        return res.status(400).json({ error: 'Authenticator code is required' });
      }
      if (!verifyTwoFactorToken(user.twoFactorSecret, req.body.token)) {
        return res.status(401).json({ error: 'Invalid authenticator code' });
      }
    }

    if (user.passwordHash) {
      if (!req.body.currentPassword) {
        return res.status(400).json({ error: 'Current password is required' });
      }
      const valid = await bcrypt.compare(req.body.currentPassword, user.passwordHash);
      if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });
    } else if (req.body.confirmDelete !== 'DELETE') {
      return res.status(400).json({ error: 'Type DELETE to confirm account removal' });
    }

    await prepareAccountDeletion(user.id, req);
    await prisma.user.delete({ where: { id: user.id } });

    res.json({ message: 'Account deleted successfully' });
  } catch (err) {
    next(err);
  }
});

router.post('/email/request', validate(emailChangeRequestSchema), async (req, res, next) => {
  try {
    const newEmail = req.body.newEmail.trim().toLowerCase();
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user?.passwordHash) {
      return res.status(400).json({ error: 'Email change is not available for Google-only accounts.' });
    }

    const valid = await bcrypt.compare(req.body.currentPassword, user.passwordHash);
    if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });

    const taken = await prisma.user.findUnique({ where: { email: newEmail } });
    if (taken && taken.id !== user.id) {
      return res.status(409).json({ error: 'Email is already in use' });
    }

    const code = generateVerificationCode();
    const expiry = new Date(Date.now() + 15 * 60 * 1000);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        pendingEmail: newEmail,
        emailChangeCode: code,
        emailChangeCodeExpiry: expiry,
      },
    });

    if (!isEmailConfigured()) {
      if (process.env.NODE_ENV === 'development') {
        console.info(`[dev] Email change code for ${newEmail}: ${code}`);
      }
      return res.status(503).json({
        error:
          'Email service is not configured. Set GMAIL_USER and GMAIL_APP_PASSWORD in backend-node/.env',
        ...(process.env.NODE_ENV === 'development' ? { devCode: code } : {}),
      });
    }

    try {
      await sendEmailChangeCode(newEmail, code);
    } catch (emailErr) {
      console.error('Email change code send failed:', emailErr);
      if (process.env.NODE_ENV === 'development') {
        console.info(`[dev] Email change code for ${newEmail}: ${code}`);
      }
      return res.status(503).json({
        error: 'Failed to send verification email. Check Gmail app password settings.',
        ...(process.env.NODE_ENV === 'development' ? { devCode: code } : {}),
      });
    }

    res.json({ message: 'Verification code sent to your new email address.' });
  } catch (err) {
    next(err);
  }
});

router.post('/email/confirm', validate(emailConfirmSchema), async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user?.pendingEmail || !user.emailChangeCode) {
      return res.status(400).json({ error: 'No pending email change request' });
    }
    if (!user.emailChangeCodeExpiry || user.emailChangeCodeExpiry < new Date()) {
      return res.status(400).json({ error: 'Verification code expired' });
    }
    if (user.emailChangeCode !== req.body.code.trim()) {
      return res.status(400).json({ error: 'Invalid verification code' });
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        email: user.pendingEmail,
        pendingEmail: null,
        emailChangeCode: null,
        emailChangeCodeExpiry: null,
      },
      select: { id: true, email: true, role: true, twoFactorEnabled: true },
    });

    await recordAccountAudit({
      userId: user.id,
      email: updated.email,
      action: 'account.email_changed',
      req,
    });

    res.json({ message: 'Email updated successfully', user: updated });
  } catch (err) {
    next(err);
  }
});

router.get('/2fa/status', async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { twoFactorEnabled: true },
    });
    res.json({ enabled: Boolean(user?.twoFactorEnabled) });
  } catch (err) {
    next(err);
  }
});

router.post('/2fa/setup', async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { email: true, twoFactorEnabled: true },
    });
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.twoFactorEnabled) {
      return res.status(400).json({ error: 'Two-factor authentication is already enabled' });
    }

    const secret = generateTwoFactorSecret();
    await prisma.user.update({
      where: { id: req.user.id },
      data: { twoFactorSecret: secret, twoFactorEnabled: false },
    });

    const otpauthUrl = getOtpAuthUrl(user.email, secret);
    const qrCodeDataUrl = await qrDataUrl(otpauthUrl);

    res.json({
      secret,
      otpauthUrl,
      qrCodeDataUrl,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/2fa/enable', validate(tokenBody), async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { twoFactorSecret: true, twoFactorEnabled: true },
    });
    if (!user?.twoFactorSecret) {
      return res.status(400).json({ error: 'Run 2FA setup first' });
    }
    if (!verifyTwoFactorToken(user.twoFactorSecret, req.body.token)) {
      return res.status(400).json({ error: 'Invalid authenticator code' });
    }

    await prisma.user.update({
      where: { id: req.user.id },
      data: { twoFactorEnabled: true },
    });

    res.json({ message: 'Two-factor authentication enabled', enabled: true });
  } catch (err) {
    next(err);
  }
});

router.post('/2fa/disable', validate(disable2faSchema), async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user?.passwordHash) {
      return res.status(400).json({ error: 'Not available for this account type' });
    }
    const validPw = await bcrypt.compare(req.body.currentPassword, user.passwordHash);
    if (!validPw) return res.status(401).json({ error: 'Current password is incorrect' });
    if (!user.twoFactorSecret || !verifyTwoFactorToken(user.twoFactorSecret, req.body.token)) {
      return res.status(400).json({ error: 'Invalid authenticator code' });
    }

    await prisma.user.update({
      where: { id: req.user.id },
      data: {
        twoFactorEnabled: false,
        twoFactorSecret: null,
      },
    });

    res.json({ message: 'Two-factor authentication disabled', enabled: false });
  } catch (err) {
    next(err);
  }
});

router.patch('/phone', validate(phoneSchema), async (req, res, next) => {
  try {
    const phone = normalizePhoneE164(req.body.phone);
    if (!phone) {
      return res.status(400).json({ error: 'Valid phone number is required (e.g. 01012345678)' });
    }
    const taken = await prisma.user.findFirst({
      where: { phone, id: { not: req.user.id } },
    });
    if (taken) {
      return res.status(409).json({ error: 'This phone number is already linked to another account' });
    }
    const updated = await prisma.user.update({
      where: { id: req.user.id },
      data: { phone, phoneVerifiedAt: new Date() },
      select: { phone: true, phoneVerifiedAt: true },
    });
    res.json({ message: 'Phone number saved', phone: updated.phone });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
