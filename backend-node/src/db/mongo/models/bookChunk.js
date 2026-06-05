/**
 * Coaching book chunk — RAG knowledge base.
 *
 * Each document is a single ingested chunk (one heading-bounded section)
 * from a markdown file under `backend-node/data/coaching-book/`. Chunks are
 * surfaced to the LLM when their `tags` overlap with the user's
 * onboardingData flags or the chat message keywords.
 *
 * `embedding` is filled in Phase 8 (Atlas Vector Search). Until then, the
 * retriever runs in tag/keyword mode only.
 */
const { mongoose } = require('../client');
const { Schema } = mongoose;

const BookChunkSchema = new Schema(
  {
    sourceFile: { type: String, required: true, index: true },
    topic: { type: String, required: true, index: true },
    lang: { type: String, default: 'en' },
    tags: { type: [String], default: [] },
    text: { type: String, required: true },
    tokens: { type: Number, default: 0 },
    embedding: { type: [Number], default: undefined },
    embeddingModel: { type: String, default: null },
  },
  {
    timestamps: true,
    collection: 'book_chunks',
  }
);

BookChunkSchema.index({ tags: 1 });
BookChunkSchema.index({ topic: 'text', text: 'text' });

const BookChunkModel =
  mongoose.models.BookChunk || mongoose.model('BookChunk', BookChunkSchema);

module.exports = BookChunkModel;
module.exports.BookChunkSchema = BookChunkSchema;
