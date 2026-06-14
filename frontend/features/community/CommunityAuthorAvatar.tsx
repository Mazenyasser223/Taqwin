import React from 'react';
import { UserAvatar } from '../../components/ui/UserAvatar';
import { communityAvatarUrl, displayName } from './communityUtils';
import { AuthorAvatarOpenMenu } from './AuthorAvatarOpenMenu';
import { PresenceAvatarDot } from './PresenceIndicator';
import type { CommunityAuthor } from '../../types';

interface CommunityAuthorAvatarProps {
  userId: string;
  author?: CommunityAuthor | null;
  avatarUrl?: string | null;
  displayName?: string;
  email?: string;
  className?: string;
  imageClassName?: string;
  showStoryRing?: boolean;
  showPresence?: boolean;
  isOnline?: boolean;
}

export const CommunityAuthorAvatar: React.FC<CommunityAuthorAvatarProps> = ({
  userId,
  author,
  avatarUrl,
  displayName: displayNameProp,
  email,
  className = '',
  imageClassName = 'size-12 rounded-full object-cover shrink-0 ring-2 ring-primary/15',
  showStoryRing = true,
  showPresence = false,
  isOnline,
}) => {
  const name = displayNameProp ?? (author ? displayName(author) : 'Member');
  const photo = avatarUrl ?? communityAvatarUrl(author);
  const authorEmail = email ?? author?.email;

  return (
    <div className={`relative shrink-0 ${className}`}>
      <AuthorAvatarOpenMenu
        userId={userId}
        avatarUrl={photo}
        displayName={name}
        showStoryRing={showStoryRing}
      >
        <UserAvatar
          avatarUrl={photo}
          displayName={name}
          email={authorEmail}
          className={imageClassName}
          imgClassName={imageClassName}
        />
      </AuthorAvatarOpenMenu>
      {showPresence && isOnline === true && <PresenceAvatarDot isOnline />}
    </div>
  );
};
