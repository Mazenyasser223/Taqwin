/**
 * Push realtime envelopes to connected WebSocket clients.
 */
const { publishToUsers } = require('./redisBus');
const { serializeNotification } = require('../lib/notifications/notificationSerialize');

/**
 * @param {string | string[]} userIds
 * @param {Record<string, unknown>} envelope
 */
async function pushRealtime(userIds, envelope) {
  const ids = Array.isArray(userIds) ? userIds : [userIds];
  await publishToUsers(ids.filter(Boolean), { ...envelope, ts: envelope.ts || Date.now() });
}

function notificationEnvelope(notification) {
  const serialized = serializeNotification(notification);
  return {
    type: 'notification.new',
    notification: serialized,
  };
}

function notificationUpdatedEnvelope(notification) {
  return {
    type: 'notification.updated',
    notification: serializeNotification(notification),
  };
}

function notificationReadEnvelope(notification) {
  return {
    type: 'notification.read',
    notification: serializeNotification(notification),
  };
}

function notificationReadAllEnvelope(readAt, updated) {
  return {
    type: 'notification.read_all',
    readAt,
    updated,
  };
}

function notificationDeletedEnvelope(id, deletedAt) {
  return {
    type: 'notification.deleted',
    id,
    deletedAt,
  };
}

function communityMessageEnvelope(conversationId, message) {
  return {
    type: 'community.message.new',
    conversationId,
    message,
  };
}

function communityPostEnvelope(post) {
  return {
    type: 'community.post.new',
    post,
  };
}

function communityCommentEnvelope(postId, comment) {
  return {
    type: 'community.comment.new',
    postId,
    comment,
  };
}

function communityStoryEnvelope(story) {
  return {
    type: 'community.story.new',
    story,
  };
}

/** Counts-only patch — safe to broadcast (no viewer-specific myReaction). */
function communityPostUpdateEnvelope(postId, patch) {
  return {
    type: 'community.post.updated',
    postId,
    patch,
  };
}

function communityProfileUpdateEnvelope(profileUserId, patch) {
  return {
    type: 'community.profile.updated',
    profileUserId,
    patch,
  };
}

function communityGroupUpdateEnvelope(groupId, payload) {
  return {
    type: 'community.group.updated',
    groupId,
    group: payload.group,
    patch: payload.patch,
  };
}

function communityGroupDeletedEnvelope(groupId) {
  return {
    type: 'community.group.deleted',
    groupId,
  };
}

function communityInboxReadEnvelope(conversationId, payload) {
  return {
    type: 'community.inbox.read',
    conversationId,
    readAt: payload.readAt,
    readerUserId: payload.readerUserId,
  };
}

function communityInboxUpdatedEnvelope(conversationId, conversation) {
  return {
    type: 'community.inbox.updated',
    conversationId,
    conversation,
  };
}

module.exports = {
  pushRealtime,
  notificationEnvelope,
  notificationUpdatedEnvelope,
  notificationReadEnvelope,
  notificationReadAllEnvelope,
  notificationDeletedEnvelope,
  communityMessageEnvelope,
  communityPostEnvelope,
  communityCommentEnvelope,
  communityStoryEnvelope,
  communityPostUpdateEnvelope,
  communityProfileUpdateEnvelope,
  communityGroupUpdateEnvelope,
  communityGroupDeletedEnvelope,
  communityInboxReadEnvelope,
  communityInboxUpdatedEnvelope,
};
