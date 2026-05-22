import React from 'react';
import { useI18n } from '../../lib/i18n/useI18n';
import { feedIconBtn } from './communityFeedStyles';

interface CommunityRefreshButtonProps {
  onRefresh: () => void | Promise<void>;
  refreshing?: boolean;
  disabled?: boolean;
  titleKey?: 'community.refreshFeed';
}

export const CommunityRefreshButton: React.FC<CommunityRefreshButtonProps> = ({
  onRefresh,
  refreshing = false,
  disabled = false,
  titleKey = 'community.refreshFeed',
}) => {
  const { t } = useI18n();
  return (
    <button
      type="button"
      onClick={() => void onRefresh()}
      disabled={disabled || refreshing}
      title={t(titleKey)}
      aria-label={t(titleKey)}
      className={`${feedIconBtn} shrink-0 disabled:opacity-40`}
    >
      <span className={`material-symbols-outlined text-lg ${refreshing ? 'animate-spin' : ''}`}>refresh</span>
    </button>
  );
};
