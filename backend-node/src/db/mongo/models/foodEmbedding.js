/**
 * Cached embedding for a Postgres food row.
 *
 * Postgres remains the source of truth; this collection only holds the
 * vector and the text we embedded so we can rerank candidates without
 * re-embedding. Looked up via the Postgres ID stored in `pgId`.
 */
const { mongoose } = require('../client');
const { Schema } = mongoose;

const FoodEmbeddingSchema = new Schema(
  {
    source: { type: String, enum: ['foodItem', 'webteb'], required: true, index: true },
    pgId: { type: String, required: true }, // FoodItem.id (UUID) or WebtebFood.id (UUID)
    webtebId: { type: Number, default: null, index: true },
    name: { type: String, required: true },
    text: { type: String, required: true }, // exact string that was embedded
    embedding: { type: [Number], required: true },
    embeddingModel: { type: String, required: true },
    embeddingDim: { type: Number, required: true },
  },
  {
    timestamps: true,
    collection: 'food_embeddings',
  }
);

FoodEmbeddingSchema.index({ source: 1, pgId: 1 }, { unique: true });

module.exports = mongoose.models.FoodEmbedding ||
  mongoose.model('FoodEmbedding', FoodEmbeddingSchema);
