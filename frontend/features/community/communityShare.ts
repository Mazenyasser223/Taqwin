import type { CommunityPost } from '../../types';
import { displayName } from './communityUtils';

export async function shareCommunityPost(
  post: CommunityPost,
  onCopied: () => void,
  onError?: (message: string) => void
): Promise<void> {
  const base = window.location.origin + (window.location.pathname || '/').replace(/\/$/, '') || window.location.origin;
  const url = `${base}#/community`;
  const text = `${displayName(post.author)}: ${post.content.slice(0, 120)}`.trim();
  const payload = text ? `${text}\n${url}` : url;

  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({ title: 'Taqwin Community', text: text || 'Check out this post', url });
      return;
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
    }
  }

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(payload);
      onCopied();
      return;
    }
  } catch {
    /* fall through */
  }

  try {
    const ta = document.createElement('textarea');
    ta.value = payload;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    if (ok) {
      onCopied();
      return;
    }
  } catch {
    /* fall through */
  }

  onError?.('Could not copy link. Copy manually: ' + url);
}
