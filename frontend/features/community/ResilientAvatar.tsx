import React, { useEffect, useState } from 'react';
import { resolveMediaUrl } from '../../lib/mediaUrl';
import { fallbackAvatar } from './communityUtils';

interface ResilientAvatarProps {
  userId: string;
  avatarUrl?: string | null;
  className?: string;
}

export const ResilientAvatar: React.FC<ResilientAvatarProps> = ({ userId, avatarUrl, className }) => {
  const fallback = fallbackAvatar(userId);
  const resolved = resolveMediaUrl(avatarUrl) || fallback;
  const [src, setSrc] = useState(resolved);

  useEffect(() => {
    setSrc(resolveMediaUrl(avatarUrl) || fallback);
  }, [avatarUrl, fallback]);

  return (
    <img
      src={src}
      alt=""
      className={className}
      loading="lazy"
      onError={() => {
        setSrc((current) => (current === fallback ? current : fallback));
      }}
    />
  );
};
