import React, { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useI18n } from '../../lib/i18n/useI18n';
import { MentionPicker, finalizeMentions, type MentionSelection } from './MentionPicker';
import { isVideoMediaFile } from './communityUtils';
import { UploadProgressBar } from '../../components/ui/UploadProgressBar';

export interface StoryComposerDraft {
  file: File;
  previewUrl: string;
}

interface StoryComposerModalProps {
  draft: StoryComposerDraft;
  uploading: boolean;
  uploadPercent: number;
  uploadPhase: 'upload' | 'processing';
  onClose: () => void;
  onSubmit: (payload: { caption: string; mentionUserIds: string[] }) => void;
}

export const StoryComposerModal: React.FC<StoryComposerModalProps> = ({
  draft,
  uploading,
  uploadPercent,
  uploadPhase,
  onClose,
  onSubmit,
}) => {
  const { t } = useI18n();
  const [caption, setCaption] = useState('');
  const [mentions, setMentions] = useState<MentionSelection>({ userIds: [], gymIds: [], labels: [] });
  const mentionQueryRef = useRef('');
  const isVideo = isVideoMediaFile(draft.file);

  const handleSubmit = async () => {
    const resolved = await finalizeMentions(mentions, mentionQueryRef.current);
    onSubmit({
      caption: caption.trim(),
      mentionUserIds: resolved.userIds,
    });
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[220] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm"
        onClick={uploading ? undefined : onClose}
      >
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 6 }}
          transition={{ duration: 0.15 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-md glass-panel rounded-[2rem] border border-subtle shadow-2xl overflow-hidden"
        >
          <div className="p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-black text-foreground">{t('community.storyComposerTitle')}</h2>
              <button
                type="button"
                disabled={uploading}
                onClick={onClose}
                className="p-2 rounded-xl hover:bg-elevated text-muted disabled:opacity-40"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="aspect-[9/16] max-h-[42vh] mx-auto rounded-2xl overflow-hidden bg-zinc-950 border border-subtle">
              {isVideo ? (
                <video src={draft.previewUrl} className="size-full object-contain" muted playsInline autoPlay loop />
              ) : (
                <img src={draft.previewUrl} alt="" className="size-full object-contain" />
              )}
            </div>

            {uploading && <UploadProgressBar percent={uploadPercent} phase={uploadPhase} />}

            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              disabled={uploading}
              maxLength={500}
              rows={3}
              placeholder={t('community.storyCaptionPlaceholder')}
              className="w-full rounded-xl border border-subtle bg-elevated px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
            />

            <MentionPicker
              value={mentions}
              onChange={setMentions}
              queryRef={mentionQueryRef}
              usersOnly
            />

            <p className="text-[11px] text-muted">{t('community.storyMentionReshareHint')}</p>

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                disabled={uploading}
                onClick={onClose}
                className="flex-1 py-3 rounded-2xl border border-subtle font-bold text-muted hover:text-foreground disabled:opacity-40"
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                disabled={uploading}
                onClick={() => void handleSubmit()}
                className="flex-1 py-3 rounded-2xl bg-primary text-white font-black disabled:opacity-50"
              >
                {uploading ? t('community.posting') : t('community.storyShare')}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  );
};
