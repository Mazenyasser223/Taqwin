import React, { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useI18n } from '../../lib/i18n/useI18n';
import communityService from '../../services/communityService';
import type { CommunityGroup, CommunityPost } from '../../types';
import { timeAgo, fallbackAvatar, displayName } from './communityUtils';
import { PostMedia } from './PostMedia';
import { useAuthStore } from '../../store/useAuthStore';

export const CommunityGroups: React.FC = () => {
  const { t } = useI18n();
  const { user } = useAuthStore();
  const [groups, setGroups] = useState<CommunityGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeGroup, setActiveGroup] = useState<CommunityGroup | null>(null);
  const [groupPosts, setGroupPosts] = useState<CommunityPost[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [postContent, setPostContent] = useState('');

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
    if (!group.joined) {
      await communityService.joinGroup(group.id);
      loadGroups();
    }
    setActiveGroup({ ...group, joined: true });
    const res = await communityService.getPosts('for_you', { groupId: group.id });
    setGroupPosts(res.data ?? []);
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

  const postToGroup = async () => {
    if (!activeGroup || !postContent.trim()) return;
    const res = await communityService.createPost({
      content: postContent.trim(),
      groupId: activeGroup.id,
    });
    if (res.data) {
      setPostContent('');
      setGroupPosts((p) => [res.data!, ...p]);
    }
  };

  if (activeGroup) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
        <button
          type="button"
          onClick={() => setActiveGroup(null)}
          className="flex items-center gap-2 text-muted hover:text-foreground text-sm font-bold"
        >
          <span className="material-symbols-outlined">arrow_back</span>
          {t('community.backToGroups')}
        </button>
        <div>
          <h2 className="text-2xl font-black">{activeGroup.name}</h2>
          {activeGroup.description && <p className="text-muted text-sm mt-1">{activeGroup.description}</p>}
          <p className="text-faint text-xs mt-2">
            {activeGroup.membersCount} {t('community.members')} · {activeGroup.postsCount} {t('community.posts')}
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-surface/60 p-4 flex gap-2">
          <input
            value={postContent}
            onChange={(e) => setPostContent(e.target.value)}
            placeholder={t('community.groupPostPlaceholder')}
            className="flex-1 bg-transparent text-sm focus:outline-none"
          />
          <button type="button" onClick={postToGroup} className="px-4 py-2 bg-primary text-white text-sm font-bold rounded-xl">
            {t('community.post')}
          </button>
        </div>
        <motion.div className="space-y-3">
          {groupPosts.map((post) => (
            <article key={post.id} className="rounded-2xl border border-border bg-surface/50 p-4">
              <div className="flex gap-3 mb-2">
                <img
                  src={post.author?.profile?.avatarUrl || fallbackAvatar(post.authorId)}
                  alt=""
                  className="size-10 rounded-full"
                />
                <div>
                  <p className="font-bold text-sm">{displayName(post.author)}</p>
                  <p className="text-[10px] text-faint">{timeAgo(post.createdAt)}</p>
                </div>
              </div>
              <p className="text-sm text-slate-200 whitespace-pre-wrap">{post.content}</p>
              {(post.imageUrl || post.videoUrl) && <PostMedia post={post} className="mt-3 rounded-xl overflow-hidden" />}
            </article>
          ))}
          {groupPosts.length === 0 && (
            <p className="text-center text-muted text-sm py-8">{t('community.groupFeedEmpty')}</p>
          )}
        </motion.div>
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
                <button type="button" onClick={() => setShowCreate(false)} className="flex-1 py-3 rounded-xl border border-subtle font-bold">
                  {t('common.cancel')}
                </button>
                <button type="button" onClick={createGroup} disabled={!name.trim()} className="flex-1 py-3 rounded-xl bg-primary text-white font-bold disabled:opacity-50">
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
