/**
 * Block E3 — AI agent trace (tool loop, intent, latency).
 */
const { mongoose } = require('../client');
const { Schema } = mongoose;

const AgentTraceSchema = new Schema(
  {
    userId: { type: String, required: true, index: true },
    threadId: { type: String, default: null, index: true },
    turnId: { type: String, default: null, index: true },
    intent: { type: String, default: 'general' },
    routing: { type: Schema.Types.Mixed, default: null },
    rag: { type: Schema.Types.Mixed, default: null },
    cag: { type: Schema.Types.Mixed, default: null },
    llm: { type: Schema.Types.Mixed, default: null },
    tools: { type: Schema.Types.Mixed, default: null },
    nodes: { type: [Schema.Types.Mixed], default: [] },
    toolCalls: { type: [Schema.Types.Mixed], default: [] },
    latencyMs: { type: Number, default: 0 },
    model: { type: String, default: null },
    locale: { type: String, default: 'ar' },
    success: { type: Boolean, default: true },
    error: { type: String, default: null },
  },
  { timestamps: true, collection: 'ai_agent_traces' }
);

AgentTraceSchema.index({ userId: 1, createdAt: -1 });
AgentTraceSchema.index({ threadId: 1, createdAt: -1 });
AgentTraceSchema.index({ turnId: 1 }, { sparse: true });
AgentTraceSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

module.exports =
  mongoose.models.AiAgentTrace || mongoose.model('AiAgentTrace', AgentTraceSchema);
