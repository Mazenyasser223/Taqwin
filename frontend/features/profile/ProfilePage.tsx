import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useAuthStore } from '../../store/useAuthStore';
import profileService from '../../services/profileService';
import { buttonPress, staggerContainer, contentRevealVariants } from '../../lib/motion';
import type { UserRole } from '../../types';
import { ImageUploader } from '../../components/shared/ImageUploader';
import type { TranslationKey } from '../../lib/i18n/translations';
import { useI18n } from '../../lib/i18n/useI18n';
import { OnboardingSummary } from './OnboardingSummary';
import { ProfileCoachDossier } from './ProfileCoachDossier';
import { answersFromOnboardingData } from '../../services/onboardingStorage';
import { persistDossierFieldUpdate } from '../onboarding/persistQuestionnaire';

function inputClass(extra = '') {
  return `w-full bg-elevated border border-subtle rounded-2xl px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/40 ${extra}`;
}

function ProfilePublicHero({
  displayName,
  onDisplayNameChange,
  displayNameDirty,
  savingDisplayName,
  onSaveDisplayName,
  avatarUrl,
  onAvatarChange,
  email,
  role,
  t,
}: {
  displayName: string;
  onDisplayNameChange: (value: string) => void;
  displayNameDirty: boolean;
  savingDisplayName: boolean;
  onSaveDisplayName: () => void;
  avatarUrl: string;
  onAvatarChange: (url: string | null) => Promise<void>;
  email: string;
  role: UserRole;
  t: (key: TranslationKey) => string;
}) {
  return (
    <motion.section
      variants={contentRevealVariants}
      className="glass-panel relative overflow-hidden rounded-xl max-[374px]:rounded-xl sm:rounded-3xl border-2 border-primary/20 ring-1 ring-primary/10 shadow-[0_4px_24px_-4px_rgba(21,139,141,0.15)] p-3.5 max-[374px]:p-3.5 sm:p-6"
    >
      <div className="relative flex flex-col sm:flex-row sm:items-center gap-4 max-[374px]:gap-4 sm:gap-6">
        <div className="shrink-0 self-center sm:self-auto sm:pt-0.5">
          <ImageUploader
            folder="avatars"
            value={avatarUrl || null}
            onChange={(url) => void onAvatarChange(url)}
            size="size-16 max-[374px]:size-16 sm:size-20"
            layout="stacked"
            label={t('profile.uploadAvatar')}
          />
        </div>

        <div className="flex-1 min-w-0 w-full space-y-2 max-[374px]:space-y-2 sm:space-y-2.5 text-center sm:text-start border-t border-subtle/60 pt-3 max-[374px]:pt-3 sm:border-t-0 sm:pt-0 sm:border-s sm:ps-6 sm:border-subtle/60">
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
            <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-[0.25em] text-primary">
              {t('profile.public')}
            </span>
            <span className="inline-flex items-center rounded-full bg-surface/80 border border-subtle px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-faint">
              {t(`roles.${role}` as TranslationKey)}
            </span>
          </div>

          <div className="space-y-1">
            <label htmlFor="profile-display-name" className="block text-[10px] font-black uppercase tracking-widest text-faint text-center sm:text-start">
              {t('profile.displayName')}
            </label>
            <div className="flex flex-col sm:flex-row gap-2 sm:items-stretch">
              <input
                id="profile-display-name"
                className={inputClass(
                  'flex-1 min-w-0 text-base max-[374px]:text-base sm:text-xl font-bold tracking-tight bg-surface/50 border-subtle py-2 max-[374px]:py-2 sm:py-3 text-center sm:text-start',
                )}
                value={displayName}
                onChange={(e) => onDisplayNameChange(e.target.value)}
                placeholder={t('profile.displayName')}
                autoComplete="name"
              />
              {displayNameDirty && (
                <motion.button
                  type="button"
                  onClick={onSaveDisplayName}
                  disabled={savingDisplayName}
                  variants={buttonPress}
                  whileHover="hover"
                  whileTap="tap"
                  className="shrink-0 self-center sm:self-auto bg-primary text-white font-black px-5 sm:px-6 py-2.5 sm:py-3 rounded-2xl shadow-md disabled:opacity-50 text-sm sm:text-base"
                >
                  {savingDisplayName ? t('profile.saving') : t('profile.save')}
                </motion.button>
              )}
            </div>
          </div>

          <p className="text-xs text-faint truncate max-w-full">{email}</p>
          <p className="text-[11px] text-faint/70">{t('profile.avatarFormats')}</p>
        </div>
      </div>
    </motion.section>
  );
}

export const ProfilePage: React.FC = () => {
  const { user, refreshUser } = useAuthStore();
  const { t } = useI18n();
  const role: UserRole = user?.role ?? 'athlete';
  const p = user?.profile;

  const [displayName, setDisplayName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [gender, setGender] = useState('');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [fitnessGoal, setFitnessGoal] = useState('');
  const [fitnessLevel, setFitnessLevel] = useState('');
  const [medicalNotes, setMedicalNotes] = useState('');
  const [bio, setBio] = useState('');
  const [specialties, setSpecialties] = useState('');
  const [yearsExperience, setYearsExperience] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [businessAddress, setBusinessAddress] = useState('');
  const [businessPhone, setBusinessPhone] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');

  const [saving, setSaving] = useState(false);
  const [savingDisplayName, setSavingDisplayName] = useState(false);
  const [displayNameDirty, setDisplayNameDirty] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const savedDisplayName = p?.displayName ?? '';

  useEffect(() => {
    void refreshUser();
  }, [refreshUser]);

  useEffect(() => {
    if (!user) return;
    if (!displayNameDirty) setDisplayName(savedDisplayName);
    setAvatarUrl(p?.avatarUrl ?? '');
    setDateOfBirth(p?.dateOfBirth ? String(p.dateOfBirth).slice(0, 10) : '');
    setGender(p?.gender ?? '');
    setHeight(p?.height != null ? String(p.height) : '');
    setWeight(p?.weight != null ? String(p.weight) : '');
    setFitnessGoal(p?.fitnessGoal ?? '');
    setFitnessLevel(p?.fitnessLevel ?? '');
    if (role === 'trainer') setMedicalNotes(p?.medicalNotes ?? '');
    setBio(p?.bio ?? '');
    setSpecialties(p?.specialties ?? '');
    setYearsExperience(p?.yearsExperience != null ? String(p.yearsExperience) : '');
    setBusinessName(p?.businessName ?? '');
    setBusinessAddress(p?.businessAddress ?? '');
    setBusinessPhone(p?.businessPhone ?? '');
    setWebsiteUrl(p?.websiteUrl ?? '');
  }, [user, p, role, displayNameDirty, savedDisplayName]);

  const handleDisplayNameChange = (value: string) => {
    setDisplayName(value);
    setDisplayNameDirty(value.trim() !== savedDisplayName.trim());
  };

  const handleSaveDisplayName = async () => {
    const trimmed = displayName.trim();
    if (trimmed.length < 2) {
      setError(t('profile.dossier.saveFailed'));
      return;
    }
    setSavingDisplayName(true);
    setError(null);
    setMessage(null);

    let result: { ok: boolean; error?: string };
    if (role === 'athlete') {
      const answers = answersFromOnboardingData(p?.onboardingData ?? null);
      result = await persistDossierFieldUpdate('core', { ...answers, displayName: trimmed }, 'displayName');
    } else {
      const res = await profileService.updateProfile({ displayName: trimmed });
      result = res.error ? { ok: false, error: res.error } : { ok: true };
    }

    setSavingDisplayName(false);
    if (!result.ok) {
      setError(result.error ?? t('profile.dossier.saveFailed'));
      return;
    }
    setDisplayNameDirty(false);
    setMessage(t('profile.saved'));
    await refreshUser();
  };
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);

    const payload: Record<string, string | number | null | undefined> = {};

    if (displayNameDirty) {
      payload.displayName = displayName.trim() || undefined;
    }

    if (role === 'trainer') {
      payload.medicalNotes = medicalNotes.trim() || null;
      payload.dateOfBirth = dateOfBirth || undefined;
      payload.gender = gender.trim() || undefined;
      payload.fitnessGoal = fitnessGoal.trim() || undefined;
      payload.fitnessLevel = fitnessLevel.trim() || undefined;
      const h = parseFloat(height);
      const w = parseFloat(weight);
      if (height.trim() !== '' && Number.isFinite(h)) payload.height = h;
      if (weight.trim() !== '' && Number.isFinite(w)) payload.weight = w;
      payload.bio = bio.trim() || undefined;
      payload.specialties = specialties.trim() || undefined;
      const y = parseInt(yearsExperience, 10);
      if (yearsExperience.trim() !== '' && Number.isFinite(y)) payload.yearsExperience = y;
    }

    if (role === 'gym' || role === 'trainer') {
      payload.businessName = businessName.trim() || undefined;
      payload.businessAddress = businessAddress.trim() || undefined;
      payload.businessPhone = businessPhone.trim() || undefined;
      payload.websiteUrl = websiteUrl.trim() || undefined;
    }

    const res = await profileService.updateProfile(payload);
    setSaving(false);

    if (res.error) {
      setError(res.error);
      return;
    }
    if (displayNameDirty) setDisplayNameDirty(false);
    setMessage(t('profile.saved'));
    await refreshUser();
  };

  const handleAvatarChange = async (url: string | null) => {
    setAvatarUrl(url ?? '');
    setError(null);
    const res = await profileService.updateProfile({ avatarUrl: url ?? null });
    if (res.error) {
      setError(res.error);
      return;
    }
    setMessage(url ? t('profile.avatarUploaded') : t('profile.saved'));
    await refreshUser();
  };

  if (!user) {
    return null;
  }

  return (
    <motion.div
      variants={staggerContainer(0.05)}
      initial="hidden"
      animate="visible"
      className={`page-shell mx-auto pb-2 w-full min-w-0 ${role === 'athlete' ? 'max-w-5xl' : 'max-w-3xl'}`}
    >
      {role === 'athlete' ? (
        <div className="space-y-4 max-[374px]:space-y-3 sm:space-y-8">
          <ProfilePublicHero
            displayName={displayName}
            onDisplayNameChange={handleDisplayNameChange}
            displayNameDirty={displayNameDirty}
            savingDisplayName={savingDisplayName}
            onSaveDisplayName={() => void handleSaveDisplayName()}
            avatarUrl={avatarUrl}
            onAvatarChange={handleAvatarChange}
            email={user.email}
            role={role}
            t={t}
          />

          <div className="w-full min-w-0 max-w-full">
            <ProfileCoachDossier onboardingData={p?.onboardingData ?? null} profile={p ?? undefined} />
          </div>

          {error && (
            <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>
          )}
          {message && (
            <div className="p-4 rounded-2xl bg-primary/10 border border-primary/20 text-primary text-sm font-bold">{message}</div>
          )}
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6 sm:space-y-8">
          <ProfilePublicHero
            displayName={displayName}
            onDisplayNameChange={handleDisplayNameChange}
            displayNameDirty={displayNameDirty}
            savingDisplayName={savingDisplayName}
            onSaveDisplayName={() => void handleSaveDisplayName()}
            avatarUrl={avatarUrl}
            onAvatarChange={handleAvatarChange}
            email={user.email}
            role={role}
            t={t}
          />
          {role === 'trainer' && (
          <section className="glass-panel rounded-3xl p-6 md:p-8 border-subtle space-y-4">
            <h2 className="text-lg font-black text-foreground">{t('profile.sectionBodyGoals')}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-faint">{t('profile.dateOfBirth')}</label>
                <input type="date" className={inputClass()} value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-faint">{t('profile.gender')}</label>
                <input className={inputClass()} value={gender} onChange={(e) => setGender(e.target.value)} placeholder={t('profile.optional')} />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-faint">{t('profile.heightCm')}</label>
                <input className={inputClass()} value={height} onChange={(e) => setHeight(e.target.value)} inputMode="decimal" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-faint">{t('profile.weightKg')}</label>
                <input className={inputClass()} value={weight} onChange={(e) => setWeight(e.target.value)} inputMode="decimal" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-faint">{t('profile.fitnessGoal')}</label>
                <input className={inputClass()} value={fitnessGoal} onChange={(e) => setFitnessGoal(e.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-faint">{t('profile.fitnessLevel')}</label>
                <input
                  className={inputClass()}
                  value={fitnessLevel}
                  onChange={(e) => setFitnessLevel(e.target.value)}
                  placeholder={t('profile.fitnessLevelPlaceholder')}
                />
              </div>
              <div className="md:col-span-2 space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-faint">{t('profile.medicalNotes')}</label>
                <textarea className={inputClass('min-h-[100px] resize-y')} value={medicalNotes} onChange={(e) => setMedicalNotes(e.target.value)} />
              </div>
            </div>
          </section>
        )}

        {role === 'trainer' && (
          <section className="glass-panel rounded-3xl p-6 md:p-8 border-subtle space-y-4">
            <h2 className="text-lg font-black text-foreground">{t('profile.trainerSection')}</h2>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-faint">{t('profile.bio')}</label>
              <textarea className={inputClass('min-h-[120px] resize-y')} value={bio} onChange={(e) => setBio(e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-faint">{t('profile.specialties')}</label>
              <input
                className={inputClass()}
                value={specialties}
                onChange={(e) => setSpecialties(e.target.value)}
                placeholder={t('profile.specialtiesPlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-faint">{t('profile.yearsExperience')}</label>
              <input className={inputClass()} value={yearsExperience} onChange={(e) => setYearsExperience(e.target.value)} inputMode="numeric" />
            </div>
          </section>
        )}

        {(role === 'gym' || role === 'trainer') && (
          <section className="glass-panel rounded-3xl p-6 md:p-8 border-subtle space-y-4">
            <h2 className="text-lg font-black text-foreground">{role === 'gym' ? t('profile.business') : t('profile.businessOptional')}</h2>
            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-faint">{t('profile.businessName')}</label>
                <input className={inputClass()} value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-faint">{t('profile.businessAddress')}</label>
                <textarea className={inputClass('min-h-[80px] resize-y')} value={businessAddress} onChange={(e) => setBusinessAddress(e.target.value)} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-faint">{t('profile.businessPhone')}</label>
                  <input className={inputClass()} value={businessPhone} onChange={(e) => setBusinessPhone(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-faint">{t('profile.website')}</label>
                  <input className={inputClass()} value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} placeholder={t('profile.websitePlaceholder')} />
                </div>
              </div>
            </div>
          </section>
        )}

        {role === 'gym' && (
          <section className="glass-panel rounded-3xl p-6 md:p-8 border-subtle space-y-4">
            <h2 className="text-lg font-black text-foreground">{t('profile.ownerSection')}</h2>
            <p className="text-sm text-faint">{t('profile.ownerDashboardHint')}</p>
          </section>
        )}

        <OnboardingSummary onboardingData={p?.onboardingData ?? null} role={role} />

        {error && (
          <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>
        )}
        {message && (
          <div className="p-4 rounded-2xl bg-primary/10 border border-primary/20 text-primary text-sm font-bold">{message}</div>
        )}

        <motion.button
          type="submit"
          disabled={saving}
          variants={buttonPress}
          whileHover="hover"
          whileTap="tap"
          className="w-full md:w-auto bg-primary text-white font-black px-10 py-4 rounded-2xl shadow-lg disabled:opacity-50"
        >
          {saving ? t('profile.saving') : t('profile.saveProfile')}
        </motion.button>
      </form>
      )}
    </motion.div>
  );
};
