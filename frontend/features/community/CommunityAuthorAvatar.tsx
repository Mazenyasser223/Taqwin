import React from 'react';
import { fallbackAvatar } from './communityUtils';
import { AuthorAvatarOpenMenu } from './AuthorAvatarOpenMenu';

interface CommunityAuthorAvatarProps {
  userId: string;
  avatarUrl?: string | null;
  displayName: string;
  className?: string;
  imageClassName?: string;
  showStoryRing?: boolean;
}

export const CommunityAuthorAvatar: React.FC<CommunityAuthorAvatarProps> = ({
  userId,
  avatarUrl,
  displayName,
  className = '',
  imageClassName = 'size-12 rounded-full object-cover shrink-0 ring-2 ring-primary/15',
  showStoryRing = true,
}) => (
    <AuthorAvatarOpenMenu
      userId={userId}
      avatarUrl={avatarUrl}
      displayName={displayName}
      className={className}
      showStoryRing={showStoryRing}
    >
      <img src={avatarUrl || fallbackAvatar(userId)} alt="" className={imageClassName} />
    </AuthorAvatarOpenMenu>
);
