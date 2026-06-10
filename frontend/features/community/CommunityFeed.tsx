import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getHashQueryParams } from '../../lib/hashRouteQuery';
import { useI18n } from '../../lib/i18n/useI18n';
import { motion, AnimatePresence } from 'framer-motion';
import communityService, { FeedFilter } from '../../services/communityService';
import type { CommunityPost } from '../../types';
import { CommunityPostComposer } from './CommunityPostComposer';
import { CommunityStoriesBar } from './CommunityStoriesBar';
import { CommunityPostCard } from './CommunityPostCard';
import { CommunityRefreshButton } from './CommunityRefreshButton';
import { CommunityLoader } from './CommunityLoader';
import {
  communityPageClass,
  feedPanel,
  feedTabActive,
  feedTabIdle,
  feedTabStripScroll,
} from './communityFeedStyles';
import { peekCommunityFeed, prependPostToFeedCaches, patchPostInAllFeedCaches } from '../../lib/communityCache';
import { useCommunityLivePoll, COMMUNITY_FEED_POLL_MS } from './useCommunityLivePoll';

const FEEDS: {
  id: FeedFilter;
  labelKey:
    | 'community.feedForYou'
    | 'community.feedFollowing'
    | 'community.feedCoaches'
    | 'community.feedAthletes'
    | 'community.feedGyms'
    | 'community.feedTrending';
}[] = [
  { id: 'for_you', labelKey: 'community.feedForYou' },
  { id: 'following', labelKey: 'community.feedFollowing' },
  { id: 'coaches', labelKey: 'community.feedCoaches' },
  { id: 'athletes', labelKey: 'community.feedAthletes' },
  { id: 'gyms', labelKey: 'community.feedGyms' },
  { id: 'trending', labelKey: 'community.feedTrending' },
];

export const CommunityFeed: React.FC = () => {
  const { t } = useI18n();
  const [searchParams, setSearchParams] = useSearchParams();
  const hashParams = getHashQueryParams();
  const focusPostId = searchParams.get('post') || hashParams.get('post');
  const focusCommentId = searchParams.get('comment') || hashParams.get('comment');
  const openStoryUserId = searchParams.get('openStory');
  const [posts, setPosts] = useState<CommunityPost[]>(() => peekCommunityFeed('for_you') ?? []);
  const [feed, setFeed] = useState<FeedFilter>('for_you');
  const [loading, setLoading] = useState(() => peekCommunityFeed('for_you') == null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const storiesRefreshRef = useRef<(() => Promise<void>) | null>(null);

  /** Moderation / post errors — brief toast; feed load errors stay until retry. */
  const showFeedError = useCallback((message: string) => {
    setError(message);
  }, []);

  useEffect(() => {
    if (!error) return;
    const transient =
      /not allowed|لا يُسمح|inappropriate|مسيء|تحرش|violates|profan|content_moderated/i.test(error);
    if (!transient && !posts.length) return;
    const timer = window.setTimeout(() => setError(null), 5000);
    return () => window.clearTimeout(timer);
  }, [error, posts.length]);

  const load = useCallback(
    (opts?: { silent?: boolean; fresh?: boolean }) => {
      if (!opts?.silent) setLoading(true);
      const fetcher = opts?.fresh
        ? () => communityService.refreshPosts(feed)
        : () => communityService.getPosts(feed);
      return fetcher().then((res) => {
        if (res.error) {
          const stale = peekCommunityFeed(feed);
          if (opts?.silent && stale?.length) return res;
          if (stale?.length) {
            setPosts(stale);
            setError(null);
          } else if (!opts?.silent) {
            setError(res.error);
          }
        } else {
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
    await Promise.all([load({ silent: true, fresh: true }), storiesRefreshRef.current?.() ?? Promise.resolve()]);
    setRefreshing(false);
  };

  useCommunityLivePoll(
    () => communityService.revalidatePosts(feed, (data) => setPosts(data)),
    COMMUNITY_FEED_POLL_MS,
    true,
    false,
  );

  useEffect(() => {
    const cached = peekCommunityFeed(feed);
    if (cached) {
      setPosts(cached);
      setLoading(false);
      setError(null);
    }
    load({ silent: Boolean(cached?.length) });
  }, [load, feed]);

  useEffect(() => {
    if (!focusPostId || loading) return;
    const exists = posts.some((p) => p.id === focusPostId);
    if (exists) return;
    communityService.getPost(focusPostId).then((res) => {
      if (res.data) setPosts((ps) => (ps.some((p) => p.id === res.data!.id) ? ps : [res.data!, ...ps]));
    });
  }, [focusPostId, loading, posts]);

  useEffect(() => {
    if (!focusPostId || loading) return;
    const timer = window.setTimeout(() => {
      document.getElementById(`post-${focusPostId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 350);
    return () => window.clearTimeout(timer);
  }, [focusPostId, focusCommentId, posts, loading]);

  const deletePost = async (id: string) => {
    const res = await communityService.deletePost(id);
    if (!res.error) setPosts((ps) => ps.filter((p) => p.id !== id));
  };

  const clearOpenStoryParam = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('openStory');
    setSearchParams(next, { replace: true });
  };

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={`w-full min-w-0 max-w-2xl mx-auto ${communityPageClass}`}>
      <CommunityPostComposer
        placeholder={t('community.composerPlaceholderLong')}
        onError={showFeedError}
        onPost={async (payload) => {
          const res = await communityService.createPost(payload);
          if (res.error) {
            showFeedError(res.error);
            return null;
          }
          if (res.data) {
            prependPostToFeedCaches(res.data);
            setPosts((p) => [res.data!, ...p.filter((x) => x.id !== res.data!.id)]);
            return res.data;
          }
          return null;
        }}
      />

      <CommunityStoriesBar
        refreshRef={storiesRefreshRef}
        openStoryUserId={openStoryUserId}
        onOpenStoryConsumed={clearOpenStoryParam}
      />

      <div className={feedTabStripScroll}>
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
        <div className="shrink-0 sticky end-0 ps-1 bg-gradient-to-l from-surface/95 via-surface/80 to-transparent">
          <CommunityRefreshButton onRefresh={refreshFeed} refreshing={refreshing} disabled={loading} />
        </div>
      </div>

      <div className="relative min-h-[4rem]">
        <AnimatePresence>
          {error && (
            <motion.div
              key={error}
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2 }}
              className="p-4 rounded-xl bg-red-500/10 text-red-400 text-sm mb-4 flex flex-col sm:flex-row sm:items-center gap-3"
            >
              <div className="flex items-start gap-2 flex-1 min-w-0">
                <span className="material-symbols-outlined text-xl shrink-0">error</span>
                <p className="leading-relaxed">{error}</p>
              </div>
              <button
                type="button"
                onClick={() => setError(null)}
                className="shrink-0 px-4 py-2 rounded-xl bg-red-500/20 hover:bg-red-500/30 font-bold text-xs transition-colors"
              >
                {t('common.close')}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
        {loading && !posts.length && <CommunityLoader />}
        {!loading && !refreshing && posts.length === 0 && (
          <div className={`${feedPanel} p-6 sm:p-12 text-center text-muted text-sm leading-relaxed`}>
            <span className="material-symbols-outlined text-4xl text-faint mb-3 block">forum</span>
            {t('community.empty')}
          </div>
        )}

        <div className={`space-y-5 sm:space-y-6 transition-opacity ${refreshing ? 'opacity-60 pointer-events-none' : ''}`}>
          {posts.map((post, postIndex) => (
            <CommunityPostCard
              key={post.id}
              post={post}
              index={postIndex}
              highlight={focusPostId === post.id}
              initialCommentsOpen={focusPostId === post.id}
              highlightCommentId={focusPostId === post.id ? focusCommentId : null}
              onPostChange={(updated) => {
                setPosts((ps) => ps.map((p) => (p.id === post.id ? updated : p)));
                patchPostInAllFeedCaches(post.id, updated);
              }}
              onDelete={() => deletePost(post.id)}
            />
          ))}
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
