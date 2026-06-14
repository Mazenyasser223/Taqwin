const { z } = require('zod');

const REACTION_EMOJIS = ['like', 'love', 'haha', 'wow', 'sad', 'angry'];

function emptyReactionCounts() {
  return Object.fromEntries(REACTION_EMOJIS.map((e) => [e, 0]));
}

const AUTHOR_PROFILE_SELECT = {
  athleteProfile: {
    select: { displayName: true, communityAvatarUrl: true, avatarUrl: true, coverUrl: true },
  },
  gymProfile: {
    select: { displayName: true, communityAvatarUrl: true, avatarUrl: true, coverUrl: true, bio: true, businessName: true },
  },
};

const AUTHOR_SELECT = {
  id: true,
  email: true,
  role: true,
  lastSeenAt: true,
  athleteProfile: { select: { displayName: true, communityAvatarUrl: true, coverUrl: true } },
  gymProfile: { select: { displayName: true, communityAvatarUrl: true, coverUrl: true, bio: true, businessName: true } },
};

/** Lighter author shape for feed cards (no cover/bio). */
const FEED_AUTHOR_PROFILE_SELECT = {
  athleteProfile: {
    select: { displayName: true, communityAvatarUrl: true, avatarUrl: true },
  },
  gymProfile: {
    select: { displayName: true, communityAvatarUrl: true, avatarUrl: true, businessName: true },
  },
};

const FEED_AUTHOR_SELECT = {
  id: true,
  email: true,
  role: true,
  lastSeenAt: true,
  athleteProfile: { select: { displayName: true, communityAvatarUrl: true } },
  gymProfile: { select: { displayName: true, communityAvatarUrl: true, businessName: true } },
};

const POST_INCLUDE = {
  author: { select: AUTHOR_SELECT },
  group: { select: { id: true, name: true, imageUrl: true } },
  media: { orderBy: { sortOrder: 'asc' } },
  tags: { include: { taggedUser: { select: AUTHOR_SELECT } } },
  gymMentions: { include: { gym: { select: { id: true, name: true, imageUrl: true, ownerId: true } } } },
  poll: { include: { options: { orderBy: { sortOrder: 'asc' } } } },
  _count: { select: { comments: true, likes: true, reposts: true } },
};

/** Feed list — smaller author payload; same mention data for UI. */
const FEED_POST_INCLUDE = {
  author: { select: FEED_AUTHOR_SELECT },
  group: { select: { id: true, name: true, imageUrl: true } },
  media: { orderBy: { sortOrder: 'asc' } },
  tags: { include: { taggedUser: { select: FEED_AUTHOR_SELECT } } },
  gymMentions: { include: { gym: { select: { id: true, name: true, imageUrl: true, ownerId: true } } } },
  poll: { include: { options: { orderBy: { sortOrder: 'asc' } } } },
  _count: { select: { comments: true, likes: true, reposts: true } },
};

const FEED_PAGE_SIZE = 25;

const mediaItemSchema = z.object({
  url: z.string().min(1).max(2048),
  mediaType: z.enum(['image', 'video']),
});

const AUDIENCE_VALUES = ['everyone', 'followers', 'following', 'mutual', 'nobody', 'only_me'];

module.exports = {
  REACTION_EMOJIS,
  AUTHOR_SELECT,
  FEED_AUTHOR_SELECT,
  POST_INCLUDE,
  FEED_POST_INCLUDE,
  FEED_PAGE_SIZE,
  mediaItemSchema,
  AUDIENCE_VALUES,
  emptyReactionCounts,
};
