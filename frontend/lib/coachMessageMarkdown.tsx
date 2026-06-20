import React from 'react';

function normalizeCoachMarkdown(text: string): string {
  return String(text || '')
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n')
    .replace(/([.!?؟])\s+(#{1,6}\s*)/g, '$1\n\n$2')
    .replace(/:\s+(#{1,6}\s*)/g, ':\n\n$1')
    .replace(/([^\n#])\s+(#{1,6}\s*)/g, '$1\n\n$2')
    .trim();
}

function renderInline(text: string, keyPrefix: string): React.ReactNode {
  if (!/\*\*[^*]+\*\*|\*[^*\n]+\*/.test(text)) {
    return text;
  }

  const nodes: React.ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|\*[^*\n]+\*)/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let i = 0;

  while ((match = re.exec(text)) !== null) {
    if (match.index > last) {
      nodes.push(text.slice(last, match.index));
    }
    const token = match[0];
    if (token.startsWith('**')) {
      nodes.push(
        <strong key={`${keyPrefix}-b-${i}`} className="font-semibold text-foreground">
          {token.slice(2, -2)}
        </strong>,
      );
    } else {
      nodes.push(
        <em key={`${keyPrefix}-i-${i}`} className="italic text-foreground/95">
          {token.slice(1, -1)}
        </em>,
      );
    }
    last = match.index + token.length;
    i += 1;
  }

  if (last < text.length) {
    nodes.push(text.slice(last));
  }

  return <span className="inline">{nodes}</span>;
}

function headingClass(level: number): string {
  if (level <= 2) {
    return 'text-lg sm:text-xl font-bold text-foreground mt-5 mb-2.5 first:mt-0 leading-snug';
  }
  return 'text-base sm:text-lg font-semibold text-foreground mt-4 mb-2 first:mt-0 leading-snug';
}

function bodyClass(): string {
  return 'text-base sm:text-[1.0625rem] font-normal leading-[1.85] text-foreground/95 mb-3.5 last:mb-0';
}

function stripLeadingMarkdownHash(line: string): string {
  return line.replace(/^#{1,6}\s*/, '').trim();
}

export function renderCoachMessageMarkdown(text: string): React.ReactNode {
  const normalized = normalizeCoachMarkdown(text);
  const lines = normalized.split('\n');
  const blocks: React.ReactNode[] = [];
  let bulletItems: string[] = [];
  let orderedItems: string[] = [];
  let blockIndex = 0;

  const flushBullets = () => {
    if (!bulletItems.length) return;
    blocks.push(
      <ul key={`ul-${blockIndex++}`} className="my-3.5 list-disc space-y-2.5 ps-5 marker:text-primary/70">
        {bulletItems.map((item, idx) => (
          <li key={idx} className={bodyClass()}>
            {renderInline(item, `ul-${blockIndex}-${idx}`)}
          </li>
        ))}
      </ul>,
    );
    bulletItems = [];
  };

  const flushOrdered = () => {
    if (!orderedItems.length) return;
    blocks.push(
      <ol key={`ol-${blockIndex++}`} className="my-3.5 list-decimal space-y-2.5 ps-5 marker:font-semibold marker:text-primary/80">
        {orderedItems.map((item, idx) => (
          <li key={idx} className={bodyClass()}>
            {renderInline(item, `ol-${blockIndex}-${idx}`)}
          </li>
        ))}
      </ol>,
    );
    orderedItems = [];
  };

  const flushLists = () => {
    flushBullets();
    flushOrdered();
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      flushLists();
      continue;
    }

    const headingMatch = line.match(/^(#{1,6})\s*(.+)$/);
    if (headingMatch) {
      flushLists();
      const level = headingMatch[1].length;
      const headingText = headingMatch[2].trim();
      const Tag = level <= 2 ? 'h2' : 'h3';
      blocks.push(
        React.createElement(
          Tag,
          {
            key: `h-${blockIndex++}`,
            className: headingClass(level),
          },
          renderInline(headingText, `h-${blockIndex}`),
        ),
      );
      continue;
    }

    const bulletMatch = line.match(/^[-*•]\s+(.+)$/);
    if (bulletMatch && !line.startsWith('**')) {
      flushOrdered();
      bulletItems.push(bulletMatch[1]);
      continue;
    }

    const orderedMatch = line.match(/^\d+\.\s+(.+)$/);
    if (orderedMatch) {
      flushBullets();
      orderedItems.push(orderedMatch[1]);
      continue;
    }

    if (/^[-*_]{3,}$/.test(line)) {
      flushLists();
      blocks.push(<hr key={`hr-${blockIndex++}`} className="my-4 border-border/60" />);
      continue;
    }

    flushLists();
    const paragraph = stripLeadingMarkdownHash(line);
    blocks.push(
      <p key={`p-${blockIndex++}`} className={bodyClass()}>
        {renderInline(paragraph, `p-${blockIndex}`)}
      </p>,
    );
  }

  flushLists();

  if (!blocks.length) {
    return <p className={bodyClass()}>{normalized}</p>;
  }

  return <div className="coach-message-markdown space-y-1">{blocks}</div>;
}
