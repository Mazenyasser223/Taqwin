import React, { useRef, useState } from 'react';
import EmojiPicker, { type EmojiClickData, Theme } from 'emoji-picker-react';
import { useI18n } from '../../lib/i18n/useI18n';

interface EmojiComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: () => void;
  placeholder?: string;
  disabled?: boolean;
  multiline?: boolean;
  rows?: number;
  className?: string;
  inputClassName?: string;
}

export const EmojiComposer: React.FC<EmojiComposerProps> = ({
  value,
  onChange,
  onSubmit,
  placeholder,
  disabled = false,
  multiline = false,
  rows = 2,
  className = '',
  inputClassName,
}) => {
  const { t } = useI18n();
  const [pickerOpen, setPickerOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  const insertEmoji = (emoji: string) => {
    const el = inputRef.current;
    if (el && 'selectionStart' in el) {
      const start = el.selectionStart ?? value.length;
      const end = el.selectionEnd ?? value.length;
      const next = value.slice(0, start) + emoji + value.slice(end);
      onChange(next);
      requestAnimationFrame(() => {
        const pos = start + emoji.length;
        el.focus();
        el.setSelectionRange(pos, pos);
      });
      return;
    }
    onChange(value + emoji);
  };

  const onEmojiClick = (data: EmojiClickData) => {
    insertEmoji(data.emoji);
    setPickerOpen(false);
  };

  const sharedClass =
    inputClassName ??
    'flex-1 bg-elevated border border-subtle rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 min-w-0';

  return (
    <div className={`relative flex gap-2 items-end ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setPickerOpen((o) => !o)}
        className="shrink-0 p-2 rounded-xl text-muted hover:text-primary hover:bg-elevated transition-colors disabled:opacity-40"
        title={t('community.addEmoji')}
        aria-label={t('community.addEmoji')}
      >
        <span className="material-symbols-outlined text-xl">mood</span>
      </button>

      {multiline ? (
        <textarea
          ref={inputRef as React.RefObject<HTMLTextAreaElement>}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && onSubmit) {
              e.preventDefault();
              onSubmit();
            }
          }}
          placeholder={placeholder}
          disabled={disabled}
          rows={rows}
          className={`${sharedClass} ${inputClassName ? '' : 'resize-none'}`}
        />
      ) : (
        <input
          ref={inputRef as React.RefObject<HTMLInputElement>}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onSubmit?.()}
          placeholder={placeholder}
          disabled={disabled}
          className={sharedClass}
        />
      )}

      {pickerOpen && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-[60]"
            aria-label={t('common.close')}
            onClick={() => setPickerOpen(false)}
          />
          <div className="absolute bottom-full left-0 mb-2 z-[70] shadow-2xl rounded-2xl overflow-hidden border border-border">
            <EmojiPicker
              onEmojiClick={onEmojiClick}
              theme={Theme.DARK}
              width={320}
              height={400}
              searchPlaceholder={t('community.searchEmoji')}
              previewConfig={{ showPreview: false }}
            />
          </div>
        </>
      )}
    </div>
  );
};
