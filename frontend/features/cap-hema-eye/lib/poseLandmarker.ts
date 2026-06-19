import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision';

const WASM_BASE = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm';
const MODEL_LITE_URL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';
/** Matches squad analysis: MediaPipe Pose model_complexity=2 */
const MODEL_HEAVY_URL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_heavy/float16/1/pose_landmarker_heavy.task';

let liteLandmarkerPromise: Promise<PoseLandmarker> | null = null;
let pushupLandmarkerPromise: Promise<PoseLandmarker> | null = null;

async function createLandmarker(
  modelAssetPath: string,
  minConfidence: number,
): Promise<PoseLandmarker> {
  const vision = await FilesetResolver.forVisionTasks(WASM_BASE);
  return PoseLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath,
      delegate: 'GPU',
    },
    runningMode: 'VIDEO',
    numPoses: 1,
    minPoseDetectionConfidence: minConfidence,
    minPosePresenceConfidence: minConfidence,
    minTrackingConfidence: 0.5,
  });
}

/** Lite model — used for squat demo/live/upload. */
export async function getPoseLandmarker(): Promise<PoseLandmarker> {
  if (!liteLandmarkerPromise) {
    liteLandmarkerPromise = createLandmarker(MODEL_LITE_URL, 0.5);
  }
  return liteLandmarkerPromise;
}

/** Heavy model + 0.7 detection — matches squad analysis Push Ups Live. */
export async function getPushupPoseLandmarker(): Promise<PoseLandmarker> {
  if (!pushupLandmarkerPromise) {
    pushupLandmarkerPromise = createLandmarker(MODEL_HEAVY_URL, 0.7);
  }
  return pushupLandmarkerPromise;
}

export function resetPoseLandmarker() {
  liteLandmarkerPromise = null;
  pushupLandmarkerPromise = null;
}
