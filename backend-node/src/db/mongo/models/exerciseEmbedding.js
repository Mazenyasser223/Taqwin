/**
 * Cached embedding for a Postgres `exercises` row, keyed by `pgId`.
 */
const { mongoose } = require('../client');
const { Schema } = mongoose;

const ExerciseEmbeddingSchema = new Schema(
  {
    pgId: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    text: { type: String, required: true },
    embedding: { type: [Number], required: true },
    embeddingModel: { type: String, required: true },
    embeddingDim: { type: Number, required: true },
  },
  {
    timestamps: true,
    collection: 'exercise_embeddings',
  }
);

module.exports = mongoose.models.ExerciseEmbedding ||
  mongoose.model('ExerciseEmbedding', ExerciseEmbeddingSchema);
