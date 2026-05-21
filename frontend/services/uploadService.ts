import apiClient, { ApiResponse } from './api';

import { getApiBaseUrl } from '../lib/apiBaseUrl';
import { getAuthToken } from '../lib/authStorage';

const API_BASE_URL = getApiBaseUrl();

export type UploadFolder = 'avatars' | 'products' | 'gyms' | 'posts' | 'covers' | 'support' | 'messages' | 'stories';

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

class UploadService {
  async uploadImage(file: File, folder: UploadFolder): Promise<{ url?: string; error?: string }> {
    return this.uploadFile(file, folder);
  }

  async uploadFile(file: File, folder: UploadFolder): Promise<{ url?: string; error?: string }> {
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

    const local = await this.uploadFileLocal(file, folder);
    if (local.url) return local;

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
      const res = await fetch(sign.data.uploadUrl, {
        method: 'PUT',
        headers,
        body: file,
      });
      if (!res.ok) {
        const text = await res.text();
        if (local.url) return local;
        return { error: local.error || `Upload failed (${res.status}): ${text.slice(0, 120)}` };
      }
      return { url: sign.data.publicUrl };
    } catch (err) {
      if (local.url) return local;
      return { error: local.error || (err instanceof Error ? err.message : 'Network error during upload') };
    }
  }

  private async uploadFileLocal(
    file: File,
    folder: UploadFolder,
  ): Promise<{ url?: string; error?: string }> {
    try {
      const token = getAuthToken();
      if (!token) {
        return { error: 'Please sign in to upload.' };
      }
      const form = new FormData();
      form.append('folder', folder);
      form.append('file', file);

      const res = await fetch(`${API_BASE_URL}/api/uploads/local?folder=${encodeURIComponent(folder)}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });

      let data: { error?: string; message?: string; publicUrl?: string } = {};
      try {
        data = await res.json();
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
