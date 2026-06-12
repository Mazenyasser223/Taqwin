/**
 * Push realtime envelopes to connected WebSocket clients.
 */
const { publishToUsers } = require('./redisBus');

/**
 * @param {string | string[]} userIds
 * @param {Record<string, unknown>} envelope
 */
async function pushRealtime(userIds, envelope) {
  const ids = Array.isArray(userIds) ? userIds : [userIds];
  await publishToUsers(ids.filter(Boolean), { ...envelope, ts: envelope.ts || Date.now() });
}

function notificationEnvelope(notification) {
  return {
    type: 'notification.new',
    notification: {
      id: notification.id,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      link: notification.link,
      read: notification.read ?? false,
      createdAt: notification.createdAt,
      actorId: notification.actorId,
      actorDisplayName: notification.actorDisplayName,
      actorAvatarUrl: notification.actorAvatarUrl,
    },
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

module.exports = {
  pushRealtime,
  notificationEnvelope,
  communityMessageEnvelope,
  communityPostEnvelope,
  communityCommentEnvelope,
  communityStoryEnvelope,
};
