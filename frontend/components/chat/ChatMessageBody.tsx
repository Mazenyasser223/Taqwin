import React from 'react';
import { renderCoachMessageMarkdown } from '../../lib/coachMessageMarkdown';
import { normalizeArabicCoachText } from '../../lib/normalizeArabicCoachText';
import { textDirection } from '../../lib/textDirection';

interface ChatMessageBodyProps {
  text: string;
  className?: string;
  /** When true, render coach markdown (headings, lists, bold) instead of raw text. */
  markdown?: boolean;
}

/** Renders chat text with correct Arabic / English bidi and optional coach markdown. */
export const ChatMessageBody: React.FC<ChatMessageBodyProps> = ({
  text,
  className = '',
  markdown = true,
}) => {
  const prepared = normalizeArabicCoachText(text);
  const dir = textDirection(prepared);
  const baseClass = `text-start ${className}`.trim();

  if (markdown && prepared.trim()) {
    return (
      <div dir="auto" lang={dir === 'rtl' ? 'ar' : undefined} className={baseClass}>
        {renderCoachMessageMarkdown(prepared)}
      </div>
    );
  }

  return (
    <p dir="auto" lang={dir === 'rtl' ? 'ar' : undefined} className={`whitespace-pre-wrap ${baseClass}`}>
      {prepared}
    </p>
  );
};
