import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CommunityProfileLink } from './CommunityProfileLink';
import { motion } from 'framer-motion';
import { useI18n } from '../../lib/i18n/useI18n';
import communityService from '../../services/communityService';
import type { CommunityAuthor, FollowStatus } from '../../types';
import { displayName } from './communityUtils';
import { UserAvatar } from '../../components/ui/UserAvatar';
import { RoleBadge } from './RoleBadge';
import { CommunityLeagueBadge } from './CommunityLeagueBadge';
import { CommunityRefreshButton } from './CommunityRefreshButton';
import { communityPageClass, feedPanel } from './communityFeedStyles';
import {
  peekCommunityBrowseDiscover,
  peekCommunityBrowseSearch,
  patchAuthorInBrowseCaches,
  patchAuthorInBrowseSearchCache,
} from '../../lib/communityCache';
import { filterUsersByPrefix, mergeBrowseSearchResults } from '../../lib/communitySearch';
import { useRealtimeStore } from '../../lib/realtime/useRealtimeStore';
import {
  useCommunityLivePoll,
  COMMUNITY_BROWSE_POLL_MS,
  COMMUNITY_FEED_POLL_WS_MS,
} from './useCommunityLivePoll';

const MIN_SEARCH_LEN = 1;

function BrowseUserSkeleton() {
  return (
    <div className={`flex items-center gap-3 p-4 ${feedPanel} animate-pulse`}>
      <div className="size-14 rounded-full bg-white/10 shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-4 w-32 rounded bg-white/10" />
        <div className="h-3 w-20 rounded bg-white/8" />
      </div>
    </div>
  );
}

function browseRelationMeta(
  u: CommunityAuthor,
  t: (key: string) => string,
): { label: string; textClass: string; dotClass: string } | null {
  const mutual = u.followStatus === 'accepted' && u.followsViewer;
  const following = u.followStatus === 'accepted' && !u.followsViewer;
  const requested = u.followStatus === 'pending';
  const followsYou = Boolean(u.followsViewer) && u.followStatus !== 'accepted';

  if (mutual) {
    return {
      label: t('community.mutualFollow'),
      textClass: 'text-violet-300',
      dotClass: 'bg-violet-400',
    };
  }
  if (following) {
    return {
      label: t('community.followingBtn'),
      textClass: 'text-sky-300',
      dotClass: 'bg-sky-400',
    };
  }
  if (requested) {
    return {
      label: t('community.requestedBtn'),
      textClass: 'text-amber-300/90',
      dotClass: 'bg-amber-400',
    };
  }
  if (followsYou) {
    return {
      label: t('community.followsYou'),
      textClass: 'text-emerald-300',
      dotClass: 'bg-emerald-400',
    };
  }
  return null;
}

function UserBrowseRow({ u }: { u: CommunityAuthor }) {
  const { t } = useI18n();
  const relation = browseRelationMeta(u, t);
  return (
    <CommunityProfileLink userId={u.id} className={`flex items-center gap-3 p-4 ${feedPanel} hover:ring-1 hover:ring-primary/30 transition-all block`}>
      <UserAvatar
        avatarUrl={u.profile?.communityAvatarUrl}
        displayName={displayName(u)}
        email={u.email}
        className="size-14 text-lg border border-subtle"
        imgClassName="size-14 rounded-full object-cover border border-subtle shrink-0"
      />
      <div className="flex-1 min-w-0">
        <p className="font-bold truncate">{displayName(u)}</p>
        <p className="text-xs truncate flex items-center gap-1.5 min-w-0">
          <span className="text-faint truncate">{u.handle}</span>
          {relation && (
            <>
              <span className="text-faint/40 shrink-0" aria-hidden>
                ·
              </span>
              <span className={`inline-flex items-center gap-1 shrink-0 font-medium ${relation.textClass}`}>
                <span className={`size-1.5 rounded-full shrink-0 ${relation.dotClass}`} aria-hidden />
                {relation.label}
              </span>
            </>
          )}
        </p>
        <CommunityLeagueBadge league={u.league} className="mt-1" />
        {u.isPrivate && (
          <span className="inline-flex items-center gap-1 mt-1 text-[10px] font-bold text-muted uppercase">
            <span className="material-symbols-outlined text-sm">lock</span>
            {t('community.privateAccount')}
          </span>
        )}
      </div>
      {u.role && <RoleBadge role={u.role} />}
      <span className="material-symbols-outlined text-muted shrink-0">chevron_right</span>
    </CommunityProfileLink>
  );
}

function patchAuthorInLists(
  list: CommunityAuthor[],
  userId: string,
  patch: Partial<CommunityAuthor>,
): CommunityAuthor[] {
  if (!list.some((u) => u.id === userId)) return list;
  return list.map((u) => (u.id === userId ? { ...u, ...patch } : u));
}

export const CommunityBrowse: React.FC = () => {
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CommunityAuthor[]>([]);
  const [discover, setDiscover] = useState<CommunityAuthor[]>(() => peekCommunityBrowseDiscover() ?? []);
  const [searching, setSearching] = useState(false);
  const [discoverLoading, setDiscoverLoading] = useState(() => peekCommunityBrowseDiscover() == null);
  const [refreshing, setRefreshing] = useState(false);
  const searchGen = useRef(0);
  const trimmedRef = useRef('');

  const trimmed = query.trim();
  trimmedRef.current = trimmed;
  const isSearchMode = trimmed.length >= MIN_SEARCH_LEN;

  const wsOpen = useRealtimeStore((s) => s.connectionState === 'open');
  const subscribe = useRealtimeStore((s) => s.subscribe);
  const browsePollMs = wsOpen ? COMMUNITY_FEED_POLL_WS_MS : COMMUNITY_BROWSE_POLL_MS;

  useEffect(() => {
    const cached = peekCommunityBrowseDiscover();
    if (cached?.length) {
      setDiscover(cached);
      setDiscoverLoading(false);
    }
    void communityService.discoverUsers().then((res) => {
      if (res.data) setDiscover(res.data);
      setDiscoverLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!isSearchMode) {
      setResults([]);
      setSearching(false);
      return;
    }

    const localHits = filterUsersByPrefix(discover, trimmed);
    setResults(localHits);

    const gen = ++searchGen.current;
    const cached = peekCommunityBrowseSearch(trimmed);
    const hasCachedHits = Boolean(cached?.length);
    if (hasCachedHits) {
      setResults(mergeBrowseSearchResults(cached!, localHits));
      setSearching(false);
    } else {
      setSearching(true);
    }

    const timer = window.setTimeout(() => {
      void communityService.searchUsers(trimmed).then((res) => {
        if (gen !== searchGen.current) return;
        const apiHits = res.data ?? [];
        setResults(mergeBrowseSearchResults(apiHits, localHits));
        setSearching(false);
      });
    }, hasCachedHits ? 0 : 80);

    return () => window.clearTimeout(timer);
  }, [trimmed, isSearchMode, discover]);

  const applyAuthorPatch = useCallback((userId: string, patch: Partial<CommunityAuthor>) => {
    patchAuthorInBrowseCaches(userId, patch);
    const q = trimmedRef.current;
    if (q) patchAuthorInBrowseSearchCache(q, userId, patch);
    setDiscover((prev) => patchAuthorInLists(prev, userId, patch));
    setResults((prev) => patchAuthorInLists(prev, userId, patch));
  }, []);

  useEffect(() => {
    return subscribe('community.profile.updated', (env) => {
      const profileUserId = env.profileUserId as string | undefined;
      const patch = env.patch as {
        followStatus?: FollowStatus;
        isFollowing?: boolean;
        followersCount?: number;
      } | undefined;
      if (!profileUserId || !patch) return;

      const authorPatch: Partial<CommunityAuthor> = {};
      if (patch.followStatus != null) authorPatch.followStatus = patch.followStatus;
      if (Object.keys(authorPatch).length === 0) return;
      applyAuthorPatch(profileUserId, authorPatch);
    });
  }, [subscribe, applyAuthorPatch]);

  useCommunityLivePoll(
    () => {
      if (isSearchMode) {
        communityService.revalidateBrowseSearch(trimmedRef.current, (data) => setResults(data));
      } else {
        communityService.revalidateBrowseDiscover((data) => setDiscover(data));
      }
    },
    browsePollMs,
    true,
    false,
  );

  const refreshBrowse = async () => {
    setRefreshing(true);
    if (isSearchMode) {
      setSearching(true);
      const res = await communityService.searchUsers(trimmed, true);
      setResults(res.data ?? []);
      setSearching(false);
    } else {
      setDiscoverLoading(true);
      const res = await communityService.discoverUsers(true);
      if (res.data) setDiscover(res.data);
      setDiscoverLoading(false);
    }
    setRefreshing(false);
  };

  const list = isSearchMode ? results : discover;
  const listLoading = isSearchMode ? searching : discoverLoading;

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={communityPageClass}>
      <div className={`${feedPanel} p-4 sm:p-5 flex items-start justify-between gap-3`}>
        <div>
          <h1 className="text-2xl font-black tracking-tight">{t('community.browseTitle')}</h1>
          <p className="text-muted text-sm mt-1">{t('community.browseSubtitle')}</p>
        </div>
        <CommunityRefreshButton onRefresh={refreshBrowse} refreshing={refreshing} disabled={listLoading} />
      </div>

      <div className={`relative ${feedPanel} p-3`} data-tour="community-browse-search">
        <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-muted">search</span>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('community.searchPeople')}
          className="w-full pl-12 pr-4 py-3.5 rounded-2xl bg-elevated border border-subtle text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>

      {!isSearchMode && !listLoading && (
        <p className="text-sm font-bold text-foreground/80 px-1">{t('community.browseDiscoverTitle')}</p>
      )}

      {listLoading && list.length === 0 && (
        <div className="space-y-2">
          {[0, 1, 2, 3].map((i) => (
            <BrowseUserSkeleton key={i} />
          ))}
        </div>
      )}

      {!listLoading && isSearchMode && results.length === 0 && (
        <p className="text-center text-muted text-sm py-8">{t('community.browseNoResults')}</p>
      )}

      {!listLoading && !isSearchMode && discover.length === 0 && (
        <p className="text-center text-muted text-sm py-8">{t('community.browseHint')}</p>
      )}

      <div className="space-y-2" data-tour="community-browse-discover">
        {list.map((u) => (
          <UserBrowseRow key={u.id} u={u} />
        ))}
      </div>
    </motion.div>
  );
};
