import React, { useRef, useState } from 'react';
import uploadService, { type UploadFolder } from '../../services/uploadService';

interface Props {
  folder: UploadFolder;
  value?: string | null;
  onChange: (url: string | null) => void;
  /** Tailwind size class for the preview, default `size-24`. */
  size?: string;
  label?: string;
}

export const ImageUploader: React.FC<Props> = ({ folder, value, onChange, size = 'size-24', label = 'Upload image' }) => {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handlePick = () => {
    if (!uploading) inputRef.current?.click();
  };

  const handleFile = async (file?: File) => {
    if (!file || uploading) return;
    setUploading(true);
    setError(null);
    const res = await uploadService.uploadImage(file, folder);
    setUploading(false);
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
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={handlePick}
          disabled={uploading}
          aria-busy={uploading}
          className={`${size} rounded-2xl bg-white/5 border border-dashed border-white/10 hover:border-primary/40 flex items-center justify-center text-slate-400 hover:text-primary overflow-hidden transition-all disabled:opacity-60`}
        >
          {value && !uploading ? (
            <img src={value} alt="" className="size-full object-cover" />
          ) : uploading ? (
            <span className="material-symbols-outlined text-3xl animate-spin">progress_activity</span>
          ) : (
            <span className="material-symbols-outlined text-3xl">add_photo_alternate</span>
          )}
        </button>
        <div className="space-y-1">
          <button type="button" onClick={handlePick} className="text-xs font-bold text-primary hover:underline">
            {uploading ? 'Uploading…' : value ? 'Replace' : label}
          </button>
          {value && (
            <button type="button" onClick={() => onChange(null)} className="block text-xs text-slate-500 hover:text-red-400">
              Remove
            </button>
          )}
          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>
      </div>
    </div>
  );
};

export default ImageUploader;
