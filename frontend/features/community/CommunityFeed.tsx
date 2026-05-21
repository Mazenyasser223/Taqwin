import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../../lib/i18n/useI18n';
import { motion } from 'framer-motion';
import communityService, { FeedFilter } from '../../services/communityService';
import type { CommunityPost } from '../../types';
import { useAuthStore } from '../../store/useAuthStore';
import { UserAvatar } from '../../components/ui/UserAvatar';
import { timeAgo, displayName, roleLabel } from './communityUtils';
import { PostMedia } from './PostMedia';
import { CommunityPostInteractions } from './CommunityPostInteractions';
import { CommunityStoriesBar } from './CommunityStoriesBar';
import { PostMentions } from './PostMentions';
import { CommunityPostComposer } from './CommunityPostComposer';

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
    <motion.div className="page-shell max-w-3xl mx-auto overflow-x-hidden pb-2">
      <motion.div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4 relative">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={snapTransition} className="relative z-10">
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight">{t('community.title')}</h1>
          <p className="text-muted mt-2 font-medium text-sm sm:text-base">{t('community.subtitleLong')}</p>
        </motion.div>
        <div className="relative z-10">
          <Magnetic>
            <motion.button
              variants={buttonPress}
              whileHover="hover"
              whileTap="tap"
              onClick={() => setComposerOpen(true)}
              className="w-full sm:w-auto bg-primary text-white font-black px-6 sm:px-8 py-3.5 min-h-11 rounded-2xl flex items-center justify-center gap-3 shadow-2xl shadow-primary/30"
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
          className="shrink-0 size-9 rounded-full border border-subtle text-muted hover:text-primary hover:border-primary/40 flex items-center justify-center transition-colors disabled:opacity-40"
        >
          <span className={`material-symbols-outlined text-lg ${refreshing ? 'animate-spin' : ''}`}>refresh</span>
        </button>
      </div>

      <div className="relative min-h-[4rem]">
        {error && (
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm mb-4">{error}</div>
        )}
        {loading && !posts.length && (
          <p className="text-primary animate-pulse text-sm">{t('community.loading')}</p>
        )}
        {!loading && !refreshing && posts.length === 0 && (
          <div className="rounded-2xl border border-border bg-surface/50 p-10 text-center text-muted text-sm">
            {t('community.empty')}
          </div>
        )}

        <div className={`space-y-4 transition-opacity ${refreshing ? 'opacity-60 pointer-events-none' : ''}`}>
        {posts.map((post) => {
          const author = post.author;
          const name = displayName(author);
          const handle = author?.handle ?? '';
          const isMine = user?.id === post.authorId;

          return (
            <motion.article
              key={post.id}
              layout
              className="rounded-2xl border border-border bg-surface/60 overflow-hidden"
            >
              <div className="p-4 flex items-start justify-between gap-3">
                <Link
                  to={`/community/profile/${post.authorId}`}
                  className="flex gap-3 min-w-0 flex-1 hover:opacity-90 transition-opacity"
                >
                  <UserAvatar
                    avatarUrl={author?.profile?.avatarUrl}
                    displayName={name}
                    className="size-12 rounded-full object-cover border border-subtle shrink-0"
                  />
                  <motion.div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-foreground truncate">{name}</span>
                      {author?.role && (
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-primary/20 text-primary uppercase tracking-wider">
                          {roleLabel(author.role)}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-faint truncate">
                      {handle} · {timeAgo(post.createdAt)}
                    </p>
                  </motion.div>
                </Link>
                {isMine && (
                  <button type="button" onClick={() => deletePost(post.id)} className="text-faint hover:text-red-400 p-1">
                    <span className="material-symbols-outlined text-xl">delete</span>
                  </button>
                )}
              </div>

              <p className="px-4 pb-3 text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">{post.content}</p>
              <PostMentions mentions={post.mentions} />

              {(post.mediaItems?.length || post.imageUrl || post.videoUrl) && (
                <PostMedia post={post} className="mb-3" />
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
