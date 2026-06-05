import React from 'react';
import { fallbackAvatar } from './communityUtils';
import { resolveMediaUrl } from '../../lib/mediaUrl';
import { AuthorAvatarOpenMenu } from './AuthorAvatarOpenMenu';
import { PresenceAvatarDot } from './PresenceIndicator';

interface CommunityAuthorAvatarProps {
  userId: string;
  avatarUrl?: string | null;
  displayName: string;
  className?: string;
  imageClassName?: string;
  showStoryRing?: boolean;
  showPresence?: boolean;
  isOnline?: boolean;
}

export const CommunityAuthorAvatar: React.FC<CommunityAuthorAvatarProps> = ({
  userId,
  avatarUrl,
  displayName,
  className = '',
  imageClassName = 'size-12 rounded-full object-cover shrink-0 ring-2 ring-primary/15',
  showStoryRing = true,
  showPresence = false,
  isOnline,
}) => (
  <div className={`relative shrink-0 ${className}`}>
    <AuthorAvatarOpenMenu
      userId={userId}
      avatarUrl={avatarUrl}
      displayName={displayName}
      showStoryRing={showStoryRing}
    >
      <img src={resolveMediaUrl(avatarUrl) || fallbackAvatar(userId)} alt="" className={imageClassName} />
    </AuthorAvatarOpenMenu>
    {showPresence && isOnline === true && <PresenceAvatarDot isOnline />}
  </div>
);
