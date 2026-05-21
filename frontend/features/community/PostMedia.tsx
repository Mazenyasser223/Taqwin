import React, { useMemo, useState } from 'react';
import type { CommunityPost, PostMediaItem } from '../../types';
import { PostMediaLightbox } from './PostMediaLightbox';

const MAX_VISIBLE = 4;

function itemsFromPost(post: CommunityPost): PostMediaItem[] {
  if (post.mediaItems?.length) return post.mediaItems;
  if (post.videoUrl) return [{ url: post.videoUrl, mediaType: 'video' }];
  if (post.imageUrl) return [{ url: post.imageUrl, mediaType: 'image' }];
  return [];
}

interface CellProps {
  item: PostMediaItem;
  overlay?: string;
  className?: string;
  onOpen: () => void;
}

const MediaCell: React.FC<CellProps> = ({ item, overlay, className = '', onOpen }) => (
  <button
    type="button"
    onClick={onOpen}
    className={`relative overflow-hidden bg-black/40 w-full h-full min-h-0 ${className}`}
  >
    {item.mediaType === 'video' ? (
      <>
        <video src={item.url} className="w-full h-full object-cover pointer-events-none" muted playsInline preload="metadata" />
        <span className="absolute inset-0 flex items-center justify-center bg-black/30">
          <span className="material-symbols-outlined text-white text-4xl">play_circle</span>
        </span>
      </>
    ) : (
      <img src={item.url} alt="" className="w-full h-full object-cover" loading="lazy" draggable={false} />
    )}
    {overlay && (
      <span className="absolute inset-0 flex items-center justify-center bg-black/55 text-white text-2xl font-black">
        {overlay}
      </span>
    )}
  </button>
);

interface PostMediaProps {
  post: CommunityPost;
  className?: string;
}

export const PostMedia: React.FC<PostMediaProps> = ({ post, className = '' }) => {
  const items = useMemo(() => itemsFromPost(post), [post]);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  if (!items.length) return null;

  const extra = items.length > MAX_VISIBLE ? items.length - MAX_VISIBLE : 0;
  const visible = extra > 0 ? items.slice(0, MAX_VISIBLE) : items;
  const gridH = 'max-h-[min(420px,70vw)]';

  const grid = (() => {
    const open = (i: number) => setLightboxIndex(i);

    if (visible.length === 1) {
      const m = visible[0];
      return (
        <button
          type="button"
          onClick={() => open(0)}
          className={`w-full bg-black/20 block cursor-zoom-in ${gridH}`}
        >
          {m.mediaType === 'video' ? (
            <div className="relative w-full min-h-[200px]">
              <video src={m.url} className="w-full max-h-[min(80vh,720px)] object-contain bg-black mx-auto pointer-events-none" muted playsInline preload="metadata" />
              <span className="absolute inset-0 flex items-center justify-center bg-black/20 pointer-events-none">
                <span className="material-symbols-outlined text-white text-5xl">play_circle</span>
              </span>
            </div>
          ) : (
            <img src={m.url} alt="" className="w-full h-auto block object-contain max-h-[min(80vh,720px)]" loading="lazy" draggable={false} />
          )}
        </button>
      );
    }

    if (visible.length === 2) {
      return (
        <div className={`grid grid-cols-2 gap-0.5 ${gridH} aspect-[2/1]`}>
          {visible.map((m, i) => (
            <MediaCell key={m.id ?? i} item={m} onOpen={() => open(i)} />
          ))}
        </div>
      );
    }

    if (visible.length === 3) {
      return (
        <div className={`grid grid-cols-2 grid-rows-2 gap-0.5 ${gridH} aspect-square max-w-full`}>
          <MediaCell item={visible[0]} className="row-span-2" onOpen={() => open(0)} />
          <MediaCell item={visible[1]} onOpen={() => open(1)} />
          <MediaCell item={visible[2]} onOpen={() => open(2)} />
        </div>
      );
    }

    return (
      <div className={`grid grid-cols-2 grid-rows-2 gap-0.5 ${gridH} aspect-square max-w-full`}>
        {visible.map((m, i) => (
          <MediaCell
            key={m.id ?? i}
            item={m}
            onOpen={() => open(i)}
            overlay={i === 3 && extra > 0 ? `+${extra}` : undefined}
          />
        ))}
      </div>
    );
  })();

  return (
    <div className={className}>
      {grid}
      {lightboxIndex !== null && (
        <PostMediaLightbox
          items={items}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </div>
  );
};
