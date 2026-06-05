/**
 * Support routes — help center contact form
 *
 *   POST /api/support/tickets
 *   GET  /api/support/tickets
 */
const express = require('express');
const { z } = require('zod');
const { prisma } = require('../db');
const { authMiddleware } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { sendSupportTicketEmail } = require('../services/emailService');
const { emitNotification } = require('../lib/notifications');

const router = express.Router();
router.use(authMiddleware);

const CATEGORIES = ['account', 'booking', 'membership', 'payments', 'technical', 'other'];

const createTicketSchema = z.object({
  body: z.object({
    category: z.enum(CATEGORIES).optional().default('other'),
    subject: z.string().trim().min(2).max(120),
    description: z.string().trim().min(10).max(4000),
    imageUrl: z.string().url().max(2048).optional().nullable(),
  }),
});

router.get('/tickets', async (req, res, next) => {
  try {
    const tickets = await prisma.supportTicket.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      take: 30,
      select: {
        id: true,
        category: true,
        subject: true,
        description: true,
        imageUrl: true,
        status: true,
        createdAt: true,
      },
    });
    res.json(tickets);
  } catch (err) {
    next(err);
  }
});

router.post('/tickets', validate(createTicketSchema), async (req, res, next) => {
  try {
    const { category, subject, description, imageUrl } = req.body;

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { email: true, profile: { select: { displayName: true } } },
    });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const ticket = await prisma.supportTicket.create({
      data: {
        userId: req.user.id,
        category: category || 'other',
        subject,
        description,
        imageUrl: imageUrl || null,
      },
    });

    await emitNotification({
      userId: req.user.id,
      type: 'support.received',
      title: 'Support request received',
      message: `We received your message: "${subject}". Our team will respond soon.`,
      link: '/support',
    });

    try {
      await sendSupportTicketEmail({
        userEmail: user.email,
        userName: user.profile?.displayName || user.email,
        category,
        subject,
        description,
        imageUrl,
        ticketId: ticket.id,
      });
    } catch (emailErr) {
      console.error('Support ticket email failed:', emailErr);
    }

    res.status(201).json(ticket);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
