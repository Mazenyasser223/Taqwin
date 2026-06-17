import type { TranslationKey } from '../../lib/i18n/translations';
import type { ChallengeParticipation } from '../../services/gamificationService';
import { COMPETE_KPI_THEMES } from './competeDashboardStyles';

export function challengeKey(slug: string, field: 'title' | 'desc'): TranslationKey {
  return `compete.challenge.${slug}.${field}` as TranslationKey;
}

export const CHALLENGE_STATUS_KEYS = {
  active: 'compete.status.active',
  completed: 'compete.status.completed',
  failed: 'compete.status.failed',
  abandoned: 'compete.status.abandoned',
} as const satisfies Record<ChallengeParticipation['status'], TranslationKey>;

export const CHALLENGE_STATUS_STYLES: Record<
  ChallengeParticipation['status'],
  { shell: string; dot: string }
> = {
  active: {
    shell: 'bg-[#f37021]/15 text-[#f37021] ring-[#f37021]/30',
    dot: 'bg-[#f37021]',
  },
  completed: {
    shell: 'bg-emerald-500/15 text-emerald-700 ring-emerald-500/30 dark:text-emerald-300',
    dot: 'bg-emerald-500',
  },
  failed: {
    shell: 'bg-red-500/10 text-red-600 ring-red-500/25 dark:text-red-400',
    dot: 'bg-red-500',
  },
  abandoned: {
    shell: 'bg-gray-500/10 text-gray-600 ring-gray-500/20 dark:text-gray-400',
    dot: 'bg-gray-400',
  },
};

export const CHALLENGE_THEME = COMPETE_KPI_THEMES.challenge;
