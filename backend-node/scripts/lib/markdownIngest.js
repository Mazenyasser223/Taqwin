/**
 * Shared markdown parsing + chunking for RAG ingest scripts.
 */
const fs = require('fs');
const path = require('path');

const MIN_CHUNK_CHARS = 80;
const TARGET_CHUNK_CHARS = 2800; // ~500–700 tokens
const MAX_CHUNK_CHARS = 4000; // ~800–1000 tokens

function parseFrontmatter(raw) {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) return { meta: {}, body: raw };
  const meta = {};
  for (const line of match[1].split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_-]*):\s*(.*)$/);
    if (!m) continue;
    const key = m[1].trim();
    let value = m[2].trim().replace(/^['"]|['"]$/g, '');
    if (value.startsWith('[') && value.endsWith(']')) {
      value = value
        .slice(1, -1)
        .split(',')
        .map((s) => s.trim().replace(/^['"]|['"]$/g, ''))
        .filter(Boolean);
    }
    meta[key] = value;
  }
  return { meta, body: match[2] };
}

function approxTokens(text) {
  return Math.ceil(String(text || '').length / 4);
}

function chunkByHeading(body) {
  const lines = String(body || '').split(/\r?\n/);
  const chunks = [];
  let current = { title: '', lines: [] };
  for (const line of lines) {
    if (/^#{1,3}\s+/.test(line)) {
      if (current.lines.length || current.title) chunks.push(current);
      current = { title: line.replace(/^#{1,3}\s+/, '').trim(), lines: [] };
    } else {
      current.lines.push(line);
    }
  }
  if (current.lines.length || current.title) chunks.push(current);

  return chunks
    .map((c) => ({ title: c.title, text: c.lines.join('\n').trim() }))
    .filter((c) => c.text.length >= MIN_CHUNK_CHARS);
}

function mergeSmallSections(sections) {
  if (!sections.length) return [];
  const out = [];
  let buf = { title: sections[0].title, text: sections[0].text };

  for (let i = 1; i < sections.length; i += 1) {
    const next = sections[i];
    const combinedLen = buf.text.length + next.text.length + 2;
    if (combinedLen <= TARGET_CHUNK_CHARS) {
      buf.text = `${buf.text}\n\n${next.text}`;
      if (!buf.title && next.title) buf.title = next.title;
    } else {
      out.push(buf);
      buf = { title: next.title, text: next.text };
    }
  }
  out.push(buf);

  const split = [];
  for (const item of out) {
    if (item.text.length <= MAX_CHUNK_CHARS) {
      split.push(item);
      continue;
    }
    let start = 0;
    while (start < item.text.length) {
      const slice = item.text.slice(start, start + MAX_CHUNK_CHARS);
      split.push({ title: item.title, text: slice.trim() });
      start += MAX_CHUNK_CHARS;
    }
  }
  return split.filter((c) => c.text.length >= MIN_CHUNK_CHARS);
}

function collectMarkdownFiles(rootDir, { prefix = '' } = {}) {
  if (!fs.existsSync(rootDir)) return [];
  const out = [];
  const walk = (current, relPrefix) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (entry.name.startsWith('_') || entry.name === 'README.md') continue;
      const abs = path.join(current, entry.name);
      const rel = relPrefix ? `${relPrefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) walk(abs, rel);
      else if (entry.name.endsWith('.md')) {
        out.push({
          abs,
          sourceFile: prefix ? `${prefix}/${rel}`.replace(/\\/g, '/') : rel.replace(/\\/g, '/'),
        });
      }
    }
  };
  walk(rootDir, '');
  return out.sort((a, b) => a.sourceFile.localeCompare(b.sourceFile));
}

function parseSimpleYaml(raw) {
  const meta = {};
  for (const line of String(raw || '').split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_-]*):\s*(.*)$/);
    if (!m) continue;
    meta[m[1].trim()] = m[2].trim().replace(/^['"]|['"]$/g, '');
  }
  return meta;
}

function collectBookCatalogEntries(booksRoot) {
  if (!fs.existsSync(booksRoot)) return [];
  const entries = [];
  for (const entry of fs.readdirSync(booksRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const metaPath = path.join(booksRoot, entry.name, '_meta.yaml');
    if (!fs.existsSync(metaPath)) continue;
    const meta = parseSimpleYaml(fs.readFileSync(metaPath, 'utf8'));
    const chapters = fs
      .readdirSync(path.join(booksRoot, entry.name))
      .filter((f) => f.endsWith('.md') && f !== 'README.md')
      .sort();
    entries.push({
      bookId: meta.id || entry.name,
      title: meta.title || entry.name,
      subtitle: meta.subtitle || '',
      author: meta.author || '',
      edition: meta.edition || '',
      level: meta.level || 'L5_BOOKS',
      locale: meta.locale || 'en',
      chapters: meta.chapters || String(chapters.length),
      chapterFiles: chapters,
    });
  }
  return entries;
}

function buildBookCatalogMarkdown(entries) {
  const lines = [
    '# Taqwin coaching book library (structure)',
    '',
    'This catalog describes licensed coaching books ingested into Taqwin. Full chapter text is stored separately (L5). Use this for platform_help about available references.',
    '',
  ];
  for (const b of entries) {
    lines.push(`## ${b.title}`);
    if (b.subtitle) lines.push(`_${b.subtitle}_`);
    lines.push('');
    lines.push(`- **Book ID:** ${b.bookId}`);
    if (b.author) lines.push(`- **Author:** ${b.author}`);
    if (b.edition) lines.push(`- **Edition:** ${b.edition}`);
    lines.push(`- **Knowledge level:** ${b.level}`);
    lines.push(`- **Chapters:** ${b.chapters}`);
    lines.push(`- **Locale:** ${b.locale}`);
    if (b.chapterFiles.length) {
      lines.push('- **Chapter files:**');
      for (const f of b.chapterFiles) lines.push(`  - ${f}`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

module.exports = {
  MIN_CHUNK_CHARS,
  TARGET_CHUNK_CHARS,
  MAX_CHUNK_CHARS,
  parseFrontmatter,
  approxTokens,
  chunkByHeading,
  mergeSmallSections,
  collectMarkdownFiles,
  collectBookCatalogEntries,
  buildBookCatalogMarkdown,
};
