import React, { useRef } from 'react';
import {
  useBackgroundVideoPlayback,
  useResponsiveVideoOrientation,
} from '../../lib/responsiveBackgroundVideo';

interface ResponsiveBackgroundVideoProps {
  portraitSrc: string;
  landscapeSrc: string;
  paused?: boolean;
  className?: string;
  onEnded?: () => void;
  onLoadedMetadata?: (video: HTMLVideoElement) => void;
  onTimeUpdate?: (video: HTMLVideoElement) => void;
}

/** One clip at a time — portrait or landscape — to avoid double decode/bandwidth. */
export const ResponsiveBackgroundVideo: React.FC<ResponsiveBackgroundVideoProps> = ({
  portraitSrc,
  landscapeSrc,
  paused = false,
  className = '',
  onEnded,
  onLoadedMetadata,
  onTimeUpdate,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const isLandscape = useResponsiveVideoOrientation();
  const activeSrc = isLandscape ? landscapeSrc : portraitSrc;

  useBackgroundVideoPlayback(videoRef, paused, activeSrc);

  if (paused) return null;

  return (
    <div className={`absolute inset-0 size-full overflow-hidden bg-black ${className}`.trim()}>
      <video
        ref={videoRef}
        key={activeSrc}
        className="absolute inset-0 h-full w-full object-cover object-center [transform:translateZ(0)]"
        src={activeSrc}
        muted
        playsInline
        preload="auto"
        disablePictureInPicture
        aria-hidden
        onEnded={onEnded}
        onLoadedMetadata={(event) => onLoadedMetadata?.(event.currentTarget)}
        onTimeUpdate={(event) => onTimeUpdate?.(event.currentTarget)}
      />
    </div>
  );
};
