/**
 * AI chat message — one document per turn.
 *
 * `meta` is free-form JSON: intent classification, off-topic flag, foodIds
 * cited from RAG, validator warnings, etc. Useful for analytics and debugging.
 */
const { mongoose } = require('../client');
const { Schema } = mongoose;

const MessageSchema = new Schema(
  {
    conversationId: { type: Schema.Types.ObjectId, required: true, index: true },
    userId: { type: String, required: true, index: true },
    role: { type: String, enum: ['user', 'assistant', 'system'], required: true },
    content: { type: String, required: true },
    meta: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true, collection: 'ai_messages' }
);

MessageSchema.index({ conversationId: 1, createdAt: 1 });

module.exports = mongoose.models.AiMessage || mongoose.model('AiMessage', MessageSchema);
