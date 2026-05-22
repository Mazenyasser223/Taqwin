import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getHashQueryParams } from '../../lib/hashRouteQuery';
import { useI18n } from '../../lib/i18n/useI18n';
import { motion } from 'framer-motion';
import communityService, { FeedFilter } from '../../services/communityService';
import type { CommunityPost } from '../../types';
import { CommunityPostComposer } from './CommunityPostComposer';
import { CommunityStoriesBar } from './CommunityStoriesBar';
import { CommunityPostCard } from './CommunityPostCard';
import { CommunityRefreshButton } from './CommunityRefreshButton';
import {
  communityPageClass,
  feedPanel,
  feedTabActive,
  feedTabIdle,
  feedTabStrip,
} from './communityFeedStyles';

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
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={communityPageClass}>
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

      <CommunityStoriesBar
        refreshRef={storiesRefreshRef}
        openStoryUserId={openStoryUserId}
        onOpenStoryConsumed={clearOpenStoryParam}
      />

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
        <CommunityRefreshButton onRefresh={refreshFeed} refreshing={refreshing} disabled={loading} />
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
          {posts.map((post, postIndex) => (
            <CommunityPostCard
              key={post.id}
              post={post}
              index={postIndex}
              highlight={focusPostId === post.id}
              initialCommentsOpen={focusPostId === post.id}
              highlightCommentId={focusPostId === post.id ? focusCommentId : null}
              onPostChange={(updated) => setPosts((ps) => ps.map((p) => (p.id === post.id ? updated : p)))}
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
