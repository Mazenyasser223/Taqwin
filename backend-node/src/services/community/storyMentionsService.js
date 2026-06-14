const { prisma } = require('../../db');
const { mapAuthorIdentity } = require('../../lib/communityAuthors');
const { notifyWithActor } = require('../../lib/communityNotify');
const { resolveMentionUserIds } = require('./postsService');
const { normalizeMediaUrl } = require('../../lib/normalizeMediaUrl');

const STORY_MENTION_INCLUDE = {
  mentionedUser: { select: require('./constants').AUTHOR_SELECT },
};

const STORY_RESHARE_AUTHOR_SELECT = require('./constants').AUTHOR_SELECT;

async function saveStoryMentions(tx, storyId, mentionUserIds = []) {
  for (const userId of mentionUserIds) {
    try {
      await tx.communityStoryMention.create({
        data: { storyId, mentionedUserId: userId },
      });
    } catch (err) {
      if (err.code !== 'P2002') throw err;
    }
  }
}

async function notifyStoryMentions(storyId, authorId, mentionUserIds = []) {
  for (const userId of mentionUserIds) {
    await notifyWithActor({
      userId,
      actorId: authorId,
      type: 'community.story_mention',
      title: 'mentioned you in a story',
      link: `/community?openStory=${authorId}`,
    });
  }
}

function mapStoryMentions(story) {
  return (story.mentions || [])
    .filter((m) => m.mentionedUser)
    .map((m) => ({
      type: 'user',
      id: m.mentionedUser.id,
      user: mapAuthorIdentity(m.mentionedUser),
    }));
}

async function buildStoryViewerContext(storyIds, viewerId) {
  if (!storyIds.length || !viewerId) {
    return { mentionedSet: new Set(), resharedSet: new Set() };
  }
  const [mentions, reshares] = await Promise.all([
    prisma.communityStoryMention.findMany({
      where: { storyId: { in: storyIds }, mentionedUserId: viewerId },
      select: { storyId: true },
    }),
    prisma.communityStory.findMany({
      where: {
        authorId: viewerId,
        resharedFromStoryId: { in: storyIds },
        expiresAt: { gt: new Date() },
      },
      select: { resharedFromStoryId: true },
    }),
  ]);
  return {
    mentionedSet: new Set(mentions.map((m) => m.storyId)),
    resharedSet: new Set(reshares.map((r) => r.resharedFromStoryId).filter(Boolean)),
  };
}

function mapStoryItem(story, viewerId, ctx = { mentionedSet: new Set(), resharedSet: new Set() }) {
  const seen = (story.views || []).length > 0;
  const resharedFromAuthor = story.resharedFromAuthor
    ? mapAuthorIdentity(story.resharedFromAuthor)
    : null;
  const isMentioned = ctx.mentionedSet?.has(story.id);
  const alreadyReshared = ctx.resharedSet?.has(story.id);
  return {
    id: story.id,
    mediaUrl: normalizeMediaUrl(story.mediaUrl),
    mediaType: story.mediaType,
    caption: story.caption ?? null,
    createdAt: story.createdAt,
    expiresAt: story.expiresAt,
    seen,
    viewCount: story._count?.views ?? 0,
    reactionCount: story._count?.reactions ?? 0,
    replyCount: story._count?.replies ?? 0,
    myReaction: story.reactions?.[0]?.emoji ?? null,
    isMine: story.authorId === viewerId,
    mentions: mapStoryMentions(story),
    resharedFrom:
      story.resharedFromStoryId && resharedFromAuthor
        ? { storyId: story.resharedFromStoryId, author: resharedFromAuthor }
        : null,
    canReshare: Boolean(
      viewerId &&
        isMentioned &&
        !alreadyReshared &&
        story.authorId !== viewerId,
    ),
  };
}

async function resolveStoryMentionUserIds(authorId, mentionUserIds = [], caption = '') {
  const { resolveUserIdsFromText, mergeMentionIds } = require('../../lib/communityMentions');
  const { getBlockedUserIds } = require('./followService');
  const blockedIds = [...(await getBlockedUserIds(authorId))];
  const fromContent = await resolveUserIdsFromText(caption, authorId, blockedIds);
  const merged = mergeMentionIds(mentionUserIds ?? [], fromContent);
  return resolveMentionUserIds(authorId, merged);
}

async function canReshareStory(storyId, userId) {
  const story = await prisma.communityStory.findUnique({
    where: { id: storyId },
    select: { id: true, authorId: true, expiresAt: true, mediaUrl: true, mediaType: true },
  });
  if (!story || story.expiresAt <= new Date()) return { ok: false, error: 'not_found' };
  if (story.authorId === userId) return { ok: false, error: 'own_story' };

  const mention = await prisma.communityStoryMention.findUnique({
    where: { storyId_mentionedUserId: { storyId, mentionedUserId: userId } },
  });
  if (!mention) return { ok: false, error: 'not_mentioned' };

  const existing = await prisma.communityStory.findFirst({
    where: {
      authorId: userId,
      resharedFromStoryId: storyId,
      expiresAt: { gt: new Date() },
    },
    select: { id: true },
  });
  if (existing) return { ok: false, error: 'already_reshared' };

  return { ok: true, story };
}

module.exports = {
  STORY_MENTION_INCLUDE,
  STORY_RESHARE_AUTHOR_SELECT,
  saveStoryMentions,
  notifyStoryMentions,
  mapStoryMentions,
  mapStoryItem,
  buildStoryViewerContext,
  resolveStoryMentionUserIds,
  canReshareStory,
};
