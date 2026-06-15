import React, { useRef, useState } from 'react';
import { useI18n } from '../../lib/i18n/useI18n';
import uploadService from '../../services/uploadService';
import { UploadProgressBar } from '../../components/ui/UploadProgressBar';
import { resolveMediaUrl } from '../../lib/mediaUrl';

const MAX_PHOTOS = 12;

interface Props {
  galleryUrls: string[];
  videoUrl: string | null;
  onGalleryChange: (urls: string[]) => void;
  onVideoChange: (url: string | null) => void;
}

export const GymMediaSection: React.FC<Props> = ({
  galleryUrls,
  videoUrl,
  onGalleryChange,
  onVideoChange,
}) => {
  const { t } = useI18n();
  const photoInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [videoBusy, setVideoBusy] = useState(false);
  const [photoPct, setPhotoPct] = useState(0);
  const [videoPct, setVideoPct] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const handlePhotos = async (files: FileList | null) => {
    if (!files?.length || photoBusy) return;
    const remaining = MAX_PHOTOS - galleryUrls.length;
    if (remaining <= 0) {
      setError(t('profile.gymPhotosMax'));
      return;
    }
    setPhotoBusy(true);
    setError(null);
    const next = [...galleryUrls];
    for (const file of Array.from(files).slice(0, remaining)) {
      setPhotoPct(0);
      const res = await uploadService.uploadImage(file, 'gyms', setPhotoPct);
      if (res.error) {
        setError(res.error);
        break;
      }
      if (res.url) next.push(res.url);
    }
    onGalleryChange(next);
    setPhotoBusy(false);
    setPhotoPct(0);
    if (photoInputRef.current) photoInputRef.current.value = '';
  };

  const handleVideo = async (file?: File) => {
    if (!file || videoBusy) return;
    setVideoBusy(true);
    setVideoPct(0);
    setError(null);
    const res = await uploadService.uploadFile(file, 'gyms', setVideoPct);
    setVideoBusy(false);
    setVideoPct(0);
    if (res.error) {
      setError(res.error);
      return;
    }
    if (res.url) onVideoChange(res.url);
    if (videoInputRef.current) videoInputRef.current.value = '';
  };

  return (
    <section className="glass-panel rounded-3xl p-6 md:p-8 border-subtle space-y-6">
      <div>
        <h2 className="text-lg font-black text-foreground">{t('profile.gymMediaTitle')}</h2>
        <p className="text-sm text-faint mt-1">{t('profile.gymMediaHint')}</p>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[10px] font-black uppercase tracking-widest text-faint">
            {t('profile.gymPhotos')} ({galleryUrls.length}/{MAX_PHOTOS})
          </p>
          {galleryUrls.length < MAX_PHOTOS && (
            <button
              type="button"
              disabled={photoBusy}
              onClick={() => photoInputRef.current?.click()}
              className="text-xs font-bold text-primary hover:underline disabled:opacity-50"
            >
              {photoBusy ? t('profile.uploading') : t('profile.gymAddPhoto')}
            </button>
          )}
        </div>
        <input
          ref={photoInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          multiple
          className="hidden"
          onChange={(e) => void handlePhotos(e.target.files)}
        />
        {galleryUrls.length === 0 ? (
          <button
            type="button"
            disabled={photoBusy}
            onClick={() => photoInputRef.current?.click()}
            className="w-full min-h-[140px] rounded-2xl border border-dashed border-subtle bg-elevated/40 hover:border-primary/40 flex flex-col items-center justify-center gap-2 text-muted hover:text-primary transition-colors"
          >
            <span className="material-symbols-outlined text-4xl">add_photo_alternate</span>
            <span className="text-sm font-bold">{t('profile.gymPhotosEmpty')}</span>
          </button>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {galleryUrls.map((url, i) => (
              <div key={url} className="relative aspect-[4/3] rounded-xl overflow-hidden border border-subtle group">
                <img src={resolveMediaUrl(url)} alt="" className="size-full object-cover" />
                <button
                  type="button"
                  onClick={() => onGalleryChange(galleryUrls.filter((_, idx) => idx !== i))}
                  className="absolute top-2 end-2 size-8 rounded-lg bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                  aria-label="Remove"
                >
                  <span className="material-symbols-outlined text-base">close</span>
                </button>
              </div>
            ))}
            {galleryUrls.length < MAX_PHOTOS && (
              <button
                type="button"
                disabled={photoBusy}
                onClick={() => photoInputRef.current?.click()}
                className="aspect-[4/3] rounded-xl border border-dashed border-subtle flex items-center justify-center text-muted hover:text-primary hover:border-primary/40"
              >
                <span className="material-symbols-outlined text-3xl">add</span>
              </button>
            )}
          </div>
        )}
        {photoBusy && <UploadProgressBar percent={photoPct} />}
      </div>

      <div className="space-y-3 border-t border-subtle pt-5">
        <p className="text-[10px] font-black uppercase tracking-widest text-faint">{t('profile.gymVideo')}</p>
        <input
          ref={videoInputRef}
          type="file"
          accept="video/mp4,video/webm,video/quicktime"
          className="hidden"
          onChange={(e) => void handleVideo(e.target.files?.[0])}
        />
        {videoUrl ? (
          <div className="space-y-2">
            <video
              src={resolveMediaUrl(videoUrl)}
              controls
              className="w-full max-h-64 rounded-2xl border border-subtle bg-black"
            />
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                disabled={videoBusy}
                onClick={() => videoInputRef.current?.click()}
                className="text-xs font-bold text-primary hover:underline"
              >
                {t('profile.gymReplaceVideo')}
              </button>
              <button
                type="button"
                onClick={() => onVideoChange(null)}
                className="text-xs font-bold text-red-400 hover:underline"
              >
                {t('profile.gymRemoveVideo')}
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            disabled={videoBusy}
            onClick={() => videoInputRef.current?.click()}
            className="w-full min-h-[120px] rounded-2xl border border-dashed border-subtle bg-elevated/40 hover:border-primary/40 flex flex-col items-center justify-center gap-2 text-muted hover:text-primary"
          >
            <span className="material-symbols-outlined text-4xl">videocam</span>
            <span className="text-sm font-bold">{t('profile.gymVideoEmpty')}</span>
          </button>
        )}
        {videoBusy && <UploadProgressBar percent={videoPct} />}
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}
    </section>
  );
};
