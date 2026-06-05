/**
 * Chat conversations + messages endpoints.
 *
 *   GET    /api/ai/conversations             list user's recent chats
 *   GET    /api/ai/conversations/:id/messages    history
 *   DELETE /api/ai/conversations/:id              archive (soft-delete)
 *
 * All routes require auth. The actual chat turn endpoint lives in routes/ai.js;
 * this file only exposes read + admin operations.
 */
const express = require('express');
const { authMiddleware } = require('../../middleware/auth');
const { isMongoConfigured, connectMongo } = require('../../db/mongo/client');
const { logger } = require('../../lib/logger');

const router = express.Router();
router.use(authMiddleware);

async function loadModels() {
  if (!isMongoConfigured()) return null;
  try {
    await connectMongo();
  } catch (err) {
    logger.warn({ err: err.message }, 'mongo connect failed for conversations');
    return null;
  }
  return {
    Conversation: require('../../db/mongo/models/conversation'),
    Message: require('../../db/mongo/models/message'),
  };
}

router.get('/', async (req, res, next) => {
  try {
    const models = await loadModels();
    if (!models) return res.json({ conversations: [] });
    const conversations = await models.Conversation.find({
      userId: req.user.id,
      archived: { $ne: true },
    })
      .sort({ lastMessageAt: -1 })
      .limit(20)
      .lean();
    res.json({ conversations });
  } catch (err) {
    next(err);
  }
});

router.get('/:id/messages', async (req, res, next) => {
  try {
    const models = await loadModels();
    if (!models) return res.json({ messages: [] });
    const conv = await models.Conversation.findOne({ _id: req.params.id, userId: req.user.id }).lean();
    if (!conv) return res.status(404).json({ error: 'Conversation not found' });
    const messages = await models.Message.find({ conversationId: conv._id })
      .sort({ createdAt: 1 })
      .limit(200)
      .lean();
    res.json({ conversation: conv, messages });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const models = await loadModels();
    if (!models) return res.status(404).end();
    const result = await models.Conversation.updateOne(
      { _id: req.params.id, userId: req.user.id },
      { $set: { archived: true } }
    );
    if (!result.matchedCount) return res.status(404).json({ error: 'Conversation not found' });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
