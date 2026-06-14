/**
 * Global API rate limiters — community, marketplace, internal AI tools.
 */
const rateLimit = require('express-rate-limit');

const communityMax = Number(
  process.env.COMMUNITY_RATE_LIMIT_MAX || (process.env.NODE_ENV === 'production' ? 120 : 400)
);
const marketplaceMax = Number(
  process.env.MARKETPLACE_RATE_LIMIT_MAX || (process.env.NODE_ENV === 'production' ? 60 : 200)
);
const internalToolsMax = Number(
  process.env.INTERNAL_AI_TOOLS_RATE_LIMIT_MAX || (process.env.NODE_ENV === 'production' ? 120 : 400)
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

module.exports = { communityLimiter, marketplaceLimiter, internalAiToolsLimiter };
