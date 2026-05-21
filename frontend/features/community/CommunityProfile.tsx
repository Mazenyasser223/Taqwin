import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useI18n } from '../../lib/i18n/useI18n';
import { useAuthStore } from '../../store/useAuthStore';
import communityService from '../../services/communityService';
import profileService from '../../services/profileService';
import uploadService from '../../services/uploadService';
import type { CommunityUserProfile, CommunityAuthor, CommunityPost } from '../../types';
import { fallbackAvatar, displayName, communityProfilePath } from './communityUtils';
import { RoleBadge } from './RoleBadge';
import { PostMedia } from './PostMedia';
import { CommunityPostInteractions } from './CommunityPostInteractions';
import { UploadProgressBar } from '../../components/ui/UploadProgressBar';

export const CommunityProfile: React.FC = () => {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { userId: routeUserId } = useParams<{ userId?: string }>();
  const { user, refreshUser } = useAuthStore();
  const targetUserId = routeUserId || user?.id;
  const [profile, setProfile] = useState<CommunityUserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [tab, setTab] = useState<'posts' | 'mentions' | 'reposts' | 'saved' | 'mutual' | 'followers' | 'following'>('posts');
  const [list, setList] = useState<CommunityAuthor[]>([]);
  const [extraPosts, setExtraPosts] = useState<CommunityPost[]>([]);
  const [bioEdit, setBioEdit] = useState('');
  const [bioEditing, setBioEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadPercent, setUploadPercent] = useState(0);
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
    setProfileError(null);
    communityService.getUserProfile(targetUserId).then((res) => {
      if (res.error) {
        setProfile(null);
        setProfileError(res.error);
        setLoading(false);
        return;
      }
      if (res.data) {
        const data = {
          ...res.data,
          followStatus: res.data.followStatus ?? (res.data.isFollowing ? 'accepted' : 'none'),
          isPrivate: res.data.isPrivate ?? false,
          canViewPosts: res.data.canViewPosts ?? true,
          isMutualFollow: res.data.isMutualFollow ?? false,
          blockedByMe: res.data.blockedByMe ?? false,
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
    if (!profile) return;
    if (tab === 'posts' || tab === 'mentions') return;
    if (tab === 'followers') {
      communityService.getFollowers(profile.user.id).then((res) => setList(res.data ?? []));
      return;
    }
    if (tab === 'following') {
      communityService.getFollowing(profile.user.id).then((res) => setList(res.data ?? []));
      return;
    }
    if (tab === 'reposts') {
      communityService.getUserReposts(profile.user.id).then((res) => setExtraPosts(res.data ?? []));
      return;
    }
    if (tab === 'saved') {
      communityService.getUserSaved(profile.user.id).then((res) => setExtraPosts(res.data ?? []));
      return;
    }
    if (tab === 'mutual') {
      communityService.getMutualWith(profile.user.id).then((res) => setList(res.data ?? []));
    }
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
    setUploadPercent(0);
    const { url, error } = await uploadService.uploadFile(file, 'covers', setUploadPercent);
    if (error || !url) {
      setUploadError(error || t('community.uploadFailed'));
      setUploadingCover(false);
      setUploadPercent(0);
      return;
    }
    const res = await profileService.updateProfile({ coverUrl: url });
    setUploadingCover(false);
    setUploadPercent(0);
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
    setUploadingAvatar(true);
    setUploadPercent(0);
    const { url, error } = await uploadService.uploadFile(file, 'avatars', setUploadPercent);
    setUploadingAvatar(false);
    setUploadPercent(0);
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

  const openMessage = async () => {
    if (!profile || profile.isMe) return;
    setActionLoading(true);
    const res = await communityService.startConversation(profile.user.id);
    setActionLoading(false);
    if (res.error) {
      setUploadError(res.error);
      return;
    }
    if (res.data) {
      navigate(`/community/inbox?c=${res.data.id}`);
    }
  };

  const toggleBlock = async () => {
    if (!profile || profile.isMe) return;
    setActionLoading(true);
    const res = profile.blockedByMe
      ? await communityService.unblockUser(profile.user.id)
      : await communityService.blockUser(profile.user.id);
    setActionLoading(false);
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

  if (loading) {
    return <p className="text-primary animate-pulse text-sm">{t('community.loading')}</p>;
  }

  if (profileError || !profile) {
    return (
      <div className="rounded-2xl border border-border bg-surface/50 p-8 text-center">
        <span className="material-symbols-outlined text-4xl text-muted mb-2">block</span>
        <p className="text-sm text-muted">{profileError || t('community.blockedProfile')}</p>
        <Link to="/community/browse" className="inline-block mt-4 text-sm font-bold text-primary hover:underline">
          {t('community.tabBrowse')}
        </Link>
      </div>
    );
  }

  const p = profile.user.profile;
  const cover = p?.coverUrl;
  const savedBio = p?.bio?.trim() ?? '';

  const showUploadProgress = uploadingCover || uploadingAvatar;

  return (
    <div className="space-y-4 -mx-2 sm:mx-0">
      {showUploadProgress && (
        <UploadProgressBar percent={uploadPercent} />
      )}
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
                <RoleBadge role={profile.user.role} className="mt-1" />
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
            savedBio && <p className="mt-4 text-sm text-slate-200 leading-relaxed">{savedBio}</p>
          )}

          {!profile.isMe && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={openMessage}
                disabled={actionLoading || profile.blockedByMe}
                className="flex items-center gap-2 px-4 py-2 rounded-full bg-primary text-white text-xs font-bold disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-lg">mail</span>
                {t('community.message')}
              </button>
              {profile.isMutualFollow && (
                <span className="text-[10px] font-bold text-primary uppercase tracking-wider px-2 py-1 rounded-full bg-primary/10">
                  {t('community.mutualFollow')}
                </span>
              )}
              <button
                type="button"
                onClick={toggleBlock}
                disabled={actionLoading}
                className="flex items-center gap-1.5 px-3 py-2 rounded-full border border-subtle text-xs font-bold text-muted hover:text-red-400 hover:border-red-500/30 disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-base">block</span>
                {profile.blockedByMe ? t('community.unblock') : t('community.block')}
              </button>
            </div>
          )}

          {profile.isMe && (profile.incomingFollowRequests?.length ?? 0) > 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-xs font-bold text-muted uppercase tracking-wider">{t('community.followRequests')}</p>
              {profile.incomingFollowRequests!.map((req) => (
                <div
                  key={req.id}
                  className="flex items-center gap-3 p-3 rounded-xl bg-elevated border border-subtle"
                >
                  <Link to={communityProfilePath(req.follower.id)} className="shrink-0">
                    <img
                      src={req.follower.profile?.avatarUrl || fallbackAvatar(req.follower.id)}
                      alt=""
                      className="size-10 rounded-full object-cover"
                    />
                  </Link>
                  <div className="flex-1 min-w-0">
                    <Link to={communityProfilePath(req.follower.id)} className="font-bold text-sm truncate hover:text-primary block">
                      {displayName(req.follower)}
                    </Link>
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
            {!profile.isMe && !profile.blockedByMe && (
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

      <div className="flex gap-2 border-b border-border pb-2 overflow-x-auto no-scrollbar">
        {(['posts', 'mentions', 'reposts', 'saved', 'mutual', 'followers', 'following'] as const).map((key) => {
          if (key === 'saved' && !profile.isMe) return null;
          if (key === 'mutual' && profile.isMe) return null;
          const label =
            key === 'posts'
              ? t('community.tabPosts')
              : key === 'mentions'
                ? t('community.tabMentions')
              : key === 'reposts'
                ? t('community.tabReposts')
                : key === 'saved'
                  ? t('community.tabSaved')
                  : key === 'mutual'
                    ? t('community.tabMutual')
                    : key === 'followers'
                      ? t('community.followers')
                      : t('community.following');
          return (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`shrink-0 px-4 py-2 text-sm font-bold rounded-lg ${
                tab === key ? 'bg-primary/15 text-primary' : 'text-muted'
              }`}
            >
              {label}
            </button>
          );
        })}
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
              {(post.mediaItems?.length || post.imageUrl || post.videoUrl) && <PostMedia post={post} />}
              <CommunityPostInteractions post={post} onPostChange={updatePost} />
            </article>
          ))}
        </div>
      )}

      {tab === 'mentions' && (
        <div className="space-y-4">
          {!(profile.mentionedPosts?.length) && (
            <p className="text-center text-muted text-sm py-8">{t('community.mentionsEmpty')}</p>
          )}
          {(profile.mentionedPosts ?? []).map((post) => (
            <article key={post.id} className="rounded-2xl border border-border bg-surface/60 overflow-hidden">
              {post.author && post.authorId !== profile.user.id && (
                <Link
                  to={communityProfilePath(post.authorId)}
                  className="flex items-center gap-2 px-4 pt-4 pb-1 hover:opacity-90"
                >
                  <img
                    src={post.author.profile?.avatarUrl || fallbackAvatar(post.authorId)}
                    alt=""
                    className="size-8 rounded-full object-cover"
                  />
                  <span className="text-sm font-bold">{displayName(post.author)}</span>
                </Link>
              )}
              <p className="px-4 pt-2 pb-2 text-sm whitespace-pre-wrap">{post.content}</p>
              {(post.mediaItems?.length || post.imageUrl || post.videoUrl) && <PostMedia post={post} />}
              <CommunityPostInteractions post={post} onPostChange={updatePost} />
            </article>
          ))}
        </div>
      )}

      {(tab === 'reposts' || tab === 'saved') && (
        <div className="space-y-4">
          {extraPosts.length === 0 && (
            <p className="text-center text-muted text-sm py-8">{t('community.empty')}</p>
          )}
          {extraPosts.map((post) => (
            <article key={post.id} className="rounded-2xl border border-border bg-surface/60 overflow-hidden">
              <p className="px-4 pt-4 pb-2 text-sm whitespace-pre-wrap">{post.content}</p>
              {(post.mediaItems?.length || post.imageUrl || post.videoUrl) && <PostMedia post={post} />}
              <CommunityPostInteractions post={post} onPostChange={updatePost} />
            </article>
          ))}
        </div>
      )}

      {tab !== 'posts' && tab !== 'mentions' && tab !== 'reposts' && tab !== 'saved' && (
        <div className="space-y-2">
          {list.map((u) => (
            <Link
              key={u.id}
              to={communityProfilePath(u.id)}
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
