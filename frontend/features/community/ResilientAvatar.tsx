import React from 'react';
import { UserAvatar } from '../../components/ui/UserAvatar';

interface ResilientAvatarProps {
  userId: string;
  avatarUrl?: string | null;
  displayName?: string | null;
  email?: string | null;
  className?: string;
}

export const ResilientAvatar: React.FC<ResilientAvatarProps> = ({
  avatarUrl,
  displayName,
  email,
  className,
}) => (
  <UserAvatar
    avatarUrl={avatarUrl}
    displayName={displayName}
    email={email}
    className={className}
    imgClassName={className}
  />
);
