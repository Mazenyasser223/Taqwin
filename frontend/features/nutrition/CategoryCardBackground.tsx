import React, { useMemo, useState } from 'react';
import { categoryImageCandidates } from './nutritionCategoryTheme';

type Props = {
  categoryId: string;
};

export const CategoryCardBackground: React.FC<Props> = ({ categoryId }) => {
  const candidates = useMemo(() => categoryImageCandidates(categoryId), [categoryId]);
  const [index, setIndex] = useState(0);
  const src = candidates[Math.min(index, candidates.length - 1)];

  return (
    <img
      src={src}
      alt=""
      className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-110"
      loading="lazy"
      decoding="async"
      draggable={false}
      onError={() => {
        setIndex((i) => (i < candidates.length - 1 ? i + 1 : i));
      }}
    />
  );
};
