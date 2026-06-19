import type { NormalizedLandmark } from '@mediapipe/tasks-vision';
import type { SquatThresholds } from './squatThresholds';
import { findAngle, getNoseCoord, getSideLandmarks, mirrorPointX, type Point } from './squatGeometry';
import {
  drawAngleArc,
  drawCircle,
  drawLine,
  drawRoundedLabel,
  drawVerticalGuide,
  SQUAT_COLORS,
} from './squatCanvasDraw';

export interface SquatStats {
  correct: number;
  incorrect: number;
  offsetAngle: number | null;
  cameraAligned: boolean;
  feedback: string[];
  lowerHips: boolean;
}

const FEEDBACK_MAP: Record<number, [string, number, string]> = {
  0: ['BEND BACKWARDS', 215, SQUAT_COLORS.cyan],
  1: ['BEND FORWARD', 215, SQUAT_COLORS.cyan],
  2: ['KNEE FALLING OVER TOE', 170, SQUAT_COLORS.red],
  3: ['SQUAT TOO DEEP', 125, SQUAT_COLORS.red],
};

export class SquatAnalyzer {
  private thresholds: SquatThresholds;
  private stateSeq: string[] = [];
  private startInactive = 0;
  private startInactiveFront = 0;
  private inactiveTime = 0;
  private inactiveTimeFront = 0;
  private displayText = [false, false, false, false];
  private countFrames = [0, 0, 0, 0];
  private lowerHips = false;
  private incorrectPosture = false;
  private prevState: string | null = null;
  private currState: string | null = null;
  private squatCount = 0;
  private improperSquat = 0;
  private clock = () => performance.now() / 1000;

  constructor(thresholds: SquatThresholds) {
    this.thresholds = thresholds;
    this.startInactive = this.clock();
    this.startInactiveFront = this.clock();
  }

  resetCounters() {
    this.squatCount = 0;
    this.improperSquat = 0;
  }

  setThresholds(thresholds: SquatThresholds) {
    this.thresholds = thresholds;
  }

  getStats(): SquatStats {
    const feedback: string[] = [];
    if (this.lowerHips) feedback.push('LOWER YOUR HIPS');
    this.countFrames.forEach((count, idx) => {
      if (count > 0 && FEEDBACK_MAP[idx]) feedback.push(FEEDBACK_MAP[idx][0]);
    });
    return {
      correct: this.squatCount,
      incorrect: this.improperSquat,
      offsetAngle: null,
      cameraAligned: true,
      feedback,
      lowerHips: this.lowerHips,
    };
  }

  private getState(kneeAngle: number): string | null {
    const t = this.thresholds.HIP_KNEE_VERT;
    if (kneeAngle >= t.NORMAL[0] && kneeAngle <= t.NORMAL[1]) return 's1';
    if (kneeAngle >= t.TRANS[0] && kneeAngle <= t.TRANS[1]) return 's2';
    if (kneeAngle >= t.PASS[0] && kneeAngle <= t.PASS[1]) return 's3';
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
    drawRoundedLabel(ctx, `CORRECT: ${this.squatCount}`, Math.floor(w * 0.75), 30, {
      bgColor: SQUAT_COLORS.correctBg,
    });
    drawRoundedLabel(ctx, `INCORRECT: ${this.improperSquat}`, Math.floor(w * 0.75), 80, {
      bgColor: SQUAT_COLORS.incorrectBg,
    });
  }

  private showFeedback(ctx: CanvasRenderingContext2D) {
    if (this.lowerHips) {
      drawRoundedLabel(ctx, 'LOWER YOUR HIPS', 30, 80, {
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
  ): SquatStats {
    const dp = (p: Point): Point => (mirrorDisplay ? mirrorPointX(p, width) : p);
    const arcMult = (m: number) => (mirrorDisplay ? -m : m);

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
          this.squatCount = 0;
          this.improperSquat = 0;
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
          correct: this.squatCount,
          incorrect: this.improperSquat,
          offsetAngle,
          cameraAligned: false,
          feedback: ['CAMERA NOT ALIGNED PROPERLY!!!'],
          lowerHips: false,
        };
      }

      this.inactiveTimeFront = 0;
      this.startInactiveFront = this.clock();

      const distL = Math.abs(left.foot[1] - left.shoulder[1]);
      const distR = Math.abs(right.foot[1] - right.shoulder[1]);
      const side = distL > distR ? left : right;
      const multiplier = distL > distR ? -1 : 1;

      const hipVertical = findAngle(side.shoulder, [side.hip[0], 0], side.hip);
      const kneeVertical = findAngle(side.hip, [side.knee[0], 0], side.knee);
      const ankleVertical = findAngle(side.knee, [side.ankle[0], 0], side.ankle);

      const hip = dp(side.hip);
      const knee = dp(side.knee);
      const ankle = dp(side.ankle);

      drawAngleArc(ctx, hip, 30, hipVertical, arcMult(multiplier), SQUAT_COLORS.white);
      drawVerticalGuide(ctx, hip[0], hip[1], 80, SQUAT_COLORS.blue);
      drawAngleArc(ctx, knee, 20, kneeVertical, arcMult(-multiplier), SQUAT_COLORS.white);
      drawVerticalGuide(ctx, knee[0], knee[1], 50, SQUAT_COLORS.blue);
      drawAngleArc(ctx, ankle, 30, ankleVertical, arcMult(multiplier), SQUAT_COLORS.white);
      drawVerticalGuide(ctx, ankle[0], ankle[1], 50, SQUAT_COLORS.blue);

      drawLine(ctx, dp(side.shoulder), dp(side.elbow), SQUAT_COLORS.lightBlue);
      drawLine(ctx, dp(side.wrist), dp(side.elbow), SQUAT_COLORS.lightBlue);
      drawLine(ctx, dp(side.shoulder), dp(side.hip), SQUAT_COLORS.lightBlue);
      drawLine(ctx, dp(side.knee), dp(side.hip), SQUAT_COLORS.lightBlue);
      drawLine(ctx, dp(side.ankle), dp(side.knee), SQUAT_COLORS.lightBlue);
      drawLine(ctx, dp(side.ankle), dp(side.foot), SQUAT_COLORS.lightBlue);

      ([side.shoulder, side.elbow, side.wrist, side.hip, side.knee, side.ankle, side.foot] as Point[]).forEach(
        (p) => drawCircle(ctx, dp(p), 7, SQUAT_COLORS.yellow),
      );

      const currentState = this.getState(Math.floor(kneeVertical));
      this.currState = currentState;
      this.updateStateSequence(currentState);

      if (currentState === 's1') {
        if (this.stateSeq.length === 3 && !this.incorrectPosture) {
          this.squatCount += 1;
        } else if (this.stateSeq.includes('s2') && this.stateSeq.length === 1) {
          this.improperSquat += 1;
        } else if (this.incorrectPosture) {
          this.improperSquat += 1;
        }
        this.stateSeq = [];
        this.incorrectPosture = false;
      } else if (currentState) {
        if (hipVertical > this.thresholds.HIP_THRESH[1]) {
          this.displayText[0] = true;
        } else if (hipVertical < this.thresholds.HIP_THRESH[0] && this.stateSeq.filter((s) => s === 's2').length === 1) {
          this.displayText[1] = true;
        }

        if (
          kneeVertical > this.thresholds.KNEE_THRESH[0] &&
          kneeVertical < this.thresholds.KNEE_THRESH[1] &&
          this.stateSeq.filter((s) => s === 's2').length === 1
        ) {
          this.lowerHips = true;
        } else if (kneeVertical > this.thresholds.KNEE_THRESH[2]) {
          this.displayText[3] = true;
          this.incorrectPosture = true;
        }

        if (ankleVertical > this.thresholds.ANKLE_THRESH) {
          this.displayText[2] = true;
          this.incorrectPosture = true;
        }
      }

      let displayInactivity = false;
      if (this.currState === this.prevState) {
        const now = this.clock();
        this.inactiveTime += now - this.startInactive;
        this.startInactive = now;
        if (this.inactiveTime >= this.thresholds.INACTIVE_THRESH) {
          this.squatCount = 0;
          this.improperSquat = 0;
          displayInactivity = true;
        }
      } else {
        this.startInactive = this.clock();
        this.inactiveTime = 0;
      }

      if (this.stateSeq.includes('s3')) this.lowerHips = false;

      this.countFrames = this.countFrames.map((c, i) => (this.displayText[i] ? c + 1 : c));

      this.showFeedback(ctx);
      if (displayInactivity) {
        this.startInactive = this.clock();
        this.inactiveTime = 0;
      }

      ctx.font = '600 14px system-ui, sans-serif';
      ctx.fillStyle = SQUAT_COLORS.lightGreen;
      ctx.fillText(String(Math.floor(hipVertical)), hip[0] + 10, hip[1]);
      ctx.fillText(String(Math.floor(kneeVertical)), knee[0] + 15, knee[1] + 10);
      ctx.fillText(String(Math.floor(ankleVertical)), ankle[0] + 10, ankle[1]);

      this.drawCounters(ctx, width);

      this.displayText = this.displayText.map((v, i) => v && this.countFrames[i] <= this.thresholds.CNT_FRAME_THRESH);
      this.countFrames = this.countFrames.map((c) => (c > this.thresholds.CNT_FRAME_THRESH ? 0 : c));
      this.prevState = currentState;
    } else {
      const now = this.clock();
      this.inactiveTime += now - this.startInactive;
      let displayInactivity = false;
      if (this.inactiveTime >= this.thresholds.INACTIVE_THRESH) {
        this.squatCount = 0;
        this.improperSquat = 0;
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
      this.startInactiveFront = this.clock();
    }

    return this.getStats();
  }
}
