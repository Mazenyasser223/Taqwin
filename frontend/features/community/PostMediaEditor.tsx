import React, { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useI18n } from '../../lib/i18n/useI18n';
import uploadService from '../../services/uploadService';
import { UploadProgressBar } from '../../components/ui/UploadProgressBar';
import type { PostMediaItem } from '../../types';
import { resolveMediaUrl } from '../../lib/mediaUrl';

export type DraftMediaItem = PostMediaItem & { key: string };

function newKey() {
  return `m-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

interface PostMediaEditorProps {
  items: DraftMediaItem[];
  onChange: (items: DraftMediaItem[]) => void;
  onError?: (message: string) => void;
  disabled?: boolean;
}

export const PostMediaEditor: React.FC<PostMediaEditorProps> = ({
  items,
  onChange,
  onError,
  disabled = false,
}) => {
  const { t } = useI18n();
  const [uploading, setUploading] = useState(false);
  const [uploadPercent, setUploadPercent] = useState(0);
  const imageRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);

  const uploadFiles = async (files: FileList, kind: 'image' | 'video') => {
    setUploading(true);
    const fileList = Array.from(files);
    const added: DraftMediaItem[] = [];
    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      const { url, error: upErr } = await uploadService.uploadFile(file, 'posts', (p) => {
        const overall = ((i + p / 100) / fileList.length) * 100;
        setUploadPercent(overall);
      });
      if (upErr) {
        onError?.(upErr);
        continue;
      }
      if (url) {
        added.push({ key: newKey(), url, mediaType: kind });
      }
    }
    setUploading(false);
    setUploadPercent(0);
    if (added.length) onChange([...items, ...added]);
  };

  const remove = (key: string) => {
    onChange(items.filter((m) => m.key !== key));
  };

  return (
    <div className="space-y-2">
      {items.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {items.map((m) => (
            <div key={m.key} className="relative rounded-xl overflow-hidden border border-subtle bg-black/30 aspect-square">
              {m.mediaType === 'video' ? (
                <video src={resolveMediaUrl(m.url)} className="w-full h-full object-cover" muted playsInline preload="metadata" />
              ) : (
                <img src={resolveMediaUrl(m.url)} alt="" className="w-full h-full object-cover" loading="lazy" />
              )}
              <button
                type="button"
                disabled={disabled}
                onClick={() => remove(m.key)}
                className="absolute top-1.5 right-1.5 size-7 rounded-full bg-black/70 text-white flex items-center justify-center"
              >
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="flex gap-1">
        <input
          ref={imageRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) uploadFiles(e.target.files, 'image');
            e.target.value = '';
          }}
        />
        <input
          ref={videoRef}
          type="file"
          accept="video/*"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) uploadFiles(e.target.files, 'video');
            e.target.value = '';
          }}
        />
        <button
          type="button"
          disabled={disabled || uploading}
          onClick={() => imageRef.current?.click()}
          className="p-2 rounded-xl text-muted hover:text-primary hover:bg-elevated transition-colors disabled:opacity-40"
          title={t('community.addImage')}
        >
          <span className="material-symbols-outlined">image</span>
        </button>
        <button
          type="button"
          disabled={disabled || uploading}
          onClick={() => videoRef.current?.click()}
          className="p-2 rounded-xl text-muted hover:text-primary hover:bg-elevated transition-colors disabled:opacity-40"
          title={t('community.addVideo')}
        >
          <span className="material-symbols-outlined">videocam</span>
        </button>
      </div>
      {uploading && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <UploadProgressBar percent={uploadPercent} />
        </motion.div>
      )}
    </div>
  );
};

export function mediaItemsFromPost(post: {
  mediaItems?: PostMediaItem[];
  imageUrl?: string | null;
  videoUrl?: string | null;
}): DraftMediaItem[] {
  if (post.mediaItems?.length) {
    return post.mediaItems.map((m) => ({ ...m, key: m.id || newKey() }));
  }
  if (post.videoUrl) return [{ key: newKey(), url: post.videoUrl, mediaType: 'video' }];
  if (post.imageUrl) return [{ key: newKey(), url: post.imageUrl, mediaType: 'image' }];
  return [];
}

export function toMediaPayload(items: DraftMediaItem[]): PostMediaItem[] {
  return items.map(({ url, mediaType, id }) => ({ url, mediaType, ...(id ? { id } : {}) }));
}
