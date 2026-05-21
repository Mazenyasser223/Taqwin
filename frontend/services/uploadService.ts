import apiClient, { ApiResponse } from './api';

import { getApiBaseUrl } from '../lib/apiBaseUrl';
import { getAuthToken } from '../lib/authStorage';

const API_BASE_URL = getApiBaseUrl();

export type UploadFolder = 'avatars' | 'products' | 'gyms' | 'posts' | 'covers' | 'support' | 'messages' | 'stories';

export type UploadProgressCallback = (percent: number) => void;

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
    const isVideo = file.type.startsWith('video/');
    if (!isImage && !isVideo) {
      return { error: 'Only images and videos are supported.' };
    }
    if (isVideo && folder !== 'posts' && folder !== 'stories') {
      return { error: 'Videos can only be uploaded to posts or stories.' };
    }
    if (isVideo && folder === 'messages') {
      return { error: 'Use voice record for audio messages.' };
    }
    const maxSize = isVideo ? 50 * 1024 * 1024 : 5 * 1024 * 1024;
    if (file.size > maxSize) {
      return { error: isVideo ? 'Video must be smaller than 50MB.' : 'Image must be smaller than 5MB.' };
    }

    onProgress?.(0);

    const local = await this.uploadFileLocal(file, folder, onProgress);
    if (local.url) {
      onProgress?.(100);
      return local;
    }

    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
    const sign: ApiResponse<SignResponse> = await apiClient.post<SignResponse>('/api/uploads/sign', {
      folder,
      contentType: file.type || 'image/jpeg',
      ext,
    });

    if (sign.error) {
      return { error: sign.error || local.error || 'Upload failed' };
    }

    if (sign.data?.mode === 'local' || !sign.data?.uploadUrl) {
      return { error: local.error || sign.error || 'Upload failed' };
    }

    try {
      const headers: Record<string, string> = { 'Content-Type': file.type || 'image/jpeg' };
      if (sign.data.token) {
        headers['x-upsert'] = 'true';
      }
      const res = await xhrUpload('PUT', sign.data.uploadUrl, file, headers, onProgress);
      if (!res.ok) {
        if (local.url) return local;
        return { error: local.error || `Upload failed (${res.status}): ${res.text.slice(0, 120)}` };
      }
      onProgress?.(100);
      return { url: sign.data.publicUrl };
    } catch (err) {
      if (local.url) return local;
      return { error: local.error || (err instanceof Error ? err.message : 'Network error during upload') };
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
        `${API_BASE_URL}/api/uploads/local?folder=${encodeURIComponent(folder)}`,
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
