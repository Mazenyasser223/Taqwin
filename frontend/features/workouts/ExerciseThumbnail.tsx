import React, { useMemo, useState } from 'react';
import {
  exerciseThumbnailCandidates,
  exerciseThumbnailProps,
  type ExerciseThumbnailPriority,
} from './exerciseThumbUrl';

type Props = {
  src?: string | null;
  alt: string;
  className?: string;
  priority?: ExerciseThumbnailPriority;
};

export function ExerciseThumbnail({ src, alt, className = '', priority = 'auto' }: Props) {
  const candidates = useMemo(() => exerciseThumbnailCandidates(src), [src]);
  const [index, setIndex] = useState(0);
  const currentSrc = candidates[Math.min(index, candidates.length - 1)];
  const imgProps = exerciseThumbnailProps(priority);

  return (
    <img
      {...imgProps}
      src={currentSrc}
      alt={alt}
      className={className}
      sizes="(max-width: 640px) 50vw, (max-width: 1280px) 25vw, 240px"
      onError={() => {
        setIndex((i) => (i < candidates.length - 1 ? i + 1 : i));
      }}
    />
  );
}
