import apiClient, { ApiResponse } from './api';

export type UploadFolder = 'avatars' | 'products' | 'gyms' | 'posts';

interface SignResponse {
  key: string;
  uploadUrl: string;
  token: string;
  publicUrl: string;
  bucket: string;
  contentType: string;
}

class UploadService {
  /** Upload a File to the configured Supabase Storage bucket and return the public URL. */
  async uploadImage(file: File, folder: UploadFolder): Promise<{ url?: string; error?: string }> {
    if (!file.type.startsWith('image/')) {
      return { error: 'Only images are supported.' };
    }
    if (file.size > 5 * 1024 * 1024) {
      return { error: 'Files must be smaller than 5MB.' };
    }
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
    const sign: ApiResponse<SignResponse> = await apiClient.post<SignResponse>('/api/uploads/sign', {
      folder,
      contentType: file.type,
      ext,
    });
    if (sign.error || !sign.data) {
      return { error: sign.error || 'Failed to get signed URL' };
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
}

export const uploadService = new UploadService();
export default uploadService;
