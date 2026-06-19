import type { NormalizedLandmark } from '@mediapipe/tasks-vision';
import type { PushupThresholds } from './pushupThresholds';
import { findAngle, getNoseCoord, getSideLandmarks, mirrorPointX, type Point } from './squatGeometry';
import {
  drawCircle,
  drawLine,
  drawPushupElbowArc,
  drawRoundedLabel,
  SQUAT_COLORS,
} from './squatCanvasDraw';

export interface PushupStats {
  correct: number;
  incorrect: number;
  offsetAngle: number | null;
  cameraAligned: boolean;
  feedback: string[];
}

const FEEDBACK_MAP: Record<number, [string, number, string]> = {
  0: ['LOWER YOUR CHEST', 215, 'rgb(255, 153, 0)'],
  1: ['KEEP BACK STRAIGHT', 170, 'rgb(80, 80, 255)'],
  2: ['HIPS SAGGING', 125, 'rgb(80, 80, 255)'],
  3: ['HIPS TOO HIGH', 80, 'rgb(80, 80, 255)'],
};

export class PushupAnalyzer {
  private thresholds: PushupThresholds;
  private stateSeq: string[] = [];
  private startInactive = 0;
  private startInactiveFront = 0;
  private inactiveTime = 0;
  private inactiveTimeFront = 0;
  private displayText = [false, false, false, false];
  private countFrames = [0, 0, 0, 0];
  private lowerChest = false;
  private incorrectPosture = false;
  private prevState: string | null = null;
  private currState: string | null = null;
  private pushupCount = 0;
  private improperPushup = 0;
  private smoothedElbow: number | null = null;
  private smoothedBody: number | null = null;
  private badPostureFrames = 0;
  /** Frames spent in s2/s3 — filters micro-movements before a real rep. */
  private downPhaseFrames = 0;
  private wasInDownPhase = false;
  private clock = () => performance.now() / 1000;

  /** Minimum frames in down phase before a rep attempt counts (correct or incorrect). */
  private static readonly MIN_DOWN_PHASE_FRAMES = 10;

  constructor(thresholds: PushupThresholds) {
    this.thresholds = thresholds;
    this.startInactive = this.clock();
    this.startInactiveFront = this.clock();
  }

  resetCounters() {
    this.pushupCount = 0;
    this.improperPushup = 0;
    this.stateSeq = [];
    this.incorrectPosture = false;
    this.badPostureFrames = 0;
    this.downPhaseFrames = 0;
    this.wasInDownPhase = false;
  }

  getStats(): PushupStats {
    const feedback: string[] = [];
    if (this.lowerChest) feedback.push('LOWER YOUR CHEST');
    this.countFrames.forEach((count, idx) => {
      if (count > 0 && FEEDBACK_MAP[idx]) feedback.push(FEEDBACK_MAP[idx][0]);
    });
    return {
      correct: this.pushupCount,
      incorrect: this.improperPushup,
      offsetAngle: null,
      cameraAligned: true,
      feedback,
    };
  }

  private getState(elbowAngle: number): string | null {
    const t = this.thresholds.ELBOW_ANGLE;
    if (elbowAngle >= t.EXTENDED[0] && elbowAngle <= t.EXTENDED[1]) return 's1';
    if (elbowAngle >= t.TRANS[0] && elbowAngle <= t.TRANS[1]) return 's2';
    if (elbowAngle >= t.LOWERED[0] && elbowAngle <= t.LOWERED[1]) return 's3';
    return null;
  }

  private updateStateSequence(state: string | null) {
    if (state === 's2') {
      if (
        (!this.stateSeq.includes('s3') && this.stateSeq.filter((s) => s === 's2').length === 0) ||
        (this.stateSeq.includes('s3') && this.stateSeq.filter((s) => s === 's2').length === 1)
      ) {
        this.stateSeq.push(state);
      }
    } else if (state === 's3') {
      if (!this.stateSeq.includes('s3') && this.stateSeq.includes('s2')) {
        this.stateSeq.push(state);
      }
    }
  }

  private drawCounters(ctx: CanvasRenderingContext2D, w: number) {
    drawRoundedLabel(ctx, `CORRECT: ${this.pushupCount}`, Math.floor(w * 0.75), 30, {
      bgColor: SQUAT_COLORS.correctBg,
    });
    drawRoundedLabel(ctx, `INCORRECT: ${this.improperPushup}`, Math.floor(w * 0.75), 80, {
      bgColor: SQUAT_COLORS.incorrectBg,
    });
  }

  private showFeedback(ctx: CanvasRenderingContext2D) {
    if (this.lowerChest) {
      drawRoundedLabel(ctx, 'LOWER YOUR CHEST', 30, 80, {
        textColor: '#000',
        bgColor: SQUAT_COLORS.lowerHipsBg,
      });
    }
    this.countFrames.forEach((count, idx) => {
      if (count <= 0 || !FEEDBACK_MAP[idx]) return;
      const [msg, y, bg] = FEEDBACK_MAP[idx];
      drawRoundedLabel(ctx, msg, 30, y, { bgColor: bg });
    });
  }

  processFrame(
    ctx: CanvasRenderingContext2D,
    landmarks: NormalizedLandmark[] | null,
    width: number,
    height: number,
    mirrorDisplay = false,
  ): PushupStats {
    const dp = (p: Point): Point => (mirrorDisplay ? mirrorPointX(p, width) : p);

    if (landmarks && landmarks.length > 0) {
      const nose = getNoseCoord(landmarks, width, height);
      const left = getSideLandmarks(landmarks, 'left', width, height);
      const right = getSideLandmarks(landmarks, 'right', width, height);
      const offsetAngle = findAngle(left.shoulder, right.shoulder, nose);

      if (offsetAngle > this.thresholds.OFFSET_THRESH) {
        const now = this.clock();
        this.inactiveTimeFront += now - this.startInactiveFront;
        this.startInactiveFront = now;

        let displayInactivity = false;
        if (this.inactiveTimeFront >= this.thresholds.INACTIVE_THRESH) {
          this.pushupCount = 0;
          this.improperPushup = 0;
          displayInactivity = true;
        }

        drawCircle(ctx, dp(nose), 7, SQUAT_COLORS.white);
        drawCircle(ctx, dp(left.shoulder), 7, SQUAT_COLORS.yellow);
        drawCircle(ctx, dp(right.shoulder), 7, SQUAT_COLORS.magenta);
        this.drawCounters(ctx, width);

        if (displayInactivity) {
          this.inactiveTimeFront = 0;
          this.startInactiveFront = this.clock();
        }

        drawRoundedLabel(ctx, 'CAMERA NOT ALIGNED PROPERLY!!!', 30, height - 60, {
          bgColor: SQUAT_COLORS.warnBg,
        });
        drawRoundedLabel(ctx, `OFFSET ANGLE: ${offsetAngle}`, 30, height - 30, {
          bgColor: SQUAT_COLORS.warnBg,
        });

        this.startInactive = this.clock();
        this.inactiveTime = 0;
        this.prevState = null;
        this.currState = null;

        return {
          correct: this.pushupCount,
          incorrect: this.improperPushup,
          offsetAngle,
          cameraAligned: false,
          feedback: ['CAMERA NOT ALIGNED PROPERLY!!!'],
        };
      }

      this.inactiveTimeFront = 0;
      this.startInactiveFront = this.clock();

      const distL = Math.abs(left.shoulder[0] - left.wrist[0]);
      const distR = Math.abs(right.shoulder[0] - right.wrist[0]);
      const side = distL > distR ? left : right;

      let elbowAngle = findAngle(side.shoulder, side.wrist, side.elbow);
      let bodyAngle = findAngle(side.shoulder, side.ankle, side.hip);

      const alpha = this.thresholds.ANGLE_SMOOTH_ALPHA;
      if (this.smoothedElbow == null) {
        this.smoothedElbow = elbowAngle;
        this.smoothedBody = bodyAngle;
      } else {
        this.smoothedElbow = alpha * elbowAngle + (1 - alpha) * this.smoothedElbow;
        this.smoothedBody = alpha * bodyAngle + (1 - alpha) * (this.smoothedBody ?? bodyAngle);
      }
      elbowAngle = Math.floor(this.smoothedElbow);
      bodyAngle = Math.floor(this.smoothedBody ?? bodyAngle);

      const elbow = dp(side.elbow);
      const hip = dp(side.hip);

      drawPushupElbowArc(ctx, elbow, 25, elbowAngle, SQUAT_COLORS.white);

      drawLine(ctx, dp(side.shoulder), dp(side.elbow), SQUAT_COLORS.lightBlue);
      drawLine(ctx, dp(side.wrist), dp(side.elbow), SQUAT_COLORS.lightBlue);
      drawLine(ctx, dp(side.shoulder), dp(side.hip), SQUAT_COLORS.lightBlue);
      drawLine(ctx, dp(side.hip), dp(side.ankle), SQUAT_COLORS.lightBlue);
      drawLine(ctx, dp(side.knee), dp(side.hip), SQUAT_COLORS.lightBlue);
      drawLine(ctx, dp(side.ankle), dp(side.foot), SQUAT_COLORS.lightBlue);

      ([side.shoulder, side.elbow, side.wrist, side.hip, side.knee, side.ankle, side.foot] as Point[]).forEach(
        (p) => drawCircle(ctx, dp(p), 7, SQUAT_COLORS.yellow),
      );

      const currentState = this.getState(elbowAngle);
      this.currState = currentState;
      this.updateStateSequence(currentState);

      if (currentState === 's2' || currentState === 's3') {
        this.downPhaseFrames += 1;
        this.wasInDownPhase = true;
      }

      const repCompleted =
        currentState === 's1' &&
        (this.prevState === 's2' || this.prevState === 's3') &&
        this.wasInDownPhase;

      if (repCompleted) {
        const reachedLow = this.stateSeq.includes('s3');
        const heldDownLongEnough = this.downPhaseFrames >= PushupAnalyzer.MIN_DOWN_PHASE_FRAMES;
        const attemptedRep = reachedLow || heldDownLongEnough;

        if (attemptedRep) {
          if (this.stateSeq.length === 3 && !this.incorrectPosture) {
            this.pushupCount += 1;
          } else if (
            (this.stateSeq.includes('s2') && this.stateSeq.length === 1 && heldDownLongEnough) ||
            (this.incorrectPosture && (reachedLow || this.stateSeq.length >= 2))
          ) {
            this.improperPushup += 1;
          }
        }

        this.stateSeq = [];
        this.incorrectPosture = false;
        this.badPostureFrames = 0;
        this.downPhaseFrames = 0;
        this.wasInDownPhase = false;
      } else if (currentState === 's1' && (this.prevState === 's1' || this.prevState === null)) {
        // Idle at top — discard partial wiggles, do not count.
        this.stateSeq = [];
        this.incorrectPosture = false;
        this.badPostureFrames = 0;
        this.downPhaseFrames = 0;
        this.wasInDownPhase = false;
        this.lowerChest = false;
      } else if (currentState === 's2' || currentState === 's3') {
        const [depthMin, depthMax] = this.thresholds.ELBOW_DEPTH;
        if (depthMin < elbowAngle && elbowAngle < depthMax && this.stateSeq.filter((s) => s === 's2').length === 1) {
          this.lowerChest = true;
        }

        let frameBad = false;
        const hipSag = side.hip[1] - side.shoulder[1];

        if (bodyAngle < this.thresholds.BODY_STRAIGHT_MIN) {
          this.displayText[1] = true;
          frameBad = true;
        } else if (hipSag > this.thresholds.HIP_SAG_OFFSET) {
          this.displayText[2] = true;
          frameBad = true;
        } else if (hipSag < -this.thresholds.HIP_PIKE_OFFSET) {
          this.displayText[3] = true;
          frameBad = true;
        }

        if (frameBad) {
          this.badPostureFrames += 1;
        } else {
          this.badPostureFrames = 0;
        }

        if (this.badPostureFrames >= this.thresholds.BAD_POSTURE_THRESH) {
          this.incorrectPosture = true;
        }
      }

      let displayInactivity = false;
      if (this.currState === this.prevState) {
        const now = this.clock();
        this.inactiveTime += now - this.startInactive;
        this.startInactive = now;
        if (this.inactiveTime >= this.thresholds.INACTIVE_THRESH) {
          this.pushupCount = 0;
          this.improperPushup = 0;
          displayInactivity = true;
        }
      } else {
        this.startInactive = this.clock();
        this.inactiveTime = 0;
      }

      if (this.stateSeq.includes('s3')) this.lowerChest = false;

      this.countFrames = this.countFrames.map((c, i) => (this.displayText[i] ? c + 1 : c));

      this.showFeedback(ctx);
      if (displayInactivity) {
        this.startInactive = this.clock();
        this.inactiveTime = 0;
      }

      ctx.font = '600 14px system-ui, sans-serif';
      ctx.fillStyle = SQUAT_COLORS.lightGreen;
      ctx.fillText(String(elbowAngle), elbow[0] + 10, elbow[1]);
      ctx.fillText(String(bodyAngle), hip[0] + 10, hip[1]);

      this.drawCounters(ctx, width);

      for (let i = 0; i < this.countFrames.length; i += 1) {
        if (this.countFrames[i] > this.thresholds.CNT_FRAME_THRESH) {
          this.displayText[i] = false;
          this.countFrames[i] = 0;
        }
      }
      this.prevState = currentState;
    } else {
      const now = this.clock();
      this.inactiveTime += now - this.startInactive;
      let displayInactivity = false;
      if (this.inactiveTime >= this.thresholds.INACTIVE_THRESH) {
        this.pushupCount = 0;
        this.improperPushup = 0;
        displayInactivity = true;
      }
      this.startInactive = now;
      this.drawCounters(ctx, width);
      if (displayInactivity) {
        this.startInactive = this.clock();
        this.inactiveTime = 0;
      }
      this.prevState = null;
      this.currState = null;
      this.inactiveTimeFront = 0;
      this.incorrectPosture = false;
      this.displayText = [false, false, false, false];
      this.countFrames = [0, 0, 0, 0];
      this.smoothedElbow = null;
      this.smoothedBody = null;
      this.badPostureFrames = 0;
      this.downPhaseFrames = 0;
      this.wasInDownPhase = false;
      this.stateSeq = [];
      this.startInactiveFront = this.clock();
    }

    return this.getStats();
  }
}
