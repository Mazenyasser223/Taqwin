import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import communityService from '../../services/communityService';
import type { CommunityPrivacySettings, PrivacyAudience } from '../../types';
import { useI18n } from '../../lib/i18n/useI18n';

const AUDIENCES: PrivacyAudience[] = ['everyone', 'followers', 'following', 'mutual', 'nobody', 'only_me'];

export const CommunityPrivacySettings: React.FC = () => {
  const { t } = useI18n();
  const [settings, setSettings] = useState<CommunityPrivacySettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    communityService.getPrivacySettings().then((res) => {
      if (res.data) setSettings(res.data);
    });
  }, []);

  const save = async (patch: Partial<CommunityPrivacySettings>) => {
    if (!settings) return;
    setSaving(true);
    const res = await communityService.updatePrivacySettings(patch);
    setSaving(false);
    if (res.data) {
      setSettings(res.data);
      setMessage(t('community.settingsSaved'));
      window.setTimeout(() => setMessage(null), 2000);
    }
  };

  if (!settings) {
    return <p className="text-sm text-primary animate-pulse">{t('community.loading')}</p>;
  }

  const audienceSelect = (
    label: string,
    desc: string,
    key: keyof Pick<
      CommunityPrivacySettings,
      'repostsAudience' | 'savedPostsAudience' | 'storyAudience' | 'mentionsAudience' | 'sharesAudience'
    >,
  ) => (
    <div className="border-b border-subtle py-4 last:border-0">
      <p className="font-semibold text-foreground">{label}</p>
      <p className="text-sm text-muted mt-0.5 mb-3">{desc}</p>
      <select
        value={settings[key]}
        onChange={(e) => {
          const v = e.target.value as PrivacyAudience;
          setSettings({ ...settings, [key]: v });
          save({ [key]: v });
        }}
        disabled={saving}
        className="w-full rounded-xl border border-subtle bg-elevated px-4 py-2.5 text-sm"
      >
        {AUDIENCES.map((a) => (
          <option key={a} value={a}>
            {t(`community.audience.${a}`)}
          </option>
        ))}
      </select>
    </div>
  );

  return (
    <div className="max-w-lg mx-auto space-y-6 pb-12">
      <Link to="/settings" className="text-sm font-bold text-primary hover:underline flex items-center gap-1">
        <span className="material-symbols-outlined text-lg">arrow_back</span>
        {t('common.back')}
      </Link>
      <h1 className="text-2xl font-black">{t('community.privacySettingsTitle')}</h1>
      {message && <p className="text-sm text-primary font-bold">{message}</p>}

      <section className="rounded-2xl border border-border bg-surface/60 p-4">
        <h2 className="text-xs font-black uppercase tracking-widest text-faint mb-2">{t('community.privacyReposts')}</h2>
        {audienceSelect(
          t('community.whoSeesReposts'),
          t('community.whoSeesRepostsDesc'),
          'repostsAudience',
        )}
      </section>

      <section className="rounded-2xl border border-border bg-surface/60 p-4">
        <h2 className="text-xs font-black uppercase tracking-widest text-faint mb-2">{t('community.privacySaved')}</h2>
        {audienceSelect(
          t('community.whoSeesSaved'),
          t('community.whoSeesSavedDesc'),
          'savedPostsAudience',
        )}
      </section>

      <section className="rounded-2xl border border-border bg-surface/60 p-4">
        <h2 className="text-xs font-black uppercase tracking-widest text-faint mb-2">{t('community.privacyStories')}</h2>
        {audienceSelect(
          t('community.whoSeesStories'),
          t('community.whoSeesStoriesDesc'),
          'storyAudience',
        )}
        <p className="text-xs text-muted mt-4">{t('community.storyHideNote')}</p>
      </section>

      <section className="rounded-2xl border border-border bg-surface/60 p-4">
        <h2 className="text-xs font-black uppercase tracking-widest text-faint mb-2">{t('community.privacyMentions')}</h2>
        {audienceSelect(
          t('community.whoCanMention'),
          t('community.whoCanMentionDesc'),
          'mentionsAudience',
        )}
      </section>

      <section className="rounded-2xl border border-border bg-surface/60 p-4">
        <h2 className="text-xs font-black uppercase tracking-widest text-faint mb-2">{t('community.privacyShares')}</h2>
        {audienceSelect(
          t('community.whoCanShare'),
          t('community.whoCanShareDesc'),
          'sharesAudience',
        )}
      </section>

      <section className="rounded-2xl border border-border bg-surface/60 p-4 text-sm text-muted">
        <p className="font-bold text-foreground mb-2">{t('community.postPrivacyNoteTitle')}</p>
        <p>{t('community.postPrivacyNoteV2')}</p>
      </section>
    </div>
  );
};
