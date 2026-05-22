import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useI18n } from '../../lib/i18n/useI18n';
import { useAuthStore } from '../../store/useAuthStore';
import { useCommunityFollowCountsStore } from '../../store/useCommunityFollowCountsStore';
import communityService from '../../services/communityService';
import profileService from '../../services/profileService';
import uploadService from '../../services/uploadService';
import type { CommunityUserProfile, CommunityAuthor, CommunityPost } from '../../types';
import { fallbackAvatar, displayName, communityProfilePath } from './communityUtils';
import { RoleBadge } from './RoleBadge';
import { UploadProgressBar } from '../../components/ui/UploadProgressBar';
import { AuthorAvatarOpenMenu } from './AuthorAvatarOpenMenu';
import { CommunityPostCard } from './CommunityPostCard';
import { CommunityRefreshButton } from './CommunityRefreshButton';
import {
  communityPageClass,
  feedPanel,
  feedTabActive,
  feedTabIdle,
  feedTabStrip,
} from './communityFeedStyles';

export const CommunityProfile: React.FC = () => {
  const { t } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();
  const { userId: routeUserId } = useParams<{ userId?: string }>();
  const { user, refreshUser } = useAuthStore();
  const myCounts = useCommunityFollowCountsStore((s) => s.myCounts);
  const setMyCounts = useCommunityFollowCountsStore((s) => s.setMyCounts);
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
  const [refreshing, setRefreshing] = useState(false);
  const [hasActiveStory, setHasActiveStory] = useState(false);

  useEffect(() => {
    bioInitRef.current = false;
  }, [targetUserId]);

  const load = useCallback(() => {
    if (!targetUserId) return Promise.resolve();
    setLoading(true);
    setProfileError(null);
    return communityService.getUserProfile(targetUserId).then((res) => {
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
        if (data.isMe) {
          setMyCounts({
            followersCount: data.followersCount,
            followingCount: data.followingCount,
          });
        }
        const bio = data.user.profile?.bio ?? '';
        setBioEdit(bio);
        if (res.data.isMe && !bioInitRef.current) {
          setBioEditing(!bio.trim());
          bioInitRef.current = true;
        }
      }
      setLoading(false);
    });
  }, [targetUserId, setMyCounts]);

  useEffect(() => {
    if (!targetUserId) {
      setHasActiveStory(false);
      return;
    }
    const loadStory = async () => {
      const feedRes = await communityService.getStoriesFeed();
      let bundle = (feedRes.data ?? []).find((b) => b.author.id === targetUserId);
      if (!bundle?.stories?.length) {
        const userRes = await communityService.getUserStories(targetUserId);
        bundle = userRes.data ?? undefined;
      }
      setHasActiveStory(!!bundle?.stories?.length);
    };
    void loadStory();
  }, [targetUserId]);

  const refreshProfile = async () => {
    if (!targetUserId) return;
    setRefreshing(true);
    await load();
    if (tab === 'followers') {
      const res = await communityService.getFollowers(targetUserId);
      setList(res.data ?? []);
    } else if (tab === 'following') {
      const res = await communityService.getFollowing(targetUserId);
      setList(res.data ?? []);
    } else if (tab === 'reposts') {
      const res = await communityService.getUserReposts(targetUserId);
      setExtraPosts(res.data ?? []);
    } else if (tab === 'saved') {
      const res = await communityService.getUserSaved(targetUserId);
      setExtraPosts(res.data ?? []);
    } else if (tab === 'mutual') {
      const res = await communityService.getMutualWith(targetUserId);
      setList(res.data ?? []);
    }
    const feedRes = await communityService.getStoriesFeed();
    let bundle = (feedRes.data ?? []).find((b) => b.author.id === targetUserId);
    if (!bundle?.stories?.length) {
      const userRes = await communityService.getUserStories(targetUserId);
      bundle = userRes.data ?? undefined;
    }
    setHasActiveStory(!!bundle?.stories?.length);
    setRefreshing(false);
  };

  useEffect(() => {
    if (routeUserId && routeUserId === user?.id && location.pathname.includes('/community/browse/')) {
      navigate('/community/profile', { replace: true });
    }
  }, [routeUserId, user?.id, location.pathname, navigate]);

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

  const refreshFollowLists = useCallback(() => {
    if (!profile) return;
    if (tab === 'followers') {
      communityService.getFollowers(profile.user.id).then((res) => setList(res.data ?? []));
    } else if (tab === 'following') {
      communityService.getFollowing(profile.user.id).then((res) => setList(res.data ?? []));
    }
  }, [profile, tab]);

  const applyProfileCounts = (
    counts: { followersCount: number; followingCount: number } | undefined,
    patch: Partial<CommunityUserProfile>,
  ) => {
    if (!profile || !counts) return;
    setProfile({
      ...profile,
      ...patch,
      followersCount: counts.followersCount,
      followingCount: counts.followingCount,
    });
  };

  const toggleFollow = async () => {
    if (!profile) return;
    const prevStatus = profile.followStatus;
    const res = await communityService.followUser(profile.user.id);
    if (res.error || !res.data) return;

    const nextStatus = (res.data.followStatus as typeof profile.followStatus) || 'none';
    const privacyChanged =
      profile.isPrivate &&
      !profile.isMe &&
      ((prevStatus === 'accepted' && nextStatus !== 'accepted') ||
        (prevStatus !== 'accepted' && nextStatus === 'accepted'));

    if (privacyChanged) {
      load();
      return;
    }

    applyProfileCounts(res.data.targetCounts, {
      isFollowing: res.data.following,
      followStatus: nextStatus,
      canViewPosts: profile.isMe || !profile.isPrivate || nextStatus === 'accepted',
    });
    if (res.data.viewerCounts) {
      setMyCounts(res.data.viewerCounts);
    }
    refreshFollowLists();
  };

  const acceptRequest = async (followerId: string) => {
    const res = await communityService.acceptFollowRequest(followerId);
    if (res.error || !res.data) return;
    if (res.data.profileCounts) {
      setMyCounts(res.data.profileCounts);
      setProfile((prev) =>
        prev
          ? {
              ...prev,
              followersCount: res.data!.profileCounts!.followersCount,
              followingCount: res.data!.profileCounts!.followingCount,
              incomingFollowRequests: prev.incomingFollowRequests?.filter(
                (r) => r.follower.id !== followerId,
              ),
            }
          : prev,
      );
      refreshFollowLists();
    } else {
      load();
    }
  };

  const declineRequest = async (followerId: string) => {
    const res = await communityService.declineFollowRequest(followerId);
    if (res.error || !res.data) return;
    setProfile((prev) =>
      prev
        ? {
            ...prev,
            incomingFollowRequests: prev.incomingFollowRequests?.filter(
              (r) => r.follower.id !== followerId,
            ),
            ...(res.data!.profileCounts
              ? {
                  followersCount: res.data!.profileCounts!.followersCount,
                  followingCount: res.data!.profileCounts!.followingCount,
                }
              : {}),
          }
        : prev,
    );
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

  const displayFollowersCount =
    profile?.isMe && myCounts ? myCounts.followersCount : (profile?.followersCount ?? 0);
  const displayFollowingCount =
    profile?.isMe && myCounts ? myCounts.followingCount : (profile?.followingCount ?? 0);

  if (profileError || !profile) {
    return (
      <div className={`${feedPanel} p-8 text-center`}>
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

  const avatarUrl = p?.avatarUrl || fallbackAvatar(profile.user.id);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`${communityPageClass} -mx-2 sm:mx-0`}
    >
      {showUploadProgress && <UploadProgressBar percent={uploadPercent} />}

      <div className="flex items-center justify-between gap-2">
        {!profile.isMe ? (
          <Link
            to="/community/browse"
            className="inline-flex items-center gap-1 text-sm font-bold text-muted hover:text-primary"
          >
            <span className="material-symbols-outlined text-lg">arrow_back</span>
            {t('community.tabBrowse')}
          </Link>
        ) : (
          <span />
        )}
        <CommunityRefreshButton onRefresh={refreshProfile} refreshing={refreshing} disabled={loading} />
      </div>

      <div className={`relative overflow-visible ${feedPanel}`}>
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
              <AuthorAvatarOpenMenu
                userId={profile.user.id}
                avatarUrl={p?.avatarUrl}
                displayName={displayName(profile.user)}
              >
                <img
                  src={avatarUrl}
                  alt=""
                  className="size-24 rounded-full border-4 border-surface object-cover"
                />
              </AuthorAvatarOpenMenu>
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
                    onClick={(e) => {
                      e.stopPropagation();
                      avatarRef.current?.click();
                    }}
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
              <span className="font-black">{displayFollowersCount}</span>{' '}
              <span className="text-muted">{t('community.followers')}</span>
            </button>
            <button type="button" onClick={() => setTab('following')} className="hover:text-primary">
              <span className="font-black">{displayFollowingCount}</span>{' '}
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

      <div className={`${feedTabStrip} overflow-x-auto no-scrollbar`}>
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
              className={tab === key ? feedTabActive : feedTabIdle}
            >
              {label}
            </button>
          );
        })}
      </div>

      {tab === 'posts' && (
        <div className={`space-y-5 sm:space-y-6 transition-opacity ${refreshing ? 'opacity-60 pointer-events-none' : ''}`}>
          {!profile.canViewPosts && !profile.isMe && (
            <div className={`${feedPanel} p-8 text-center`}>
              <span className="material-symbols-outlined text-4xl text-muted mb-2">lock</span>
              <p className="text-sm text-muted">{t('community.privatePosts')}</p>
            </div>
          )}
          {profile.canViewPosts && profile.posts.length === 0 && (
            <div className={`${feedPanel} p-12 text-center text-muted text-sm`}>{t('community.empty')}</div>
          )}
          {profile.canViewPosts &&
            profile.posts.map((post, i) => (
              <CommunityPostCard
                key={post.id}
                post={post}
                index={i}
                showAuthor={false}
                onPostChange={updatePost}
                onDelete={
                  profile.isMe
                    ? () => {
                        void communityService.deletePost(post.id).then((res) => {
                          if (!res.error) {
                            setProfile((prev) =>
                              prev ? { ...prev, posts: prev.posts.filter((p) => p.id !== post.id) } : prev,
                            );
                          }
                        });
                      }
                    : undefined
                }
              />
            ))}
        </div>
      )}

      {tab === 'mentions' && (
        <div className={`space-y-5 sm:space-y-6 transition-opacity ${refreshing ? 'opacity-60 pointer-events-none' : ''}`}>
          {!(profile.mentionedPosts?.length) && (
            <div className={`${feedPanel} p-12 text-center text-muted text-sm`}>{t('community.mentionsEmpty')}</div>
          )}
          {(profile.mentionedPosts ?? []).map((post, i) => (
            <CommunityPostCard key={post.id} post={post} index={i} onPostChange={updatePost} />
          ))}
        </div>
      )}

      {(tab === 'reposts' || tab === 'saved') && (
        <div className={`space-y-5 sm:space-y-6 transition-opacity ${refreshing ? 'opacity-60 pointer-events-none' : ''}`}>
          {extraPosts.length === 0 && (
            <div className={`${feedPanel} p-12 text-center text-muted text-sm`}>{t('community.empty')}</div>
          )}
          {extraPosts.map((post, i) => (
            <CommunityPostCard key={post.id} post={post} index={i} onPostChange={updatePost} />
          ))}
        </div>
      )}

      {tab !== 'posts' && tab !== 'mentions' && tab !== 'reposts' && tab !== 'saved' && (
        <div className="space-y-3">
          {list.map((u) => (
            <Link
              key={u.id}
              to={communityProfilePath(u.id)}
              className={`flex items-center gap-3 p-3 ${feedPanel} hover:ring-1 hover:ring-primary/30 transition-all`}
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
    </motion.div>
  );
};
