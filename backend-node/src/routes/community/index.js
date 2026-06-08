/** Community API router entry — mounts domain router + re-exports services for extras. */
const router = require('./router');
const postsService = require('../../services/community/postsService');
const postMedia = require('../../services/community/postMedia');
const { mediaItemSchema } = require('../../services/community/constants');

module.exports = router;
module.exports.enrichPosts = postsService.enrichPosts;
module.exports.applyMentions = postsService.applyMentions;
module.exports.POST_INCLUDE = require('../../services/community/constants').POST_INCLUDE;
module.exports.syncPostMedia = postMedia.syncPostMedia;
module.exports.resolveMediaItemsFromBody = postMedia.resolveMediaItemsFromBody;
module.exports.mapPostMediaItems = postMedia.mapPostMediaItems;
module.exports.mediaItemSchema = mediaItemSchema;
