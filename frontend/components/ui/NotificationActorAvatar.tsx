import React from 'react';
import { UserAvatar } from './UserAvatar';

interface NotificationActorAvatarProps {
  avatarUrl?: string | null;
  displayName?: string | null;
  className?: string;
}

export const NotificationActorAvatar: React.FC<NotificationActorAvatarProps> = ({
  avatarUrl,
  displayName,
  className = 'size-10',
}) => (
  <UserAvatar
    avatarUrl={avatarUrl}
    displayName={displayName}
    className={`${className} rounded-full object-cover border border-subtle shrink-0`}
  />
);
