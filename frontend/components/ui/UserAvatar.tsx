import React, { useEffect, useState } from 'react';

interface UserAvatarProps {
  avatarUrl?: string | null;
  displayName?: string | null;
  className?: string;
}

export const UserAvatar: React.FC<UserAvatarProps> = ({
  avatarUrl,
  displayName,
  className = 'size-10 rounded-full object-cover border border-subtle shrink-0',
}) => {
  const [imgFailed, setImgFailed] = useState(false);
  const label = (displayName || '?').trim();
  const initial = label.charAt(0).toUpperCase() || '?';
  const url = avatarUrl?.trim();
  const showImage = Boolean(url) && !imgFailed;

  useEffect(() => {
    setImgFailed(false);
  }, [url]);

  if (showImage) {
    return (
      <img
        src={url!}
        alt=""
        className={className}
        onError={() => setImgFailed(true)}
      />
    );
  }

  return (
    <div
      className={`${className} flex items-center justify-center bg-primary/20 text-primary font-black text-sm uppercase`}
      aria-hidden
    >
      {initial}
    </div>
  );
};
