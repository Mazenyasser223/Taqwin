import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
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
import { communityPageClass, feedPanel } from './communityFeedStyles';

export const CommunityGroups: React.FC = () => {
  const { t } = useI18n();
  const { user } = useAuthStore();
  const [groups, setGroups] = useState<CommunityGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeGroup, setActiveGroup] = useState<CommunityGroup | null>(null);
  const [groupPosts, setGroupPosts] = useState<CommunityPost[]>([]);
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

  const loadGroups = useCallback(() => {
    setLoading(true);
    return communityService.getGroups().then((res) => {
      setGroups(res.data ?? []);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    loadGroups();
  }, [loadGroups]);

  const openGroup = async (group: CommunityGroup) => {
    setPostsLoading(true);
    setError(null);
    const detailRes = await communityService.getGroup(group.id);
    const detail = detailRes.data ?? group;
    setActiveGroup(detail);
    const canReadPosts = detail.canViewPosts ?? detail.joined;
    if (canReadPosts) {
      const res = await communityService.getPosts('for_you', { groupId: group.id });
      setGroupPosts(res.data ?? []);
      if (res.error) setError(res.error);
    } else {
      setGroupPosts([]);
      if (!detail.joined && detail.postsVisibility === 'members_only') {
        setError(null);
      }
    }
    setPostsLoading(false);
  };

  const joinActiveGroup = async () => {
    if (!activeGroup) return;
    const res = await communityService.joinGroup(activeGroup.id);
    if (res.error) setError(res.error);
    else if (res.data) {
      setActiveGroup(res.data);
      if (!res.data.joinPending) {
        const postsRes = await communityService.getPosts('for_you', { groupId: activeGroup.id });
        setGroupPosts(postsRes.data ?? []);
      }
      loadGroups();
    }
  };

  const leaveGroup = async (groupId: string) => {
    setLeaving(true);
    const res = await communityService.leaveGroup(groupId);
    setLeaving(false);
    setLeaveConfirmGroupId(null);
    if (res.error) {
      setError(res.error);
      return;
    }
    if (activeGroup?.id === groupId && res.data) {
      setActiveGroup(res.data);
      setGroupPosts([]);
    }
    loadGroups();
  };

  const toggleJoin = async (group: CommunityGroup, e: React.MouseEvent) => {
    e.stopPropagation();
    if (group.joined) {
      setLeaveConfirmGroupId(group.id);
      return;
    }
    const res = await communityService.joinGroup(group.id);
    if (res.data && activeGroup?.id === group.id) {
      setActiveGroup(res.data);
      if (!res.data.joinPending) {
        const postsRes = await communityService.getPosts('for_you', { groupId: group.id });
        setGroupPosts(postsRes.data ?? []);
      }
    }
    loadGroups();
  };

  const createGroup = async () => {
    if (!name.trim()) return;
    const res = await communityService.createGroup({
      name: name.trim(),
      description: description.trim() || undefined,
    });
    if (res.data) {
      setShowCreate(false);
      setName('');
      setDescription('');
      loadGroups();
    }
  };

  const deletePost = async (id: string) => {
    const res = await communityService.deletePost(id);
    if (!res.error) setGroupPosts((ps) => ps.filter((p) => p.id !== id));
  };

  const refreshGroupsList = async () => {
    setRefreshing(true);
    await loadGroups();
    setRefreshing(false);
  };

  const refreshActiveGroup = async () => {
    if (!activeGroup) return;
    setRefreshing(true);
    const [gRes, postsRes] = await Promise.all([
      communityService.getGroup(activeGroup.id),
      communityService.getPosts('for_you', { groupId: activeGroup.id }),
    ]);
    if (gRes.data) setActiveGroup(gRes.data);
    setGroupPosts(postsRes.data ?? []);
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
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={communityPageClass}>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setActiveGroup(null);
              setGroupPosts([]);
              loadGroups();
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

        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-2xl font-black">{activeGroup.name}</h2>
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
          <div className="flex flex-wrap gap-2 shrink-0 justify-end">
            {!activeGroup.joined && !activeGroup.invitePending && (
              <button
                type="button"
                onClick={joinActiveGroup}
                disabled={activeGroup.joinPending}
                className="px-4 py-2 rounded-full bg-primary text-white text-sm font-bold disabled:opacity-60"
              >
                {activeGroup.joinPending
                  ? t('community.joinRequestSent')
                  : activeGroup.joinPolicy === 'approval'
                    ? t('community.requestToJoin')
                    : t('community.join')}
              </button>
            )}
            {activeGroup.invitePending && (
              <span className="px-4 py-2 rounded-full border border-primary/30 text-primary text-sm font-bold">
                {t('community.groupInviteSent')}
              </span>
            )}
            {activeGroup.joined && activeGroup.myRole !== 'owner' && (
              <button
                type="button"
                onClick={() => setLeaveConfirmGroupId(activeGroup.id)}
                className="px-4 py-2 rounded-full border border-subtle text-sm font-bold text-muted hover:text-red-400 hover:border-red-400/40"
              >
                {t('community.leaveGroup')}
              </button>
            )}
            {activeGroup.canManage && (
              <button
                type="button"
                onClick={() => setShowManage(true)}
                className="px-4 py-2 rounded-full border border-subtle text-sm font-bold hover:border-primary/40"
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
              setGroupPosts((p) => [res.data!, ...p]);
              return res.data;
            }
            return null;
          }}
        />

        {postsLoading && <p className="text-primary animate-pulse text-sm">{t('community.loading')}</p>}

        <div className={`space-y-5 sm:space-y-6 transition-opacity ${refreshing ? 'opacity-60 pointer-events-none' : ''}`}>
          {groupPosts.map((post, i) => (
            <CommunityPostCard
              key={post.id}
              post={post}
              index={i}
              onPostChange={(updated) =>
                setGroupPosts((ps) => ps.map((p) => (p.id === post.id ? updated : p)))
              }
              onDelete={user?.id === post.authorId ? () => deletePost(post.id) : undefined}
            />
          ))}
          {!postsLoading && groupPosts.length === 0 && (
            <div className={`${feedPanel} p-12 text-center text-muted text-sm`}>{t('community.groupFeedEmpty')}</div>
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
                setShowManage(false);
                loadGroups();
              }}
              onDeleted={() => {
                setShowManage(false);
                setActiveGroup(null);
                setGroupPosts([]);
                loadGroups();
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
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={communityPageClass}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black">{t('community.groupsTitle')}</h1>
          <p className="text-muted text-sm mt-1">{t('community.groupsSubtitle')}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <CommunityRefreshButton onRefresh={refreshGroupsList} refreshing={refreshing} disabled={loading} />
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="shrink-0 flex items-center gap-1 bg-primary text-white font-bold px-4 py-2.5 rounded-full text-sm"
        >
          <span className="material-symbols-outlined text-lg">add</span>
          {t('community.createGroup')}
        </button>
        </div>
      </div>

      {loading && <p className="text-primary animate-pulse text-sm">{t('community.loading')}</p>}

      <div className="grid gap-3 sm:grid-cols-2">
        {groups.map((g) => (
          <button
            key={g.id}
            type="button"
            onClick={() => openGroup(g)}
            className={`text-left p-5 ${feedPanel} hover:ring-1 hover:ring-primary/30 transition-all`}
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

      {!loading && groups.length === 0 && (
        <motion.div className="rounded-2xl border border-dashed border-border p-12 text-center text-muted text-sm">
          {t('community.groupsEmpty')}
        </motion.div>
      )}

      <AnimatePresence>
        {showCreate && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
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
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('community.groupName')}
                className="w-full bg-elevated border border-subtle rounded-xl px-4 py-3 text-sm"
              />
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder={t('community.groupDescription')}
                className="w-full bg-elevated border border-subtle rounded-xl px-4 py-3 text-sm resize-none"
              />
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="flex-1 py-3 rounded-xl border border-subtle font-bold"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="button"
                  onClick={createGroup}
                  disabled={!name.trim()}
                  className="flex-1 py-3 rounded-xl bg-primary text-white font-bold disabled:opacity-50"
                >
                  {t('community.create')}
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
