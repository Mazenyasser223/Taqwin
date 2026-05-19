import React from 'react';
import type { CommunityPost } from '../../types';

interface PostMediaProps {
  post: CommunityPost;
  className?: string;
}

export const PostMedia: React.FC<PostMediaProps> = ({ post, className = '' }) => {
  const type = post.mediaType || (post.videoUrl ? 'video' : post.imageUrl ? 'image' : null);

  if (type === 'video' && post.videoUrl) {
    return (
      <div className={`w-full bg-black ${className}`}>
        <video
          src={post.videoUrl}
          controls
          playsInline
          className="w-full max-h-[min(80vh,720px)] object-contain bg-black"
          preload="metadata"
        />
      </div>
    );
  }

  if (post.imageUrl) {
    return (
      <div className={`w-full bg-black/20 ${className}`}>
        <img src={post.imageUrl} alt="" className="w-full h-auto block object-contain" loading="lazy" />
      </div>
    );
  }

  return null;
};
