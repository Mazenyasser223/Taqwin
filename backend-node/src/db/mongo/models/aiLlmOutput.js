/**
 * Raw LLM request/response audit — debugging, cost tracking (Mongo warehouse).
 */
const { mongoose } = require('../client');
const { Schema } = mongoose;

const AiLlmOutputSchema = new Schema(
  {
    userId: { type: String, default: null, index: true },
    threadId: { type: String, default: null, index: true },
    provider: { type: String, required: true },
    model: { type: String, default: null },
    purpose: { type: String, default: 'chat' },
    promptHash: { type: String, default: null },
    systemChars: { type: Number, default: 0 },
    inputChars: { type: Number, default: 0 },
    outputChars: { type: Number, default: 0 },
    latencyMs: { type: Number, default: 0 },
    success: { type: Boolean, default: true },
    error: { type: String, default: null },
  },
  { timestamps: true, collection: 'ai_llm_outputs' }
);

AiLlmOutputSchema.index({ userId: 1, createdAt: -1 });
AiLlmOutputSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

module.exports =
  mongoose.models.AiLlmOutput || mongoose.model('AiLlmOutput', AiLlmOutputSchema);
