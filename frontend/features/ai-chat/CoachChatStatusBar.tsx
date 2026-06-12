import React from 'react';

import { useI18n } from '../../lib/i18n/useI18n';
import type { RealtimeConnectionState } from '../../lib/realtime/useRealtimeStore';

import { coachPhaseI18nKey } from './coachPhaseLabels';

export interface CoachChatStatusBarProps {
  connectionState: RealtimeConnectionState;
  streamPhase: string | null;
  isSending: boolean;
  compact?: boolean;
}

export function CoachChatStatusBar({
  connectionState,
  streamPhase,
  isSending,
  compact = false,
}: CoachChatStatusBarProps) {
  const { t } = useI18n();

  const isOnline = connectionState === 'open';
  const isConnecting = connectionState === 'connecting';
  const phaseKey =
    isSending && streamPhase && streamPhase !== 'saving'
      ? coachPhaseI18nKey(streamPhase)
      : null;
  const phaseLabel = phaseKey ? t(phaseKey) : null;

  const connectionLabel = isOnline
    ? t('ai.connection.live')
    : isConnecting
      ? t('ai.connection.connecting')
      : t('ai.connection.offline');

  const dotClass = isOnline
    ? 'bg-teal-400 animate-pulse'
    : isConnecting
      ? 'bg-amber-400 animate-pulse'
      : 'bg-red-400';

  return (
    <div
      className={`flex items-center justify-between gap-2 ${compact ? 'text-[9px]' : 'text-[10px] sm:text-xs'} font-bold uppercase tracking-widest text-faint`}
    >
      <div className="flex items-center gap-1.5 min-w-0">
        <span className={`size-1.5 rounded-full shrink-0 ${dotClass}`} aria-hidden />
        <span className="truncate">{connectionLabel}</span>
      </div>
      {phaseLabel ? (
        <span className="truncate text-primary/80 normal-case tracking-normal font-medium shrink max-w-[55%]">
          {phaseLabel}
        </span>
      ) : null}
    </div>
  );
}
