import React, { useMemo, useState } from 'react';
import type { CommunityPost, PostMediaItem } from '../../types';
import { resolveMediaUrl } from '../../lib/mediaUrl';
import { PostMediaViewer } from './PostMediaViewer';

const MAX_VISIBLE = 4;

/** Shared feed media frame — width of post, capped height */
const MEDIA_FRAME = 'w-full h-[min(420px,70vw)] max-h-[min(420px,70vw)] overflow-hidden';

function itemsFromPost(post: CommunityPost): PostMediaItem[] {
  const raw = post.mediaItems?.length
    ? post.mediaItems
    : post.videoUrl
      ? [{ url: post.videoUrl, mediaType: 'video' as const }]
      : post.imageUrl
        ? [{ url: post.imageUrl, mediaType: 'image' as const }]
        : [];
  return raw.map((item) => ({ ...item, url: resolveMediaUrl(item.url) }));
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
    className={`relative overflow-hidden bg-black/40 w-full h-full min-h-0 min-w-0 ${className}`}
  >
    {item.mediaType === 'video' ? (
      <>
        <video
          src={item.url}
          className="absolute inset-0 w-full h-full object-cover pointer-events-none"
          muted
          playsInline
          preload="metadata"
        />
        <span className="absolute inset-0 flex items-center justify-center bg-black/30 pointer-events-none">
          <span className="material-symbols-outlined text-white text-3xl sm:text-4xl">play_circle</span>
        </span>
      </>
    ) : (
      <img
        src={item.url}
        alt=""
        className="absolute inset-0 w-full h-full object-cover"
        loading="lazy"
        draggable={false}
      />
    )}
    {overlay && (
      <span className="absolute inset-0 z-10 flex items-center justify-center bg-black/55 text-white text-xl sm:text-2xl font-black">
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
  const [lightboxMode, setLightboxMode] = useState<'carousel' | 'gallery'>('carousel');

  if (!items.length) return null;

  const extra = items.length > MAX_VISIBLE ? items.length - MAX_VISIBLE : 0;
  const visible = extra > 0 ? items.slice(0, MAX_VISIBLE) : items;

  const grid = (() => {
    const open = (i: number) => {
      setLightboxMode('carousel');
      setLightboxIndex(i);
    };
    const openGallery = () => {
      setLightboxMode('gallery');
      setLightboxIndex(0);
    };

    if (visible.length === 1) {
      const m = visible[0];
      const maxH = 'max-h-[min(420px,70vw)]';

      if (m.mediaType === 'video') {
        return (
          <button
            type="button"
            onClick={() => open(0)}
            className={`w-full ${maxH} overflow-hidden block bg-black/20 cursor-zoom-in`}
          >
            <div className={`relative w-full aspect-video ${maxH} bg-black`}>
              <video
                src={m.url}
                className="w-full h-full object-contain pointer-events-none"
                muted
                playsInline
                preload="metadata"
              />
              <span className="absolute inset-0 flex items-center justify-center bg-black/20 pointer-events-none">
                <span className="material-symbols-outlined text-white text-5xl">play_circle</span>
              </span>
            </div>
          </button>
        );
      }

      return (
        <button
          type="button"
          onClick={() => open(0)}
          className="w-full block cursor-zoom-in overflow-hidden bg-surface/30"
        >
          <img
            src={m.url}
            alt=""
            className={`w-full h-auto ${maxH} object-contain block`}
            loading="lazy"
            draggable={false}
          />
        </button>
      );
    }

    if (visible.length === 2) {
      return (
        <div className={`grid grid-cols-2 gap-0.5 ${MEDIA_FRAME}`}>
          {visible.map((m, i) => (
            <MediaCell key={m.id ?? i} item={m} onOpen={() => open(i)} />
          ))}
        </div>
      );
    }

    if (visible.length === 3) {
      return (
        <div className={`grid grid-cols-2 grid-rows-2 gap-0.5 ${MEDIA_FRAME}`}>
          <MediaCell item={visible[0]} className="row-span-2" onOpen={() => open(0)} />
          <MediaCell item={visible[1]} onOpen={() => open(1)} />
          <MediaCell item={visible[2]} onOpen={() => open(2)} />
        </div>
      );
    }

    return (
      <div className={`grid grid-cols-2 grid-rows-2 gap-0.5 ${MEDIA_FRAME}`}>
        {visible.map((m, i) => (
          <MediaCell
            key={m.id ?? i}
            item={m}
            onOpen={() => (i === 3 && extra > 0 ? openGallery() : open(i))}
            overlay={i === 3 && extra > 0 ? `+${extra}` : undefined}
          />
        ))}
      </div>
    );
  })();

  const viewerOpen = lightboxIndex !== null;

  return (
    <div className={`w-full min-w-0 overflow-hidden ${className}`}>
      {viewerOpen ? (
        <PostMediaViewer
          items={items}
          initialIndex={lightboxIndex}
          mode={lightboxMode}
          onClose={() => {
            setLightboxIndex(null);
            setLightboxMode('carousel');
          }}
        />
      ) : (
        grid
      )}
    </div>
  );
};
