import { useEffect, useRef, useState, type RefObject } from 'react';
import type { PoseLandmarker } from '@mediapipe/tasks-vision';
import { SquatAnalyzer, type SquatStats } from '../lib/squatAnalyzer';
import { getPoseLandmarker } from '../lib/poseLandmarker';
import { getSquatThresholds, type SquatLevel } from '../lib/squatThresholds';

const EMPTY_STATS: SquatStats = {
  correct: 0,
  incorrect: 0,
  offsetAngle: null,
  cameraAligned: true,
  feedback: [],
  lowerHips: false,
};

export function useSquatAnalysisLoop(
  videoRef: RefObject<HTMLVideoElement | null>,
  canvasRef: RefObject<HTMLCanvasElement | null>,
  level: SquatLevel,
  active: boolean,
  flip = false,
) {
  const analyzerRef = useRef<SquatAnalyzer | null>(null);
  const [stats, setStats] = useState<SquatStats>(EMPTY_STATS);
  const [modelLoading, setModelLoading] = useState(true);
  const [modelError, setModelError] = useState<string | null>(null);

  useEffect(() => {
    analyzerRef.current = new SquatAnalyzer(getSquatThresholds(level));
  }, [level]);

  useEffect(() => {
    if (!active) {
      setModelLoading(true);
      return;
    }

    let raf = 0;
    let cancelled = false;
    let landmarker: PoseLandmarker | null = null;

    void (async () => {
      try {
        landmarker = await getPoseLandmarker();
        if (cancelled) return;
        setModelLoading(false);
        setModelError(null);
      } catch {
        if (!cancelled) setModelError('Failed to load pose model');
        return;
      }

      const tick = () => {
        if (cancelled) return;
        const video = videoRef.current;
        const canvas = canvasRef.current;
        const analyzer = analyzerRef.current;
        if (!video || !canvas || !analyzer || !landmarker || video.readyState < 2) {
          raf = requestAnimationFrame(tick);
          return;
        }

        const w = video.videoWidth || 640;
        const h = video.videoHeight || 480;
        if (canvas.width !== w || canvas.height !== h) {
          canvas.width = w;
          canvas.height = h;
        }

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          raf = requestAnimationFrame(tick);
          return;
        }

        ctx.save();
        if (flip) {
          ctx.translate(w, 0);
          ctx.scale(-1, 1);
        }
        ctx.drawImage(video, 0, 0, w, h);
        ctx.restore();

        const result = landmarker.detectForVideo(video, performance.now());
        const landmarks = result.landmarks[0] ?? null;
        const nextStats = analyzer.processFrame(ctx, landmarks, w, h, flip);
        setStats(nextStats);
        raf = requestAnimationFrame(tick);
      };

      raf = requestAnimationFrame(tick);
    })();

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [active, videoRef, canvasRef, level, flip]);

  const resetCounters = () => analyzerRef.current?.resetCounters();

  return { stats, modelLoading, modelError, resetCounters };
}
