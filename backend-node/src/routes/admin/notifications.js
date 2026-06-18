/**
 * Platform admin — notification ops health (JWT + admin role).
 *
 *   GET /api/admin/notifications/health
 */
const express = require('express');
const { authMiddleware, requireAdmin } = require('../../middleware/auth');
const { getNotificationHealth } = require('../../lib/notifications/notificationHealth');

const router = express.Router();
router.use(authMiddleware, requireAdmin);

router.get('/health', async (req, res, next) => {
  try {
    res.json(await getNotificationHealth());
  } catch (err) {
    next(err);
  }
});

module.exports = router;
