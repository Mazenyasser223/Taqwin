export type PushupLevel = 'beginner' | 'pro';

export interface PushupThresholds {
  ELBOW_ANGLE: {
    EXTENDED: [number, number];
    TRANS: [number, number];
    LOWERED: [number, number];
  };
  BODY_STRAIGHT_MIN: number;
  HIP_SAG_OFFSET: number;
  HIP_PIKE_OFFSET: number;
  ELBOW_DEPTH: [number, number];
  OFFSET_THRESH: number;
  INACTIVE_THRESH: number;
  CNT_FRAME_THRESH: number;
  BAD_POSTURE_THRESH: number;
  ANGLE_SMOOTH_ALPHA: number;
}

export function getPushupThresholds(level: PushupLevel): PushupThresholds {
  if (level === 'pro') {
    return {
      ELBOW_ANGLE: {
        EXTENDED: [155, 180],
        TRANS: [95, 155],
        LOWERED: [65, 95],
      },
      BODY_STRAIGHT_MIN: 165,
      HIP_SAG_OFFSET: 35,
      HIP_PIKE_OFFSET: 35,
      ELBOW_DEPTH: [95, 110],
      OFFSET_THRESH: 50,
      INACTIVE_THRESH: 15,
      CNT_FRAME_THRESH: 50,
      BAD_POSTURE_THRESH: 8,
      ANGLE_SMOOTH_ALPHA: 0.4,
    };
  }

  return {
    ELBOW_ANGLE: {
      EXTENDED: [145, 180],
      TRANS: [85, 145],
      LOWERED: [55, 85],
    },
    BODY_STRAIGHT_MIN: 155,
    HIP_SAG_OFFSET: 45,
    HIP_PIKE_OFFSET: 45,
    ELBOW_DEPTH: [85, 100],
    OFFSET_THRESH: 50,
    INACTIVE_THRESH: 15,
    CNT_FRAME_THRESH: 50,
    BAD_POSTURE_THRESH: 8,
    ANGLE_SMOOTH_ALPHA: 0.4,
  };
}
