/**
 * WebSocket message envelope validation (Zod).
 */
const { z } = require('zod');

const authSchema = z.object({
  type: z.literal('auth'),
  token: z.string().min(10).max(8192),
});

const pingSchema = z.object({ type: z.literal('ping') });

const coachSendSchema = z.object({
  type: z.literal('coach.send'),
  text: z.string().min(1).max(4000),
  conversationId: z.string().optional(),
  threadId: z.string().max(128).optional(),
  locale: z.enum(['en', 'ar']).optional(),
  turnId: z.string().max(64).optional(),
});

const coachCancelSchema = z.object({
  type: z.literal('coach.cancel'),
  turnId: z.string().max(64).optional(),
});

const coachConfirmSchema = z.object({
  type: z.literal('coach.confirm'),
  actionId: z.string().uuid(),
  conversationId: z.string().optional(),
  locale: z.enum(['en', 'ar']).optional(),
  confirmationPhrase: z.string().max(64).optional(),
  password: z.string().max(128).optional(),
});

const coachCancelPendingSchema = z.object({
  type: z.literal('coach.cancelPending'),
  actionId: z.string().uuid(),
  conversationId: z.string().optional(),
  locale: z.enum(['en', 'ar']).optional(),
});

const coachDisambiguateSchema = z
  .object({
    type: z.literal('coach.disambiguate'),
    actionId: z.string().uuid(),
    conversationId: z.string().optional(),
    locale: z.enum(['en', 'ar']).optional(),
    foodItemId: z.string().uuid().optional(),
    webtebId: z.coerce.number().int().positive().optional(),
  })
  .refine((b) => Boolean(b.foodItemId || b.webtebId), {
    message: 'foodItemId or webtebId is required',
  });

const presencePingSchema = z.object({
  type: z.literal('presence.ping'),
});

const clientMessageSchema = z.discriminatedUnion('type', [
  authSchema,
  pingSchema,
  coachSendSchema,
  coachCancelSchema,
  coachConfirmSchema,
  coachCancelPendingSchema,
  coachDisambiguateSchema,
  presencePingSchema,
]);

function parseClientMessage(raw) {
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return { ok: false, error: 'Invalid JSON' };
  }
  const parsed = clientMessageSchema.safeParse(data);
  if (!parsed.success) {
    return { ok: false, error: 'Invalid message envelope' };
  }
  return { ok: true, message: parsed.data };
}

function serverEnvelope(type, payload = {}) {
  return { type, ...payload, ts: Date.now() };
}

module.exports = {
  parseClientMessage,
  serverEnvelope,
  authSchema,
  coachSendSchema,
};
