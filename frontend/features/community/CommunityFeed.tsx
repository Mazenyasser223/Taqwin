import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useI18n } from '../../lib/i18n/useI18n';
import { motion } from 'framer-motion';
import communityService, { FeedFilter } from '../../services/communityService';
import uploadService from '../../services/uploadService';
import type { CommunityPost } from '../../types';
import { useAuthStore } from '../../store/useAuthStore';
import { timeAgo, fallbackAvatar, displayName, roleLabel } from './communityUtils';
import { PostMedia } from './PostMedia';
import { CommunityPostInteractions } from './CommunityPostInteractions';

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
  const [error, setError] = useState<string | null>(null);
  const [content, setContent] = useState('');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'image' | 'video' | null>(null);
  const [posting, setPosting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    setLoading(true);
    communityService.getPosts(feed).then((res) => {
      if (res.error) setError(res.error);
      else {
        setPosts(res.data ?? []);
        setError(null);
      }
      setLoading(false);
    });
  }, [feed]);

  useEffect(() => {
    load();
  }, [load]);

  const submitPost = async () => {
    if (!content.trim()) return;
    setPosting(true);
    const res = await communityService.createPost({
      content: content.trim(),
      imageUrl: imageUrl ?? undefined,
      videoUrl: videoUrl ?? undefined,
      mediaType: mediaType ?? undefined,
    });
    setPosting(false);
    if (res.error) setError(res.error);
    else if (res.data) {
      setContent('');
      setImageUrl(null);
      setVideoUrl(null);
      setMediaType(null);
      setPosts((p) => [res.data!, ...p]);
    }
  };

  const onPickMedia = async (e: React.ChangeEvent<HTMLInputElement>, kind: 'image' | 'video') => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const { url, error: upErr } = await uploadService.uploadFile(file, 'posts');
    setUploading(false);
    if (upErr) setError(upErr);
    else if (url) {
      if (kind === 'video') {
        setVideoUrl(url);
        setImageUrl(null);
        setMediaType('video');
      } else {
        setImageUrl(url);
        setVideoUrl(null);
        setMediaType('image');
      }
    }
    e.target.value = '';
  };

  const deletePost = async (id: string) => {
    const res = await communityService.deletePost(id);
    if (!res.error) setPosts((ps) => ps.filter((p) => p.id !== id));
  };

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <motion.div>
        <h1 className="text-3xl font-black tracking-tight">{t('community.title')}</h1>
        <p className="text-muted mt-1 text-sm">{t('community.subtitleLong')}</p>
      </motion.div>

      {/* Composer */}
      <motion.div className="rounded-2xl border border-border bg-surface/80 p-4 space-y-3">
        <div className="flex gap-3">
          <img
            src={user?.profile?.avatarUrl || fallbackAvatar(user?.id ?? 'me')}
            alt=""
            className="size-11 rounded-full border border-primary/30 object-cover shrink-0"
          />
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={2}
            placeholder={t('community.composerPlaceholderLong')}
            className="flex-1 bg-transparent text-foreground placeholder:text-faint resize-none focus:outline-none text-sm"
          />
        </div>
        {(imageUrl || videoUrl) && (
          <motion.div className="relative rounded-xl overflow-hidden">
            {videoUrl ? (
              <video src={videoUrl} controls className="w-full max-h-96 object-contain bg-black" />
            ) : (
              <img src={imageUrl!} alt="" className="w-full h-auto object-contain" />
            )}
            <button
              type="button"
              onClick={() => {
                setImageUrl(null);
                setVideoUrl(null);
                setMediaType(null);
              }}
              className="absolute top-2 right-2 size-8 rounded-full bg-black/60 text-white flex items-center justify-center"
            >
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          </motion.div>
        )}
        <div className="flex items-center justify-between pt-1 border-t border-subtle">
          <div className="flex gap-1">
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onPickMedia(e, 'image')} />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="p-2 rounded-xl text-muted hover:text-primary hover:bg-elevated transition-colors"
              title={t('community.addImage')}
            >
              <span className="material-symbols-outlined">image</span>
            </button>
            <input ref={videoRef} type="file" accept="video/mp4,video/webm,video/quicktime" className="hidden" onChange={(e) => onPickMedia(e, 'video')} />
            <button
              type="button"
              onClick={() => videoRef.current?.click()}
              disabled={uploading}
              className="p-2 rounded-xl text-muted hover:text-primary hover:bg-elevated transition-colors"
              title={t('community.addVideo')}
            >
              <span className="material-symbols-outlined">videocam</span>
            </button>
          </div>
          <button
            type="button"
            onClick={submitPost}
            disabled={!content.trim() || posting}
            className="flex items-center gap-2 bg-primary text-white font-bold px-5 py-2 rounded-full text-sm disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-lg">send</span>
            {posting ? '…' : t('community.post')}
          </button>
        </div>
      </motion.div>

      {/* Feed tabs */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
        {FEEDS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFeed(f.id)}
            className={`shrink-0 px-4 py-2 rounded-full text-xs font-bold border transition-all ${
              feed === f.id
                ? 'border-primary text-primary bg-primary/10'
                : 'border-border text-muted hover:border-primary/40'
            }`}
          >
            {t(f.labelKey)}
          </button>
        ))}
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>
      )}
      {loading && <p className="text-primary animate-pulse text-sm">{t('community.loading')}</p>}
      {!loading && posts.length === 0 && (
        <div className="rounded-2xl border border-border bg-surface/50 p-10 text-center text-muted text-sm">
          {t('community.empty')}
        </div>
      )}

      <div className="space-y-4">
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
                <div className="flex gap-3 min-w-0">
                  <img
                    src={author?.profile?.avatarUrl || fallbackAvatar(post.authorId)}
                    alt=""
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
                </div>
                {isMine && (
                  <button type="button" onClick={() => deletePost(post.id)} className="text-faint hover:text-red-400 p-1">
                    <span className="material-symbols-outlined text-xl">delete</span>
                  </button>
                )}
              </div>

              <p className="px-4 pb-3 text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">{post.content}</p>

              {(post.imageUrl || post.videoUrl) && <PostMedia post={post} className="mb-3" />}

              <CommunityPostInteractions
                post={post}
                onPostChange={(updated) => setPosts((ps) => ps.map((p) => (p.id === post.id ? updated : p)))}
              />

            </motion.article>
          );
        })}
      </div>
    </motion.div>
  );
};
