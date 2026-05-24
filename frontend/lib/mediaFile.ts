export function isVideoMediaFile(file: File): boolean {
  if (file.type.startsWith('video/')) return true;
  return /\.(mp4|webm|mov|m4v|avi|mkv|3gp)$/i.test(file.name);
}
