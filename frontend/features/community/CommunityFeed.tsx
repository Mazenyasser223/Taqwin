import React, { useEffect, useState } from 'react';
import { useI18n } from '../../lib/i18n/useI18n';
import { motion, AnimatePresence } from 'framer-motion';
import { staggerContainer, itemVariants, buttonPress, snapTransition } from '../../lib/motion';
import { Magnetic } from '../../components/shared/MotionWrappers';
import { CommunityVisual } from '../../3d/PageSpecificVisuals';
import communityService from '../../services/communityService';
import type { CommunityComment, CommunityPost } from '../../types';
import { useAuthStore } from '../../store/useAuthStore';

interface FeedPost extends CommunityPost {
  likedByMe?: boolean;
  _count?: { comments?: number; likes?: number };
}

function timeAgo(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.floor(hr / 24);
  return `${d}d ago`;
}

const FALLBACK_AVATAR = (id: string) => `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(id)}`;

export const CommunityFeed: React.FC = () => {
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerContent, setComposerContent] = useState('');
  const [composerImage, setComposerImage] = useState('');
  const [composerSubmitting, setComposerSubmitting] = useState(false);
  const [openComments, setOpenComments] = useState<Record<string, CommunityComment[] | undefined>>({});
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const { user } = useAuthStore();
  const { t } = useI18n();

  const reload = () => {
    setLoading(true);
    communityService.getPosts().then((res) => {
      if (res.error) setError(res.error);
      else setPosts((res.data ?? []) as FeedPost[]);
      setLoading(false);
    });
  };

  useEffect(() => {
    reload();
  }, []);

  const handleLike = async (post: FeedPost) => {
    setPosts((ps) =>
      ps.map((p) =>
        p.id === post.id
          ? {
              ...p,
              likedByMe: !p.likedByMe,
              likesCount: p.likesCount + (p.likedByMe ? -1 : 1),
            }
          : p
      )
    );
    const res = await communityService.likePost(post.id);
    if (res.data) {
      setPosts((ps) => ps.map((p) => (p.id === post.id ? (res.data as FeedPost) : p)));
    }
  };

  const submitPost = async () => {
    if (!composerContent.trim()) return;
    setComposerSubmitting(true);
    const res = await communityService.createPost({
      content: composerContent.trim(),
      imageUrl: composerImage.trim() || undefined,
    });
    setComposerSubmitting(false);
    if (res.error) {
      setError(res.error);
    } else {
      setComposerContent('');
      setComposerImage('');
      setComposerOpen(false);
      if (res.data) setPosts((ps) => [res.data as FeedPost, ...ps]);
    }
  };

  const loadComments = async (postId: string) => {
    if (openComments[postId]) {
      setOpenComments((o) => ({ ...o, [postId]: undefined }));
      return;
    }
    const res = await communityService.getComments(postId);
    setOpenComments((o) => ({ ...o, [postId]: res.data ?? [] }));
  };

  const submitComment = async (postId: string) => {
    const draft = commentDrafts[postId]?.trim();
    if (!draft) return;
    const res = await communityService.addComment(postId, { content: draft });
    if (res.data) {
      setOpenComments((o) => ({ ...o, [postId]: [...(o[postId] ?? []), res.data!] }));
      setCommentDrafts((d) => ({ ...d, [postId]: '' }));
      setPosts((ps) =>
        ps.map((p) => (p.id === postId ? { ...p, _count: { ...(p._count ?? {}), comments: ((p._count?.comments ?? 0) + 1) } } : p))
      );
    }
  };

  const handleDelete = async (postId: string) => {
    const res = await communityService.deletePost(postId);
    if (!res.error) {
      setPosts((ps) => ps.filter((p) => p.id !== postId));
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-10">
      <div className="flex justify-between items-end relative">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={snapTransition} className="relative z-10">
          <h1 className="text-4xl font-black tracking-tight">{t('community.title')}</h1>
          <p className="text-muted mt-2 font-medium">{t('community.subtitleLong')}</p>
        </motion.div>
        <div className="relative z-10">
          <Magnetic>
            <motion.button
              variants={buttonPress}
              whileHover="hover"
              whileTap="tap"
              onClick={() => setComposerOpen(true)}
              className="bg-primary text-white font-black px-8 py-3.5 rounded-2xl flex items-center gap-3 shadow-2xl shadow-primary/30"
            >
              <span className="material-symbols-outlined">add_circle</span>
              {t('community.newPost')}
            </motion.button>
          </Magnetic>
        </div>
        <div className="absolute -top-10 right-0 w-64 h-64 pointer-events-none opacity-40">
          <CommunityVisual />
        </div>
      </div>

      {loading && <div className="text-primary animate-pulse">{t('community.loading')}</div>}
      {error && <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">{error}</div>}
      {!loading && posts.length === 0 && (
        <div className="glass-panel p-10 rounded-3xl text-center text-muted">
          {t('community.empty')}
        </div>
      )}

      <motion.div variants={staggerContainer(0.12)} initial="hidden" animate="visible" className="space-y-8">
        {posts.map((post) => {
          const authorName = post.author?.profile?.displayName ?? post.author?.email ?? 'Anon';
          const isMine = user?.id === post.authorId;
          const comments = openComments[post.id];
          return (
            <motion.div
              key={post.id}
              variants={itemVariants}
              className="bg-surface/50 border border-border rounded-[2.5rem] overflow-hidden shadow-2xl group hover:border-primary/40 transition-all"
            >
              <div className="p-8 flex items-center justify-between">
                <div className="flex items-center gap-5">
                  <div className="size-14 rounded-full border-2 border-primary/20 p-1">
                    <img src={post.author?.profile?.avatarUrl || FALLBACK_AVATAR(post.authorId)} className="size-full rounded-full object-cover" alt={authorName} />
                  </div>
                  <div>
                    <h3 className="font-black text-xl group-hover:text-primary transition-colors">{authorName}</h3>
                    <p className="text-[10px] text-faint font-black uppercase tracking-[0.2em]">{timeAgo(post.createdAt)}</p>
                  </div>
                </div>
                {isMine && (
                  <button onClick={() => handleDelete(post.id)} className="text-faint hover:text-red-400 transition-colors">
                    <span className="material-symbols-outlined">delete</span>
                  </button>
                )}
              </div>

              <div className="px-8 pb-4">
                <p className="text-slate-200 text-lg leading-relaxed mb-6 font-medium whitespace-pre-wrap">{post.content}</p>
              </div>

              {post.imageUrl && (
                <div className="aspect-video overflow-hidden bg-black/40">
                  <img src={post.imageUrl} className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-all duration-1000" alt="post" />
                </div>
              )}

              <div className="p-8 border-t border-border flex items-center justify-between">
                <div className="flex items-center gap-10">
                  <button
                    onClick={() => handleLike(post)}
                    className={`flex items-center gap-3 transition-colors group ${post.likedByMe ? 'text-primary' : 'text-muted hover:text-primary'}`}
                  >
                    <motion.span
                      animate={post.likedByMe ? { scale: [1, 1.6, 1], rotate: [0, -20, 0] } : {}}
                      transition={{ type: 'spring', stiffness: 400, damping: 10 }}
                      className="material-symbols-outlined text-2xl"
                      style={{ fontVariationSettings: post.likedByMe ? "'FILL' 1" : '' }}
                    >
                      favorite
                    </motion.span>
                    <span className="text-sm font-black tabular-nums">{post.likesCount}</span>
                  </button>
                  <button onClick={() => loadComments(post.id)} className="flex items-center gap-3 text-muted hover:text-primary transition-colors group">
                    <span className="material-symbols-outlined text-2xl group-hover:scale-110 transition-transform">mode_comment</span>
                    <span className="text-sm font-black">{post._count?.comments ?? 0}</span>
                  </button>
                </div>
              </div>

              <AnimatePresence>
                {comments !== undefined && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="border-t border-border bg-black/20 overflow-hidden">
                    <div className="p-6 space-y-4">
                      {comments.length === 0 && <p className="text-faint text-sm">{t('community.noComments')}</p>}
                      {comments.map((c) => (
                        <div key={c.id} className="flex items-start gap-3">
                          <img src={c.author?.profile?.avatarUrl || FALLBACK_AVATAR(c.authorId)} className="size-8 rounded-full" alt="" />
                          <div className="flex-1">
                            <p className="text-sm">
                              <span className="font-bold mr-2">{c.author?.profile?.displayName ?? 'Anon'}</span>
                              {c.content}
                            </p>
                            <p className="text-xs text-faint mt-1">{timeAgo(c.createdAt)}</p>
                          </div>
                        </div>
                      ))}
                      <div className="flex gap-2 pt-2 border-t border-subtle">
                        <input
                          value={commentDrafts[post.id] ?? ''}
                          onChange={(e) => setCommentDrafts((d) => ({ ...d, [post.id]: e.target.value }))}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') submitComment(post.id);
                          }}
                          placeholder="Write a comment..."
                          className="flex-1 bg-elevated border border-subtle rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                        />
                        <button onClick={() => submitComment(post.id)} className="px-4 bg-primary text-white text-sm font-bold rounded-xl">
                          Send
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </motion.div>

      <AnimatePresence>
        {composerOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setComposerOpen(false)} className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-6">
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} onClick={(e) => e.stopPropagation()} className="glass-panel w-full max-w-lg rounded-3xl p-8 space-y-6">
              <h3 className="text-2xl font-black">Share progress</h3>
              <textarea
                value={composerContent}
                onChange={(e) => setComposerContent(e.target.value)}
                rows={5}
                placeholder="What's on your mind?"
                className="w-full bg-elevated border border-subtle rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/40 font-medium"
              />
              <input
                value={composerImage}
                onChange={(e) => setComposerImage(e.target.value)}
                placeholder="Image URL (optional)"
                className="w-full bg-elevated border border-subtle rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
              <div className="flex gap-3">
                <button onClick={() => setComposerOpen(false)} className="flex-1 bg-elevated border border-subtle py-3 rounded-xl font-bold">{t('common.cancel')}</button>
                <button onClick={submitPost} disabled={!composerContent.trim() || composerSubmitting} className="flex-1 bg-primary text-white font-bold py-3 rounded-xl disabled:opacity-50">
                  {composerSubmitting ? 'Posting…' : 'Post'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
