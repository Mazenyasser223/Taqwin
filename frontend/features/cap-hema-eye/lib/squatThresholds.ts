export type SquatLevel = 'beginner' | 'pro';

export interface SquatThresholds {
  HIP_KNEE_VERT: {
    NORMAL: [number, number];
    TRANS: [number, number];
    PASS: [number, number];
  };
  HIP_THRESH: [number, number];
  ANKLE_THRESH: number;
  KNEE_THRESH: [number, number, number];
  OFFSET_THRESH: number;
  INACTIVE_THRESH: number;
  CNT_FRAME_THRESH: number;
}

export function getSquatThresholds(level: SquatLevel): SquatThresholds {
  const HIP_KNEE_VERT =
    level === 'pro'
      ? { NORMAL: [0, 30] as [number, number], TRANS: [35, 65] as [number, number], PASS: [80, 95] as [number, number] }
      : { NORMAL: [0, 30] as [number, number], TRANS: [35, 65] as [number, number], PASS: [70, 95] as [number, number] };

  if (level === 'pro') {
    return {
      HIP_KNEE_VERT,
      HIP_THRESH: [15, 50],
      ANKLE_THRESH: 30,
      KNEE_THRESH: [50, 80, 95],
      OFFSET_THRESH: 50,
      INACTIVE_THRESH: 15,
      CNT_FRAME_THRESH: 50,
    };
  }

  return {
    HIP_KNEE_VERT,
    HIP_THRESH: [10, 60],
    ANKLE_THRESH: 45,
    KNEE_THRESH: [50, 70, 95],
    OFFSET_THRESH: 50,
    INACTIVE_THRESH: 15,
    CNT_FRAME_THRESH: 50,
  };
}
