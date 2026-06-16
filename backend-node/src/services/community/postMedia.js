const { normalizeMediaUrl } = require('../../lib/normalizeMediaUrl');

function mapPostMediaItems(post) {
  const rows = post.media || [];
  if (rows.length) {
    return rows.map((m) => ({
      id: m.id,
      url: normalizeMediaUrl(m.url),
      mediaType: m.mediaType,
    }));
  }
  if (post.videoUrl) return [{ url: normalizeMediaUrl(post.videoUrl), mediaType: 'video' }];
  if (post.imageUrl) return [{ url: normalizeMediaUrl(post.imageUrl), mediaType: 'image' }];
  return [];
}

function resolveMediaItemsFromBody(body) {
  if (body.mediaItems?.length) return body.mediaItems;
  if (body.videoUrl) return [{ url: body.videoUrl, mediaType: 'video' }];
  if (body.imageUrl) return [{ url: body.imageUrl, mediaType: 'image' }];
  return [];
}

async function syncPostMedia(tx, postId, items) {
  await tx.communityPostMedia.deleteMany({ where: { postId } });
  if (!items.length) {
    await tx.communityPost.update({
      where: { id: postId },
      data: { imageUrl: null, videoUrl: null, mediaType: null },
    });
    return;
  }
  await tx.communityPostMedia.createMany({
    data: items.map((m, i) => ({
      postId,
      url: m.url,
      mediaType: m.mediaType,
      sortOrder: i,
    })),
  });
  const firstImage = items.find((m) => m.mediaType === 'image');
  const firstVideo = items.find((m) => m.mediaType === 'video');
  const hasImage = Boolean(firstImage);
  const hasVideo = Boolean(firstVideo);
  let mediaType = items[0].mediaType;
  if (hasImage && hasVideo) mediaType = 'mixed';
  else if (items.length > 1) mediaType = hasVideo && !hasImage ? 'video' : 'image';
  await tx.communityPost.update({
    where: { id: postId },
    data: {
      imageUrl: firstImage?.url ?? null,
      videoUrl: firstVideo?.url ?? null,
      mediaType,
    },
  });
}

module.exports = { mapPostMediaItems, resolveMediaItemsFromBody, syncPostMedia };
