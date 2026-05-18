import apiClient, { ApiResponse } from './api';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export type UploadFolder = 'avatars' | 'products' | 'gyms' | 'posts';

interface SignResponse {
  mode?: 'supabase' | 'local';
  key: string;
  uploadUrl: string;
  token?: string;
  publicUrl: string;
  bucket?: string;
  contentType: string;
  localEndpoint?: string;
}

interface LocalUploadResponse {
  mode: 'local';
  key: string;
  publicUrl: string;
  contentType: string;
}

class UploadService {
  /** Upload image via Supabase signed URL, or local API fallback. */
  async uploadImage(file: File, folder: UploadFolder): Promise<{ url?: string; error?: string }> {
    if (!file.type.startsWith('image/')) {
      return { error: 'Only images are supported.' };
    }
    if (file.size > 5 * 1024 * 1024) {
      return { error: 'Files must be smaller than 5MB.' };
    }

    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace('jpeg', 'jpg');
    const sign: ApiResponse<SignResponse> = await apiClient.post<SignResponse>('/api/uploads/sign', {
      folder,
      contentType: file.type,
      ext,
    });

    if (sign.error || !sign.data) {
      const useLocal =
        sign.error?.toLowerCase().includes('not configured') ||
        sign.error?.toLowerCase().includes('local upload');
      if (useLocal) {
        return this.uploadLocal(file, folder);
      }
      return { error: sign.error || 'Failed to get upload URL' };
    }

    if (sign.data.mode === 'local') {
      return this.uploadLocal(file, folder);
    }

    try {
      const res = await fetch(sign.data.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      });
      if (!res.ok) {
        const text = await res.text();
        return { error: `Upload failed (${res.status}): ${text.slice(0, 120)}` };
      }
      return { url: sign.data.publicUrl };
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'Network error during upload' };
    }
  }

  /** Direct multipart upload to backend (dev / no Supabase). */
  async uploadLocal(file: File, folder: UploadFolder): Promise<{ url?: string; error?: string }> {
    const token = localStorage.getItem('taqwin_token');
    if (!token) {
      return { error: 'You must be signed in to upload images.' };
    }

    const form = new FormData();
    form.append('file', file);
    form.append('folder', folder);

    try {
      const res = await fetch(`${API_BASE_URL}/api/uploads/local`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const data = (await res.json()) as LocalUploadResponse & { error?: string };
      if (!res.ok) {
        return { error: data.error || `Upload failed (${res.status})` };
      }
      return { url: data.publicUrl };
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'Network error during upload' };
    }
  }
}

export const uploadService = new UploadService();
export default uploadService;
