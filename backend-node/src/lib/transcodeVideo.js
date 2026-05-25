const { spawn } = require('child_process');
const fs = require('fs');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');

const FFMPEG_PATH = process.env.FFMPEG_PATH || ffmpegInstaller.path;

/**
 * Transcode any common upload to H.264 + AAC in an MP4 container for broad browser support.
 */
function transcodeToWebMp4(inputPath, outputPath, onProgress) {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(inputPath)) {
      reject(new Error('Input video not found'));
      return;
    }

    const args = [
      '-y',
      '-i',
      inputPath,
      '-map',
      '0:v:0',
      '-map',
      '0:a:0?',
      '-c:v',
      'libx264',
      '-profile:v',
      'main',
      '-level',
      '4.0',
      '-pix_fmt',
      'yuv420p',
      '-movflags',
      '+faststart',
      '-vf',
      'scale=1080:-2:force_original_aspect_ratio=decrease',
      '-preset',
      'fast',
      '-crf',
      '23',
      '-c:a',
      'aac',
      '-b:a',
      '128k',
      '-ar',
      '44100',
      '-ac',
      '2',
      outputPath,
    ];

    const proc = spawn(FFMPEG_PATH, args, { windowsHide: true });
    let stderr = '';
    let durationSec = null;

    proc.stderr.on('data', (chunk) => {
      const text = chunk.toString();
      stderr += text;
      if (durationSec == null) {
        const durMatch = text.match(/Duration:\s(\d+):(\d+):([\d.]+)/);
        if (durMatch) {
          durationSec =
            Number(durMatch[1]) * 3600 + Number(durMatch[2]) * 60 + Number.parseFloat(durMatch[3]);
        }
      }
      if (onProgress && durationSec && durationSec > 0) {
        const timeMatch = text.match(/time=(\d+):(\d+):([\d.]+)/);
        if (timeMatch) {
          const current =
            Number(timeMatch[1]) * 3600 + Number(timeMatch[2]) * 60 + Number.parseFloat(timeMatch[3]);
          onProgress(Math.min(99, Math.round((current / durationSec) * 100)));
        }
      }
    });

    proc.on('error', (err) => {
      reject(new Error(err.code === 'ENOENT' ? 'FFmpeg is not available on the server' : err.message));
    });

    proc.on('close', (code) => {
      if (code === 0 && fs.existsSync(outputPath)) {
        onProgress?.(100);
        resolve(outputPath);
        return;
      }
      reject(new Error(stderr.trim().slice(-500) || `Video conversion failed (${code ?? 'unknown'})`));
    });
  });
}

module.exports = { transcodeToWebMp4, FFMPEG_PATH };
