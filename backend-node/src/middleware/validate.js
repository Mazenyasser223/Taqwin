/**
 * Generic Zod validation middleware factory.
 *
 *   const schema = { body: z.object({...}), query: z.object({...}), params: z.object({...}) };
 *   router.post('/foo', validate(schema), handler)
 *
 * Also accepts z.object({ body, query, params }) for backward compatibility.
 */
const { ZodError } = require('zod');

function normalizeSchema(schema) {
  if (!schema) return schema;
  if (schema.body || schema.query || schema.params) return schema;
  if (typeof schema.safeParse === 'function' && schema.shape) {
    const { body, query, params } = schema.shape;
    if (body || query || params) {
      return { body, query, params };
    }
  }
  return schema;
}

function validate(schema) {
  const normalized = normalizeSchema(schema);
  return (req, res, next) => {
    try {
      if (normalized.body) req.body = normalized.body.parse(req.body ?? {});
      if (normalized.query) req.query = normalized.query.parse(req.query ?? {});
      if (normalized.params) {
        const parsed = normalized.params.parse(req.params ?? {});
        Object.assign(req.params, parsed);
      }
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        return res.status(400).json({
          error: 'Validation failed',
          details: err.issues.map((i) => ({
            path: i.path.join('.'),
            message: i.message,
          })),
        });
      }
      next(err);
    }
  };
}

module.exports = { validate, normalizeSchema };
