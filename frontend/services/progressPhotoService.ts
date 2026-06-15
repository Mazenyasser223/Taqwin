import { getApiBaseUrl } from '../lib/apiBaseUrl';
import { getAuthToken } from '../lib/authStorage';
import { ApiResponse } from './api';

export type ProgressPhotoPose = 'front' | 'side' | 'back';

export interface ProgressPhotoAnalysis {
  postureNotes?: string | null;
  visibleBodyRegions?: string[];
  waistVisible?: boolean | null;
  chestVisible?: boolean | null;
  shouldersVisible?: boolean | null;
  lightingQuality?: 'good' | 'fair' | 'poor' | null;
  framingQuality?: 'good' | 'fair' | 'poor' | null;
  coachingNotes?: string | null;
}

export interface ProgressPhotoRecord {
  id: string;
  photoUrl: string;
  pose: ProgressPhotoPose;
  analysis: ProgressPhotoAnalysis | null;
  takenAt: string;
}

export interface AnalyzeProgressPhotoResult {
  progressPhoto: ProgressPhotoRecord;
  validation: {
    isBodyPhoto: boolean;
    detectedPose: ProgressPhotoPose | 'unknown';
    poseMatchesExpected: boolean;
    confidence: number;
  };
}

class ProgressPhotoService {
  async analyzeAndSave(
    file: File,
    pose: ProgressPhotoPose,
  ): Promise<ApiResponse<AnalyzeProgressPhotoResult>> {
    const token = getAuthToken();
    const form = new FormData();
    form.append('file', file);
    form.append('pose', pose);

    try {
      const res = await fetch(`${getApiBaseUrl()}/api/progress-photos/analyze`, {
        method: 'POST',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: form,
      });

      let payload: unknown = null;
      try {
        payload = await res.json();
      } catch {
        /* non-JSON */
      }

      const data =
        payload !== null && typeof payload === 'object' && !Array.isArray(payload)
          ? (payload as Record<string, unknown>)
          : {};

      if (!res.ok) {
        return {
          error:
            (typeof data.error === 'string' && data.error) ||
            `Photo validation failed (${res.status})`,
          code: typeof data.code === 'string' ? data.code : undefined,
        };
      }

      return { data: data as AnalyzeProgressPhotoResult };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Network error';
      return { error: msg };
    }
  }
}

const progressPhotoService = new ProgressPhotoService();
export default progressPhotoService;
