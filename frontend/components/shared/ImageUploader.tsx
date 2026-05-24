import React, { useRef, useState } from 'react';
import uploadService, { type UploadFolder } from '../../services/uploadService';
import { UploadProgressBar } from '../ui/UploadProgressBar';

interface Props {
  folder: UploadFolder;
  value?: string | null;
  onChange: (url: string | null) => void;
  /** Tailwind size class for the preview, default `size-24`. */
  size?: string;
  label?: string;
  /** `horizontal` (default) or `stacked` — actions below the preview. */
  layout?: 'horizontal' | 'stacked';
}

export const ImageUploader: React.FC<Props> = ({
  folder,
  value,
  onChange,
  size = 'size-24',
  label = 'Upload image',
  layout = 'horizontal',
}) => {
  const [uploading, setUploading] = useState(false);
  const [uploadPercent, setUploadPercent] = useState(0);
  const [error, setError] = useState<string | null>(null);
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
        <button
          type="button"
          onClick={handlePick}
          className={`${size} rounded-xl bg-elevated border border-dashed border-subtle hover:border-primary/40 flex items-center justify-center text-muted hover:text-primary overflow-hidden transition-all shrink-0`}
        >
          {value && !uploading ? (
            <img src={value} alt="" className="size-full object-cover" />
          ) : uploading ? (
            <span className="material-symbols-outlined text-xl animate-spin">progress_activity</span>
          ) : (
            <span className="material-symbols-outlined text-xl">add_photo_alternate</span>
          )}
        </button>
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
    </div>
  );
};

export default ImageUploader;
