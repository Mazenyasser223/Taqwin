import apiClient, { ApiResponse } from './api';

import { getApiBaseUrl } from '../lib/apiBaseUrl';
import { getAuthToken } from '../lib/authStorage';
import { isVideoMediaFile } from '../lib/mediaFile';

function apiBaseUrl(): string {
  return getApiBaseUrl();
}

export type UploadFolder = 'avatars' | 'products' | 'gyms' | 'posts' | 'covers' | 'support' | 'messages' | 'stories' | 'progress';

export type UploadProgressCallback = (percent: number, phase?: 'upload' | 'processing') => void;

interface SignResponse {
  mode?: 'supabase' | 'local';
  key?: string;
  uploadUrl?: string;
  token?: string;
  publicUrl?: string;
  bucket?: string;
  contentType?: string;
  message?: string;
}

/** Video upload: bytes → 0–45%, server transcode wait → gradual 45–95%, done → 100%. */
function xhrVideoUpload(
  url: string,
  form: FormData,
  headers: Record<string, string>,
  onProgress?: UploadProgressCallback,
): Promise<{ ok: boolean; status: number; text: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    let processingTimer: ReturnType<typeof setInterval> | null = null;
    let processingPct = 45;
    let bytesSent = false;

    const stopProcessing = () => {
      if (processingTimer) {
        clearInterval(processingTimer);
        processingTimer = null;
      }
    };

    const startProcessing = () => {
      if (bytesSent) return;
      bytesSent = true;
      onProgress?.(45, 'processing');
      processingTimer = setInterval(() => {
        if (processingPct < 95) {
          processingPct = Math.min(95, processingPct + 1);
          onProgress?.(processingPct, 'processing');
        }
      }, 400);
    };

    xhr.upload.addEventListener('progress', (e) => {
      if (!e.lengthComputable || !onProgress) return;
      const uploadPct = Math.round((e.loaded / e.total) * 45);
      onProgress(uploadPct, 'upload');
      if (e.loaded >= e.total) startProcessing();
    });

    xhr.addEventListener('load', () => {
      stopProcessing();
      onProgress?.(100, 'upload');
      resolve({ ok: xhr.status >= 200 && xhr.status < 300, status: xhr.status, text: xhr.responseText });
    });
    xhr.addEventListener('error', () => {
      stopProcessing();
      reject(new Error('Failed to fetch'));
    });
    xhr.addEventListener('abort', () => {
      stopProcessing();
      reject(new Error('Upload aborted'));
    });
    xhr.open('POST', url);
    for (const [k, v] of Object.entries(headers)) {
      xhr.setRequestHeader(k, v);
    }
    xhr.send(form);
  });
}

function xhrUpload(
  method: string,
  url: string,
  body: FormData | File,
  headers: Record<string, string>,
  onProgress?: UploadProgressCallback,
): Promise<{ ok: boolean; status: number; text: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    });
    xhr.addEventListener('load', () => {
      resolve({ ok: xhr.status >= 200 && xhr.status < 300, status: xhr.status, text: xhr.responseText });
    });
    xhr.addEventListener('error', () => reject(new Error('Failed to fetch')));
    xhr.addEventListener('abort', () => reject(new Error('Upload aborted')));
    xhr.open(method, url);
    for (const [k, v] of Object.entries(headers)) {
      xhr.setRequestHeader(k, v);
    }
    xhr.send(body);
  });
}

class UploadService {
  async uploadImage(
    file: File,
    folder: UploadFolder,
    onProgress?: UploadProgressCallback,
  ): Promise<{ url?: string; error?: string }> {
    return this.uploadFile(file, folder, onProgress);
  }

  async uploadFile(
    file: File,
    folder: UploadFolder,
    onProgress?: UploadProgressCallback,
  ): Promise<{ url?: string; error?: string }> {
    const isImage = file.type.startsWith('image/');
    const isVideo = isVideoMediaFile(file);
    const isAudio = file.type.startsWith('audio/');

    if (isVideo && (folder === 'posts' || folder === 'stories' || folder === 'gyms')) {
      return this.uploadVideoNormalized(file, folder, onProgress);
    }

    if (folder === 'messages' && isAudio) {
      const maxAudio = 10 * 1024 * 1024;
      if (file.size > maxAudio) {
        return { error: 'Voice message must be smaller than 10MB.' };
      }
      if (file.size < 1) {
        return { error: 'Recording is empty. Try again.' };
      }
    } else if (!isImage && !isVideo) {
      return { error: 'Only images and videos are supported.' };
    } else {
      if (isVideo && folder !== 'posts' && folder !== 'stories' && folder !== 'gyms') {
        return { error: 'Videos can only be uploaded to posts, stories, or gyms.' };
      }
      if (isVideo && folder === 'messages') {
        return { error: 'Use voice record for audio messages.' };
      }
      const maxSize = isVideo ? 50 * 1024 * 1024 : 5 * 1024 * 1024;
      if (file.size > maxSize) {
        return { error: isVideo ? 'Video must be smaller than 50MB.' : 'Image must be smaller than 5MB.' };
      }
    }

    onProgress?.(0);

    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
    const sign: ApiResponse<SignResponse> = await apiClient.post<SignResponse>('/api/uploads/sign', {
      folder,
      contentType: file.type || 'image/jpeg',
      ext,
    });

    if (!sign.error && sign.data?.mode === 'supabase' && sign.data.uploadUrl && sign.data.publicUrl) {
      try {
        const headers: Record<string, string> = { 'Content-Type': file.type || 'image/jpeg' };
        if (sign.data.token) {
          headers['x-upsert'] = 'true';
        }
        const res = await xhrUpload('PUT', sign.data.uploadUrl, file, headers, onProgress);
        if (res.ok) {
          onProgress?.(100);
          return { url: sign.data.publicUrl };
        }
      } catch {
        /* fall through to local */
      }
    }

    const local = await this.uploadFileLocal(file, folder, onProgress);
    if (local.url) {
      onProgress?.(100);
      return local;
    }

    if (sign.error) {
      return { error: sign.error || local.error || 'Upload failed' };
    }

    return { error: local.error || sign.error || 'Upload failed' };
  }

  /** Upload + server-side transcode to MP4 (H.264) for universal browser playback. */
  private async uploadVideoNormalized(
    file: File,
    folder: UploadFolder,
    onProgress?: UploadProgressCallback,
  ): Promise<{ url?: string; error?: string }> {
    const maxSize = 50 * 1024 * 1024;
    if (file.size > maxSize) {
      return { error: 'Video must be smaller than 50MB.' };
    }
    if (file.size < 1) {
      return { error: 'Video file is empty.' };
    }

    onProgress?.(0);

    try {
      const token = getAuthToken();
      if (!token) {
        return { error: 'Please sign in to upload.' };
      }

      const form = new FormData();
      form.append('folder', folder);
      form.append('file', file);

      const res = await xhrVideoUpload(
        `${apiBaseUrl()}/api/uploads/video?folder=${encodeURIComponent(folder)}`,
        form,
        { Authorization: `Bearer ${token}` },
        onProgress,
      );

      let data: { error?: string; message?: string; publicUrl?: string } = {};
      try {
        data = JSON.parse(res.text);
      } catch {
        /* non-JSON */
      }

      if (!res.ok) {
        return {
          error:
            data.error ||
            data.message ||
            (res.status === 404
              ? 'Video upload endpoint not found. Is the backend running?'
              : `Video upload failed (${res.status})`),
        };
      }

      onProgress?.(100, 'upload');
      return { url: data.publicUrl as string };
    } catch (err) {
      return {
        error:
          err instanceof Error && err.message === 'Failed to fetch'
            ? 'Cannot reach server. Check that the backend is running on port 4000.'
            : err instanceof Error
              ? err.message
              : 'Video upload failed',
      };
    }
  }

  private async uploadFileLocal(
    file: File,
    folder: UploadFolder,
    onProgress?: UploadProgressCallback,
  ): Promise<{ url?: string; error?: string }> {
    try {
      const token = getAuthToken();
      if (!token) {
        return { error: 'Please sign in to upload.' };
      }
      const form = new FormData();
      form.append('folder', folder);
      form.append('file', file);

      const res = await xhrUpload(
        'POST',
        `${apiBaseUrl()}/api/uploads/local?folder=${encodeURIComponent(folder)}`,
        form,
        { Authorization: `Bearer ${token}` },
        onProgress,
      );

      let data: { error?: string; message?: string; publicUrl?: string } = {};
      try {
        data = JSON.parse(res.text);
      } catch {
        /* non-JSON */
      }
      if (!res.ok) {
        return {
          error:
            data.error ||
            data.message ||
            (res.status === 404 ? 'Upload endpoint not found. Is the backend running?' : `Upload failed (${res.status})`),
        };
      }
      return { url: data.publicUrl as string };
    } catch (err) {
      return {
        error:
          err instanceof Error && err.message === 'Failed to fetch'
            ? 'Cannot reach server. Check that the backend is running on port 4000.'
            : err instanceof Error
              ? err.message
              : 'Local upload failed',
      };
    }
  }
}

export const uploadService = new UploadService();
export default uploadService;
