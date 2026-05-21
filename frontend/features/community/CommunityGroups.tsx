import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useI18n } from '../../lib/i18n/useI18n';
import communityService from '../../services/communityService';
import type { CommunityGroup, CommunityPost } from '../../types';
import { timeAgo, displayName, roleLabel } from './communityUtils';
import { PostMedia } from './PostMedia';
import { PostMentions } from './PostMentions';
import { useAuthStore } from '../../store/useAuthStore';
import { UserAvatar } from '../../components/ui/UserAvatar';
import { CommunityPostComposer } from './CommunityPostComposer';
import { CommunityPostInteractions } from './CommunityPostInteractions';
import { GroupManageModal } from './GroupManageModal';

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
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);

  const loadGroups = useCallback(() => {
    setLoading(true);
    communityService.getGroups().then((res) => {
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
    if (detail.joined) {
      const res = await communityService.getPosts('for_you', { groupId: group.id });
      setGroupPosts(res.data ?? []);
      if (res.error) setError(res.error);
    } else {
      setGroupPosts([]);
    }
    setPostsLoading(false);
  };

  const joinActiveGroup = async () => {
    if (!activeGroup) return;
    const res = await communityService.joinGroup(activeGroup.id);
    if (res.error) setError(res.error);
    else if (res.data) {
      setActiveGroup(res.data);
      const postsRes = await communityService.getPosts('for_you', { groupId: activeGroup.id });
      setGroupPosts(postsRes.data ?? []);
      loadGroups();
    }
  };

  const toggleJoin = async (group: CommunityGroup, e: React.MouseEvent) => {
    e.stopPropagation();
    if (group.joined) {
      await communityService.leaveGroup(group.id);
    } else {
      await communityService.joinGroup(group.id);
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

  if (activeGroup) {
    const canPost = Boolean(activeGroup.joined && activeGroup.canPost);
    const postDisabledReason = !activeGroup.joined
      ? t('community.joinToPost')
      : !activeGroup.canPost
        ? t('community.adminsOnlyPost')
        : undefined;

    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
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
        </div>

        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-2xl font-black">{activeGroup.name}</h2>
            {activeGroup.description && <p className="text-muted text-sm mt-1">{activeGroup.description}</p>}
            <p className="text-faint text-xs mt-2">
              {activeGroup.membersCount} {t('community.members')} · {activeGroup.postsCount} {t('community.posts')}
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            {!activeGroup.joined && (
              <button
                type="button"
                onClick={joinActiveGroup}
                className="px-4 py-2 rounded-full bg-primary text-white text-sm font-bold"
              >
                {t('community.join')}
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

        <div className="space-y-4">
          {groupPosts.map((post) => {
            const author = post.author;
            const postName = displayName(author);
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
                      displayName={postName}
                      className="size-12 rounded-full object-cover border border-subtle shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-foreground truncate">{postName}</span>
                        {author?.role && (
                          <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-primary/20 text-primary uppercase tracking-wider">
                            {roleLabel(author.role)}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-faint truncate">
                        {handle} · {timeAgo(post.createdAt)}
                      </p>
                    </div>
                  </Link>
                  {isMine && (
                    <button
                      type="button"
                      onClick={() => deletePost(post.id)}
                      className="text-faint hover:text-red-400 p-1"
                    >
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
                  onPostChange={(updated) =>
                    setGroupPosts((ps) => ps.map((p) => (p.id === post.id ? updated : p)))
                  }
                />
              </motion.article>
            );
          })}
          {!postsLoading && groupPosts.length === 0 && (
            <p className="text-center text-muted text-sm py-8">{t('community.groupFeedEmpty')}</p>
          )}
        </div>

        <AnimatePresence>
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
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black">{t('community.groupsTitle')}</h1>
          <p className="text-muted text-sm mt-1">{t('community.groupsSubtitle')}</p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="shrink-0 flex items-center gap-1 bg-primary text-white font-bold px-4 py-2.5 rounded-full text-sm"
        >
          <span className="material-symbols-outlined text-lg">add</span>
          {t('community.createGroup')}
        </button>
      </div>

      {loading && <p className="text-primary animate-pulse text-sm">{t('community.loading')}</p>}

      <div className="grid gap-3 sm:grid-cols-2">
        {groups.map((g) => (
          <button
            key={g.id}
            type="button"
            onClick={() => openGroup(g)}
            className="text-left rounded-2xl border border-border bg-surface/60 p-5 hover:border-primary/40 transition-all"
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
                {g.joined ? t('community.joined') : t('community.join')}
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
  );
};
