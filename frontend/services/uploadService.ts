import apiClient, { ApiResponse } from './api';

import { getApiBaseUrl } from '../lib/apiBaseUrl';
import { getAuthToken } from '../lib/authStorage';

const API_BASE_URL = getApiBaseUrl();

export type UploadFolder = 'avatars' | 'products' | 'gyms' | 'posts' | 'support';

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
  /** Upload image via Supabase signed URL, or local API fallback when Storage is not configured. */
  async uploadImage(file: File, folder: UploadFolder): Promise<{ url?: string; error?: string }> {
    if (!file.type.startsWith('image/')) {
      return { error: 'Only images are supported.' };
    }
    if (file.size > 5 * 1024 * 1024) {
      return { error: 'Files must be smaller than 5MB.' };
    }

    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
    const sign: ApiResponse<SignResponse> = await apiClient.post<SignResponse>('/api/uploads/sign', {
      folder,
      contentType: file.type,
      ext,
    });

    if (sign.error) {
      return { error: sign.error };
    }

    if (sign.data?.mode === 'local' || !sign.data?.uploadUrl) {
      return this.uploadImageLocal(file, folder);
    }

    try {
      const headers: Record<string, string> = { 'Content-Type': file.type };
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
        const local = await this.uploadImageLocal(file, folder);
        if (local.url) return local;
        return { error: `Upload failed (${res.status}): ${text.slice(0, 120)}` };
      }
      return { url: sign.data.publicUrl };
    } catch (err) {
      const local = await this.uploadImageLocal(file, folder);
      if (local.url) return local;
      return { error: err instanceof Error ? err.message : 'Network error during upload' };
    }
  }

  private async uploadImageLocal(
    file: File,
    folder: UploadFolder,
  ): Promise<{ url?: string; error?: string }> {
    try {
      const token = getAuthToken();
      const form = new FormData();
      form.append('file', file);
      form.append('folder', folder);

      const res = await fetch(`${API_BASE_URL}/api/uploads/local`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
      });

      const data = await res.json();
      if (!res.ok) {
        return { error: data.error || data.message || 'Local upload failed' };
      }
      return { url: data.publicUrl as string };
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'Local upload failed' };
    }
  }
}

export const uploadService = new UploadService();
export default uploadService;
