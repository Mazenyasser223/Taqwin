import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useI18n } from '../../lib/i18n/useI18n';
import { useAuthStore } from '../../store/useAuthStore';
import communityService from '../../services/communityService';
import profileService from '../../services/profileService';
import uploadService from '../../services/uploadService';
import type { CommunityUserProfile, CommunityAuthor, CommunityPost } from '../../types';
import { fallbackAvatar, displayName, roleLabel } from './communityUtils';
import { PostMedia } from './PostMedia';
import { CommunityPostInteractions } from './CommunityPostInteractions';

export const CommunityProfile: React.FC = () => {
  const { t } = useI18n();
  const { userId: routeUserId } = useParams<{ userId?: string }>();
  const { user, refreshUser } = useAuthStore();
  const targetUserId = routeUserId || user?.id;
  const [profile, setProfile] = useState<CommunityUserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'posts' | 'followers' | 'following'>('posts');
  const [list, setList] = useState<CommunityAuthor[]>([]);
  const [bioEdit, setBioEdit] = useState('');
  const [bioEditing, setBioEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [bioSaveError, setBioSaveError] = useState<string | null>(null);
  const avatarRef = useRef<HTMLInputElement>(null);
  const coverRef = useRef<HTMLInputElement>(null);
  const bioInitRef = useRef(false);

  useEffect(() => {
    bioInitRef.current = false;
  }, [targetUserId]);

  const load = useCallback(() => {
    if (!targetUserId) return;
    setLoading(true);
    communityService.getUserProfile(targetUserId).then((res) => {
      if (res.data) {
        const data = {
          ...res.data,
          followStatus: res.data.followStatus ?? (res.data.isFollowing ? 'accepted' : 'none'),
          isPrivate: res.data.isPrivate ?? false,
          canViewPosts: res.data.canViewPosts ?? true,
        };
        setProfile(data);
        const bio = data.user.profile?.bio ?? '';
        setBioEdit(bio);
        if (res.data.isMe && !bioInitRef.current) {
          setBioEditing(!bio.trim());
          bioInitRef.current = true;
        }
      }
      setLoading(false);
    });
  }, [targetUserId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!profile || tab === 'posts') return;
    const fn =
      tab === 'followers'
        ? () => communityService.getFollowers(profile.user.id)
        : () => communityService.getFollowing(profile.user.id);
    fn().then((res) => setList(res.data ?? []));
  }, [tab, profile]);

  const saveBio = async () => {
    const trimmed = bioEdit.trim();
    setSaving(true);
    setBioSaveError(null);
    const res = await profileService.updateProfile({ bio: trimmed });
    setSaving(false);
    if (res.error || !profile) {
      setBioSaveError(res.error || t('community.saveFailed'));
      return;
    }
    const updatedProfile = res.data!;
    setProfile({
      ...profile,
      user: {
        ...profile.user,
        profile: {
          ...profile.user.profile,
          ...updatedProfile,
          bio: trimmed,
        },
      },
    });
    setBioEditing(false);
    await refreshUser();
  };

  const uploadCover = async (file: File) => {
    setUploadError(null);
    setUploadingCover(true);
    const { url, error } = await uploadService.uploadFile(file, 'covers');
    if (error || !url) {
      setUploadError(error || t('community.uploadFailed'));
      setUploadingCover(false);
      return;
    }
    const res = await profileService.updateProfile({ coverUrl: url });
    setUploadingCover(false);
    if (res.error) {
      setUploadError(res.error);
      return;
    }
    if (profile && res.data) {
      setProfile({
        ...profile,
        user: {
          ...profile.user,
          profile: { ...profile.user.profile, ...res.data, coverUrl: url },
        },
      });
    }
    await refreshUser();
  };

  const uploadAvatar = async (file: File) => {
    setUploadError(null);
    const { url, error } = await uploadService.uploadFile(file, 'avatars');
    if (error || !url) {
      setUploadError(error || t('community.uploadFailed'));
      return;
    }
    const res = await profileService.updateProfile({ avatarUrl: url });
    if (res.error) {
      setUploadError(res.error);
      return;
    }
    if (profile && res.data) {
      setProfile({
        ...profile,
        user: {
          ...profile.user,
          profile: { ...profile.user.profile, ...res.data, avatarUrl: url },
        },
      });
    }
    await refreshUser();
  };

  const toggleFollow = async () => {
    if (!profile) return;
    const res = await communityService.followUser(profile.user.id);
    if (!res.error && res.data) {
      setProfile({
        ...profile,
        isFollowing: res.data.following,
        followStatus: (res.data.followStatus as typeof profile.followStatus) || 'none',
      });
    }
  };

  const acceptRequest = async (followerId: string) => {
    const res = await communityService.acceptFollowRequest(followerId);
    if (!res.error) load();
  };

  const declineRequest = async (followerId: string) => {
    const res = await communityService.declineFollowRequest(followerId);
    if (!res.error) load();
  };

  const followButtonLabel = () => {
    if (!profile) return '';
    if (profile.followStatus === 'accepted') return t('community.followingBtn');
    if (profile.followStatus === 'pending') return t('community.requestedBtn');
    return profile.isPrivate ? t('community.requestFollowBtn') : t('community.followBtn');
  };

  const updatePost = (updated: CommunityPost) => {
    if (!profile) return;
    setProfile({
      ...profile,
      posts: profile.posts.map((p) => (p.id === updated.id ? updated : p)),
    });
  };

  if (loading || !profile) {
    return <p className="text-primary animate-pulse text-sm">{t('community.loading')}</p>;
  }

  const p = profile.user.profile;
  const cover = p?.coverUrl;
  const savedBio = p?.bio?.trim() ?? '';

  return (
    <div className="space-y-4 -mx-2 sm:mx-0">
      <div className="relative rounded-2xl overflow-hidden border border-border bg-surface/60">
        <div className="h-36 sm:h-44 bg-gradient-to-br from-primary/30 to-background relative">
          {cover && <img src={cover} alt="" className="absolute inset-0 w-full h-full object-cover" />}
          {profile.isMe && (
            <>
              <input
                ref={coverRef}
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) uploadCover(file);
                  e.target.value = '';
                }}
              />
              <button
                type="button"
                onClick={() => coverRef.current?.click()}
                disabled={uploadingCover}
                className="absolute bottom-2 right-2 z-10 text-xs font-bold px-3 py-1.5 rounded-full bg-black/60 text-white backdrop-blur hover:bg-black/80 disabled:opacity-60"
              >
                {uploadingCover ? '…' : t('community.editCover')}
              </button>
            </>
          )}
        </div>
        <div className="px-4 pb-4 -mt-12 relative">
          <div className="flex items-end gap-4">
            <div className="relative shrink-0">
              <img
                src={p?.avatarUrl || fallbackAvatar(profile.user.id)}
                alt=""
                className="size-24 rounded-full border-4 border-surface object-cover"
              />
              {profile.isMe && (
                <>
                  <input
                    ref={avatarRef}
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) uploadAvatar(file);
                      e.target.value = '';
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => avatarRef.current?.click()}
                    className="absolute bottom-1 right-1 z-10 size-8 rounded-full bg-primary text-white flex items-center justify-center shadow-lg"
                  >
                    <span className="material-symbols-outlined text-sm">photo_camera</span>
                  </button>
                </>
              )}
            </div>
            <div className="flex-1 min-w-0 pt-10">
              <h2 className="text-xl font-black truncate">{displayName(profile.user)}</h2>
              <p className="text-xs text-faint">{profile.user.handle}</p>
              {profile.user.role && (
                <span className="inline-block mt-1 text-[10px] font-black px-2 py-0.5 rounded-full bg-primary/20 text-primary uppercase">
                  {roleLabel(profile.user.role)}
                </span>
              )}
            </div>
          </div>

          {uploadError && (
            <p className="mt-3 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{uploadError}</p>
          )}

          {profile.gym && (
            <div className="mt-4 flex items-center gap-2 p-3 rounded-xl bg-elevated border border-subtle text-sm">
              <span className="material-symbols-outlined text-primary">apartment</span>
              <div>
                <p className="font-bold">{profile.gym.name}</p>
                <p className="text-xs text-muted">{profile.gym.location}</p>
              </div>
            </div>
          )}

          {bioSaveError && (
            <p className="mt-3 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{bioSaveError}</p>
          )}

          {profile.isMe ? (
            <div className="mt-4">
              {bioEditing ? (
                <div className="space-y-2">
                  <textarea
                    value={bioEdit}
                    onChange={(e) => setBioEdit(e.target.value)}
                    rows={3}
                    placeholder={t('community.bioPlaceholder')}
                    className="w-full bg-elevated border border-subtle rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={saveBio}
                      disabled={saving}
                      className="text-sm font-bold px-4 py-2 rounded-xl bg-primary text-white disabled:opacity-50"
                    >
                      {t('common.save')}
                    </button>
                    {savedBio && (
                      <button
                        type="button"
                        onClick={() => {
                          setBioEdit(savedBio);
                          setBioEditing(false);
                        }}
                        className="text-sm font-bold px-4 py-2 rounded-xl border border-subtle text-muted"
                      >
                        {t('common.cancel')}
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm text-slate-200 leading-relaxed flex-1">
                    {savedBio || <span className="text-muted italic">{t('community.bioEmpty')}</span>}
                  </p>
                  <button
                    type="button"
                    onClick={() => setBioEditing(true)}
                    className="shrink-0 text-xs font-bold text-primary hover:underline"
                  >
                    {t('community.editBio')}
                  </button>
                </div>
              )}
            </div>
          ) : (
            profile.canViewPosts &&
            savedBio && <p className="mt-4 text-sm text-slate-200 leading-relaxed">{savedBio}</p>
          )}

          {profile.isMe && (profile.incomingFollowRequests?.length ?? 0) > 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-xs font-bold text-muted uppercase tracking-wider">{t('community.followRequests')}</p>
              {profile.incomingFollowRequests!.map((req) => (
                <div
                  key={req.id}
                  className="flex items-center gap-3 p-3 rounded-xl bg-elevated border border-subtle"
                >
                  <img
                    src={req.follower.profile?.avatarUrl || fallbackAvatar(req.follower.id)}
                    alt=""
                    className="size-10 rounded-full"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm truncate">{displayName(req.follower)}</p>
                    <p className="text-xs text-faint">{req.follower.handle}</p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => acceptRequest(req.follower.id)}
                      className="px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-bold"
                    >
                      {t('community.accept')}
                    </button>
                    <button
                      type="button"
                      onClick={() => declineRequest(req.follower.id)}
                      className="px-3 py-1.5 rounded-lg border border-subtle text-xs font-bold text-muted"
                    >
                      {t('community.decline')}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-6 mt-4 text-sm">
            <button type="button" onClick={() => setTab('followers')} className="hover:text-primary">
              <span className="font-black">{profile.followersCount}</span>{' '}
              <span className="text-muted">{t('community.followers')}</span>
            </button>
            <button type="button" onClick={() => setTab('following')} className="hover:text-primary">
              <span className="font-black">{profile.followingCount}</span>{' '}
              <span className="text-muted">{t('community.following')}</span>
            </button>
            {!profile.isMe && (
              <button
                type="button"
                onClick={toggleFollow}
                className={`ml-auto px-4 py-1.5 rounded-full text-xs font-bold ${
                  profile.followStatus === 'accepted'
                    ? 'bg-elevated border border-subtle'
                    : profile.followStatus === 'pending'
                      ? 'bg-elevated border border-subtle text-muted'
                      : 'bg-primary text-white'
                }`}
              >
                {followButtonLabel()}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex gap-2 border-b border-border pb-2">
        {(['posts', 'followers', 'following'] as const).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`px-4 py-2 text-sm font-bold rounded-lg ${
              tab === key ? 'bg-primary/15 text-primary' : 'text-muted'
            }`}
          >
            {key === 'posts'
              ? t('community.tabPosts')
              : key === 'followers'
                ? t('community.followers')
                : t('community.following')}
          </button>
        ))}
      </div>

      {tab === 'posts' && (
        <div className="space-y-4">
          {!profile.canViewPosts && !profile.isMe && (
            <div className="rounded-2xl border border-border bg-surface/50 p-8 text-center">
              <span className="material-symbols-outlined text-4xl text-muted mb-2">lock</span>
              <p className="text-sm text-muted">{t('community.privatePosts')}</p>
            </div>
          )}
          {profile.canViewPosts && profile.posts.length === 0 && (
            <p className="text-center text-muted text-sm py-8">{t('community.empty')}</p>
          )}
          {profile.canViewPosts &&
            profile.posts.map((post) => (
            <article key={post.id} className="rounded-2xl border border-border bg-surface/60 overflow-hidden">
              <p className="px-4 pt-4 pb-2 text-sm whitespace-pre-wrap">{post.content}</p>
              {(post.imageUrl || post.videoUrl) && <PostMedia post={post} />}
              <CommunityPostInteractions post={post} onPostChange={updatePost} />
            </article>
          ))}
        </div>
      )}

      {tab !== 'posts' && (
        <div className="space-y-2">
          {list.map((u) => (
            <Link
              key={u.id}
              to={`/community/profile/${u.id}`}
              className="flex items-center gap-3 p-3 rounded-xl border border-border hover:border-primary/40"
            >
              <img src={u.profile?.avatarUrl || fallbackAvatar(u.id)} alt="" className="size-12 rounded-full" />
              <div>
                <p className="font-bold text-sm">{displayName(u)}</p>
                <p className="text-xs text-faint">{u.handle}</p>
              </div>
            </Link>
          ))}
          {list.length === 0 && <p className="text-muted text-sm text-center py-6">{t('community.listEmpty')}</p>}
        </div>
      )}
    </div>
  );
};
