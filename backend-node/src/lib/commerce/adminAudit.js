/**
 * Admin shop audit log — who changed what.
 */
const { prisma } = require('../../db');
const { logger } = require('../logger');

async function logAdminAction({ adminId, action, entity, entityId, metadata }) {
  if (!adminId || !action || !entity) return null;
  try {
    return await prisma.adminAuditLog.create({
      data: {
        adminId,
        action: String(action).slice(0, 64),
        entity: String(entity).slice(0, 64),
        entityId: entityId ? String(entityId) : null,
        metadata: metadata && typeof metadata === 'object' ? metadata : undefined,
      },
    });
  } catch (err) {
    logger.warn({ err, adminId, action, entity }, 'Admin audit log failed');
    return null;
  }
}

module.exports = { logAdminAction };
