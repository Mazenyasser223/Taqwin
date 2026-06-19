import type { NormalizedLandmark } from '@mediapipe/tasks-vision';

export type Point = [number, number];

/** Mirror pixel x so skeleton overlays align with a horizontally flipped video frame. */
export function mirrorPointX(p: Point, width: number): Point {
  return [width - p[0], p[1]];
}

const LEFT_FEATURES = {
  shoulder: 11,
  elbow: 13,
  wrist: 15,
  hip: 23,
  knee: 25,
  ankle: 27,
  foot: 31,
} as const;

const RIGHT_FEATURES = {
  shoulder: 12,
  elbow: 14,
  wrist: 16,
  hip: 24,
  knee: 26,
  ankle: 28,
  foot: 32,
} as const;

export function findAngle(p1: Point, p2: Point, ref: Point = [0, 0]): number {
  const p1Ref: Point = [p1[0] - ref[0], p1[1] - ref[1]];
  const p2Ref: Point = [p2[0] - ref[0], p2[1] - ref[1]];
  const dot = p1Ref[0] * p2Ref[0] + p1Ref[1] * p2Ref[1];
  const mag = Math.hypot(p1Ref[0], p1Ref[1]) * Math.hypot(p2Ref[0], p2Ref[1]);
  if (mag === 0) return 0;
  const theta = Math.acos(Math.max(-1, Math.min(1, dot / mag)));
  return Math.floor((180 / Math.PI) * theta);
}

function landmarkPoint(landmarks: NormalizedLandmark[], index: number, w: number, h: number): Point {
  const lm = landmarks[index];
  return [Math.round(lm.x * w), Math.round(lm.y * h)];
}

export function getNoseCoord(landmarks: NormalizedLandmark[], w: number, h: number): Point {
  return landmarkPoint(landmarks, 0, w, h);
}

export type SideLandmarks = {
  shoulder: Point;
  elbow: Point;
  wrist: Point;
  hip: Point;
  knee: Point;
  ankle: Point;
  foot: Point;
};

export function getSideLandmarks(
  landmarks: NormalizedLandmark[],
  side: 'left' | 'right',
  w: number,
  h: number,
): SideLandmarks {
  const f = side === 'left' ? LEFT_FEATURES : RIGHT_FEATURES;
  return {
    shoulder: landmarkPoint(landmarks, f.shoulder, w, h),
    elbow: landmarkPoint(landmarks, f.elbow, w, h),
    wrist: landmarkPoint(landmarks, f.wrist, w, h),
    hip: landmarkPoint(landmarks, f.hip, w, h),
    knee: landmarkPoint(landmarks, f.knee, w, h),
    ankle: landmarkPoint(landmarks, f.ankle, w, h),
    foot: landmarkPoint(landmarks, f.foot, w, h),
  };
}
