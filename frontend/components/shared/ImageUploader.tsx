import React, { useRef, useState } from 'react';
import uploadService, { type UploadFolder } from '../../services/uploadService';
import { UploadProgressBar } from '../ui/UploadProgressBar';
import { ImageLightbox } from '../ui/ImageLightbox';

interface Props {
  folder: UploadFolder;
  value?: string | null;
  onChange: (url: string | null) => void;
  /** Tailwind size class for the preview, default `size-24`. */
  size?: string;
  label?: string;
  /** `horizontal` (default) or `stacked` — actions below the preview. */
  layout?: 'horizontal' | 'stacked';
  previewAlt?: string;
}

export const ImageUploader: React.FC<Props> = ({
  folder,
  value,
  onChange,
  size = 'size-24',
  label = 'Upload image',
  layout = 'horizontal',
  previewAlt = '',
}) => {
  const [uploading, setUploading] = useState(false);
  const [uploadPercent, setUploadPercent] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handlePick = () => {
    if (!uploading) inputRef.current?.click();
  };

  const handleFile = async (file?: File) => {
    if (!file || uploading) return;
    setUploading(true);
    setUploadPercent(0);
    setError(null);
    const res = await uploadService.uploadImage(file, folder, setUploadPercent);
    setUploading(false);
    setUploadPercent(0);
    if (res.error) {
      setError(res.error);
      return;
    }
    if (res.url) onChange(res.url);
  };

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        onChange={(e) => handleFile(e.target.files?.[0])}
        className="hidden"
      />
      <div className={layout === 'stacked' ? 'flex flex-col items-center gap-2' : 'flex items-center gap-4'}>
        {value && !uploading ? (
          <button
            type="button"
            onClick={() => setPreviewOpen(true)}
            className={`${size} shrink-0 overflow-hidden rounded-xl border border-subtle transition-all hover:border-primary/40 hover:ring-2 hover:ring-primary/25 cursor-zoom-in`}
            aria-label={previewAlt || label}
          >
            <img src={value} alt="" className="size-full object-cover" />
          </button>
        ) : (
          <button
            type="button"
            onClick={handlePick}
            className={`${size} flex shrink-0 items-center justify-center overflow-hidden rounded-xl border border-dashed border-subtle bg-elevated text-muted transition-all hover:border-primary/40 hover:text-primary`}
          >
            {uploading ? (
              <span className="material-symbols-outlined animate-spin text-xl">progress_activity</span>
            ) : (
              <span className="material-symbols-outlined text-xl">add_photo_alternate</span>
            )}
          </button>
        )}
        <div className={layout === 'stacked' ? 'flex flex-col items-center gap-0.5 text-center' : 'space-y-1'}>
          <button type="button" onClick={handlePick} className="text-[11px] font-semibold text-primary hover:underline">
            {uploading ? 'Uploading…' : value ? 'Replace' : label}
          </button>
          {value && (
            <button type="button" onClick={() => onChange(null)} className="block text-[11px] text-faint hover:text-red-400">
              Remove
            </button>
          )}
          {error && <p className="text-xs text-red-400">{error}</p>}
          {uploading && <UploadProgressBar percent={uploadPercent} className="max-w-[12rem]" />}
        </div>
      </div>
      {value && (
        <ImageLightbox
          open={previewOpen}
          src={value}
          alt={previewAlt || label}
          onClose={() => setPreviewOpen(false)}
        />
      )}
    </div>
  );
};

export default ImageUploader;
