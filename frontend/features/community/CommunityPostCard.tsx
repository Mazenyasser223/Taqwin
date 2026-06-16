import React from 'react';
import { CommunityProfileLink } from './CommunityProfileLink';
import { motion } from 'framer-motion';
import type { CommunityPost } from '../../types';
import { useAuthStore } from '../../store/useAuthStore';
import { useI18n } from '../../lib/i18n/useI18n';
import { timeAgo, displayName } from './communityUtils';
import { CommunityAuthorAvatar } from './CommunityAuthorAvatar';
import { RoleBadge } from './RoleBadge';
import { CommunityLeagueBadge } from './CommunityLeagueBadge';
import { PostMedia } from './PostMedia';
import { PostMentions } from './PostMentions';
import { CommunityPostInteractions } from './CommunityPostInteractions';
import { PostPoll } from './PostPoll';
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
  pinProfileEnabled?: boolean;
  pinGroupEnabled?: boolean;
  onPinError?: (message: string) => void;
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
  pinProfileEnabled = false,
  pinGroupEnabled = false,
  onPinError,
}) => {
  const { t } = useI18n();
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
      {(post.isProfilePinned || post.isGroupFeatured) && (
        <div className="px-4 pt-3 sm:px-5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-amber-400/90">
          <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>
            {post.isGroupFeatured ? 'star' : 'push_pin'}
          </span>
          {post.isGroupFeatured ? t('community.featuredPost') : t('community.pinnedPost')}
        </div>
      )}
      {showAuthor && author && (
        <div className={`${feedCardHeader} flex items-start justify-between gap-3 overflow-visible`}>
          <div className="flex gap-3 min-w-0 flex-1">
            <CommunityAuthorAvatar
              userId={post.authorId}
              avatarUrl={author.profile?.communityAvatarUrl}
              displayName={name}
              showPresence={!isMine && hasVisiblePresence(author) && author.isOnline === true}
              isOnline={author.isOnline}
              imageClassName="size-8 sm:size-10 rounded-full object-cover shrink-0 ring-2 ring-primary/15"
            />
            <CommunityProfileLink
              userId={post.authorId}
              className="min-w-0 flex-1 hover:opacity-90 transition-opacity"
            >
              <span className="font-bold text-foreground truncate block">{name}</span>
              <p className="text-xs text-muted/90 truncate mt-0.5">
                {handle ? `@${handle.replace(/^@/, '')}` : ''}
                {handle ? ' · ' : ''}
                {timeAgo(post.createdAt)}
              </p>
            </CommunityProfileLink>
          </div>
          <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
            {author.role && <RoleBadge role={author.role} />}
            <CommunityLeagueBadge league={author.league} />
            {isMine && onDelete && (
              <button type="button" onClick={onDelete} className={`${feedIconBtn} hover:!text-red-400`}>
                <span className="material-symbols-outlined text-xl">delete</span>
              </button>
            )}
          </div>
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
      {post.poll && <PostPoll post={post} onPostChange={onPostChange} />}

      {(post.mediaItems?.length || post.imageUrl || post.videoUrl) && <PostMedia post={post} />}

      <CommunityPostInteractions
        post={post}
        onPostChange={onPostChange}
        initialCommentsOpen={initialCommentsOpen}
        highlightCommentId={highlightCommentId}
        pinProfileEnabled={pinProfileEnabled}
        pinGroupEnabled={pinGroupEnabled}
        onPinError={onPinError}
      />
    </motion.article>
  );
};
