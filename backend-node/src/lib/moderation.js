/**
 * Content moderation — text + image.
 *
 * Layers (each is optional and gracefully skipped if not configured):
 *   1. Local bad-words filter  — always active, zero cost, instant
 *   2. OpenAI Moderation API   — free, handles Arabic/Egyptian context
 *   3. Sightengine             — image nudity/violence/gore (2 000 free/month)
 *
 * All public functions accept an optional `lang` ('ar' | 'en') to choose the
 * language of the user-facing error message. Defaults to 'ar'.
 */

const Filter = require('bad-words');

// ─── Bilingual category messages ──────────────────────────────────────────────
const MESSAGES = {
  ar: {
    sexual:     'هذا المحتوى يحتوي على مواد أو مشاهد غير لائقة ولا يُسمح بنشره.',
    violence:   'هذا المحتوى يحتوي على عنف أو تهديدات ولا يُسمح بنشره.',
    hate:       'هذا المحتوى يحتوي على خطاب كراهية ولا يُسمح بنشره.',
    harassment: 'هذا المحتوى يحتوي على تحرش أو إساءة ولا يُسمح بنشره.',
    profanity:  'هذا المحتوى يحتوي على كلمات مسيئة أو بذيئة ولا يُسمح بنشره.',
    gore:       'هذا المحتوى يحتوي على صور دموية أو مقززة ولا يُسمح بنشره.',
    default:    'هذا المحتوى يخالف سياسة المجتمع ولا يُسمح بنشره.',
  },
  en: {
    sexual:     'This content contains inappropriate or indecent material and is not allowed.',
    violence:   'This content contains violence or threats and is not allowed.',
    hate:       'This content contains hate speech and is not allowed.',
    harassment: 'This content contains harassment or abuse and is not allowed.',
    profanity:  'This content contains offensive or inappropriate language and is not allowed.',
    gore:       'This content contains graphic or disturbing imagery and is not allowed.',
    default:    'This content violates our community guidelines and is not allowed.',
  },
};

function getMessage(category, lang) {
  const l = lang === 'en' ? 'en' : 'ar';
  return (MESSAGES[l][category] || MESSAGES[l].default);
}

// ─── Custom error class ───────────────────────────────────────────────────────
class ModerationError extends Error {
  constructor(category, detail, lang) {
    const msg = getMessage(category, lang);
    super(msg);
    this.name = 'ModerationError';
    this.category = category;
    this.detail = detail;
    // Store both so the route can re-localise if needed
    this.messages = { ar: getMessage(category, 'ar'), en: getMessage(category, 'en') };
  }

  messageFor(lang) {
    return lang === 'en' ? this.messages.en : this.messages.ar;
  }
}

// ─── Arabic / Egyptian / Franco-Arab bad-words list ───────────────────────────
const ARABIC_BAD_WORDS = [
  // ── Egyptian dialect — sexual ──────────────────────────────────────────────
  'كس', 'كسك', 'كسمك', 'كسم', 'كسها', 'كسه', 'كسهم', 'كسي',
  'كس امك', 'كس اختك', 'كس امه', 'كس امها',
  'طيز', 'طيزك', 'طيزه', 'طيزها', 'طيزي', 'طيزهم',
  'زب', 'زبك', 'زبه', 'زبها', 'زبي', 'زبهم', 'زبر',
  'نيك', 'نيكك', 'نيكه', 'نيكها', 'ينيك', 'اتناك', 'اتنيك',
  'شرموطة', 'شراميط', 'شرموط',
  'عاهرة', 'عاهر', 'عواهر',
  'قحبة', 'قحاب', 'قحب',
  'متناك', 'متناكة', 'متنيك', 'متنيكة',
  'بتتناك', 'بيتناك',
  'نيكني', 'نيكها',
  'منيوك', 'منيوكة',

  // ── Egyptian dialect — general profanity ──────────────────────────────────
  'احا', 'أحا',
  'ابن الشرموطة', 'ابن القحبة', 'ابن الكلب', 'ابن المتناكة',
  'ابن الوسخة', 'ابن الوسخ', 'يابن الوسخة', 'يابن الوسخ',
  'يابن الشرموطة', 'يابن القحبة', 'يابن الكلب', 'يابن المتناكة',
  'يلعن', 'يلعن دينك', 'يلعن ابوك', 'يلعن امك',
  'كلب', 'كلبة',
  'وسخ', 'وسخة',
  'خول', 'خولة', 'خوالة',
  'شاذ', 'شاذة', 'لوطي',
  'زفت', 'لقيط', 'لقيطة',
  'متخلف', 'متخلفة',
  'غبي', 'غبية',
  'حمار', 'حمارة',

  // ── Franco-Arab — sexual / profanity ──────────────────────────────────────
  'ks', 'kos', 'kuss', 'kosk', 'koskm', 'kosomak', 'kos omak', 'kos okhtak',
  'tiz', 'tizak', 'tizha',
  'zb', 'zibb', 'zebr',
  'neek', 'nik', 'nayek', 'nayeka', 'baynek', 'batneek',
  'sharmoota', 'sharmota', 'shrmota', 'el sharmoota',
  'a7a', '7mar',
  'ibn el sharmoota', 'ibn elsharmota',
  'ibn el kahba', 'ibn elkahba', 'yabn el kahba', 'yabn elkahba',
  'ibn el kalb', 'ibn elkalb', 'yabn el kalb', 'yabn elkalb',
  'ibn el mtnaka', 'yabn el mtnaka', 'yabn elmtnaka',
  'ibn el ws5a', 'yabn el ws5a', 'yabn elws5a',
  'yabn el a7ba', 'yabn ela7ba',
  'mtnaka', 'mtnakeh', 'metnaak', 'metnaaka',
  'mitnaka', 'mitnakeh', 'mitnaaka', 'mitnakah',
  'metnaka', 'metnakeh',
  'yabn el mitnaka', 'yabn elmitnaka',
  'ibn el mitnaka', 'ibn elmitnaka',
  'kahba', 'kahbeh', 'el kahba',
  'el5awl', 'khawl', 'khawal', 'el khawal',
  'manyak', 'manyok', 'manyooka',
  'wiskh', 'ws5', 'ws5a', 'el ws5a',
  'zbala',
  'kalb', 'el kalb',
  'shaz', 'el shaz',
  'looty', 'lawaty',

  // ── Additional Egyptian slang ─────────────────────────────────────────────
  'labwa', 'labweh', 'el labwa',       // لبوة — Egyptian slang for promiscuous woman
  'sharmouta', 'el sharmouta',
  'a7ba', 'el a7ba',                   // أحبة used as insult in Egyptian slang
  'bn el sharmoota', 'bn elsharmoota',
  'ybn elsharmoota', 'ybn el sharmoota',

  // ── MSA / Pan-Arab ────────────────────────────────────────────────────────
  'عضو تناسلي', 'أعضاء تناسلية',
  'زنا', 'زانية', 'زاني',
  'فاسق', 'فاسقة',
  'فاجر', 'فاجرة',

  // ── Violence / threats ────────────────────────────────────────────────────
  'سأقتلك', 'هقتلك', 'هقتله', 'هموتك', 'سأقتله',
  'اقتل نفسك', 'اشنق نفسك',
];

// ─── Regex root patterns — catch entire spelling-variation families ───────────
// Tested against lowercased, space-collapsed text AND space-stripped text.
const BAD_WORD_PATTERNS = [
  // naak / nik / mitnak / mtnaka / mitnaka / metnaka family  (ن-ي-ك root)
  /m[ie]?[ei]?t?n[aeiou]?[iy]?[ao]?k[aeh]?/,          // mitnak, mtnaka, mitnaka, metnaka, metnaak …
  /\bn[ie][iy]?[ao]?k[aeh]?\b/,                         // neek, nik, nayek …
  /(ya?bn?|ibn?).{0,6}m[ie]?[ei]?t?n[aeiou]?[iy]?[ao]?k/, // yabn el mtnaka / mitnaka …
  /bayt?n[ie][iy]?k/,                                    // batneek …

  // kos / ks / kuss family  (ك-س root)
  /\bk[ou]?[su]{1,3}[km]?\b/,
  /k[ou]?s\s*(omak|okhtak|amk|ahtak|omk)/,

  // tiz family  (ط-ي-ز root)
  /\bt[iy]z[aehk]?\b/,

  // sharmoota family
  /sh[ae]?rm[ou][ou]?t[aeh]?/,

  // kahba / qahba family
  /[kq][ao]h?b[aeh]/,

  // manyak family
  /man?y[oaeu][ok]a?/,

  // franco a7a
  /\ba7a\b/,

  // ws5 / wiskh
  /w[uis]?s?[k5][hx]?a?/,

  // labwa / labweh family
  /\blab?w[aeh]+\b/,
];

// ─── Build the English profanity filter ───────────────────────────────────────
const filter = new Filter({ placeHolder: '*' });
filter.addWords(...ARABIC_BAD_WORDS);

// Normalise + check via regex roots AND the explicit phrase list.
function containsBadWord(text) {
  if (!text) return null;
  const norm = text.toLowerCase().replace(/\s+/g, ' ').trim();
  const normNoSpace = norm.replace(/\s/g, '');

  // 1. Regex patterns — catch all spelling variations of each root
  for (const pattern of BAD_WORD_PATTERNS) {
    if (pattern.test(norm) || pattern.test(normNoSpace)) return pattern.toString();
  }

  // 2. Explicit Arabic-script + franco phrase list
  for (const word of ARABIC_BAD_WORDS) {
    const w = word.toLowerCase().replace(/\s+/g, ' ').trim();
    const wNoSpace = w.replace(/\s/g, '');
    if (norm.includes(w)) return word;
    if (wNoSpace.length > 2 && normNoSpace.includes(wNoSpace)) return word;
  }
  return null;
}

// ─── Layer 1: Local bad-words check (always runs) ────────────────────────────
function checkLocalFilter(text, lang) {
  if (!text || typeof text !== 'string') return;
  const trimmed = text.trim();
  if (!trimmed) return;

  const match = containsBadWord(trimmed);
  if (match) throw new ModerationError('profanity', `matched: ${match}`, lang);

  // English profanity via bad-words library
  try {
    if (filter.isProfane(trimmed)) throw new ModerationError('profanity', 'en-filter', lang);
  } catch (e) {
    if (e instanceof ModerationError) throw e;
    // bad-words may throw on edge-case inputs — ignore safely
  }
}

// ─── Layer 2: OpenAI Moderation API (runs if OPENAI_API_KEY is set) ──────────
async function checkOpenAI(text, lang) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || !text) return;

  let res;
  try {
    const fetch = require('node-fetch');
    res = await fetch('https://api.openai.com/v1/moderations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ input: text }),
    });
  } catch {
    return; // network error — don't block the user
  }

  if (!res.ok) return;
  const data = await res.json();
  const result = data?.results?.[0];
  if (!result?.flagged) return;

  const cats = result.categories || {};
  if (cats.sexual || cats['sexual/minors'])          throw new ModerationError('sexual',     'openai', lang);
  if (cats.violence || cats['violence/graphic'])     throw new ModerationError('violence',   'openai', lang);
  if (cats.hate || cats['hate/threatening'])         throw new ModerationError('hate',       'openai', lang);
  if (cats.harassment || cats['harassment/threatening']) throw new ModerationError('harassment', 'openai', lang);
  if (cats['self-harm'])                             throw new ModerationError('violence',   'openai-self-harm', lang);
  throw new ModerationError('default', 'openai-flagged', lang);
}

// ─── Layer 3: Sightengine image check (runs if SIGHTENGINE_USER + SECRET set) ─
async function checkSightengine(imageUrl, lang) {
  const user   = process.env.SIGHTENGINE_USER;
  const secret = process.env.SIGHTENGINE_SECRET;
  if (!user || !secret || !imageUrl) return;

  const fetch = require('node-fetch');
  let data;

  try {
    // Decide whether to use URL-mode or stream-mode.
    // Sightengine's servers can't reach localhost/private URLs, so we
    // download the image ourselves and POST the bytes directly.
    const isPublicUrl =
      imageUrl.startsWith('https://') &&
      !imageUrl.includes('localhost') &&
      !imageUrl.includes('127.0.0.1');

    if (isPublicUrl) {
      // Public URL — let Sightengine fetch it directly (faster)
      const params = new URLSearchParams({
        url: imageUrl,
        models: 'nudity-2.1,violence,gore-2.0,weapon',
        api_user: user,
        api_secret: secret,
      });
      const res = await fetch(`https://api.sightengine.com/1.0/check.json?${params}`);
      if (!res.ok) return;
      data = await res.json();
    } else {
      // Local / relative URL — download bytes, send as multipart stream
      const FormData = require('form-data');

      // Resolve relative URL to absolute localhost
      const absoluteUrl = imageUrl.startsWith('http')
        ? imageUrl
        : `http://localhost:${process.env.PORT || 4002}${imageUrl}`;

      const imgRes = await fetch(absoluteUrl);
      if (!imgRes.ok) return; // can't download — skip gracefully

      const imgBuffer = await imgRes.buffer();
      const form = new FormData();
      form.append('media', imgBuffer, { filename: 'image.jpg', contentType: imgRes.headers.get('content-type') || 'image/jpeg' });
      form.append('models', 'nudity-2.1,violence,gore-2.0,weapon');
      form.append('api_user', user);
      form.append('api_secret', secret);

      const res = await fetch('https://api.sightengine.com/1.0/check.json', {
        method: 'POST',
        body: form,
        headers: form.getHeaders(),
      });
      if (!res.ok) return;
      data = await res.json();
    }
  } catch {
    return; // network error — don't block the user
  }

  if (!data || data.status !== 'success') return;

  const nudity = data.nudity;
  if (nudity) {
    const explicit = (nudity.raw ?? 0) + (nudity.sexual_activity ?? 0) + (nudity.sexual_display ?? 0);
    if (explicit > 0.7)                                    throw new ModerationError('sexual', `sightengine nudity=${explicit.toFixed(2)}`, lang);
    if ((nudity.erotica        ?? 0) > 0.8)                throw new ModerationError('sexual', 'sightengine-erotica', lang);
    if ((nudity.suggestive     ?? 0) > 0.85)               throw new ModerationError('sexual', 'sightengine-suggestive', lang);
    if ((nudity.suggestive_classes?.bikini  ?? 0) > 0.75)  throw new ModerationError('sexual', 'sightengine-bikini', lang);
  }

  if ((data.violence?.prob ?? 0) > 0.8) throw new ModerationError('violence', `sightengine`, lang);
  if ((data.gore?.prob     ?? 0) > 0.8) throw new ModerationError('gore',     `sightengine`, lang);
  if ((data.weapon?.classes?.firearm ?? 0) > 0.95) throw new ModerationError('violence', 'sightengine-weapon', lang);
}

// ─── Layer 4: OpenAI Vision — kissing / romantic content detection ────────────
// Uses gpt-4o-mini vision (~$0.0002/image). Only runs if OPENAI_API_KEY is set.
async function checkOpenAIVision(imageUrl, lang) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || !imageUrl) return;

  // Resolve local URLs to absolute for the API call
  let absoluteUrl = imageUrl;
  if (!imageUrl.startsWith('http')) {
    absoluteUrl = `http://localhost:${process.env.PORT || 4002}${imageUrl}`;
  }

  // For local images, download and encode as base64
  const fetch = require('node-fetch');
  let imageContent;
  try {
    if (absoluteUrl.includes('localhost') || absoluteUrl.includes('127.0.0.1')) {
      const imgRes = await fetch(absoluteUrl);
      if (!imgRes.ok) return;
      const buffer = await imgRes.buffer();
      const b64 = buffer.toString('base64');
      const mime = imgRes.headers.get('content-type') || 'image/jpeg';
      imageContent = { type: 'image_url', image_url: { url: `data:${mime};base64,${b64}`, detail: 'low' } };
    } else {
      imageContent = { type: 'image_url', image_url: { url: absoluteUrl, detail: 'low' } };
    }
  } catch {
    return;
  }

  let res;
  try {
    res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 10,
        messages: [{
          role: 'user',
          content: [
            imageContent,
            {
              type: 'text',
              text: 'Does this image contain kissing, romantic physical contact, or sexual content? Reply only YES or NO.',
            },
          ],
        }],
      }),
    });
  } catch {
    return;
  }

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    console.log('[moderation] openai-vision error:', res.status, errText.slice(0, 200));
    return;
  }
  const data = await res.json();
  const answer = data?.choices?.[0]?.message?.content?.trim().toUpperCase() ?? '';
  console.log('[moderation] openai-vision answer:', answer, '| url:', imageUrl.slice(0, 80));
  if (answer.startsWith('YES')) throw new ModerationError('sexual', 'openai-vision-kissing', lang);
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Moderate text. lang = 'ar' | 'en' (defaults to 'ar').
 * @throws {ModerationError}
 */
async function moderateText(text, lang = 'ar') {
  if (!text) return;
  checkLocalFilter(text, lang);
  await checkOpenAI(text, lang);
}

/** Text moderation with a capped OpenAI wait — for comments/DMs where latency matters. */
async function moderateTextFast(text, lang = 'ar', openAiTimeoutMs = 4000) {
  if (!text) return;
  checkLocalFilter(text, lang);
  if (!process.env.OPENAI_API_KEY) return;
  let timedOut = false;
  await Promise.race([
    checkOpenAI(text, lang),
    new Promise((resolve) => setTimeout(resolve, openAiTimeoutMs)).then(() => {
      timedOut = true;
    }),
  ]);
  if (timedOut) {
    void checkOpenAI(text, lang).catch(() => {});
  }
}

/**
 * Moderate an image URL.
 * @throws {ModerationError}
 */
async function moderateImage(imageUrl, lang = 'ar') {
  if (!imageUrl) return;
  await checkSightengine(imageUrl, lang);
  await checkOpenAIVision(imageUrl, lang);
}

/**
 * Moderate all text + image fields at once.
 * @throws {ModerationError}
 */
async function moderateContent({ text, imageUrl, imageUrls, lang = 'ar' } = {}) {
  if (text)          await moderateText(text, lang);
  if (imageUrl)      await moderateImage(imageUrl, lang);
  if (imageUrls?.length) {
    for (const url of imageUrls) await moderateImage(url, lang);
  }
}

module.exports = { moderateText, moderateTextFast, moderateImage, moderateContent, ModerationError };
