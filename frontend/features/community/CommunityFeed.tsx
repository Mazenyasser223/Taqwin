import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../../lib/i18n/useI18n';
import { motion } from 'framer-motion';
import communityService, { FeedFilter } from '../../services/communityService';
import type { CommunityPost } from '../../types';
import { useAuthStore } from '../../store/useAuthStore';
import { UserAvatar } from '../../components/ui/UserAvatar';
import { timeAgo, displayName } from './communityUtils';
import { RoleBadge } from './RoleBadge';
import { PostMedia } from './PostMedia';
import { CommunityPostInteractions } from './CommunityPostInteractions';
import { CommunityStoriesBar } from './CommunityStoriesBar';
import { PostMentions } from './PostMentions';
import { CommunityPostComposer } from './CommunityPostComposer';
import {
  feedBodyText,
  feedCard,
  feedCardHeader,
  feedPanel,
  feedTabActive,
  feedTabIdle,
  feedTabStrip,
  feedIconBtn,
} from './communityFeedStyles';

const FEEDS: { id: FeedFilter; labelKey: 'community.feedForYou' | 'community.feedFollowing' | 'community.feedCoaches' | 'community.feedAthletes' | 'community.feedTrending' }[] = [
  { id: 'for_you', labelKey: 'community.feedForYou' },
  { id: 'following', labelKey: 'community.feedFollowing' },
  { id: 'coaches', labelKey: 'community.feedCoaches' },
  { id: 'athletes', labelKey: 'community.feedAthletes' },
  { id: 'trending', labelKey: 'community.feedTrending' },
];

export const CommunityFeed: React.FC = () => {
  const { t } = useI18n();
  const { user } = useAuthStore();
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [feed, setFeed] = useState<FeedFilter>('for_you');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const storiesRefreshRef = useRef<(() => Promise<void>) | null>(null);

  const load = useCallback(
    (opts?: { silent?: boolean }) => {
      if (!opts?.silent) setLoading(true);
      return communityService.getPosts(feed).then((res) => {
        if (res.error) setError(res.error);
        else {
          setPosts(res.data ?? []);
          setError(null);
        }
        if (!opts?.silent) setLoading(false);
        return res;
      });
    },
    [feed],
  );

  const refreshFeed = async () => {
    setRefreshing(true);
    await Promise.all([load({ silent: true }), storiesRefreshRef.current?.() ?? Promise.resolve()]);
    setRefreshing(false);
  };

  useEffect(() => {
    load();
  }, [load]);

  const deletePost = async (id: string) => {
    const res = await communityService.deletePost(id);
    if (!res.error) setPosts((ps) => ps.filter((p) => p.id !== id));
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-5 sm:space-y-6"
    >
      <CommunityPostComposer
        placeholder={t('community.composerPlaceholderLong')}
        onError={setError}
        onPost={async (payload) => {
          const res = await communityService.createPost(payload);
          if (res.error) {
            setError(res.error);
            return null;
          }
          if (res.data) {
            setPosts((p) => [res.data!, ...p]);
            return res.data;
          }
          return null;
        }}
      />

      <CommunityStoriesBar refreshRef={storiesRefreshRef} />

      {/* Feed tabs + refresh */}
      <div className="flex items-center gap-2">
        <div className={`${feedTabStrip} overflow-x-auto no-scrollbar flex-1 min-w-0`}>
          {FEEDS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFeed(f.id)}
              className={feed === f.id ? feedTabActive : feedTabIdle}
            >
              {t(f.labelKey)}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={refreshFeed}
          disabled={refreshing || loading}
          title={t('community.refreshFeed')}
          aria-label={t('community.refreshFeed')}
          className={`${feedIconBtn} shrink-0 disabled:opacity-40`}
        >
          <span className={`material-symbols-outlined text-lg ${refreshing ? 'animate-spin' : ''}`}>refresh</span>
        </button>
      </div>

      <div className="relative min-h-[4rem]">
        {error && (
          <div className="p-4 rounded-xl bg-red-500/10 text-red-400 text-sm mb-4 flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex items-start gap-2 flex-1 min-w-0">
              <span className="material-symbols-outlined text-xl shrink-0">cloud_off</span>
              <p className="leading-relaxed">{error}</p>
            </div>
            <button
              type="button"
              onClick={() => refreshFeed()}
              disabled={refreshing}
              className="shrink-0 px-4 py-2 rounded-xl bg-red-500/20 hover:bg-red-500/30 font-bold text-xs transition-colors disabled:opacity-50"
            >
              {t('community.retry')}
            </button>
          </div>
        )}
        {loading && !posts.length && (
          <div className="flex flex-col items-center gap-3 py-16 text-muted">
            <span className="material-symbols-outlined text-4xl text-primary/60 animate-pulse">dynamic_feed</span>
            <p className="text-sm">{t('community.loading')}</p>
          </div>
        )}
        {!loading && !refreshing && posts.length === 0 && (
          <div className={`${feedPanel} p-12 text-center text-muted text-sm leading-relaxed`}>
            <span className="material-symbols-outlined text-4xl text-faint mb-3 block">forum</span>
            {t('community.empty')}
          </div>
        )}

        <div className={`space-y-5 sm:space-y-6 transition-opacity ${refreshing ? 'opacity-60 pointer-events-none' : ''}`}>
        {posts.map((post, postIndex) => {
          const author = post.author;
          const name = displayName(author);
          const handle = author?.handle ?? '';
          const isMine = user?.id === post.authorId;

          return (
            <motion.article
              key={post.id}
              layout
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(postIndex * 0.04, 0.2), duration: 0.35 }}
              className={feedCard}
            >
              <div className={`${feedCardHeader} flex items-start justify-between gap-3`}>
                <Link
                  to={`/community/profile/${post.authorId}`}
                  className="flex gap-3 min-w-0 flex-1 hover:opacity-90 transition-opacity"
                >
                  <UserAvatar
                    avatarUrl={author?.profile?.avatarUrl}
                    displayName={name}
                    className="size-12 rounded-full object-cover shrink-0 ring-2 ring-primary/15"
                  />
                  <motion.div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-foreground truncate">{name}</span>
                      {author?.role && <RoleBadge role={author.role} />}
                    </div>
                    <p className="text-xs text-muted/90 truncate mt-0.5">
                      {handle ? `@${handle.replace(/^@/, '')}` : ''}
                      {handle ? ' · ' : ''}
                      {timeAgo(post.createdAt)}
                    </p>
                  </motion.div>
                </Link>
                {isMine && (
                  <button
                    type="button"
                    onClick={() => deletePost(post.id)}
                    className={`${feedIconBtn} hover:!text-red-400`}
                  >
                    <span className="material-symbols-outlined text-xl">delete</span>
                  </button>
                )}
              </div>

              {post.content?.trim() && <p className={feedBodyText}>{post.content}</p>}
              <PostMentions mentions={post.mentions} />

              {(post.mediaItems?.length || post.imageUrl || post.videoUrl) && (
                <PostMedia post={post} />
              )}

              <CommunityPostInteractions
                post={post}
                onPostChange={(updated) => setPosts((ps) => ps.map((p) => (p.id === post.id ? updated : p)))}
              />

            </motion.article>
          );
        })}
        </div>
        {refreshing && posts.length > 0 && (
          <div className="absolute inset-0 flex items-start justify-center pt-8 pointer-events-none">
            <span className="material-symbols-outlined text-3xl text-primary animate-spin">progress_activity</span>
          </div>
        )}
      </div>
    </motion.div>
  );
};
