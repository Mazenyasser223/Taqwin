import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import communityService from '../../services/communityService';
import type { CommunityPrivacySettings, PrivacyAudience } from '../../types';
import { useI18n } from '../../lib/i18n/useI18n';
import { communitySelectClass, feedPanel } from './communityFeedStyles';

const AUDIENCES: PrivacyAudience[] = ['everyone', 'followers', 'following', 'mutual', 'nobody', 'only_me'];

export const CommunitySettings: React.FC = () => {
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
    return <p className="text-sm text-primary animate-pulse py-8 text-center">{t('community.loading')}</p>;
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
        className={communitySelectClass}
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
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      <div className="flex items-center gap-3 px-1">
        <span className="material-symbols-outlined text-2xl text-primary">settings</span>
        <div>
          <h1 className="text-xl font-black text-foreground">{t('community.settingsTitle')}</h1>
          <p className="text-sm text-muted">{t('community.settingsSubtitle')}</p>
        </div>
      </div>

      {message && (
        <p className="text-sm text-primary font-bold px-1">{message}</p>
      )}

      <section className={`${feedPanel} p-4`}>
        <h2 className="text-xs font-black uppercase tracking-widest text-faint mb-2">{t('community.privacyReposts')}</h2>
        {audienceSelect(t('community.whoSeesReposts'), t('community.whoSeesRepostsDesc'), 'repostsAudience')}
      </section>

      <section className={`${feedPanel} p-4`}>
        <h2 className="text-xs font-black uppercase tracking-widest text-faint mb-2">{t('community.privacySaved')}</h2>
        {audienceSelect(t('community.whoSeesSaved'), t('community.whoSeesSavedDesc'), 'savedPostsAudience')}
      </section>

      <section className={`${feedPanel} p-4`}>
        <h2 className="text-xs font-black uppercase tracking-widest text-faint mb-2">{t('community.privacyStories')}</h2>
        {audienceSelect(t('community.whoSeesStories'), t('community.whoSeesStoriesDesc'), 'storyAudience')}
        <p className="text-xs text-muted mt-4">{t('community.storyHideNote')}</p>
      </section>

      <section className={`${feedPanel} p-4`}>
        <h2 className="text-xs font-black uppercase tracking-widest text-faint mb-2">{t('community.privacyMentions')}</h2>
        {audienceSelect(t('community.whoCanMention'), t('community.whoCanMentionDesc'), 'mentionsAudience')}
      </section>

      <section className={`${feedPanel} p-4`}>
        <h2 className="text-xs font-black uppercase tracking-widest text-faint mb-2">{t('community.privacyShares')}</h2>
        {audienceSelect(t('community.whoCanShare'), t('community.whoCanShareDesc'), 'sharesAudience')}
      </section>

      <section className={`${feedPanel} p-4 text-sm text-muted`}>
        <p className="font-bold text-foreground mb-2">{t('community.postPrivacyNoteTitle')}</p>
        <p>{t('community.postPrivacyNoteV2')}</p>
      </section>
    </motion.div>
  );
};
