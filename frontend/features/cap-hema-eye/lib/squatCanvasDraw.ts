import type { Point } from './squatGeometry';

/** OpenCV BGR tuples from the Python project, converted to CSS rgb(). */
export const SQUAT_COLORS = {
  blue: 'rgb(255, 127, 0)',
  red: 'rgb(50, 50, 255)',
  green: 'rgb(127, 255, 0)',
  lightGreen: 'rgb(127, 233, 100)',
  yellow: 'rgb(0, 255, 255)',
  magenta: 'rgb(255, 0, 255)',
  white: 'rgb(255, 255, 255)',
  cyan: 'rgb(255, 255, 0)',
  lightBlue: 'rgb(255, 204, 102)',
  orange: 'rgb(255, 153, 0)',
  correctBg: 'rgb(18, 185, 0)',
  incorrectBg: 'rgb(221, 0, 0)',
  warnBg: 'rgb(255, 153, 0)',
  lowerHipsBg: 'rgb(255, 255, 0)',
} as const;

export function drawRoundedLabel(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  opts: {
    fontSize?: number;
    textColor?: string;
    bgColor?: string;
    paddingX?: number;
    paddingY?: number;
  } = {},
) {
  const fontSize = opts.fontSize ?? 14;
  const textColor = opts.textColor ?? 'rgb(255, 255, 230)';
  const bgColor = opts.bgColor ?? 'rgb(0, 0, 0)';
  const paddingX = opts.paddingX ?? 10;
  const paddingY = opts.paddingY ?? 6;

  ctx.font = `700 ${fontSize}px system-ui, sans-serif`;
  const metrics = ctx.measureText(text);
  const w = metrics.width + paddingX * 2;
  const h = fontSize + paddingY * 2;
  const rx = 8;

  ctx.fillStyle = bgColor;
  ctx.beginPath();
  ctx.moveTo(x + rx, y);
  ctx.lineTo(x + w - rx, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rx);
  ctx.lineTo(x + w, y + h - rx);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rx, y + h);
  ctx.lineTo(x + rx, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rx);
  ctx.lineTo(x, y + rx);
  ctx.quadraticCurveTo(x, y, x + rx, y);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = textColor;
  ctx.fillText(text, x + paddingX, y + paddingY + fontSize * 0.85);
}

export function drawLine(ctx: CanvasRenderingContext2D, a: Point, b: Point, color: string, width = 4) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(a[0], a[1]);
  ctx.lineTo(b[0], b[1]);
  ctx.stroke();
}

export function drawCircle(ctx: CanvasRenderingContext2D, center: Point, radius: number, color: string) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(center[0], center[1], radius, 0, Math.PI * 2);
  ctx.fill();
}

export function drawVerticalGuide(ctx: CanvasRenderingContext2D, x: number, y: number, half: number, color: string) {
  drawLine(ctx, [x, y + 20], [x, y - half], color, 4);
}

export function drawPushupElbowArc(
  ctx: CanvasRenderingContext2D,
  center: Point,
  radius: number,
  degrees: number,
  color: string,
) {
  const start = 0;
  const end = (degrees * Math.PI) / 180;
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(center[0], center[1], radius, start, end);
  ctx.stroke();
}

export function drawAngleArc(
  ctx: CanvasRenderingContext2D,
  center: Point,
  radius: number,
  degrees: number,
  multiplier: number,
  color: string,
) {
  const start = -Math.PI / 2;
  const end = start + (multiplier * degrees * Math.PI) / 180;
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(center[0], center[1], radius, start, end, multiplier < 0);
  ctx.stroke();
}
