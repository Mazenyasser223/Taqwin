import React, { useEffect, useState } from 'react';
import { useI18n } from '../../lib/i18n/useI18n';
import gamificationService, { type GamificationSettings } from '../../services/gamificationService';
import { SettingRow, Section, Toggle } from './SettingsPage';

export function GamificationSettingsSection() {
  const { t } = useI18n();
  const [settings, setSettings] = useState<GamificationSettings | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void gamificationService.me().then((res) => {
      if (res.data?.settings) setSettings(res.data.settings);
    });
  }, []);

  const patch = async (partial: Partial<GamificationSettings>) => {
    if (!settings) return;
    setSaving(true);
    const next = { ...settings, ...partial };
    setSettings(next);
    const res = await gamificationService.updateSettings(partial);
    setSaving(false);
    if (res.data?.settings) setSettings(res.data.settings);
  };

  if (!settings) return null;

  return (
    <Section title={t('compete.settingsTitle')}>
      <SettingRow title={t('compete.settingsLeagueOptIn')} description={t('compete.settingsLeagueOptInDesc')}>
        <Toggle checked={settings.leagueOptIn} disabled={saving} onChange={(v) => void patch({ leagueOptIn: v })} />
      </SettingRow>
      <SettingRow title={t('compete.settingsShowOnBoard')} description={t('compete.settingsShowOnBoardDesc')}>
        <Toggle
          checked={settings.showOnLeaderboard}
          disabled={saving || !settings.leagueOptIn}
          onChange={(v) => void patch({ showOnLeaderboard: v })}
        />
      </SettingRow>
      <SettingRow title={t('compete.settingsVisibility')} description={t('compete.settingsVisibilityDesc')}>
        <select
          disabled={saving || !settings.leagueOptIn}
          value={settings.leaderboardVisibility}
          onChange={(e) =>
            void patch({
              leaderboardVisibility: e.target.value as GamificationSettings['leaderboardVisibility'],
            })
          }
          className="rounded-xl border border-subtle bg-elevated px-3 py-2 text-sm font-medium text-primary"
        >
          <option value="off">{t('compete.visibility.off')}</option>
          <option value="friends">{t('compete.visibility.friends')}</option>
          <option value="gym">{t('compete.visibility.gym')}</option>
          <option value="global">{t('compete.visibility.global')}</option>
        </select>
      </SettingRow>
    </Section>
  );
}
