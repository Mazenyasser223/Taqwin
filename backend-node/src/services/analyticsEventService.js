/**
 * Fire-and-forget product analytics events → MongoDB analytics_events.
 */
const { isMongoConfigured } = require('../db/mongo/client');
const { logger } = require('../lib/logger');

async function trackAnalyticsEvent({ event, userId = null, properties = {} }) {
  if (!event || !isMongoConfigured()) return null;
  try {
    const AnalyticsEvent = require('../db/mongo/models/analyticsEvent');
    const row = await AnalyticsEvent.create({
      event: String(event),
      userId: userId || null,
      properties: properties && typeof properties === 'object' ? properties : {},
      timestamp: new Date(),
    });
    return row._id?.toString() || null;
  } catch (err) {
    logger.debug({ err: err.message, event }, 'analytics event write failed');
    return null;
  }
}

module.exports = { trackAnalyticsEvent };
