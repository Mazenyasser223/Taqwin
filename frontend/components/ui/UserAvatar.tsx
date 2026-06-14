import React, { useEffect, useState } from 'react';
import { resolveMediaUrl } from '../../lib/mediaUrl';
import { profileInitials } from '../../lib/profileInitials';

interface UserAvatarProps {
  avatarUrl?: string | null;
  displayName?: string | null;
  email?: string | null;
  className?: string;
  imgClassName?: string;
  alt?: string;
}

export const UserAvatar: React.FC<UserAvatarProps> = ({
  avatarUrl,
  displayName,
  email,
  className = 'size-10 rounded-full object-cover border border-subtle shrink-0',
  imgClassName,
  alt = '',
}) => {
  const [imgFailed, setImgFailed] = useState(false);
  const initials = profileInitials(displayName, email);
  const url = resolveMediaUrl(avatarUrl);
  const showImage = Boolean(url) && !imgFailed;
  const imgClass = imgClassName || className;

  useEffect(() => {
    setImgFailed(false);
  }, [url]);

  if (showImage) {
    return (
      <img
        src={url!}
        alt={alt}
        className={imgClass}
        loading="lazy"
        onError={() => setImgFailed(true)}
      />
    );
  }

  return (
    <span
      className={`inline-flex items-center justify-center shrink-0 rounded-full bg-primary/15 text-primary font-bold uppercase select-none ${className}`}
      aria-hidden={!alt}
      title={alt || undefined}
    >
      {initials}
    </span>
  );
};
