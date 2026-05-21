/** Shared visual tokens for the community feed (layout/behavior unchanged). */

/** Same surface tint as the stories bar — all feed boxes use this */
export const feedBoxBg = 'bg-surface/50 backdrop-blur-sm';

/** Visible depth on dark background (avoid large negative spread) */
export const feedBoxShadow =
  'shadow-[0_4px_28px_0px_rgba(0,0,0,0.48),0_2px_8px_0px_rgba(0,0,0,0.25)]';

export const feedBoxShadowHover =
  'hover:shadow-[0_8px_40px_0px_rgba(0,0,0,0.55),0_4px_12px_0px_rgba(0,0,0,0.3)]';

export const feedPanel = `rounded-2xl ${feedBoxBg} ${feedBoxShadow}`;

export const feedCard = `rounded-2xl overflow-hidden ${feedBoxBg} ${feedBoxShadow} transition-shadow duration-300 ${feedBoxShadowHover}`;

export const feedCardHeader = 'px-4 pt-4 pb-2';

export const feedBodyText = 'px-4 py-3 text-[15px] sm:text-base text-foreground/88 leading-[1.65] whitespace-pre-wrap';

export const feedActionBar =
  'px-3 sm:px-4 py-2.5 border-t border-white/[0.06] bg-black/5 flex items-center justify-between text-muted';

export const feedActionBtn =
  'flex items-center gap-1.5 px-2.5 py-2 rounded-xl text-sm font-medium text-muted hover:text-primary hover:bg-white/5 transition-colors';

export const feedIconBtn =
  'p-2 rounded-xl text-muted hover:text-primary hover:bg-white/5 transition-colors';

export const feedTabStrip = `flex items-center gap-1.5 p-1.5 rounded-2xl ${feedBoxBg} ${feedBoxShadow}`;

export const feedTabActive =
  'shrink-0 px-4 py-2 rounded-xl text-xs font-bold bg-primary/20 text-primary shadow-sm';

export const feedTabIdle =
  'shrink-0 px-4 py-2 rounded-xl text-xs font-bold text-muted hover:text-foreground hover:bg-white/5 transition-colors';

export const feedCommentsPanel = 'bg-black/10 overflow-hidden';

/** Composer input — same surface as post cards; subtle inset edge only */
export const feedComposerInput =
  'flex-1 min-h-[3.25rem] bg-transparent rounded-xl px-3 py-2.5 text-foreground/90 placeholder:text-faint resize-none ring-1 ring-inset ring-white/[0.06] focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm leading-relaxed disabled:opacity-50';
