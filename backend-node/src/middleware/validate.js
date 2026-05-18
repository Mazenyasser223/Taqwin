/**
 * Generic Zod validation middleware factory.
 *
 *   const schema = { body: z.object({...}), query: z.object({...}), params: z.object({...}) };
 *   router.post('/foo', validate(schema), handler)
 *
 * On success: parsed values overwrite req.body / req.query / req.params.
 * On failure: 400 with a flat list of issues.
 */
const { ZodError } = require('zod');

function validate(schema) {
  return (req, res, next) => {
    try {
      if (schema.body) req.body = schema.body.parse(req.body ?? {});
      if (schema.query) req.query = schema.query.parse(req.query ?? {});
      if (schema.params) req.params = schema.params.parse(req.params ?? {});
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

module.exports = { validate };
