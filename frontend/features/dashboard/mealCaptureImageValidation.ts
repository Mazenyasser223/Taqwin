export type ImageQualityLevel = 'ok' | 'warn' | 'fail';

export type ImageQualityCheck = {
  blur: ImageQualityLevel;
  brightness: ImageQualityLevel;
  resolution: ImageQualityLevel;
  food_visible: boolean;
  full_plate_visible: boolean;
  width: number;
  height: number;
  brightnessValue: number;
  blurScore: number;
  notes: string[];
  blocking: boolean;
};

type BandStats = { variance: number; edge: number };

function bandStats(gray: Uint8ClampedArray, w: number, h: number, x0: number, y0: number, x1: number, y1: number): BandStats {
  let lumSum = 0;
  let lumSq = 0;
  let edgeSum = 0;
  let count = 0;
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      if (x < 1 || x >= w - 1 || y < 1 || y >= h - 1) continue;
      const idx = y * w + x;
      const lum = gray[idx];
      lumSum += lum;
      lumSq += lum * lum;
      edgeSum += Math.abs(gray[idx + 1] - gray[idx - 1]) + Math.abs(gray[idx + w] - gray[idx - w]);
      count += 1;
    }
  }
  if (!count) return { variance: 0, edge: 0 };
  const mean = lumSum / count;
  return { variance: lumSq / count - mean * mean, edge: edgeSum / count };
}

/** Heuristic: meal/plate content cropped at 2+ frame edges → not full plate visible. */
function detectFullPlateVisible(gray: Uint8ClampedArray, w: number, h: number): boolean {
  const band = Math.max(3, Math.round(Math.min(w, h) * 0.07));
  const margin = Math.round(Math.min(w, h) * 0.18);

  const top = bandStats(gray, w, h, 0, 0, w, band);
  const bottom = bandStats(gray, w, h, 0, h - band, w, h);
  const left = bandStats(gray, w, h, 0, 0, band, h);
  const right = bandStats(gray, w, h, w - band, 0, w, h);
  const center = bandStats(gray, w, h, margin, margin, w - margin, h - margin);

  const edgeThreshold = Math.max(center.edge * 1.22, 6);
  const varianceThreshold = Math.max(center.variance * 0.55, 70);

  let croppedSides = 0;
  for (const side of [top, bottom, left, right]) {
    if (side.edge >= edgeThreshold && side.variance >= varianceThreshold) croppedSides += 1;
  }
  return croppedSides < 2;
}

const MIN_NATURAL_SIDE_FAIL = 200;
const MIN_NATURAL_SIDE_WARN = 480;
const BLUR_WARN = 50;
const BRIGHTNESS_MIN = 35;
const BRIGHTNESS_MAX = 240;
const BRIGHTNESS_FAIL = 20;
const BRIGHTNESS_HIGH_FAIL = 250;

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not load image'));
    };
    img.src = url;
  });
}

function laplacianVariance(data: Uint8ClampedArray, w: number, h: number): number {
  let sum = 0;
  let sumSq = 0;
  let count = 0;
  const kernel = (x: number, y: number) => {
    const idx = y * w + x;
    const c = data[idx * 4];
    const l =
      data[((y - 1) * w + x) * 4] +
      data[((y + 1) * w + x) * 4] +
      data[(y * w + (x - 1)) * 4] +
      data[(y * w + (x + 1)) * 4] -
      4 * c;
    sum += l;
    sumSq += l * l;
    count += 1;
  };
  for (let y = 1; y < h - 1; y += 1) {
    for (let x = 1; x < w - 1; x += 1) kernel(x, y);
  }
  if (count === 0) return 0;
  const mean = sum / count;
  return sumSq / count - mean * mean;
}

function analyzeCanvasPixels(ctx: CanvasRenderingContext2D, w: number, h: number): Omit<ImageQualityCheck, 'notes' | 'blocking'> {
  const imageData = ctx.getImageData(0, 0, w, h);
  const { data } = imageData;

  let lumSum = 0;
  let lumSqSum = 0;
  let edgeSum = 0;
  const pixels = w * h;
  for (let i = 0; i < pixels; i += 1) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    lumSum += lum;
    lumSqSum += lum * lum;
  }
  const avgLum = lumSum / pixels;
  const variance = lumSqSum / pixels - avgLum * avgLum;

  const gray = new Uint8ClampedArray(pixels);
  for (let i = 0; i < pixels; i += 1) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    gray[i] = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
  }
  const rgba = new Uint8ClampedArray(pixels * 4);
  for (let i = 0; i < pixels; i += 1) {
    const v = gray[i];
    rgba[i * 4] = v;
    rgba[i * 4 + 1] = v;
    rgba[i * 4 + 2] = v;
    rgba[i * 4 + 3] = 255;
  }
  const blurScore = laplacianVariance(rgba, w, h);

  for (let y = 1; y < h - 1; y += 1) {
    for (let x = 1; x < w - 1; x += 1) {
      const idx = y * w + x;
      const gx = gray[idx + 1] - gray[idx - 1];
      const gy = gray[idx + w] - gray[idx - w];
      edgeSum += Math.abs(gx) + Math.abs(gy);
    }
  }
  const edgeDensity = edgeSum / ((w - 2) * (h - 2) * 2);

  let resolution: ImageQualityLevel = 'ok';

  let brightness: ImageQualityLevel = 'ok';
  if (avgLum < BRIGHTNESS_FAIL || avgLum > BRIGHTNESS_HIGH_FAIL) brightness = 'fail';
  else if (avgLum < BRIGHTNESS_MIN || avgLum > BRIGHTNESS_MAX) brightness = 'warn';

  let blur: ImageQualityLevel = 'ok';
  if (blurScore < BLUR_WARN) blur = 'warn';

  const food_visible = variance > 120 && edgeDensity > 4;
  const full_plate_visible = detectFullPlateVisible(gray, w, h);

  return {
    blur,
    brightness,
    resolution,
    food_visible,
    full_plate_visible,
    width: w,
    height: h,
    brightnessValue: Math.round(avgLum),
    blurScore: Math.round(blurScore),
  };
}

export async function compressMealCaptureFile(file: File): Promise<File> {
  if (!file.type.startsWith('image/')) return file;
  const img = await loadImage(file);
  const maxSide = 1280;
  const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return file;
  ctx.drawImage(img, 0, 0, w, h);

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.82);
  });
  if (!blob) return file;
  const base = file.name.replace(/\.[^.]+$/, '') || 'meal';
  return new File([blob], `${base}.jpg`, { type: 'image/jpeg', lastModified: Date.now() });
}

export async function compressMealCaptureFiles(files: File[]): Promise<File[]> {
  return Promise.all(files.map((file) => compressMealCaptureFile(file)));
}

export function isSoftMealCaptureQualityNote(note: string): boolean {
  return (
    /blurry/i.test(note) ||
    /low resolution/i.test(note) ||
    /full plate not visible/i.test(note) ||
    /food may not be clearly visible/i.test(note) ||
    /quite dark/i.test(note) ||
    /quite bright/i.test(note)
  );
}

function resolutionLevel(naturalWidth: number, naturalHeight: number): ImageQualityLevel {
  const minSide = Math.min(naturalWidth, naturalHeight);
  if (minSide < MIN_NATURAL_SIDE_FAIL) return 'fail';
  if (minSide < MIN_NATURAL_SIDE_WARN) return 'warn';
  return 'ok';
}

export async function validateMealCaptureImage(file: File): Promise<ImageQualityCheck> {
  const img = await loadImage(file);
  const maxSide = 512;
  const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return {
      blur: 'warn',
      brightness: 'warn',
      resolution: 'warn',
      food_visible: true,
      full_plate_visible: true,
      width: img.naturalWidth,
      height: img.naturalHeight,
      brightnessValue: 0,
      blurScore: 0,
      notes: ['Could not analyze image quality'],
      blocking: false,
    };
  }
  ctx.drawImage(img, 0, 0, w, h);
  const metrics = analyzeCanvasPixels(ctx, w, h);
  const naturalWidth = img.naturalWidth;
  const naturalHeight = img.naturalHeight;
  const resolution = resolutionLevel(naturalWidth, naturalHeight);

  const notes: string[] = [];
  if (resolution === 'fail') {
    notes.push(`Very low resolution (${naturalWidth}×${naturalHeight})`);
  } else if (resolution === 'warn') {
    notes.push(`Low resolution (${naturalWidth}×${naturalHeight})`);
  }
  if (metrics.blur === 'warn') notes.push('Slightly blurry');
  if (metrics.brightness === 'fail') {
    notes.push(metrics.brightnessValue < BRIGHTNESS_FAIL ? 'Image is too dark' : 'Image is overexposed');
  } else if (metrics.brightness === 'warn') {
    notes.push(metrics.brightnessValue < BRIGHTNESS_MIN ? 'Image is quite dark' : 'Image is quite bright');
  }
  if (!metrics.food_visible) notes.push('Food may not be clearly visible');
  if (!metrics.full_plate_visible) notes.push('Full plate not visible — frame may be cropped');

  const minSide = Math.min(naturalWidth, naturalHeight);
  const blocking = metrics.brightness === 'fail' || minSide < MIN_NATURAL_SIDE_FAIL;

  return {
    ...metrics,
    resolution,
    width: naturalWidth,
    height: naturalHeight,
    notes,
    blocking,
  };
}

export type MealCaptureValidationSummary = {
  perImage: ImageQualityCheck[];
  missingAngleWarning: boolean;
  partialPlatePhotos: number[];
  blocking: boolean;
  warnings: string[];
  softWarnings: string[];
};

export function partialPlateIndicesFromChecks(checks: ImageQualityCheck[]): number[] {
  return checks
    .map((check, i) => (!check.full_plate_visible ? i + 1 : null))
    .filter((n): n is number => n !== null);
}

export async function validateMealCaptureSet(files: File[]): Promise<MealCaptureValidationSummary> {
  const perImage = await Promise.all(files.map((f) => validateMealCaptureImage(f)));
  const missingAngleWarning = files.length === 1;
  const partialPlatePhotos = partialPlateIndicesFromChecks(perImage);
  const warnings: string[] = [];
  const softWarnings: string[] = [];
  if (missingAngleWarning) {
    softWarnings.push('Add top + side views for better portion accuracy');
  }
  perImage.forEach((check, i) => {
    check.notes.forEach((n) => {
      const line = `Photo ${i + 1}: ${n}`;
      if (isSoftMealCaptureQualityNote(n)) softWarnings.push(line);
      else warnings.push(line);
    });
  });
  const blocking = perImage.some((c) => c.blocking);
  return { perImage, missingAngleWarning, partialPlatePhotos, blocking, warnings, softWarnings };
}
