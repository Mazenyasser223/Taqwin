import React, { useRef, useState } from 'react';
import EmojiPicker, { type EmojiClickData, Theme } from 'emoji-picker-react';
import { useI18n } from '../../lib/i18n/useI18n';

interface InboxEmojiPickerProps {
  onPick: (emoji: string) => void;
  disabled?: boolean;
}

export const InboxEmojiPicker: React.FC<InboxEmojiPickerProps> = ({ onPick, disabled = false }) => {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const handleClick = (data: EmojiClickData) => {
    onPick(data.emoji);
    setOpen(false);
  };

  return (
    <div ref={wrapRef} className="relative shrink-0">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className="p-2 text-muted hover:text-primary disabled:opacity-40"
        title={t('community.addEmoji')}
      >
        <span className="material-symbols-outlined">mood</span>
      </button>
      {open && (
        <>
          <button
            type="button"
            aria-label={t('common.close')}
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div className="absolute bottom-full left-0 mb-2 z-50 shadow-2xl rounded-2xl overflow-hidden border border-subtle">
            <EmojiPicker
              theme={Theme.DARK}
              onEmojiClick={handleClick}
              width={320}
              height={400}
              searchPlaceHolder={t('community.searchEmoji')}
              previewConfig={{ showPreview: false }}
            />
          </div>
        </>
      )}
    </div>
  );
};
