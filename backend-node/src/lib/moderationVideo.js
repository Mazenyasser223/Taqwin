/**
 * Video moderation — visual frames + spoken audio.
 *
 * Layers:
 *   1. Frame sampling + image moderation (Sightengine + OpenAI Vision per frame)
 *   2. Whisper (language ar/en) + text moderation on speech
 *   3. Sightengine audio-profanity on the video audio track
 */

const AUDIO_MODELS = 'audio-profanity';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { FFMPEG_PATH } = require('./transcodeVideo');

const MAX_VIDEO_BYTES = 80 * 1024 * 1024;
const MAX_SYNC_VIDEO_SEC = 60;
const FRAME_SAMPLE_COUNT = 5;
const VIDEO_MODELS = 'nudity-2.1,violence,gore-2.0,weapon,audio-profanity';

function lazyModeration() {
  return require('./moderation');
}

function resolveAbsoluteMediaUrl(mediaUrl) {
  if (!mediaUrl?.trim()) return '';
  const trimmed = mediaUrl.trim();
  if (trimmed.startsWith('http')) return trimmed;
  const port = process.env.PORT || 4000;
  return `http://localhost:${port}${trimmed.startsWith('/') ? trimmed : `/${trimmed}`}`;
}

function isPublicHttpsUrl(url) {
  return (
    url.startsWith('https://') &&
    !url.includes('localhost') &&
    !url.includes('127.0.0.1')
  );
}

async function fetchVideoToTemp(videoUrl) {
  const fetch = require('node-fetch');
  const absoluteUrl = resolveAbsoluteMediaUrl(videoUrl);
  const res = await fetch(absoluteUrl);
  if (!res.ok) throw new Error(`video fetch failed: ${res.status}`);

  const buffer = await res.buffer();
  if (buffer.length > MAX_VIDEO_BYTES) {
    throw new Error('Video file is too large to moderate');
  }

  const ext = path.extname(new URL(absoluteUrl, 'http://x').pathname) || '.mp4';
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'taqwin-vid-mod-'));
  const filePath = path.join(dir, `input${ext}`);
  fs.writeFileSync(filePath, buffer);
  return { filePath, dir, absoluteUrl, buffer };
}

function runProcess(bin, args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(bin, args, { windowsHide: true });
    let stderr = '';
    proc.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    proc.on('error', reject);
    proc.on('close', (code) => {
      if (code === 0) resolve(stderr);
      else reject(new Error(stderr.trim().slice(-500) || `${bin} exited ${code}`));
    });
  });
}

async function probeMediaInfo(filePath) {
  return new Promise((resolve) => {
    const proc = spawn(FFMPEG_PATH, ['-i', filePath], { windowsHide: true });
    let stderr = '';
    proc.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    proc.on('close', () => {
      const match = stderr.match(/Duration:\s(\d+):(\d+):([\d.]+)/);
      const duration = match
        ? Number(match[1]) * 3600 + Number(match[2]) * 60 + Number.parseFloat(match[3])
        : 0;
      resolve({ duration, hasAudio: /Audio:/i.test(stderr) });
    });
    proc.on('error', () => resolve({ duration: 0, hasAudio: false }));
  });
}

async function probeDurationSec(filePath) {
  const { duration } = await probeMediaInfo(filePath);
  return duration;
}

function isModerationError(err) {
  const { ModerationError } = lazyModeration();
  return err?.name === 'ModerationError' || err instanceof ModerationError;
}

function evaluateAudioProfanity(data, lang) {
  const { ModerationError } = lazyModeration();
  const raw = data?.profanity ?? data?.audio_profanity;
  const matches = Array.isArray(raw) ? raw : raw?.matches;
  if (Array.isArray(matches) && matches.length > 0) {
    throw new ModerationError('profanity', 'sightengine-audio', lang);
  }
}

function evaluateSightengineVideoPayload(data, lang) {
  const { ModerationError } = lazyModeration();
  if (!data || data.status !== 'success') return;

  evaluateAudioProfanity(data, lang);

  const frames = data.frames || [];
  for (const frame of frames) {
    const nudity = frame.nudity || {};
    const explicit =
      (nudity.raw ?? 0) +
      (nudity.sexual_activity ?? 0) +
      (nudity.sexual_display ?? 0);
    if (explicit > 0.7) throw new ModerationError('sexual', 'sightengine-video', lang);
    if ((nudity.erotica ?? 0) > 0.8) throw new ModerationError('sexual', 'sightengine-video-erotica', lang);
    if ((nudity.suggestive ?? 0) > 0.55) throw new ModerationError('sexual', 'sightengine-video-suggestive', lang);
    if ((frame.violence?.prob ?? 0) > 0.8) throw new ModerationError('violence', 'sightengine-video', lang);
    if ((frame.gore?.prob ?? 0) > 0.8) throw new ModerationError('gore', 'sightengine-video', lang);
    if ((frame.weapon?.classes?.firearm ?? 0) > 0.95) {
      throw new ModerationError('violence', 'sightengine-video-weapon', lang);
    }
  }

  const summary = data.summary || data.data?.summary;
  if (summary?.action === 'reject' || summary?.action === 'block') {
    const reason = summary.reject_reason?.[0] || summary.reject_profanity?.[0] || 'sightengine-summary';
    const category = String(reason).includes('profan') ? 'profanity' : 'default';
    throw new ModerationError(category, String(reason), lang);
  }
}

async function checkSightengineAudioProfanity({ audioPath, buffer, absoluteUrl, lang, durationSec = 0 }) {
  const user = process.env.SIGHTENGINE_USER;
  const secret = process.env.SIGHTENGINE_SECRET;
  if (!user || !secret) return 'skipped';
  if (durationSec > MAX_SYNC_VIDEO_SEC) {
    console.log('[moderation] sightengine audio skipped — video longer than', MAX_SYNC_VIDEO_SEC, 's');
    return 'skipped';
  }

  const fetch = require('node-fetch');
  const FormData = require('form-data');

  try {
    const form = new FormData();
    if (audioPath && fs.existsSync(audioPath)) {
      form.append('media', fs.createReadStream(audioPath), { filename: 'speech.mp3', contentType: 'audio/mpeg' });
    } else if (isPublicHttpsUrl(absoluteUrl)) {
      form.append('url', absoluteUrl);
    } else if (buffer?.length) {
      form.append('media', buffer, { filename: 'video.mp4', contentType: 'video/mp4' });
    } else {
      return 'failed';
    }
    form.append('models', AUDIO_MODELS);
    form.append('api_user', user);
    form.append('api_secret', secret);

    const res = await fetch('https://api.sightengine.com/1.0/video/check-sync.json', {
      method: 'POST',
      body: form,
      headers: form.getHeaders(),
    });
    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      let planBlocked = res.status === 400 && /usage_limit|paid plan|Video Analysis/i.test(errBody);
      try {
        const parsed = JSON.parse(errBody);
        planBlocked =
          planBlocked ||
          parsed?.error?.code === 3701 ||
          /usage_limit|paid plan/i.test(parsed?.error?.message || '');
      } catch {
        /* ignore */
      }
      if (planBlocked) {
        console.log('[moderation] sightengine audio skipped — plan does not include video/audio analysis');
        return 'skipped-plan';
      }
      console.warn('[moderation] sightengine audio HTTP', res.status);
      return 'failed';
    }
    const data = await res.json();
    if (!data || data.status !== 'success') {
      const planBlocked = data?.error?.code === 3701 || /usage_limit|paid plan/i.test(data?.error?.message || '');
      if (planBlocked) {
        console.log('[moderation] sightengine audio skipped — plan does not include video/audio analysis');
        return 'skipped-plan';
      }
      console.warn('[moderation] sightengine audio no result:', data?.status || data?.error?.message || 'empty');
      return 'failed';
    }
    evaluateAudioProfanity(data, lang);
    console.log('[moderation] sightengine audio profanity scan ok');
    return 'ok';
  } catch (err) {
    if (isModerationError(err)) throw err;
    console.warn('[moderation] sightengine audio error:', err.message?.slice(0, 120));
    return 'failed';
  }
}

async function checkSightengineVideoSync({ buffer, absoluteUrl, lang }) {
  const user = process.env.SIGHTENGINE_USER;
  const secret = process.env.SIGHTENGINE_SECRET;
  if (!user || !secret) return false;

  const fetch = require('node-fetch');
  const FormData = require('form-data');
  let data;

  try {
    const form = new FormData();
    if (isPublicHttpsUrl(absoluteUrl)) {
      form.append('url', absoluteUrl);
    } else {
      form.append('media', buffer, { filename: 'video.mp4', contentType: 'video/mp4' });
    }
    form.append('models', VIDEO_MODELS);
    form.append('api_user', user);
    form.append('api_secret', secret);

    const res = await fetch('https://api.sightengine.com/1.0/video/check-sync.json', {
      method: 'POST',
      body: form,
      headers: form.getHeaders(),
    });
    if (!res.ok) {
      console.warn('[moderation] sightengine video HTTP', res.status);
      return false;
    }
    data = await res.json();
  } catch (err) {
    console.warn('[moderation] sightengine video error:', err.message?.slice(0, 120));
    return false;
  }

  if (!data || data.status !== 'success') {
    console.warn('[moderation] sightengine video no result:', data?.status || 'empty');
    return false;
  }

  evaluateSightengineVideoPayload(data, lang);
  return true;
}

async function sampleFramesAndModerateImages(filePath, lang) {
  const { moderateImage, ModerationError } = lazyModeration();
  const duration = await probeDurationSec(filePath);
  const offsets =
    duration > 1
      ? Array.from({ length: FRAME_SAMPLE_COUNT }, (_, i) =>
          Math.min(duration - 0.1, (duration * (i + 0.5)) / FRAME_SAMPLE_COUNT),
        )
      : [0];

  const frameDir = path.join(path.dirname(filePath), 'frames');
  fs.mkdirSync(frameDir, { recursive: true });

  let checkedFrames = 0;
  const frameUrls = [];
  for (let i = 0; i < offsets.length; i += 1) {
    const framePath = path.join(frameDir, `frame-${i}.jpg`);
    const ss = offsets[i].toFixed(2);
    try {
      await runProcess(FFMPEG_PATH, [
        '-y',
        '-ss',
        ss,
        '-i',
        filePath,
        '-frames:v',
        '1',
        '-q:v',
        '3',
        framePath,
      ]);
    } catch {
      continue;
    }
    if (!fs.existsSync(framePath)) continue;

    const b64 = fs.readFileSync(framePath).toString('base64');
    frameUrls.push({ ss, dataUrl: `data:image/jpeg;base64,${b64}` });
  }

  await Promise.all(
    frameUrls.map(async ({ ss, dataUrl }) => {
      await moderateImage(dataUrl, lang);
      console.log('[moderation] video frame checked at', ss, 's');
    }),
  );
  checkedFrames = frameUrls.length;

  const hasModerationApi =
    Boolean(process.env.OPENAI_API_KEY) ||
    Boolean(process.env.SIGHTENGINE_USER && process.env.SIGHTENGINE_SECRET);

  if (checkedFrames === 0 && hasModerationApi) {
    throw new ModerationError('default', 'video-frame-extraction-failed', lang);
  }

  return checkedFrames;
}

async function extractAudioMp3(filePath, outPath) {
  try {
    await runProcess(FFMPEG_PATH, [
      '-y',
      '-i',
      filePath,
      '-vn',
      '-map',
      '0:a:0?',
      '-acodec',
      'libmp3lame',
      '-q:a',
      '6',
      '-ar',
      '16000',
      '-ac',
      '1',
      outPath,
    ]);
  } catch (err) {
    console.warn('[moderation] audio extract failed:', err.message?.slice(0, 120));
    return false;
  }
  return fs.existsSync(outPath) && fs.statSync(outPath).size > 800;
}

/** @returns {'transcribed'|'empty'|'failed'|'skipped'} */
async function checkVideoSpeechWithWhisper(audioPath, lang) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return 'skipped';
  if (!audioPath || !fs.existsSync(audioPath)) return 'failed';

  const { moderateText } = lazyModeration();
  const fetch = require('node-fetch');
  const FormData = require('form-data');
  const form = new FormData();
  form.append('file', fs.createReadStream(audioPath), { filename: 'speech.mp3', contentType: 'audio/mpeg' });
  form.append('model', 'whisper-1');
  form.append('response_format', 'json');

  let res;
  try {
    res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, ...form.getHeaders() },
      body: form,
    });
  } catch (err) {
    console.warn('[moderation] whisper request failed:', err.message?.slice(0, 120));
    return 'failed';
  }

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    console.warn('[moderation] whisper HTTP', res.status, errText.slice(0, 120));
    return 'failed';
  }

  const data = await res.json();
  const transcript = (data.text || '').trim();
  if (!transcript) {
    console.log('[moderation] whisper returned empty transcript');
    return 'empty';
  }

  console.log('[moderation] video whisper transcript:', transcript.slice(0, 120));
  await moderateText(transcript, lang);
  await lazyModeration().checkOpenAISpeechTranscript(transcript, lang);
  return 'transcribed';
}

async function moderateVideoAudio({ filePath, buffer, absoluteUrl, lang, hasAudio, durationSec }) {
  if (!hasAudio) {
    console.log('[moderation] video: no audio track — speech skipped');
    return;
  }

  const openaiConfigured = Boolean(process.env.OPENAI_API_KEY);
  const sightengineConfigured = Boolean(process.env.SIGHTENGINE_USER && process.env.SIGHTENGINE_SECRET);
  if (!openaiConfigured && !sightengineConfigured) {
    console.warn('[moderation] video: audio present but no speech moderation APIs configured');
    return;
  }

  const { ModerationError } = lazyModeration();
  const audioPath = path.join(path.dirname(filePath), 'speech.mp3');
  const extracted = await extractAudioMp3(filePath, audioPath);
  if (!extracted) {
    console.warn('[moderation] video: has audio track but extraction failed');
    throw new ModerationError('default', 'video-audio-extraction-failed', lang);
  }

  const [whisperStatus, sightengineStatus] = await Promise.all([
    checkVideoSpeechWithWhisper(audioPath, lang),
    checkSightengineAudioProfanity({ audioPath, buffer, absoluteUrl, lang, durationSec }),
  ]);

  const attempted = [
    openaiConfigured && whisperStatus !== 'skipped',
    sightengineConfigured && whisperStatus !== 'skipped' && sightengineStatus !== 'skipped-plan',
  ].filter(Boolean);
  const succeeded = [
    openaiConfigured && (whisperStatus === 'transcribed' || whisperStatus === 'empty'),
    sightengineConfigured && (sightengineStatus === 'ok' || sightengineStatus === 'skipped-plan'),
  ].filter(Boolean);

  console.log('[moderation] video audio checks — whisper:', whisperStatus, '| sightengine:', sightengineStatus);

  if (attempted.length > 0 && succeeded.length === 0) {
    throw new ModerationError('default', 'video-audio-moderation-failed', lang);
  }
}

function cleanupDir(dir) {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
}

/**
 * Moderate a stored video URL (visual + audio speech).
 * @throws {ModerationError}
 */
async function runVideoModeration(videoUrl, lang = 'ar') {
  if (!videoUrl?.trim()) return;

  let dir;
  try {
    const { filePath, dir: workDir, buffer, absoluteUrl } = await fetchVideoToTemp(videoUrl);
    dir = workDir;
    const { hasAudio, duration } = await probeMediaInfo(filePath);
    console.log('[moderation] video probe — hasAudio:', hasAudio, '| duration:', duration.toFixed(1), 's');

    await Promise.all([
      sampleFramesAndModerateImages(filePath, lang),
      moderateVideoAudio({ filePath, buffer, absoluteUrl, lang, hasAudio, durationSec: duration }),
    ]);
  } catch (err) {
    if (isModerationError(err)) throw err;
    console.warn('[moderation] video check skipped:', err.message?.slice?.(0, 200) || err);
  } finally {
    if (dir) cleanupDir(dir);
  }
}

module.exports = { runVideoModeration };
