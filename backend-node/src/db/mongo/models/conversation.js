/**
 * AI chat conversation envelope.
 *
 * One document per coach conversation; messages live in the separate
 * `messages` collection (see `message.js`) keyed by `conversationId`.
 * `lastMessageAt` is updated on every turn so we can list "recent chats"
 * efficiently.
 */
const { mongoose } = require('../client');
const { Schema } = mongoose;

const ConversationSchema = new Schema(
  {
    userId: { type: String, required: true, index: true },
    title: { type: String, default: '' },
    locale: { type: String, default: 'ar' },
    lastMessageAt: { type: Date, default: () => new Date(), index: true },
    archived: { type: Boolean, default: false, index: true },
  },
  { timestamps: true, collection: 'ai_conversations' }
);

ConversationSchema.index({ userId: 1, lastMessageAt: -1 });

module.exports =
  mongoose.models.AiConversation || mongoose.model('AiConversation', ConversationSchema);
