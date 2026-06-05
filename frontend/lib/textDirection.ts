/** Arabic + related scripts */
const ARABIC_SCRIPT_RE = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;

/** Pick paragraph direction from content (for mixed AR/EN chat). */
export function textDirection(text: string): 'rtl' | 'ltr' {
  let ar = 0;
  let lat = 0;
  for (const ch of text) {
    if (ARABIC_SCRIPT_RE.test(ch)) ar += 1;
    else if (/[A-Za-z]/.test(ch)) lat += 1;
  }
  if (ar === 0 && lat === 0) return 'ltr';
  return ar >= lat ? 'rtl' : 'ltr';
}
