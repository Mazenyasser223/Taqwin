/**
 * Global API rate limiters — community, marketplace, internal AI tools, shop funnel, payments.
 */
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');

const communityMax = Number(
  process.env.COMMUNITY_RATE_LIMIT_MAX || (process.env.NODE_ENV === 'production' ? 120 : 400)
);
const marketplaceMax = Number(
  process.env.MARKETPLACE_RATE_LIMIT_MAX || (process.env.NODE_ENV === 'production' ? 60 : 200)
);
const internalToolsMax = Number(
  process.env.INTERNAL_AI_TOOLS_RATE_LIMIT_MAX || (process.env.NODE_ENV === 'production' ? 120 : 400)
);
const funnelMax = Number(
  process.env.FUNNEL_RATE_LIMIT_MAX || (process.env.NODE_ENV === 'production' ? 40 : 200)
);
const paymentsCreateMax = Number(
  process.env.PAYMENTS_CREATE_RATE_LIMIT_MAX || (process.env.NODE_ENV === 'production' ? 8 : 30)
);

const communityLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: Number.isFinite(communityMax) && communityMax > 0 ? communityMax : 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Community rate limit reached. Try again in a minute.' },
});

const marketplaceLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: Number.isFinite(marketplaceMax) && marketplaceMax > 0 ? marketplaceMax : 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Marketplace rate limit reached. Try again in a minute.' },
});

const internalAiToolsLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: Number.isFinite(internalToolsMax) && internalToolsMax > 0 ? internalToolsMax : 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Internal AI tools rate limit reached. Try again in a minute.' },
});

/** Anonymous funnel analytics — per IP */
const funnelEventsLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: Number.isFinite(funnelMax) && funnelMax > 0 ? funnelMax : 40,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => ipKeyGenerator(req.ip),
  message: { error: 'Too many analytics events. Try again in a minute.' },
});

/** Checkout session creation — per user when authenticated, else IP */
const paymentsCreateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: Number.isFinite(paymentsCreateMax) && paymentsCreateMax > 0 ? paymentsCreateMax : 8,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id || ipKeyGenerator(req.ip),
  message: { error: 'Too many checkout attempts. Try again in a minute.' },
});

module.exports = {
  communityLimiter,
  marketplaceLimiter,
  internalAiToolsLimiter,
  funnelEventsLimiter,
  paymentsCreateLimiter,
};
