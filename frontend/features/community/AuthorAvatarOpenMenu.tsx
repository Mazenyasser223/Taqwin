import React, { useEffect, useRef, useState } from 'react';
import { useI18n } from '../../lib/i18n/useI18n';
import communityService from '../../services/communityService';
import { fallbackAvatar } from './communityUtils';
import { useCommunityStoryViewerStore } from '../../store/useCommunityStoryViewerStore';

interface AuthorAvatarOpenMenuProps {
  userId: string;
  avatarUrl?: string | null;
  displayName: string;
  children: React.ReactNode;
  className?: string;
  /** Show story ring on avatar when user has an active story */
  showStoryRing?: boolean;
}

export const AuthorAvatarOpenMenu: React.FC<AuthorAvatarOpenMenuProps> = ({
  userId,
  avatarUrl,
  displayName,
  children,
  className = '',
  showStoryRing = true,
}) => {
  const { t } = useI18n();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [photoOpen, setPhotoOpen] = useState(false);
  const [hasActiveStory, setHasActiveStory] = useState(false);
  const [placeStart, setPlaceStart] = useState<'end' | 'start'>('end');
  const openStoryForUserId = useCommunityStoryViewerStore((s) => s.openStoryForUserId);

  const src = avatarUrl || fallbackAvatar(userId);

  const loadStoryAvailability = async () => {
    const feedRes = await communityService.getStoriesFeed();
    let bundle = (feedRes.data ?? []).find((b) => b.author.id === userId);
    if (!bundle?.stories?.length) {
      const userRes = await communityService.getUserStories(userId);
      bundle = userRes.data ?? undefined;
    }
    setHasActiveStory(!!bundle?.stories?.length);
  };

  useEffect(() => {
    void loadStoryAvailability();
  }, [userId]);

  useEffect(() => {
    if (menuOpen) void loadStoryAvailability();
  }, [menuOpen, userId]);

  const updatePlacement = () => {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return;
    const menuWidth = 160;
    const pad = 8;
    const fitsRight = rect.right + pad + menuWidth <= window.innerWidth - pad;
    setPlaceStart(fitsRight ? 'end' : 'start');
  };

  useEffect(() => {
    if (!menuOpen && !photoOpen) return;
    updatePlacement();
    window.addEventListener('resize', updatePlacement);
    window.addEventListener('scroll', updatePlacement, true);
    return () => {
      window.removeEventListener('resize', updatePlacement);
      window.removeEventListener('scroll', updatePlacement, true);
    };
  }, [menuOpen, photoOpen]);

  useEffect(() => {
    if (!menuOpen && !photoOpen) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current?.contains(e.target as Node)) return;
      const target = e.target as HTMLElement;
      if (target.closest('[data-avatar-popover]')) return;
      setMenuOpen(false);
      setPhotoOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [menuOpen, photoOpen]);

  const onAvatarClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setPhotoOpen(false);
    updatePlacement();
    setMenuOpen((v) => !v);
  };

  const onViewStory = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setMenuOpen(false);
    const rect = wrapRef.current?.getBoundingClientRect() ?? null;
    await openStoryForUserId(userId, rect);
  };

  const onViewPhoto = (e: React.MouseEvent) => {
    e.stopPropagation();
    setMenuOpen(false);
    updatePlacement();
    setPhotoOpen(true);
  };

  const popoverSideClass =
    placeStart === 'end'
      ? 'left-full ml-2 origin-top-left'
      : 'right-full mr-2 origin-top-right';

  const ring = showStoryRing && hasActiveStory;

  return (
    <div ref={wrapRef} className={`relative shrink-0 ${className}`}>
      <div
        role="presentation"
        onClick={onAvatarClick}
        className={`cursor-pointer rounded-full ${ring ? 'p-0.5 bg-gradient-to-tr from-primary via-amber-400 to-pink-500' : ''}`}
      >
        {children}
      </div>

      {menuOpen && (
        <div
          data-avatar-popover
          className={`absolute top-0 z-[85] w-[9.5rem] rounded-xl bg-surface border border-border shadow-lg p-1.5 flex flex-col gap-0.5 ${popoverSideClass}`}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            disabled={!hasActiveStory}
            onClick={onViewStory}
            className="w-full text-left px-2.5 py-2 rounded-lg text-xs font-bold text-foreground hover:bg-elevated disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {t('community.viewStory')}
          </button>
          <button
            type="button"
            onClick={onViewPhoto}
            className="w-full text-left px-2.5 py-2 rounded-lg text-xs font-bold text-foreground hover:bg-elevated"
          >
            {t('community.viewProfilePhoto')}
          </button>
        </div>
      )}

      {photoOpen && (
        <div
          data-avatar-popover
          className={`absolute top-0 z-[85] w-[12.5rem] rounded-xl bg-surface border border-border shadow-lg p-2 ${popoverSideClass}`}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => setPhotoOpen(false)}
            className="absolute -top-1 -right-1 z-10 size-6 rounded-full bg-elevated border border-subtle flex items-center justify-center text-muted hover:text-foreground"
            aria-label={t('common.close')}
          >
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
          <img
            src={src}
            alt={displayName}
            className="w-full max-w-[11rem] max-h-[11rem] rounded-lg object-cover mx-auto"
          />
        </div>
      )}
    </div>
  );
};
