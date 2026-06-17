/** KPI-premium themes — aligned with FitnessScore / Calories / Workout KPI cards. */
export type CompeteKpiTheme = {
  accent: string;
  glow: string;
  border: string;
  wash: string;
  iconFrom: string;
  iconTo: string;
};

export const COMPETE_KPI_THEMES = {
  league: {
    accent: '#158b8d',
    glow: 'rgba(21, 139, 141, 0.35)',
    border: 'border-[#158b8d]/25 dark:border-[#158b8d]/35',
    wash: 'from-[#158b8d]/18 via-[#158b8d]/5 to-transparent',
    iconFrom: 'from-[#158b8d]/45',
    iconTo: 'to-[#158b8d]/10',
  },
  challenge: {
    accent: '#f37021',
    glow: 'rgba(243, 112, 33, 0.38)',
    border: 'border-[#f37021]/25 dark:border-[#f37021]/35',
    wash: 'from-[#f37021]/20 via-[#f37021]/6 to-transparent',
    iconFrom: 'from-[#f37021]/50',
    iconTo: 'to-[#f37021]/10',
  },
  duel: {
    accent: '#158b8d',
    glow: 'rgba(21, 139, 141, 0.35)',
    border: 'border-[#158b8d]/25 dark:border-[#158b8d]/35',
    wash: 'from-[#158b8d]/18 via-[#158b8d]/5 to-transparent',
    iconFrom: 'from-[#158b8d]/45',
    iconTo: 'to-[#158b8d]/10',
  },
  squad: {
    accent: '#7c3aed',
    glow: 'rgba(124, 58, 237, 0.35)',
    border: 'border-violet-500/25 dark:border-violet-400/35',
    wash: 'from-violet-500/20 via-violet-500/6 to-transparent',
    iconFrom: 'from-violet-500/45',
    iconTo: 'to-violet-500/10',
  },
} satisfies Record<string, CompeteKpiTheme>;

export type CompeteKpiThemeKey = keyof typeof COMPETE_KPI_THEMES;

export const TIER_TEXT: Record<string, string> = {
  bronze: 'text-amber-700 dark:text-amber-400',
  silver: 'text-slate-500 dark:text-slate-300',
  gold: 'text-yellow-600 dark:text-yellow-400',
  diamond: 'text-cyan-600 dark:text-cyan-400',
};

export const TIER_DOT: Record<string, string> = {
  bronze: 'bg-amber-500',
  silver: 'bg-slate-400',
  gold: 'bg-yellow-500',
  diamond: 'bg-cyan-400',
};

export const TIER_BADGE: Record<
  string,
  { shell: string; icon: string; label: string; ring: string; glow: string }
> = {
  bronze: {
    shell: 'bg-gradient-to-br from-amber-500/20 via-amber-400/10 to-orange-500/15',
    icon: 'text-amber-600 dark:text-amber-400',
    label: 'text-amber-900 dark:text-amber-200',
    ring: 'ring-amber-500/30',
    glow: 'shadow-[0_4px_14px_-4px_rgba(245,158,11,0.45)]',
  },
  silver: {
    shell: 'bg-gradient-to-br from-slate-400/20 via-slate-300/10 to-slate-500/15',
    icon: 'text-slate-600 dark:text-slate-300',
    label: 'text-slate-800 dark:text-slate-200',
    ring: 'ring-slate-400/35',
    glow: 'shadow-[0_4px_14px_-4px_rgba(148,163,184,0.4)]',
  },
  gold: {
    shell: 'bg-gradient-to-br from-yellow-500/25 via-amber-400/15 to-orange-400/10',
    icon: 'text-yellow-600 dark:text-yellow-400',
    label: 'text-yellow-900 dark:text-yellow-100',
    ring: 'ring-yellow-500/35',
    glow: 'shadow-[0_4px_14px_-4px_rgba(234,179,8,0.45)]',
  },
  diamond: {
    shell: 'bg-gradient-to-br from-cyan-500/20 via-sky-400/10 to-indigo-500/15',
    icon: 'text-cyan-600 dark:text-cyan-300',
    label: 'text-cyan-900 dark:text-cyan-100',
    ring: 'ring-cyan-400/35',
    glow: 'shadow-[0_4px_14px_-4px_rgba(34,211,238,0.4)]',
  },
};
