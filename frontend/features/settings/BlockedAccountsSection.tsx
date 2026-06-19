import React, { useCallback, useEffect, useState } from 'react';
import communityService from '../../services/communityService';
import { useI18n } from '../../lib/i18n/useI18n';
import { CommunityAuthorAvatar } from '../community/CommunityAuthorAvatar';
import { displayName } from '../community/communityUtils';
import type { CommunityBlockedUser } from '../../types';

export function BlockedAccountsSection() {
  const { t } = useI18n();
  const [blocked, setBlocked] = useState<CommunityBlockedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unblockingId, setUnblockingId] = useState<string | null>(null);

  const loadBlocked = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await communityService.getBlockedUsers();
    if (res.error) {
      setError(res.error);
      setBlocked([]);
    } else {
      setBlocked(res.data?.blocked ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadBlocked();
  }, [loadBlocked]);

  const handleUnblock = async (userId: string) => {
    setUnblockingId(userId);
    setError(null);
    const res = await communityService.unblockUser(userId);
    if (res.error) {
      setError(t('settings.blockedAccountsUnblockFailed'));
    } else {
      setBlocked((prev) => prev.filter((row) => row.userId !== userId));
    }
    setUnblockingId(null);
  };

  return (
    <div data-testid="settings-blocked-accounts">
      <p className="pb-2 text-sm text-muted">{t('settings.blockedAccountsDesc')}</p>
      {loading ? (
        <p className="py-3 text-sm text-muted animate-pulse">{t('settings.loading')}</p>
      ) : error && blocked.length === 0 ? (
        <div className="py-3">
          <p className="text-sm text-red-500">{error}</p>
          <button
            type="button"
            onClick={() => void loadBlocked()}
            className="mt-2 text-sm font-semibold text-primary hover:underline"
          >
            {t('settings.retry')}
          </button>
        </div>
      ) : blocked.length === 0 ? (
        <p className="py-3 text-sm text-muted">{t('settings.blockedAccountsEmpty')}</p>
      ) : (
        <ul className="divide-y divide-subtle">
          {blocked.map((row) => {
            const name = displayName(row.user);
            return (
              <li key={row.userId} className="flex items-center gap-3 py-3 first:pt-0">
                <CommunityAuthorAvatar
                  userId={row.userId}
                  author={row.user}
                  showStoryRing={false}
                  imageClassName="size-11 rounded-full object-cover shrink-0 ring-2 ring-primary/10"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-foreground">{name}</p>
                  {row.user.handle && <p className="truncate text-xs text-muted">{row.user.handle}</p>}
                </div>
                <button
                  type="button"
                  data-testid={`settings-unblock-${row.userId}`}
                  disabled={unblockingId === row.userId}
                  onClick={() => void handleUnblock(row.userId)}
                  className="shrink-0 rounded-xl border border-subtle bg-elevated px-3 py-1.5 text-sm font-semibold text-primary hover:bg-elevated-hover disabled:opacity-50"
                >
                  {t('community.unblock')}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {error && blocked.length > 0 && <p className="pt-2 text-sm text-red-500">{error}</p>}
    </div>
  );
}
