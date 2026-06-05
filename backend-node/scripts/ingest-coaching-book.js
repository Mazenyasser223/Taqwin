/* eslint-disable no-console */
/**
 * Ingest markdown coaching files into the MongoDB `book_chunks` collection.
 *
 *   node scripts/ingest-coaching-book.js
 *
 * Each file under data/coaching-book/ and data/books/ (recursive) is parsed
 * for a YAML frontmatter block (topic, tags, lang) and split by H1-H3 headings.
 * Existing chunks for the same `sourceFile` are replaced atomically (idempotent).
 *
 * Requires MONGO_URI to be set in .env.
 */
require('dotenv').config();

const path = require('path');
const fs = require('fs');
const { connectMongo, disconnectMongo, isMongoConfigured } = require('../src/db/mongo/client');

const DATA_DIRS = [
  path.join(__dirname, '..', 'data', 'coaching-book'),
  path.join(__dirname, '..', 'data', 'books'),
];

function collectMarkdownFiles() {
  const out = [];
  for (const dir of DATA_DIRS) {
    if (!fs.existsSync(dir)) continue;
    const baseName = path.basename(dir);
    const walk = (current, relPrefix) => {
      for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
        if (entry.name.startsWith('_') || entry.name === 'README.md') continue;
        const abs = path.join(current, entry.name);
        const rel = relPrefix ? `${relPrefix}/${entry.name}` : entry.name;
        if (entry.isDirectory()) walk(abs, rel);
        else if (entry.name.endsWith('.md')) out.push({ abs, sourceFile: `${baseName}/${rel}`.replace(/\\/g, '/') });
      }
    };
    walk(dir, '');
  }
  return out.sort((a, b) => a.sourceFile.localeCompare(b.sourceFile));
}

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
  // Crude approximation: ~4 chars per token for English / mixed scripts.
  return Math.ceil(text.length / 4);
}

function chunkByHeading(body) {
  const lines = body.split(/\r?\n/);
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
    .filter((c) => c.text.length >= 80); // skip empty/trivial sections
}

async function main() {
  if (!isMongoConfigured()) {
    console.error('MONGO_URI is not configured. Set it in backend-node/.env first.');
    process.exit(1);
  }

  await connectMongo();
  const BookChunk = require('../src/db/mongo/models/bookChunk');

  const files = collectMarkdownFiles();
  if (!files.length) {
    console.error('No markdown files found under data/coaching-book or data/books.');
    process.exit(0);
  }

  let totalChunks = 0;
  for (const { abs: fullPath, sourceFile } of files) {
    const raw = fs.readFileSync(fullPath, 'utf8');
    const { meta, body } = parseFrontmatter(raw);

    const file = sourceFile;
    const topic = meta.topic || path.basename(file, '.md').replace(/^[\d-]+/, '').trim();
    const lang = meta.lang || 'en';
    const tags = Array.isArray(meta.tags) ? meta.tags : [];

    const sections = chunkByHeading(body);

    // Replace previous ingestion for this source file
    await BookChunk.deleteMany({ sourceFile: file });

    const docs = sections.map((s) => ({
      sourceFile: file,
      topic: s.title || topic,
      lang,
      tags,
      text: s.text,
      tokens: approxTokens(s.text),
    }));

    if (docs.length) {
      await BookChunk.insertMany(docs);
      console.log(`  + ${file}: ${docs.length} chunk(s), tags=[${tags.join(', ')}]`);
      totalChunks += docs.length;
    } else {
      console.log(`  - ${file}: no chunks extracted (file too short?)`);
    }
  }

  const total = await BookChunk.estimatedDocumentCount();
  console.log(`\nIngested ${totalChunks} chunks. Collection total: ${total}.`);

  await disconnectMongo();
  process.exit(0);
}

main().catch((err) => {
  console.error('Ingestion failed:', err);
  process.exit(1);
});
