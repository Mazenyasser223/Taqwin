import React, { useRef, useState, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import EmojiPicker, { type EmojiClickData, Theme } from 'emoji-picker-react';
import { useI18n } from '../../lib/i18n/useI18n';

const PICKER_W = 320;
const PICKER_H = 400;
const MARGIN = 8;

function computePickerPos(btn: HTMLButtonElement): React.CSSProperties {
  const r = btn.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  // Prefer opening above; fall back to below if not enough room
  let top: number;
  if (r.top - PICKER_H - MARGIN >= MARGIN) {
    top = r.top - PICKER_H - MARGIN;
  } else {
    top = Math.min(r.bottom + MARGIN, vh - PICKER_H - MARGIN);
  }

  // Align to button left; clamp so it never overflows right or left
  let left = r.left;
  left = Math.min(left, vw - PICKER_W - MARGIN);
  left = Math.max(MARGIN, left);

  return { position: 'fixed', top, left, zIndex: 9999 };
}

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
  inputRef?: React.Ref<HTMLInputElement | HTMLTextAreaElement>;
  /** When false, hide inline mood button (use toolbar trigger + pickerOpen). */
  showEmojiButton?: boolean;
  pickerOpen?: boolean;
  onPickerOpenChange?: (open: boolean) => void;
  /** Anchor for picker position when showEmojiButton is false. */
  pickerAnchorRef?: React.RefObject<HTMLButtonElement | null>;
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
  inputRef: externalInputRef,
  showEmojiButton = true,
  pickerOpen: pickerOpenProp,
  onPickerOpenChange,
  pickerAnchorRef,
}) => {
  const { t } = useI18n();
  const [pickerOpenInternal, setPickerOpenInternal] = useState(false);
  const pickerOpen = pickerOpenProp ?? pickerOpenInternal;
  const setPickerOpen = onPickerOpenChange ?? setPickerOpenInternal;
  const [pickerStyle, setPickerStyle] = useState<React.CSSProperties>({});
  const internalInputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  const setInputRef = useCallback(
    (el: HTMLInputElement | HTMLTextAreaElement | null) => {
      internalInputRef.current = el;
      if (!externalInputRef) return;
      if (typeof externalInputRef === 'function') externalInputRef(el);
      else externalInputRef.current = el;
    },
    [externalInputRef],
  );
  const btnRef = useRef<HTMLButtonElement>(null);

  const openPicker = useCallback(() => {
    const anchor = (showEmojiButton ? btnRef : pickerAnchorRef ?? btnRef).current;
    if (anchor) setPickerStyle(computePickerPos(anchor));
    setPickerOpen(!pickerOpen);
  }, [pickerOpen, pickerAnchorRef, setPickerOpen, showEmojiButton]);

  useEffect(() => {
    if (!pickerOpen) return;
    const anchor = (showEmojiButton ? btnRef : pickerAnchorRef ?? btnRef).current;
    if (anchor) setPickerStyle(computePickerPos(anchor));
  }, [pickerOpen, pickerAnchorRef, showEmojiButton]);

  const insertEmoji = (emoji: string) => {
    const el = internalInputRef.current;
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
    <div className={`relative flex gap-2 items-stretch ${className}`}>
      {showEmojiButton && (
        <button
          ref={btnRef}
          type="button"
          disabled={disabled}
          onClick={openPicker}
          className="shrink-0 p-2 rounded-xl text-muted hover:text-primary hover:bg-elevated transition-colors disabled:opacity-40 self-end"
          title={t('community.addEmoji')}
          aria-label={t('community.addEmoji')}
        >
          <span className="material-symbols-outlined text-xl">mood</span>
        </button>
      )}

      {multiline ? (
        <textarea
          ref={setInputRef}
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
          ref={setInputRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onSubmit?.()}
          placeholder={placeholder}
          disabled={disabled}
          className={sharedClass}
        />
      )}

      {pickerOpen && typeof document !== 'undefined' && createPortal(
        <>
          <button
            type="button"
            className="fixed inset-0"
            style={{ zIndex: 9998 }}
            aria-label={t('common.close')}
            onClick={() => setPickerOpen(false)}
          />
          <div
            className="shadow-2xl rounded-2xl overflow-hidden border border-border"
            style={pickerStyle}
          >
            <EmojiPicker
              onEmojiClick={onEmojiClick}
              theme={Theme.DARK}
              width={PICKER_W}
              height={PICKER_H}
              searchPlaceholder={t('community.searchEmoji')}
              previewConfig={{ showPreview: false }}
            />
          </div>
        </>,
        document.body,
      )}
    </div>
  );
};
