/* eslint-disable no-console */
/**
 * Split Bigger Leaner Stronger (2nd ed.) PDF into chapter markdown files.
 *
 *   node scripts/split-bls-pdf.js
 *   node scripts/split-bls-pdf.js --pdf path/to/file.pdf
 *
 * Output: backend-node/data/books/bigger-leaner-stronger/*.md
 */
const fs = require('fs');
const path = require('path');
const { PDFParse } = require('pdf-parse');

const DEFAULT_PDF = path.join(
  __dirname,
  '..',
  'data',
  'books',
  'bigger-leaner-stronger',
  'source',
  'Bigger Leaner Stronger.pdf'
);
const OUT_DIR = path.join(__dirname, '..', 'data', 'books', 'bigger-leaner-stronger');

const BODY_ANCHOR = 'THE PROMISE\nNo matter how bad';
const INTRO_ANCHOR = 'INTRODUCTION\nWHY BIGGER LEANER STRONGER IS DIFFERENT';
const END_ANCHOR = 'BONUS REPORT';

/** Chapter start offsets within the body slice (after BODY_ANCHOR). */
const CHAPTER_OFFSETS = [
  14486, 19144, 26313, 32253, 37462, 55251, 62468, 79868, 96466, 99415, 159290,
  167553, 257250, 275927, 330513, 340319, 392631, 472531, 500203, 509026, 511288,
  521744, 592050, 594216,
];

const CHAPTERS = [
  {
    file: '00-promise.md',
    title: 'The Promise',
    part: 'intro',
    chapter: 0,
    tags: ['bls', 'intro', 'motivation'],
  },
  {
    file: '01-introduction.md',
    title: 'Introduction — Why Bigger Leaner Stronger Is Different',
    part: 'intro',
    chapter: 0,
    tags: ['bls', 'intro', 'fundamentals'],
  },
  {
    file: '02-ch01-hidden-barrier.md',
    title: 'The Hidden Barrier to Achieving Your Fitness and Health Goals',
    part: 'fundamentals',
    chapter: 1,
    tags: ['bls', 'fundamentals', 'education'],
  },
  {
    file: '03-ch02-physiology-101.md',
    title: "What Most People Don't Know — Part One: Physiology 101",
    part: 'fundamentals',
    chapter: 2,
    tags: ['bls', 'fundamentals', 'physiology'],
  },
  {
    file: '04-ch03-nutrition-keywords.md',
    title: "What Most People Don't Know — Part Two: Nutrition",
    part: 'fundamentals',
    chapter: 3,
    tags: ['bls', 'fundamentals', 'nutrition'],
  },
  {
    file: '05-ch04-general-health-keywords.md',
    title: "What Most People Don't Know — Part Three: General Health",
    part: 'fundamentals',
    chapter: 4,
    tags: ['bls', 'fundamentals', 'health'],
  },
  {
    file: '06-ch05-muscle-myths.md',
    title: 'The 7 Biggest Muscle-Building Myths and Mistakes',
    part: 'fundamentals',
    chapter: 5,
    tags: ['bls', 'fundamentals', 'training', 'hypertrophy', 'muscle'],
  },
  {
    file: '07-ch06-laws-muscle-growth.md',
    title: 'The 3 Scientific Laws of Muscle Growth',
    part: 'fundamentals',
    chapter: 6,
    tags: ['bls', 'fundamentals', 'training', 'hypertrophy', 'progressive-overload', 'muscle'],
  },
  {
    file: '08-ch07-fat-loss-myths.md',
    title: 'The 5 Biggest Fat Loss Myths and Mistakes',
    part: 'fundamentals',
    chapter: 7,
    tags: ['bls', 'fundamentals', 'fat-loss', 'nutrition'],
  },
  {
    file: '09-ch08-laws-fat-loss.md',
    title: 'The 4 Scientific Laws of Healthy Fat Loss',
    part: 'fundamentals',
    chapter: 8,
    tags: ['bls', 'fundamentals', 'fat-loss', 'deficit', 'nutrition'],
  },
  {
    file: '10-ch09-inner-game.md',
    title: 'The Inner Game of Getting Fit',
    part: 'inner-game',
    chapter: 9,
    tags: ['bls', 'inner-game', 'motivation', 'habits'],
  },
  {
    file: '11-ch10-willpower.md',
    title: 'How to Become Your Own Master — Willpower and Self-Control',
    part: 'inner-game',
    chapter: 10,
    tags: ['bls', 'inner-game', 'willpower', 'habits'],
  },
  {
    file: '12-ch11-goal-setting.md',
    title: 'The Simple Way to Set Health and Fitness Goals That Will Motivate You',
    part: 'inner-game',
    chapter: 11,
    tags: ['bls', 'inner-game', 'goals', 'motivation'],
  },
  {
    file: '13-ch12-effective-nutrition.md',
    title: 'Going Beyond Clean Eating — Definitive Guide to Effective Nutrition',
    part: 'nutrition',
    chapter: 12,
    tags: ['bls', 'nutrition', 'macros', 'diet'],
  },
  {
    file: '14-ch13-pre-post-workout.md',
    title: 'How to Maximize Your Gains with Pre- and Post-Workout Nutrition',
    part: 'nutrition',
    chapter: 13,
    tags: ['bls', 'nutrition', 'pre-workout', 'post-workout', 'protein'],
  },
  {
    file: '15-ch14-bls-diet.md',
    title: 'Build the Body You Want — The Bigger Leaner Stronger Diet',
    part: 'nutrition',
    chapter: 14,
    tags: ['bls', 'nutrition', 'macros', 'meal-plan', 'flexible-dieting', 'diet'],
  },
  {
    file: '16-ch15-eating-on-budget.md',
    title: 'How to Eat Healthy Foods on a Budget',
    part: 'nutrition',
    chapter: 15,
    tags: ['bls', 'nutrition', 'budget', 'diet'],
  },
  {
    file: '17-ch16-training-philosophy.md',
    title: 'The Bigger Leaner Stronger Training Philosophy',
    part: 'training',
    chapter: 16,
    tags: ['bls', 'training', 'hypertrophy', 'strength', 'philosophy'],
  },
  {
    file: '18-ch17-training-program.md',
    title: 'The Bigger Leaner Stronger Training Program',
    part: 'training',
    chapter: 17,
    tags: ['bls', 'training', 'hypertrophy', 'program', 'exercises'],
  },
  {
    file: '19-ch18-workout-routine.md',
    title: 'The Bigger Leaner Stronger Workout Routine',
    part: 'training',
    chapter: 18,
    tags: ['bls', 'training', 'workout-program', 'routine', 'beginner', 'intermediate'],
  },
  {
    file: '20-ch19-tracking-progress.md',
    title: 'Tracking Your Progress',
    part: 'training',
    chapter: 19,
    tags: ['bls', 'training', 'progress-tracking'],
  },
  {
    file: '21-ch20-training-partner.md',
    title: 'The Code of a Good Training Partner',
    part: 'training',
    chapter: 20,
    tags: ['bls', 'training'],
  },
  {
    file: '22-ch21-prevent-injuries.md',
    title: 'How to Prevent Workout Injuries',
    part: 'training',
    chapter: 21,
    tags: ['bls', 'training', 'injury', 'recovery'],
  },
  {
    file: '23-ch22-supplements.md',
    title: 'The No-BS Guide to Supplements',
    part: 'supplements',
    chapter: 22,
    tags: ['bls', 'supplements'],
  },
  {
    file: '24-ch23-the-beginning.md',
    title: 'From Here, Your Body Will Change',
    part: 'beginning',
    chapter: 23,
    tags: ['bls', 'intro', 'motivation'],
  },
  {
    file: '25-ch24-faq.md',
    title: 'Frequently Asked Questions',
    part: 'faq',
    chapter: 24,
    tags: ['bls', 'faq', 'training', 'nutrition'],
  },
];

function parseArgs() {
  const pdfArg = process.argv.indexOf('--pdf');
  if (pdfArg >= 0 && process.argv[pdfArg + 1]) {
    return path.resolve(process.argv[pdfArg + 1]);
  }
  return DEFAULT_PDF;
}

function normalizeText(raw) {
  return raw
    .replace(/\n--\s*\d+\s+of\s+\d+\s*--\n/g, '\n\n')
    .replace(/\n\d{1,3}\n(?=[A-Z])/g, '\n')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u2013|\u2014/g, '-')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function stripLeadingChapterHeader(text, chapterNum) {
  if (!chapterNum) return text;
  const re = new RegExp(`^${chapterNum}\\s*\\n`, 'm');
  return text.replace(re, '').trim();
}

function buildFrontmatter(meta) {
  const tags = meta.tags.map((t) => `"${t}"`).join(', ');
  const lines = [
    '---',
    `topic: "BLS — ${meta.title.replace(/"/g, '\\"')}"`,
    'book: bigger-leaner-stronger',
    'edition: 2',
    `chapter: ${meta.chapter}`,
    `part: ${meta.part}`,
    `tags: [${tags}]`,
    'lang: en',
    'source: bigger-leaner-stronger-2e',
    'rights: licensed-personal-use',
    '---',
    '',
  ];
  return lines.join('\n');
}

function sliceRanges(body) {
  const introOffset = body.indexOf(INTRO_ANCHOR);
  if (introOffset < 0) throw new Error(`Intro anchor not found: ${INTRO_ANCHOR}`);

  const endOffset = body.indexOf(END_ANCHOR);
  if (endOffset < 0) throw new Error(`End anchor not found: ${END_ANCHOR}`);

  const ranges = [];
  ranges.push({ start: 0, end: introOffset });
  ranges.push({ start: introOffset, end: CHAPTER_OFFSETS[0] });

  for (let i = 0; i < CHAPTER_OFFSETS.length; i += 1) {
    const start = CHAPTER_OFFSETS[i];
    const end = i + 1 < CHAPTER_OFFSETS.length ? CHAPTER_OFFSETS[i + 1] : endOffset;
    ranges.push({ start, end });
  }

  return ranges;
}

async function extractPdfText(pdfPath) {
  const buf = fs.readFileSync(pdfPath);
  const parser = new PDFParse({ data: buf });
  const result = await parser.getText();
  await parser.destroy();
  return result.text;
}

async function main() {
  const pdfPath = parseArgs();
  if (!fs.existsSync(pdfPath)) {
    console.error(`PDF not found: ${pdfPath}`);
    process.exit(1);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });

  console.log(`Reading ${pdfPath}...`);
  const fullText = await extractPdfText(pdfPath);
  const bodyStart = fullText.indexOf(BODY_ANCHOR);
  if (bodyStart < 0) {
    console.error(`Body anchor not found: ${BODY_ANCHOR}`);
    process.exit(1);
  }

  const body = fullText.slice(bodyStart);
  const ranges = sliceRanges(body);

  if (ranges.length !== CHAPTERS.length) {
    console.error(`Range/chapter mismatch: ${ranges.length} ranges vs ${CHAPTERS.length} chapters`);
    process.exit(1);
  }

  for (let i = 0; i < CHAPTERS.length; i += 1) {
    const meta = CHAPTERS[i];
    const { start, end } = ranges[i];
    let chunk = normalizeText(body.slice(start, end));
    chunk = stripLeadingChapterHeader(chunk, meta.chapter || null);

    const heading = `# ${meta.title}\n\n`;
    const content = buildFrontmatter(meta) + heading + chunk + '\n';
    const outPath = path.join(OUT_DIR, meta.file);
    fs.writeFileSync(outPath, content, 'utf8');
    console.log(`  + ${meta.file} (${chunk.length.toLocaleString()} chars)`);
  }

  const metaPath = path.join(OUT_DIR, '_meta.yaml');
  if (!fs.existsSync(metaPath)) {
    fs.writeFileSync(
      metaPath,
      [
        'id: bigger-leaner-stronger',
        'title: Bigger Leaner Stronger',
        'subtitle: The Simple Science of Building the Ultimate Male Body',
        'author: Michael Matthews',
        'edition: 2',
        'level: L5_BOOKS',
        'locale: en',
        'chapters: 26',
      ].join('\n') + '\n',
      'utf8'
    );
    console.log('  + _meta.yaml');
  }

  console.log(`\nDone. ${CHAPTERS.length} files written to ${OUT_DIR}`);
}

main().catch((err) => {
  console.error('Split failed:', err);
  process.exit(1);
});
