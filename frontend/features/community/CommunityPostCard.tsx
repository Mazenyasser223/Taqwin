import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import type { CommunityPost } from '../../types';
import { useAuthStore } from '../../store/useAuthStore';
import { timeAgo, displayName, communityProfilePath } from './communityUtils';
import { CommunityAuthorAvatar } from './CommunityAuthorAvatar';
import { RoleBadge } from './RoleBadge';
import { PostMedia } from './PostMedia';
import { PostMentions } from './PostMentions';
import { CommunityPostInteractions } from './CommunityPostInteractions';
import { hasVisiblePresence } from './PresenceIndicator';
import {
  feedBodyText,
  feedCard,
  feedCardHeader,
  feedIconBtn,
} from './communityFeedStyles';

export interface CommunityPostCardProps {
  post: CommunityPost;
  onPostChange: (post: CommunityPost) => void;
  onDelete?: () => void;
  showAuthor?: boolean;
  highlight?: boolean;
  initialCommentsOpen?: boolean;
  highlightCommentId?: string | null;
  index?: number;
}

export const CommunityPostCard: React.FC<CommunityPostCardProps> = ({
  post,
  onPostChange,
  onDelete,
  showAuthor = true,
  highlight = false,
  initialCommentsOpen = false,
  highlightCommentId = null,
  index = 0,
}) => {
  const { user } = useAuthStore();
  const author = post.author;
  const name = displayName(author);
  const handle = author?.handle ?? '';
  const isMine = user?.id === post.authorId;

  return (
    <motion.article
      id={`post-${post.id}`}
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.04, 0.2), duration: 0.35 }}
      className={`${feedCard} ${highlight ? 'ring-2 ring-primary/40' : ''}`}
    >
      {showAuthor && author && (
        <div className={`${feedCardHeader} flex items-start justify-between gap-3 overflow-visible`}>
          <div className="flex gap-3 min-w-0 flex-1">
            <CommunityAuthorAvatar
              userId={post.authorId}
              avatarUrl={author.profile?.avatarUrl}
              displayName={name}
              showPresence={!isMine && hasVisiblePresence(author) && author.isOnline === true}
              isOnline={author.isOnline}
            />
            <Link
              to={communityProfilePath(post.authorId)}
              className="min-w-0 flex-1 hover:opacity-90 transition-opacity"
            >
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-foreground truncate">{name}</span>
                {author.role && <RoleBadge role={author.role} />}
              </div>
              <p className="text-xs text-muted/90 truncate mt-0.5">
                {handle ? `@${handle.replace(/^@/, '')}` : ''}
                {handle ? ' · ' : ''}
                {timeAgo(post.createdAt)}
              </p>
            </Link>
          </div>
          {isMine && onDelete && (
            <button type="button" onClick={onDelete} className={`${feedIconBtn} hover:!text-red-400`}>
              <span className="material-symbols-outlined text-xl">delete</span>
            </button>
          )}
        </div>
      )}

      {!showAuthor && (
        <div className={`${feedCardHeader} flex items-center justify-between gap-3`}>
          <p className="text-xs text-muted/90">{timeAgo(post.createdAt)}</p>
          {isMine && onDelete && (
            <button type="button" onClick={onDelete} className={`${feedIconBtn} hover:!text-red-400`}>
              <span className="material-symbols-outlined text-xl">delete</span>
            </button>
          )}
        </div>
      )}

      {post.content?.trim() && <p className={feedBodyText}>{post.content}</p>}
      <PostMentions mentions={post.mentions} />

      {(post.mediaItems?.length || post.imageUrl || post.videoUrl) && <PostMedia post={post} />}

      <CommunityPostInteractions
        post={post}
        onPostChange={onPostChange}
        initialCommentsOpen={initialCommentsOpen}
        highlightCommentId={highlightCommentId}
      />
    </motion.article>
  );
};
