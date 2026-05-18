import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/useAuthStore';
import { ChangePasswordDialog } from './ChangePasswordDialog';
import { DeleteAccountDialog, EmailChangeDialog, TwoFactorDialog } from './accountDialogs';
import { useSettingsStore } from '../../store/useSettingsStore';
import { useI18n } from '../../lib/i18n/useI18n';
import accountSettingsService from '../../services/accountSettingsService';
import type { AppLanguage, AppTheme, UnitSystem, UserSettingsPatch } from '../../services/settingsService';
import { COMMON_TIMEZONES } from './timezones';

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
        checked ? 'bg-primary' : 'bg-slate-400 dark:bg-slate-600'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <span
        className={`absolute top-0.5 size-6 rounded-full bg-white shadow transition-transform ${
          checked ? 'start-[22px]' : 'start-0.5'
        }`}
      />
    </button>
  );
}

function SettingRow({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-subtle py-4 last:border-0">
      <div className="min-w-0">
        <p className="font-semibold text-foreground">{title}</p>
        <p className="mt-0.5 text-sm text-muted">{description}</p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-b border-subtle last:border-0">
      <h3 className="py-4 text-xs font-black uppercase tracking-[0.25em] text-faint">{title}</h3>
      <div className="pb-2">{children}</div>
    </section>
  );
}

const selectClass =
  'ui-select rounded-xl border px-4 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/40 min-w-[140px]';

export const SettingsPage: React.FC = () => {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const { settings, loading, saving, error, load, update } = useSettingsStore();
  const { t } = useI18n();

  const [passwordOpen, setPasswordOpen] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [twoFactorOpen, setTwoFactorOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const hasPassword = user?.hasPassword !== false;

  useEffect(() => {
    load();
    void useAuthStore.getState().refreshUser();
  }, [load]);

  const patch = async (data: UserSettingsPatch) => {
    await update(data);
  };

  const handleExport = async () => {
    setExporting(true);
    setActionMsg(null);
    try {
      const res = await accountSettingsService.exportData();
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setActionMsg((err as { error?: string }).error || 'Export failed');
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `taqwin-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setActionMsg(t('settings.exportDone'));
    } catch {
      setActionMsg(t('settings.exportFailed'));
    } finally {
      setExporting(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/auth');
  };

  if (loading && !settings) {
    return <p className="animate-pulse text-primary">{t('settings.loading')}</p>;
  }

  if (!settings) {
    return (
      <div className="glass-panel rounded-2xl p-8 text-center">
        <p className="text-red-500">{error || t('settings.retry')}</p>
        <button type="button" onClick={load} className="mt-4 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white">
          {t('settings.retry')}
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex size-12 items-center justify-center rounded-2xl border border-subtle bg-elevated">
          <span className="material-symbols-outlined text-2xl text-primary">settings</span>
        </div>
        <div>
          <h1 className="text-2xl font-black text-foreground">{t('settings.title')}</h1>
          <p className="text-sm text-muted">{t('settings.subtitle')}</p>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-500">
          {error}
        </div>
      )}
      {actionMsg && (
        <div className="mb-4 rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-primary">
          {actionMsg}
        </div>
      )}
      {saving && (
        <p className="mb-4 text-xs font-bold uppercase tracking-widest text-primary">{t('settings.saving')}</p>
      )}

      <div className="glass-panel overflow-hidden rounded-2xl border border-subtle px-5 sm:px-6">
        <Section title={t('settings.preferences')}>
          <SettingRow title={t('settings.language')} description={t('settings.languageDesc')}>
            <select
              className={selectClass}
              value={settings.language}
              disabled={saving}
              onChange={(e) => patch({ language: e.target.value as AppLanguage })}
            >
              <option value="en">{t('lang.en')}</option>
              <option value="ar">{t('lang.ar')}</option>
            </select>
          </SettingRow>
          <SettingRow title={t('settings.theme')} description={t('settings.themeDesc')}>
            <select
              className={selectClass}
              value={settings.theme}
              disabled={saving}
              onChange={(e) => patch({ theme: e.target.value as AppTheme })}
            >
              <option value="light">{t('settings.themeLight')}</option>
              <option value="dark">{t('settings.themeDark')}</option>
            </select>
          </SettingRow>
          <SettingRow title={t('settings.units')} description={t('settings.unitsDesc')}>
            <select
              className={selectClass}
              value={settings.unitSystem ?? 'metric'}
              disabled={saving}
              onChange={(e) => patch({ unitSystem: e.target.value as UnitSystem })}
            >
              <option value="metric">{t('settings.unitsMetric')}</option>
              <option value="imperial">{t('settings.unitsImperial')}</option>
            </select>
          </SettingRow>
          <SettingRow title={t('settings.timezone')} description={t('settings.timezoneDesc')}>
            <select
              className={`${selectClass} max-w-[180px]`}
              value={settings.timezone ?? 'UTC'}
              disabled={saving}
              onChange={(e) => patch({ timezone: e.target.value })}
            >
              {COMMON_TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </select>
          </SettingRow>
        </Section>

        <Section title={t('settings.notifications')}>
          <SettingRow title={t('settings.workoutReminders')} description={t('settings.workoutRemindersDesc')}>
            <Toggle checked={settings.notifyWorkoutReminders} disabled={saving} onChange={(v) => patch({ notifyWorkoutReminders: v })} />
          </SettingRow>
          <SettingRow title={t('settings.aiSuggestions')} description={t('settings.aiSuggestionsDesc')}>
            <Toggle checked={settings.notifyAiSuggestions} disabled={saving} onChange={(v) => patch({ notifyAiSuggestions: v })} />
          </SettingRow>
          <SettingRow title={t('settings.promotional')} description={t('settings.promotionalDesc')}>
            <Toggle checked={settings.notifyPromotional} disabled={saving} onChange={(v) => patch({ notifyPromotional: v })} />
          </SettingRow>
        </Section>

        <Section title={t('settings.privacy')}>
          <SettingRow title={t('settings.shareTrainers')} description={t('settings.shareTrainersDesc')}>
            <Toggle checked={settings.shareWithTrainers} disabled={saving} onChange={(v) => patch({ shareWithTrainers: v })} />
          </SettingRow>
          <SettingRow title={t('settings.publicProfile')} description={t('settings.publicProfileDesc')}>
            <Toggle checked={settings.publicProfile} disabled={saving} onChange={(v) => patch({ publicProfile: v })} />
          </SettingRow>
        </Section>

        <Section title={t('settings.account')}>
          <SettingRow title={t('settings.email')} description={t('settings.emailDesc')}>
            <span className="text-sm font-medium text-muted">{user?.email}</span>
          </SettingRow>
          <SettingRow title={t('settings.password')} description={t('settings.passwordDesc')}>
            <button
              type="button"
              onClick={() => setPasswordOpen(true)}
              className="rounded-xl border border-subtle bg-elevated px-4 py-2 text-sm font-semibold text-primary hover:bg-elevated-hover"
            >
              {t('settings.manage')}
            </button>
          </SettingRow>
          <SettingRow title={t('settings.changeEmail')} description={t('settings.changeEmailDesc')}>
            <button
              type="button"
              onClick={() => setEmailOpen(true)}
              className="rounded-xl border border-subtle bg-elevated px-4 py-2 text-sm font-semibold text-primary hover:bg-elevated-hover"
            >
              {t('settings.manage')}
            </button>
          </SettingRow>
          <SettingRow title={t('settings.twoFactor')} description={t('settings.twoFactorDesc')}>
            <button
              type="button"
              onClick={() => setTwoFactorOpen(true)}
              className="rounded-xl border border-subtle bg-elevated px-4 py-2 text-sm font-semibold text-primary hover:bg-elevated-hover"
            >
              {t('settings.manage')}
            </button>
          </SettingRow>
        </Section>

        <Section title={t('settings.dataAndHelp')}>
          <SettingRow title={t('settings.exportData')} description={t('settings.exportDataDesc')}>
            <button
              type="button"
              onClick={handleExport}
              disabled={exporting}
              className="rounded-xl border border-subtle bg-elevated px-4 py-2 text-sm font-semibold text-primary hover:bg-elevated-hover disabled:opacity-50"
            >
              {exporting ? t('settings.exporting') : t('settings.export')}
            </button>
          </SettingRow>
          <SettingRow title={t('settings.supportLink')} description={t('settings.supportLinkDesc')}>
            <Link
              to="/support"
              className="rounded-xl border border-subtle bg-elevated px-4 py-2 text-sm font-semibold text-primary hover:bg-elevated-hover"
            >
              {t('nav.support')}
            </Link>
          </SettingRow>
          <SettingRow title={t('settings.logout')} description={t('settings.logoutDesc')}>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-xl border border-subtle bg-elevated px-4 py-2 text-sm font-semibold text-foreground hover:bg-elevated-hover"
            >
              {t('nav.logout')}
            </button>
          </SettingRow>
          <SettingRow title={t('settings.deleteAccount')} description={t('settings.deleteAccountDesc')}>
            <button
              type="button"
              onClick={() => setDeleteOpen(true)}
              className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-500"
            >
              {t('settings.delete')}
            </button>
          </SettingRow>
        </Section>
      </div>

      <p className="mt-4 text-center text-xs text-faint">{t('settings.savedNote')}</p>

      <ChangePasswordDialog open={passwordOpen} onClose={() => setPasswordOpen(false)} hasPassword={hasPassword} />
      <EmailChangeDialog open={emailOpen} onClose={() => setEmailOpen(false)} hasPassword={hasPassword} />
      <TwoFactorDialog open={twoFactorOpen} onClose={() => setTwoFactorOpen(false)} />
      <DeleteAccountDialog open={deleteOpen} onClose={() => setDeleteOpen(false)} hasPassword={hasPassword} />
    </div>
  );
};
