import React, { useCallback, useEffect, useState } from 'react';
import apiClient from '../../services/api';
import { useSettingsStore } from '../../store/useSettingsStore';
import { useI18n } from '../../lib/i18n/useI18n';
import type { UserSettingsPatch } from '../../services/settingsService';
import { SettingRow, Toggle } from './SettingsPage';

interface TelegramStatus {
  linked: boolean;
  linkedAt: string | null;
  enabled: boolean;
  botUsername: string;
}

interface LinkResponse {
  deepLink: string;
  expiresAt: string;
  botUsername: string;
}

export function TelegramSettingsSection() {
  const { t } = useI18n();
  const { settings, saving, update } = useSettingsStore();
  const [status, setStatus] = useState<TelegramStatus | null>(null);
  const [linkLoading, setLinkLoading] = useState(false);
  const [linkUrl, setLinkUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    const res = await apiClient.get<TelegramStatus>('/api/settings/telegram/status');
    if (res.data) setStatus(res.data);
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus, settings?.telegramEnabled, settings?.telegramLinked]);

  const patch = async (data: UserSettingsPatch) => {
    setError(null);
    await update(data);
  };

  const startLink = async () => {
    setLinkLoading(true);
    setError(null);
    try {
      const res = await apiClient.post<LinkResponse>('/api/settings/telegram/link', {});
      if (res.error || !res.data?.deepLink) {
        setError(res.error || t('settings.telegramLinkError'));
        return;
      }
      setLinkUrl(res.data.deepLink);
      window.open(res.data.deepLink, '_blank', 'noopener,noreferrer');
      const poll = setInterval(() => void loadStatus(), 3000);
      setTimeout(() => clearInterval(poll), 120_000);
    } catch {
      setError(t('settings.telegramLinkError'));
    } finally {
      setLinkLoading(false);
    }
  };

  const unlink = async () => {
    setLinkLoading(true);
    setError(null);
    try {
      const res = await apiClient.delete<{ ok: boolean }>('/api/settings/telegram/unlink');
      if (res.error) {
        setError(res.error || t('settings.telegramUnlinkError'));
        return;
      }
      setLinkUrl(null);
      await loadStatus();
      await update({ telegramEnabled: false });
    } finally {
      setLinkLoading(false);
    }
  };

  if (!settings) return null;

  const linked = status?.linked ?? settings.telegramLinked ?? false;
  const botUsername = status?.botUsername || 'Taqwin_Ai_Fitness_bot';

  return (
    <>
      <SettingRow
        title={t('settings.telegramAlerts')}
        description={
          linked
            ? t('settings.telegramLinkedDesc', { bot: `@${botUsername}` })
            : t('settings.telegramAlertsDesc')
        }
      >
        <div className="flex flex-col items-end gap-2">
          {linked ? (
            <button
              type="button"
              disabled={linkLoading || saving}
              onClick={() => void unlink()}
              className="rounded-xl border border-subtle bg-elevated px-4 py-2 text-sm font-semibold text-primary hover:bg-elevated-hover disabled:opacity-50"
            >
              {t('settings.telegramUnlink')}
            </button>
          ) : (
            <button
              type="button"
              disabled={linkLoading || saving}
              onClick={() => void startLink()}
              className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {linkLoading ? t('settings.telegramLinking') : t('settings.telegramConnect')}
            </button>
          )}
        </div>
      </SettingRow>

      {linkUrl && !linked && (
        <p className="pb-3 text-sm text-muted">
          {t('settings.telegramOpenBot')}{' '}
          <a href={linkUrl} target="_blank" rel="noopener noreferrer" className="text-primary underline">
            @{botUsername}
          </a>
        </p>
      )}

      {error && <p className="pb-3 text-sm text-red-500">{error}</p>}

      {linked && (
        <>
          <SettingRow title={t('settings.telegramEnabled')} description={t('settings.telegramEnabledDesc')}>
            <Toggle
              checked={settings.telegramEnabled ?? false}
              disabled={saving}
              onChange={(v) => patch({ telegramEnabled: v })}
            />
          </SettingRow>
          <SettingRow title={t('settings.telegramSecurity')} description={t('settings.telegramSecurityDesc')}>
            <Toggle
              checked={settings.telegramSecurityAlerts ?? true}
              disabled={saving || !settings.telegramEnabled}
              onChange={(v) => patch({ telegramSecurityAlerts: v })}
            />
          </SettingRow>
          <SettingRow title={t('settings.telegramCoachAi')} description={t('settings.telegramCoachAiDesc')}>
            <Toggle
              checked={settings.telegramCoachAi ?? true}
              disabled={saving || !settings.telegramEnabled}
              onChange={(v) => patch({ telegramCoachAi: v })}
            />
          </SettingRow>
          <SettingRow
            title={t('settings.telegramFitness')}
            description={t('settings.telegramFitnessDesc')}
          >
            <Toggle
              checked={settings.telegramFitnessAchievements ?? true}
              disabled={saving || !settings.telegramEnabled}
              onChange={(v) => patch({ telegramFitnessAchievements: v })}
            />
          </SettingRow>
          <SettingRow title={t('settings.telegramOrders')} description={t('settings.telegramOrdersDesc')}>
            <Toggle
              checked={settings.telegramOrders ?? true}
              disabled={saving || !settings.telegramEnabled}
              onChange={(v) => patch({ telegramOrders: v })}
            />
          </SettingRow>
          <SettingRow
            title={t('settings.telegramCommunity')}
            description={t('settings.telegramCommunityDesc')}
          >
            <Toggle
              checked={settings.telegramCommunityMessages ?? true}
              disabled={saving || !settings.telegramEnabled}
              onChange={(v) => patch({ telegramCommunityMessages: v })}
            />
          </SettingRow>
          <SettingRow title={t('settings.telegramSocial')} description={t('settings.telegramSocialDesc')}>
            <Toggle
              checked={settings.telegramSocialActivity ?? false}
              disabled={saving || !settings.telegramEnabled}
              onChange={(v) => patch({ telegramSocialActivity: v })}
            />
          </SettingRow>
          <SettingRow title={t('settings.telegramComments')} description={t('settings.telegramCommentsDesc')}>
            <Toggle
              checked={settings.telegramCommunityComments ?? false}
              disabled={saving || !settings.telegramEnabled}
              onChange={(v) => patch({ telegramCommunityComments: v })}
            />
          </SettingRow>
          <SettingRow title={t('settings.telegramAiInsights')} description={t('settings.telegramAiInsightsDesc')}>
            <Toggle
              checked={settings.telegramAiInsights ?? true}
              disabled={saving || !settings.telegramEnabled}
              onChange={(v) => patch({ telegramAiInsights: v })}
            />
          </SettingRow>
          <SettingRow title={t('settings.telegramDailyDigest')} description={t('settings.telegramDailyDigestDesc')}>
            <Toggle
              checked={settings.telegramDailyDigest ?? false}
              disabled={saving || !settings.telegramEnabled}
              onChange={(v) => patch({ telegramDailyDigest: v })}
            />
          </SettingRow>
          {settings.telegramDailyDigest && (
            <SettingRow title={t('settings.telegramDigestHour')} description={t('settings.telegramDigestHourDesc')}>
              <input
                type="time"
                className="ui-select rounded-xl border px-4 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/40"
                value={settings.telegramDailyDigestHour ?? '08:00'}
                disabled={saving || !settings.telegramEnabled}
                onChange={(e) => patch({ telegramDailyDigestHour: e.target.value })}
              />
            </SettingRow>
          )}
          <SettingRow title={t('settings.telegramWeekly')} description={t('settings.telegramWeeklyDesc')}>
            <Toggle
              checked={settings.telegramWeeklySummary ?? true}
              disabled={saving || !settings.telegramEnabled}
              onChange={(v) => patch({ telegramWeeklySummary: v })}
            />
          </SettingRow>
        </>
      )}
    </>
  );
}
