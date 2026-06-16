import React, { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useI18n } from '../../lib/i18n/useI18n';
import uploadService from '../../services/uploadService';
import { UploadProgressBar } from '../../components/ui/UploadProgressBar';
import type { PostMediaItem } from '../../types';
import { resolveMediaUrl } from '../../lib/mediaUrl';
import { composerToolbarBtn } from './communityFeedStyles';

export type DraftMediaItem = PostMediaItem & { key: string };

function newKey() {
  return `m-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

interface PostMediaEditorProps {
  items: DraftMediaItem[];
  onChange: (items: DraftMediaItem[]) => void;
  onError?: (message: string) => void;
  disabled?: boolean;
  /** Hide attach buttons (use PostMediaAttachButtons in toolbar). */
  hideAttachButtons?: boolean;
  buttonClassName?: string;
  showButtonLabels?: boolean;
}

function usePostMediaUpload(
  items: DraftMediaItem[],
  onChange: (items: DraftMediaItem[]) => void,
  onError?: (message: string) => void,
) {
  const [uploading, setUploading] = useState(false);
  const [uploadPercent, setUploadPercent] = useState(0);
  const [uploadPhase, setUploadPhase] = useState<'upload' | 'processing'>('upload');
  const imageRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);

  const uploadFiles = async (files: FileList, kind: 'image' | 'video') => {
    setUploading(true);
    setUploadPhase('upload');
    const fileList = Array.from(files);
    const added: DraftMediaItem[] = [];
    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      const { url, error: upErr } = await uploadService.uploadFile(file, 'posts', (p, phase) => {
        if (phase) setUploadPhase(phase);
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
    setUploadPhase('upload');
    if (added.length) onChange([...items, ...added]);
  };

  return {
    uploading,
    uploadPercent,
    uploadPhase,
    imageRef,
    videoRef,
    uploadFiles,
  };
}

export { usePostMediaUpload };

interface PostMediaAttachButtonsProps {
  disabled?: boolean;
  uploading?: boolean;
  imageRef: React.RefObject<HTMLInputElement | null>;
  videoRef: React.RefObject<HTMLInputElement | null>;
  onPickImages: (files: FileList) => void;
  onPickVideos: (files: FileList) => void;
  buttonClassName?: string;
  showLabels?: boolean;
  className?: string;
}

export const PostMediaAttachButtons: React.FC<PostMediaAttachButtonsProps> = ({
  disabled = false,
  uploading = false,
  imageRef,
  videoRef,
  onPickImages,
  onPickVideos,
  buttonClassName,
  showLabels = false,
  className = '',
}) => {
  const { t } = useI18n();
  const btnClass = buttonClassName ?? composerToolbarBtn;

  return (
    <div className={`flex items-center gap-0.5 ${className}`}>
      <input
        ref={imageRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) onPickImages(e.target.files);
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
          if (e.target.files?.length) onPickVideos(e.target.files);
          e.target.value = '';
        }}
      />
      <button
        type="button"
        disabled={disabled || uploading}
        onClick={() => imageRef.current?.click()}
        className={btnClass}
        title={t('community.addImage')}
        aria-label={t('community.addImage')}
      >
        <span className="material-symbols-outlined text-[1.2rem]">image</span>
        {showLabels && <span className="hidden sm:inline text-xs font-semibold">{t('community.addImage')}</span>}
      </button>
      <button
        type="button"
        disabled={disabled || uploading}
        onClick={() => videoRef.current?.click()}
        className={btnClass}
        title={t('community.addVideo')}
        aria-label={t('community.addVideo')}
      >
        <span className="material-symbols-outlined text-[1.2rem]">videocam</span>
        {showLabels && <span className="hidden sm:inline text-xs font-semibold">{t('community.addVideo')}</span>}
      </button>
    </div>
  );
};

export const PostMediaEditor: React.FC<PostMediaEditorProps> = ({
  items,
  onChange,
  onError,
  disabled = false,
  hideAttachButtons = false,
  buttonClassName,
  showButtonLabels = false,
}) => {
  const upload = usePostMediaUpload(items, onChange, onError);
  const { uploading, uploadPercent, uploadPhase, imageRef, videoRef, uploadFiles } = upload;

  const remove = (key: string) => {
    onChange(items.filter((m) => m.key !== key));
  };

  if (hideAttachButtons) {
    if (!items.length) return null;
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {items.map((m) => (
          <div key={m.key} className="relative rounded-xl overflow-hidden border border-white/[0.08] bg-black/30 aspect-square group">
            {m.mediaType === 'video' ? (
              <video src={resolveMediaUrl(m.url)} className="w-full h-full object-cover" muted playsInline preload="metadata" />
            ) : (
              <img src={resolveMediaUrl(m.url)} alt="" className="w-full h-full object-cover" loading="lazy" />
            )}
            <button
              type="button"
              disabled={disabled}
              onClick={() => remove(m.key)}
              className="absolute top-1.5 right-1.5 size-7 rounded-full bg-black/75 text-white flex items-center justify-center opacity-90 hover:opacity-100 transition-opacity"
            >
              <span className="material-symbols-outlined text-base">close</span>
            </button>
          </div>
        ))}
      </div>
    );
  }

  if (!items.length && !uploading) {
    return (
      <PostMediaAttachButtons
        disabled={disabled}
        uploading={uploading}
        imageRef={imageRef}
        videoRef={videoRef}
        onPickImages={(files) => void uploadFiles(files, 'image')}
        onPickVideos={(files) => void uploadFiles(files, 'video')}
        buttonClassName={buttonClassName}
        showLabels={showButtonLabels}
      />
    );
  }

  return (
    <div className="space-y-2">
      {items.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {items.map((m) => (
            <div key={m.key} className="relative rounded-xl overflow-hidden border border-white/[0.08] bg-black/30 aspect-square group">
              {m.mediaType === 'video' ? (
                <video src={resolveMediaUrl(m.url)} className="w-full h-full object-cover" muted playsInline preload="metadata" />
              ) : (
                <img src={resolveMediaUrl(m.url)} alt="" className="w-full h-full object-cover" loading="lazy" />
              )}
              <button
                type="button"
                disabled={disabled}
                onClick={() => remove(m.key)}
                className="absolute top-1.5 right-1.5 size-7 rounded-full bg-black/75 text-white flex items-center justify-center opacity-90 hover:opacity-100 transition-opacity"
              >
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>
          ))}
        </div>
      )}
      {!hideAttachButtons && (
        <PostMediaAttachButtons
          disabled={disabled}
          uploading={uploading}
          imageRef={imageRef}
          videoRef={videoRef}
          onPickImages={(files) => void uploadFiles(files, 'image')}
          onPickVideos={(files) => void uploadFiles(files, 'video')}
          buttonClassName={buttonClassName}
          showLabels={showButtonLabels}
        />
      )}
      {uploading && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <UploadProgressBar percent={uploadPercent} phase={uploadPhase} />
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
