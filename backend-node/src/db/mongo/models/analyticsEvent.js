/**
 * Flexible product analytics events (Mongo warehouse).
 */
const { mongoose } = require('../client');
const { Schema } = mongoose;

const AnalyticsEventSchema = new Schema(
  {
    event: { type: String, required: true, index: true },
    userId: { type: String, default: null, index: true },
    properties: { type: Schema.Types.Mixed, default: {} },
    timestamp: { type: Date, default: Date.now },
  },
  { collection: 'analytics_events' }
);

AnalyticsEventSchema.index({ event: 1, timestamp: -1 });
AnalyticsEventSchema.index({ timestamp: 1 }, { expireAfterSeconds: 180 * 24 * 60 * 60 });

module.exports =
  mongoose.models.AnalyticsEvent ||
  mongoose.model('AnalyticsEvent', AnalyticsEventSchema);
