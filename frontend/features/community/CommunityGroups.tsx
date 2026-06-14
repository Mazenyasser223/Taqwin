import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useI18n } from '../../lib/i18n/useI18n';
import communityService from '../../services/communityService';
import type { CommunityGroup, CommunityPost } from '../../types';
import { timeAgo, displayName, communityProfilePath } from './communityUtils';
import { RoleBadge } from './RoleBadge';
import { PostMedia } from './PostMedia';
import { PostMentions } from './PostMentions';
import { useAuthStore } from '../../store/useAuthStore';
import { UserAvatar } from '../../components/ui/UserAvatar';
import { CommunityPostComposer } from './CommunityPostComposer';
import { CommunityPostInteractions } from './CommunityPostInteractions';
import { GroupManageModal } from './GroupManageModal';
import { GroupMembersModal } from './GroupMembersModal';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { CommunityPostCard } from './CommunityPostCard';
import { CommunityRefreshButton } from './CommunityRefreshButton';
import { CommunityLoader } from './CommunityLoader';
import { communityPageClass, feedPanel, feedTabActive, feedTabIdle, feedTabStrip } from './communityFeedStyles';
import { useCommunityLivePoll, COMMUNITY_GROUPS_POLL_MS, COMMUNITY_GROUP_POSTS_POLL_MS } from './useCommunityLivePoll';
import {
  peekCommunityGroups,
  peekCommunityGroup,
  peekCommunityFeed,
  prefetchCommunityGroup,
  filterCommunityGroupsLocal,
} from '../../lib/communityCache';
import { filterConversationsByPrefix, filterUsersByPrefix } from '../../lib/communitySearch';

export const CommunityGroups: React.FC = () => {
  const { t } = useI18n();
  const { user } = useAuthStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const deepLinkHandled = useRef<string | null>(null);
  const [groups, setGroups] = useState<CommunityGroup[]>(() => peekCommunityGroups() ?? []);
  const [loading, setLoading] = useState(() => !peekCommunityGroups()?.length);
  const [activeGroup, setActiveGroup] = useState<CommunityGroup | null>(null);
  const [groupPosts, setGroupPosts] = useState<CommunityPost[]>([]);
  const [featuredPosts, setFeaturedPosts] = useState<CommunityPost[]>([]);
  const [groupFeedTab, setGroupFeedTab] = useState<'all' | 'featured'>('all');
  const [postsLoading, setPostsLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showManage, setShowManage] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [leaveConfirmGroupId, setLeaveConfirmGroupId] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<CommunityGroup[] | null>(null);
  const [searching, setSearching] = useState(false);
  const searchGen = useRef(0);

  const loadGroups = useCallback(async (opts?: { silent?: boolean; fresh?: boolean }) => {
    const cached = peekCommunityGroups();
    if (cached?.length) {
      setGroups(cached);
      if (!opts?.silent) setLoading(false);
    } else if (!opts?.silent) {
      setLoading(true);
    }

    const res = await (opts?.fresh ? communityService.refreshGroups() : communityService.getGroups());
    if (res.data) setGroups(res.data);
    if (res.error && !cached?.length) setError(res.error);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadGroups();
  }, [loadGroups]);

  useCommunityLivePoll(
    () => {
      void communityService.refreshGroups().then((res) => {
        if (res.data) setGroups(res.data);
      });
    },
    COMMUNITY_GROUPS_POLL_MS,
    !activeGroup && !searchQuery.trim(),
    false,
  );

  const localFilteredGroups = useMemo(
    () => filterCommunityGroupsLocal(groups, searchQuery),
    [groups, searchQuery],
  );

  const displayedGroups = searchQuery.trim()
    ? (searchResults ?? localFilteredGroups)
    : groups;

  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (!trimmed) {
      setSearchResults(null);
      setSearching(false);
      return;
    }

    setSearchResults(filterCommunityGroupsLocal(groups, trimmed));

    const gen = ++searchGen.current;
    setSearching(true);
    void communityService.searchGroups(trimmed).then((res) => {
      if (gen !== searchGen.current) return;
      if (res.data) setSearchResults(res.data);
      setSearching(false);
    });

    return () => {
      searchGen.current += 1;
    };
  }, [searchQuery, groups]);

  const sortGroupPosts = (list: CommunityPost[]) =>
    [...list].sort((a, b) => {
      if (a.isGroupFeatured && !b.isGroupFeatured) return -1;
      if (!a.isGroupFeatured && b.isGroupFeatured) return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

  const updateGroupPost = (updated: CommunityPost) => {
    setGroupPosts((prev) => sortGroupPosts(prev.map((p) => (p.id === updated.id ? updated : p))));
    setFeaturedPosts((prev) => {
      if (!updated.isGroupFeatured) return prev.filter((p) => p.id !== updated.id);
      const exists = prev.some((p) => p.id === updated.id);
      const next = exists ? prev.map((p) => (p.id === updated.id ? updated : p)) : [updated, ...prev];
      return sortGroupPosts(next);
    });
  };

  const loadFeaturedPosts = useCallback(async (groupId: string, silent = false) => {
    if (!silent) setPostsLoading(true);
    const res = await communityService.getGroupFeaturedPosts(groupId);
    setFeaturedPosts(res.data ?? []);
    if (res.error) setError(res.error);
    setPostsLoading(false);
  }, []);

  const openGroup = useCallback(async (group: CommunityGroup) => {
    setGroupFeedTab('all');
    setFeaturedPosts([]);
    const cachedDetail = peekCommunityGroup(group.id);
    const preview = cachedDetail ?? group;
    setActiveGroup(preview);
    setError(null);

    const canRead = preview.canViewPosts ?? preview.joined;
    const cachedPosts = canRead ? peekCommunityFeed('for_you', { groupId: group.id }) : null;
    if (cachedPosts?.length) {
      setGroupPosts(cachedPosts);
      setPostsLoading(false);
    } else if (canRead) {
      setGroupPosts([]);
      setPostsLoading(true);
    } else {
      setGroupPosts([]);
      setPostsLoading(false);
    }

    void communityService.getGroup(group.id).then((detailRes) => {
      if (detailRes.data) {
        setActiveGroup(detailRes.data);
        setGroups((gs) => gs.map((g) => (g.id === detailRes.data!.id ? detailRes.data! : g)));
      }
      if (detailRes.error) setError(detailRes.error);
    });

    if (canRead) {
      void communityService.refreshPosts('for_you', { groupId: group.id }).then((postsRes) => {
        setGroupPosts(sortGroupPosts(postsRes.data ?? []));
        if (postsRes.error) setError(postsRes.error);
        setPostsLoading(false);
      });
    }
  }, [sortGroupPosts]);

  useEffect(() => {
    if (!activeGroup || groupFeedTab !== 'featured') return;
    void loadFeaturedPosts(activeGroup.id);
  }, [activeGroup?.id, groupFeedTab, loadFeaturedPosts]);

  useEffect(() => {
    const gid = searchParams.get('g');
    if (!gid || deepLinkHandled.current === gid) return;
    if (loading && !groups.length) return;

    deepLinkHandled.current = gid;
    const fromList = groups.find((g) => g.id === gid);
    if (fromList) {
      void openGroup(fromList);
    } else {
      void communityService.getGroup(gid).then((res) => {
        if (res.data) void openGroup(res.data);
      });
    }
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete('g');
        return next;
      },
      { replace: true },
    );
  }, [searchParams, loading, groups, openGroup, setSearchParams]);

  useCommunityLivePoll(
    () => {
      if (!activeGroup) return;
      const canRead = activeGroup.canViewPosts ?? activeGroup.joined;
      void Promise.all([
        communityService.getGroup(activeGroup.id, { fresh: true }),
        canRead
          ? communityService.refreshPosts('for_you', { groupId: activeGroup.id })
          : Promise.resolve(null),
        canRead && groupFeedTab === 'featured'
          ? communityService.getGroupFeaturedPosts(activeGroup.id)
          : Promise.resolve(null),
      ]).then(([gRes, postsRes, featuredRes]) => {
        if (gRes.data) {
          setActiveGroup(gRes.data);
          setGroups((gs) => gs.map((g) => (g.id === gRes.data!.id ? gRes.data! : g)));
        }
        if (postsRes?.data) setGroupPosts(sortGroupPosts(postsRes.data));
        if (featuredRes?.data) setFeaturedPosts(featuredRes.data);
      });
    },
    COMMUNITY_GROUP_POSTS_POLL_MS,
    !!activeGroup,
    false,
  );

  const patchGroupInList = (updated: CommunityGroup) => {
    setGroups((gs) => gs.map((g) => (g.id === updated.id ? updated : g)));
  };

  const joinActiveGroup = async () => {
    if (!activeGroup) return;
    const prev = activeGroup;
    const optimistic: CommunityGroup = {
      ...prev,
      joinPending: prev.joinPolicy === 'approval',
      joined: prev.joinPolicy !== 'approval',
      membersCount: prev.joinPolicy !== 'approval' ? prev.membersCount + 1 : prev.membersCount,
    };
    setActiveGroup(optimistic);
    patchGroupInList(optimistic);

    const res = await communityService.joinGroup(activeGroup.id);
    if (res.error) {
      setError(res.error);
      setActiveGroup(prev);
      patchGroupInList(prev);
      return;
    }
    if (res.data) {
      setActiveGroup(res.data);
      patchGroupInList(res.data);
      if (!res.data.joinPending) {
        void communityService.refreshPosts('for_you', { groupId: activeGroup.id }).then((postsRes) => {
          setGroupPosts(postsRes.data ?? []);
          setPostsLoading(false);
        });
      }
    }
  };

  const leaveGroup = async (groupId: string) => {
    setLeaving(true);
    const prevActive = activeGroup?.id === groupId ? activeGroup : null;
    const prevList = groups.find((g) => g.id === groupId);
    if (prevActive) {
      const optimistic = {
        ...prevActive,
        joined: false,
        myRole: null,
        membersCount: Math.max(0, prevActive.membersCount - 1),
      };
      setActiveGroup(optimistic);
      patchGroupInList(optimistic);
    }

    const res = await communityService.leaveGroup(groupId);
    setLeaving(false);
    setLeaveConfirmGroupId(null);
    if (res.error) {
      setError(res.error);
      if (prevActive) setActiveGroup(prevActive);
      if (prevList) patchGroupInList(prevList);
      return;
    }
    if (activeGroup?.id === groupId && res.data) {
      setActiveGroup(res.data);
      setGroupPosts([]);
      patchGroupInList(res.data);
    }
  };

  const toggleJoin = async (group: CommunityGroup, e: React.MouseEvent) => {
    e.stopPropagation();
    if (group.joined) {
      setLeaveConfirmGroupId(group.id);
      return;
    }
    const prev = group;
    const optimistic: CommunityGroup = {
      ...prev,
      joinPending: prev.joinPolicy === 'approval',
      joined: prev.joinPolicy !== 'approval',
      membersCount: prev.joinPolicy !== 'approval' ? prev.membersCount + 1 : prev.membersCount,
    };
    patchGroupInList(optimistic);
    if (activeGroup?.id === group.id) setActiveGroup(optimistic);

    const res = await communityService.joinGroup(group.id);
    if (res.error) {
      patchGroupInList(prev);
      if (activeGroup?.id === group.id) setActiveGroup(prev);
      return;
    }
    if (res.data) {
      patchGroupInList(res.data);
      if (activeGroup?.id === group.id) {
        setActiveGroup(res.data);
        if (!res.data.joinPending) {
          void communityService.refreshPosts('for_you', { groupId: group.id }).then((postsRes) => {
            setGroupPosts(postsRes.data ?? []);
            setPostsLoading(false);
          });
        }
      }
    }
  };

  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const createGroup = async () => {
    if (!name.trim() || creating) return;
    setCreating(true);
    setCreateError(null);
    const res = await communityService.createGroup({
      name: name.trim(),
      description: description.trim() || undefined,
    });
    setCreating(false);
    if (res.error) {
      setCreateError(res.error);
      return;
    }
    if (res.data) {
      setShowCreate(false);
      setName('');
      setDescription('');
      setCreateError(null);
      setGroups((gs) => [res.data!, ...gs.filter((g) => g.id !== res.data!.id)]);
    }
  };

  const deletePost = async (id: string) => {
    const res = await communityService.deletePost(id);
    if (!res.error) {
      setGroupPosts((ps) => ps.filter((p) => p.id !== id));
      setFeaturedPosts((ps) => ps.filter((p) => p.id !== id));
    }
  };

  const refreshGroupsList = async () => {
    setRefreshing(true);
    await loadGroups({ silent: true, fresh: true });
    if (searchQuery.trim()) {
      const res = await communityService.searchGroups(searchQuery.trim());
      if (res.data) setSearchResults(res.data);
    }
    setRefreshing(false);
  };

  const refreshActiveGroup = async () => {
    if (!activeGroup) return;
    setRefreshing(true);
    const [gRes, postsRes, featuredRes] = await Promise.all([
      communityService.getGroup(activeGroup.id, { fresh: true }),
      communityService.refreshPosts('for_you', { groupId: activeGroup.id }),
      groupFeedTab === 'featured'
        ? communityService.getGroupFeaturedPosts(activeGroup.id)
        : Promise.resolve(null),
    ]);
    if (gRes.data) {
      setActiveGroup(gRes.data);
      setGroups((gs) => gs.map((g) => (g.id === gRes.data!.id ? gRes.data! : g)));
    }
    setGroupPosts(sortGroupPosts(postsRes.data ?? []));
    if (featuredRes?.data) setFeaturedPosts(featuredRes.data);
    setRefreshing(false);
  };

  const leaveConfirmDialog = (
    <ConfirmDialog
      open={!!leaveConfirmGroupId}
      title={t('community.leaveGroup')}
      message={t('community.leaveGroupConfirm')}
      confirmLabel={t('community.leaveGroup')}
      variant="danger"
      loading={leaving}
      onConfirm={() => {
        if (leaveConfirmGroupId) void leaveGroup(leaveConfirmGroupId);
      }}
      onCancel={() => setLeaveConfirmGroupId(null)}
    />
  );

  if (activeGroup) {
    const canPost = Boolean(activeGroup.joined && activeGroup.canPost);
    const postDisabledReason = !activeGroup.joined
      ? t('community.joinToPost')
      : !activeGroup.canPost
        ? t('community.adminsOnlyPost')
        : undefined;

    return (
      <>
      {leaveConfirmDialog}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={`max-w-2xl mx-auto ${communityPageClass}`}>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setActiveGroup(null);
              setGroupPosts([]);
            }}
            className="flex items-center gap-2 text-muted hover:text-foreground text-sm font-bold"
          >
            <span className="material-symbols-outlined">arrow_back</span>
            {t('community.backToGroups')}
          </button>
          <div className="ml-auto">
            <CommunityRefreshButton
              onRefresh={refreshActiveGroup}
              refreshing={refreshing}
              disabled={postsLoading}
            />
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-xl sm:text-2xl font-black truncate">{activeGroup.name}</h2>
            {activeGroup.description && <p className="text-muted text-sm mt-1">{activeGroup.description}</p>}
            <p className="text-faint text-xs mt-2 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setShowMembers(true)}
                className="hover:text-primary font-bold underline-offset-2 hover:underline"
              >
                {activeGroup.membersCount} {t('community.members')}
              </button>
              <span>·</span>
              <span>
                {activeGroup.postsCount} {t('community.posts')}
              </span>
              <span
                className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                  activeGroup.postsVisibility === 'public'
                    ? 'bg-emerald-500/15 text-emerald-400'
                    : 'bg-amber-500/15 text-amber-400'
                }`}
              >
                {activeGroup.postsVisibility === 'public'
                  ? t('community.groupPublicBadge')
                  : t('community.groupPrivateBadge')}
              </span>
            </p>
          </div>
          <div className="flex flex-wrap gap-2 sm:shrink-0 sm:justify-end">
            {!activeGroup.joined && !activeGroup.invitePending && (
              <button
                type="button"
                onClick={joinActiveGroup}
                disabled={activeGroup.joinPending}
                className="px-3 py-1.5 sm:px-4 sm:py-2 rounded-full bg-primary text-white text-xs sm:text-sm font-bold disabled:opacity-60"
              >
                {activeGroup.joinPending
                  ? t('community.joinRequestSent')
                  : activeGroup.joinPolicy === 'approval'
                    ? t('community.requestToJoin')
                    : t('community.join')}
              </button>
            )}
            {activeGroup.invitePending && (
              <span className="px-3 py-1.5 sm:px-4 sm:py-2 rounded-full border border-primary/30 text-primary text-xs sm:text-sm font-bold">
                {t('community.groupInviteSent')}
              </span>
            )}
            {activeGroup.joined && activeGroup.myRole !== 'owner' && (
              <button
                type="button"
                onClick={() => setLeaveConfirmGroupId(activeGroup.id)}
                className="px-3 py-1.5 sm:px-4 sm:py-2 rounded-full border border-subtle text-xs sm:text-sm font-bold text-muted hover:text-red-400 hover:border-red-400/40"
              >
                {t('community.leaveGroup')}
              </button>
            )}
            {activeGroup.canManage && (
              <button
                type="button"
                onClick={() => setShowManage(true)}
                className="px-3 py-1.5 sm:px-4 sm:py-2 rounded-full border border-subtle text-xs sm:text-sm font-bold hover:border-primary/40"
              >
                {t('community.manageGroup')}
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>
        )}

        {!activeGroup.joined && activeGroup.postsVisibility === 'members_only' && groupPosts.length === 0 && (
          <p className="text-sm text-muted bg-elevated/50 border border-subtle rounded-xl px-4 py-3">
            {t('community.groupPostsPrivate')}
          </p>
        )}

        <CommunityPostComposer
          placeholder={t('community.groupPostPlaceholder')}
          canPost={canPost}
          disabledReason={postDisabledReason}
          onError={setError}
          onPost={async (payload) => {
            const res = await communityService.createPost({ ...payload, groupId: activeGroup.id });
            if (res.error) {
              setError(res.error);
              return null;
            }
            if (res.data) {
              setGroupPosts((p) => sortGroupPosts([res.data!, ...p]));
              return res.data;
            }
            return null;
          }}
        />

        <div className={feedTabStrip}>
          <button
            type="button"
            onClick={() => setGroupFeedTab('all')}
            className={groupFeedTab === 'all' ? feedTabActive : feedTabIdle}
          >
            {t('community.groupTabAll')}
          </button>
          <button
            type="button"
            onClick={() => setGroupFeedTab('featured')}
            className={groupFeedTab === 'featured' ? feedTabActive : feedTabIdle}
          >
            {t('community.groupTabFeatured')}
          </button>
        </div>

        {postsLoading && <CommunityLoader icon="article" />}

        <div className={`space-y-5 sm:space-y-6 transition-opacity ${refreshing ? 'opacity-60 pointer-events-none' : ''}`}>
          {(groupFeedTab === 'all' ? groupPosts : featuredPosts).map((post, i) => (
            <CommunityPostCard
              key={post.id}
              post={post}
              index={i}
              pinGroupEnabled={Boolean(activeGroup.canManage)}
              onPinError={setError}
              onPostChange={updateGroupPost}
              onDelete={user?.id === post.authorId ? () => deletePost(post.id) : undefined}
            />
          ))}
          {!postsLoading && (groupFeedTab === 'all' ? groupPosts : featuredPosts).length === 0 && (
            <div className={`${feedPanel} p-6 sm:p-12 text-center text-muted text-sm`}>
              {groupFeedTab === 'featured' ? t('community.groupFeaturedEmpty') : t('community.groupFeedEmpty')}
            </div>
          )}
        </div>

        <AnimatePresence>
          {showMembers && (
            <GroupMembersModal group={activeGroup} onClose={() => setShowMembers(false)} />
          )}
          {showManage && (
            <GroupManageModal
              group={activeGroup}
              onClose={() => setShowManage(false)}
              onUpdated={(g) => {
                setActiveGroup(g);
                patchGroupInList(g);
                setShowManage(false);
              }}
              onDeleted={() => {
                const deletedId = activeGroup?.id;
                setShowManage(false);
                setActiveGroup(null);
                setGroupPosts([]);
                if (deletedId) setGroups((gs) => gs.filter((g) => g.id !== deletedId));
              }}
            />
          )}
        </AnimatePresence>
      </motion.div>
      </>
    );
  }

  return (
    <>
    {leaveConfirmDialog}
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={`max-w-2xl mx-auto ${communityPageClass}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-black">{t('community.groupsTitle')}</h1>
          <p className="text-muted text-sm mt-0.5">{t('community.groupsSubtitle')}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <CommunityRefreshButton onRefresh={refreshGroupsList} refreshing={refreshing} disabled={loading} />
          <button
            type="button"
            onClick={() => { setCreateError(null); setName(''); setDescription(''); setShowCreate(true); }}
            className="shrink-0 flex items-center gap-1 bg-primary text-white font-bold px-3 sm:px-4 py-2 sm:py-2.5 rounded-full text-xs sm:text-sm"
          >
            <span className="material-symbols-outlined text-lg">add</span>
            <span className="hidden sm:inline">{t('community.createGroup')}</span>
            <span className="sm:hidden">New</span>
          </button>
        </div>
      </div>

      <div className="relative">
        <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-muted text-xl pointer-events-none">
          search
        </span>
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={t('community.searchGroups')}
          className="w-full bg-elevated/80 border border-subtle rounded-2xl pl-12 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
        {searching && (
          <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-muted text-lg animate-spin">
            progress_activity
          </span>
        )}
      </div>

      {loading && !groups.length && <CommunityLoader icon="group" />}

      <div className="grid gap-3 sm:grid-cols-2">
        {displayedGroups.map((g) => (
          <button
            key={g.id}
            type="button"
            onClick={() => void openGroup(g)}
            onMouseEnter={() => prefetchCommunityGroup(g.id)}
            onFocus={() => prefetchCommunityGroup(g.id)}
            className={`text-left p-4 sm:p-5 ${feedPanel} hover:ring-1 hover:ring-primary/30 transition-all`}
          >
            <div className="flex justify-between items-start gap-2">
              <h3 className="font-black text-lg">{g.name}</h3>
              <span
                role="presentation"
                onClick={(e) => toggleJoin(g, e)}
                className={`text-[10px] font-black px-2 py-1 rounded-full cursor-pointer ${
                  g.joined ? 'bg-primary/20 text-primary' : 'bg-elevated text-muted border border-subtle'
                }`}
              >
                {g.joined
                  ? t('community.joined')
                  : g.joinPending || g.invitePending
                    ? t('community.pending')
                      : g.joinPolicy === 'approval'
                        ? t('community.requestToJoin')
                        : t('community.join')}
              </span>
            </div>
            {g.description && <p className="text-sm text-muted mt-2 line-clamp-2">{g.description}</p>}
            <p className="text-xs text-faint mt-3">
              {g.membersCount} {t('community.members')}
              {g.ownerId === user?.id ? ` · ${t('community.youOwn')}` : ''}
            </p>
          </button>
        ))}
      </div>

      {!loading && !searching && displayedGroups.length === 0 && (
        <motion.div className="rounded-2xl border border-dashed border-border p-6 sm:p-12 text-center text-muted text-sm">
          {searchQuery.trim() ? t('community.groupsSearchEmpty') : t('community.groupsEmpty')}
        </motion.div>
      )}

      <AnimatePresence>
        {showCreate && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center p-4"
            onClick={() => setShowCreate(false)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-3xl bg-surface border border-border p-6 space-y-4"
            >
              <h3 className="text-xl font-black">{t('community.createGroup')}</h3>

              {createError && (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                  <span className="material-symbols-outlined text-lg shrink-0">error</span>
                  <p>{createError}</p>
                </div>
              )}

              <input
                value={name}
                onChange={(e) => { setName(e.target.value); setCreateError(null); }}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && createGroup()}
                placeholder={t('community.groupName')}
                disabled={creating}
                autoFocus
                className="w-full bg-elevated border border-subtle rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50"
              />
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder={t('community.groupDescription')}
                disabled={creating}
                className="w-full bg-elevated border border-subtle rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50"
              />
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => { setShowCreate(false); setCreateError(null); }}
                  disabled={creating}
                  className="flex-1 py-3 rounded-xl border border-subtle font-bold disabled:opacity-50"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="button"
                  onClick={createGroup}
                  disabled={!name.trim() || creating}
                  className="flex-1 py-3 rounded-xl bg-primary text-white font-bold disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {creating && (
                    <span className="material-symbols-outlined text-lg animate-spin">progress_activity</span>
                  )}
                  {creating ? '…' : t('community.create')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
    </>
  );
};
