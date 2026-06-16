const MAX_EDGE_PX = 1800;
const JPEG_QUALITY = 0.82;
const SKIP_BELOW_BYTES = 350_000;

/** Resize/compress large photos before upload — faster transfer and Claude vision. */
export async function prepareInbodyUpload(file: File): Promise<File> {
  if (file.type === 'application/pdf' || !file.type.startsWith('image/')) {
    return file;
  }
  if (file.size <= SKIP_BELOW_BYTES) {
    return file;
  }

  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await createImageBitmap(file);
    const longest = Math.max(bitmap.width, bitmap.height);
    const scale = Math.min(1, MAX_EDGE_PX / longest);

    if (scale >= 1 && file.size <= 1_200_000) {
      return file;
    }

    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;

    ctx.drawImage(bitmap, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY);
    });
    if (!blob || blob.size >= file.size) return file;

    const base = file.name.replace(/\.[^.]+$/, '') || 'inbody';
    return new File([blob], `${base}.jpg`, { type: 'image/jpeg', lastModified: file.lastModified });
  } catch {
    return file;
  } finally {
    bitmap?.close();
  }
}
