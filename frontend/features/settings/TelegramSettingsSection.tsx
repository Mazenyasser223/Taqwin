import React, { useCallback, useEffect, useState } from 'react';
import apiClient from '../../services/api';
import { useSettingsStore } from '../../store/useSettingsStore';
import { useI18n } from '../../lib/i18n/useI18n';
import type { UserSettingsPatch } from '../../services/settingsService';
import { Toggle } from './SettingsPage';

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

type PreviewKey =
  | 'security'
  | 'coach'
  | 'fitness'
  | 'orders'
  | 'messages'
  | 'groupInvites'
  | 'followRequests'
  | 'follows'
  | 'comments'
  | 'mentions'
  | 'aiInsights'
  | 'dailyDigest'
  | 'weekly';

const selectClass =
  'ui-select rounded-xl border px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/40';

function AlertToggleRow({
  icon,
  title,
  description,
  checked,
  disabled,
  onChange,
  onPreview,
  previewLabel,
  'data-testid': testId,
}: {
  icon: string;
  title: string;
  description?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
  onPreview?: () => void;
  previewLabel: string;
  'data-testid'?: string;
}) {
  return (
    <div
      data-testid={testId}
      className="flex items-start justify-between gap-3 border-b border-subtle py-3 last:border-0"
    >
      <div className="min-w-0 flex-1">
        <p className="font-medium text-foreground">
          <span className="me-2" aria-hidden>
            {icon}
          </span>
          {title}
        </p>
        {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
        {onPreview && (
          <button
            type="button"
            onClick={onPreview}
            className="mt-2 text-xs font-semibold text-primary hover:underline"
          >
            {previewLabel}
          </button>
        )}
      </div>
      <Toggle checked={checked} disabled={disabled} onChange={onChange} />
    </div>
  );
}

export function TelegramSettingsSection() {
  const { t } = useI18n();
  const { settings, saving, update, load: reloadSettings } = useSettingsStore();
  const [status, setStatus] = useState<TelegramStatus | null>(null);
  const [expanded, setExpanded] = useState(true);
  const [linkLoading, setLinkLoading] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  const [linkUrl, setLinkUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [previewKey, setPreviewKey] = useState<PreviewKey | null>(null);

  const loadStatus = useCallback(async () => {
    const res = await apiClient.get<TelegramStatus>('/api/settings/telegram/status');
    if (res.data) {
      setStatus(res.data);
      if (res.data.linked) {
        setLinkUrl(null);
        await reloadSettings();
      }
    }
  }, [reloadSettings]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus, settings?.telegramEnabled, settings?.telegramLinked]);

  useEffect(() => {
    const onFocus = () => void loadStatus();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [loadStatus]);

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

  const sendTest = async () => {
    setTestLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await apiClient.post<{ ok: boolean }>('/api/settings/telegram/test', {});
      if (res.error) {
        setError(res.error);
        return;
      }
      setSuccess(t('settings.telegramTestSent'));
    } finally {
      setTestLoading(false);
    }
  };

  if (!settings) return null;

  const linked = status?.linked ?? settings.telegramLinked ?? false;
  const botUsername = status?.botUsername || 'Taqwin_Ai_Fitness_bot';
  const enabled = settings.telegramEnabled ?? false;
  const showOptions = linked && enabled;
  const previewLabel = t('settings.telegramPreview');

  const previewContent: Record<PreviewKey, { title: string; lines: string[] }> = {
    security: {
      title: t('settings.telegramPreviewSecurityTitle'),
      lines: [t('settings.telegramPreviewSecurity1'), t('settings.telegramPreviewSecurity2')],
    },
    coach: {
      title: t('settings.telegramPreviewCoachTitle'),
      lines: [t('settings.telegramPreviewCoach1'), t('settings.telegramPreviewCoach2'), t('settings.telegramPreviewOpen')],
    },
    fitness: {
      title: t('settings.telegramPreviewFitnessTitle'),
      lines: [t('settings.telegramPreviewFitness1'), t('settings.telegramPreviewFitness2')],
    },
    orders: {
      title: t('settings.telegramPreviewOrdersTitle'),
      lines: [t('settings.telegramPreviewOrders1')],
    },
    messages: {
      title: t('settings.telegramPreviewMessagesTitle'),
      lines: [t('settings.telegramPreviewMessages1')],
    },
    groupInvites: {
      title: t('settings.telegramPreviewGroupTitle'),
      lines: [t('settings.telegramPreviewGroup1')],
    },
    followRequests: {
      title: t('settings.telegramPreviewFollowReqTitle'),
      lines: [t('settings.telegramPreviewFollowReq1')],
    },
    follows: {
      title: t('settings.telegramPreviewFollowsTitle'),
      lines: [t('settings.telegramPreviewFollows1')],
    },
    comments: {
      title: t('settings.telegramPreviewCommentsTitle'),
      lines: [t('settings.telegramPreviewComments1')],
    },
    mentions: {
      title: t('settings.telegramPreviewMentionsTitle'),
      lines: [t('settings.telegramPreviewMentions1')],
    },
    aiInsights: {
      title: t('settings.telegramPreviewAiTitle'),
      lines: [t('settings.telegramPreviewAi1'), t('settings.telegramPreviewAi2')],
    },
    dailyDigest: {
      title: t('settings.telegramPreviewDigestTitle'),
      lines: [t('settings.telegramPreviewDigest1'), t('settings.telegramPreviewDigest2')],
    },
    weekly: {
      title: t('settings.telegramPreviewWeeklyTitle'),
      lines: [t('settings.telegramPreviewWeekly1'), t('settings.telegramPreviewWeekly2')],
    },
  };

  return (
    <div className="pb-2" data-testid="telegram-section">
      <p className="mb-3 text-xs font-black uppercase tracking-[0.25em] text-faint">{t('settings.telegramAlerts')}</p>
      <p className="mb-4 text-sm text-muted">{t('settings.notificationsInAppHint')}</p>
      <div className="space-y-3">
          <div className="flex flex-col gap-3 rounded-2xl border border-subtle bg-elevated/40 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="flex items-center gap-2 font-semibold text-foreground">
                <span aria-hidden>{linked ? '🟢' : '🔴'}</span>
                {linked ? t('settings.telegramConnected') : t('settings.telegramNotConnected')}
              </p>
              <p className="mt-1 text-sm text-muted">@{botUsername}</p>
              <p className="mt-2 text-xs text-muted">{t('settings.telegramDailyCap')}</p>
            </div>
            <div className="flex shrink-0 gap-2">
              {linked ? (
                <button
                  type="button"
                  data-testid="telegram-unlink"
                  disabled={linkLoading || saving}
                  onClick={() => void unlink()}
                  className="rounded-xl border border-subtle bg-elevated px-4 py-2 text-sm font-semibold text-primary hover:bg-elevated-hover disabled:opacity-50"
                >
                  {t('settings.telegramUnlink')}
                </button>
              ) : (
                <button
                  type="button"
                  data-testid="telegram-connect"
                  disabled={linkLoading || saving}
                  onClick={() => void startLink()}
                  className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
                >
                  {linkLoading ? t('settings.telegramLinking') : t('settings.telegramConnect')}
                </button>
              )}
            </div>
          </div>

          {linkUrl && !linked && (
            <p className="text-sm text-muted">
              {t('settings.telegramOpenBot')}{' '}
              <a href={linkUrl} target="_blank" rel="noopener noreferrer" className="text-primary underline">
                @{botUsername}
              </a>
            </p>
          )}

          {linked && (
            <div className="flex items-center justify-between rounded-xl border border-subtle px-4 py-3">
              <div>
                <p className="font-semibold text-foreground">{t('settings.telegramEnabledLabel')}</p>
                <p className="text-sm text-muted">{t('settings.telegramEnabledHint')}</p>
              </div>
              <Toggle
                data-testid="telegram-enabled"
                checked={enabled}
                disabled={saving}
                onChange={(v) => patch({ telegramEnabled: v })}
              />
            </div>
          )}

          {showOptions && (
            <>
              <button
                type="button"
                data-testid="telegram-expand"
                onClick={() => setExpanded((v) => !v)}
                className="flex w-full items-center py-2 text-start text-xs font-black uppercase tracking-[0.2em] text-faint"
              >
                {expanded ? '▼' : '▶'} {t('settings.telegramCustomize')}
              </button>

              {expanded && (
                <>
              <p className="pt-1 text-xs font-black uppercase tracking-[0.2em] text-faint">
                {t('settings.telegramWhatToSend')}
              </p>

              <AlertToggleRow
                icon="🛡"
                title={t('settings.telegramSecurity')}
                checked={settings.telegramSecurityAlerts ?? true}
                disabled={saving}
                onChange={(v) => patch({ telegramSecurityAlerts: v })}
                onPreview={() => setPreviewKey('security')}
                previewLabel={previewLabel}
                data-testid="telegram-security-row"
              />
              <AlertToggleRow
                icon="🤖"
                title={t('settings.telegramCoachAi')}
                checked={settings.telegramCoachAi ?? true}
                disabled={saving}
                onChange={(v) => patch({ telegramCoachAi: v })}
                onPreview={() => setPreviewKey('coach')}
                previewLabel={previewLabel}
              />
              <AlertToggleRow
                icon="🏆"
                title={t('settings.telegramFitnessShort')}
                checked={settings.telegramFitnessAchievements ?? true}
                disabled={saving}
                onChange={(v) => patch({ telegramFitnessAchievements: v })}
                onPreview={() => setPreviewKey('fitness')}
                previewLabel={previewLabel}
              />
              <AlertToggleRow
                icon="📦"
                title={t('settings.telegramOrdersShort')}
                checked={settings.telegramOrders ?? true}
                disabled={saving}
                onChange={(v) => patch({ telegramOrders: v })}
                onPreview={() => setPreviewKey('orders')}
                previewLabel={previewLabel}
              />
              <AlertToggleRow
                icon="🧠"
                title={t('settings.telegramAiInsightsShort')}
                checked={settings.telegramAiInsights ?? true}
                disabled={saving}
                onChange={(v) => patch({ telegramAiInsights: v })}
                onPreview={() => setPreviewKey('aiInsights')}
                previewLabel={previewLabel}
              />
              <AlertToggleRow
                icon="🏋️"
                title={t('settings.telegramWorkoutCheckins')}
                description={t('settings.telegramWorkoutCheckinsDesc')}
                checked={settings.telegramWorkoutMissed ?? true}
                disabled={saving}
                onChange={(v) => patch({ telegramWorkoutMissed: v })}
                previewLabel={previewLabel}
              />
              <AlertToggleRow
                icon="🍽️"
                title={t('settings.telegramMealCheckins')}
                description={t('settings.telegramMealCheckinsDesc')}
                checked={settings.telegramMealReminders ?? false}
                disabled={saving}
                onChange={(v) => patch({ telegramMealReminders: v })}
                previewLabel={previewLabel}
              />

              <p className="pt-2 text-xs font-semibold uppercase tracking-wide text-muted">
                {t('settings.telegramMessagesSection')}
              </p>
              <AlertToggleRow
                icon="💬"
                title={t('settings.telegramDirectMessages')}
                checked={settings.telegramCommunityMessages ?? true}
                disabled={saving}
                onChange={(v) => patch({ telegramCommunityMessages: v })}
                onPreview={() => setPreviewKey('messages')}
                previewLabel={previewLabel}
              />
              <AlertToggleRow
                icon="👥"
                title={t('settings.telegramGroupInvites')}
                checked={settings.telegramGroupInvites ?? true}
                disabled={saving}
                onChange={(v) => patch({ telegramGroupInvites: v })}
                onPreview={() => setPreviewKey('groupInvites')}
                previewLabel={previewLabel}
              />
              <AlertToggleRow
                icon="📩"
                title={t('settings.telegramFollowRequests')}
                checked={settings.telegramFollowRequests ?? true}
                disabled={saving}
                onChange={(v) => patch({ telegramFollowRequests: v })}
                onPreview={() => setPreviewKey('followRequests')}
                previewLabel={previewLabel}
              />

              <p className="pt-2 text-xs font-semibold uppercase tracking-wide text-muted">
                {t('settings.telegramSocialSection')}
              </p>
              <AlertToggleRow
                icon="👤"
                title={t('settings.telegramFollows')}
                description={t('settings.telegramFollowsDesc')}
                checked={settings.telegramSocialActivity ?? false}
                disabled={saving}
                onChange={(v) => patch({ telegramSocialActivity: v })}
                onPreview={() => setPreviewKey('follows')}
                previewLabel={previewLabel}
              />
              <AlertToggleRow
                icon="💭"
                title={t('settings.telegramCommentsShort')}
                checked={settings.telegramCommunityComments ?? false}
                disabled={saving}
                onChange={(v) => patch({ telegramCommunityComments: v })}
                onPreview={() => setPreviewKey('comments')}
                previewLabel={previewLabel}
              />
              <AlertToggleRow
                icon="@"
                title={t('settings.telegramMentions')}
                checked={settings.telegramMentions ?? false}
                disabled={saving}
                onChange={(v) => patch({ telegramMentions: v })}
                onPreview={() => setPreviewKey('mentions')}
                previewLabel={previewLabel}
              />
              <p className="text-xs text-muted ps-1">{t('settings.telegramLikesNever')}</p>

              <p className="pt-2 text-xs font-semibold uppercase tracking-wide text-muted">
                {t('settings.telegramDigestSection')}
              </p>
              <div className="rounded-xl border border-subtle px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-foreground">
                      <span className="me-2">🌅</span>
                      {t('settings.telegramDailyDigest')}
                    </p>
                  </div>
                  <Toggle
                    checked={settings.telegramDailyDigest ?? false}
                    disabled={saving}
                    onChange={(v) => patch({ telegramDailyDigest: v })}
                  />
                </div>
                {settings.telegramDailyDigest && (
                  <div className="mt-3 flex items-center gap-2">
                    <span className="text-sm text-muted">{t('settings.telegramTime')}</span>
                    <input
                      type="time"
                      className={selectClass}
                      value={settings.telegramDailyDigestHour ?? '08:00'}
                      disabled={saving}
                      onChange={(e) => patch({ telegramDailyDigestHour: e.target.value })}
                    />
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => setPreviewKey('dailyDigest')}
                  className="mt-2 text-xs font-semibold text-primary hover:underline"
                >
                  {previewLabel}
                </button>
              </div>

              <div className="rounded-xl border border-subtle px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-foreground">
                      <span className="me-2">📊</span>
                      {t('settings.telegramWeeklyShort')}
                    </p>
                    <p className="mt-0.5 text-sm text-muted">{t('settings.telegramWeeklySchedule')}</p>
                  </div>
                  <Toggle
                    checked={settings.telegramWeeklySummary ?? true}
                    disabled={saving}
                    onChange={(v) => patch({ telegramWeeklySummary: v })}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setPreviewKey('weekly')}
                  className="mt-2 text-xs font-semibold text-primary hover:underline"
                >
                  {previewLabel}
                </button>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  data-testid="telegram-test"
                  disabled={testLoading || saving}
                  onClick={() => void sendTest()}
                  className="rounded-xl border border-primary/30 bg-primary/10 px-4 py-2 text-sm font-semibold text-primary hover:bg-primary/15 disabled:opacity-50"
                >
                  {testLoading ? t('settings.telegramTestSending') : t('settings.telegramTest')}
                </button>
              </div>
                </>
              )}
            </>
          )}

          {error && <p className="text-sm text-red-500">{error}</p>}
          {success && <p className="text-sm text-emerald-500">{success}</p>}
      </div>

      {previewKey && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center"
          onClick={() => setPreviewKey(null)}
          role="presentation"
        >
          <div
            className="w-full max-w-md rounded-2xl border border-subtle bg-background p-5 shadow-xl"
            data-testid="telegram-preview-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <p className="text-xs font-black uppercase tracking-widest text-faint">{t('settings.telegramPreview')}</p>
            <p className="mt-3 font-bold text-foreground">{previewContent[previewKey].title}</p>
            <div className="mt-3 space-y-2 rounded-xl bg-elevated p-4 text-sm text-foreground">
              {previewContent[previewKey].lines.map((line) => (
                <p key={line}>{line}</p>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setPreviewKey(null)}
              className="mt-4 w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground"
            >
              {t('settings.close')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
