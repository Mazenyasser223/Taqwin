import React from 'react';
import { textDirection } from '../../lib/textDirection';

interface ChatMessageBodyProps {
  text: string;
  className?: string;
}

/** Renders chat text with correct Arabic / English bidi (fixes inverted Egyptian). */
export const ChatMessageBody: React.FC<ChatMessageBodyProps> = ({ text, className = '' }) => {
  const dir = textDirection(text);
  return (
    <p
      dir={dir}
      className={`text-start whitespace-pre-wrap [unicode-bidi:plaintext] ${className}`.trim()}
    >
      {text}
    </p>
  );
};
