import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useAuthStore } from '../../store/useAuthStore';
import profileService from '../../services/profileService';
import { buttonPress, staggerContainer, contentRevealVariants } from '../../lib/motion';
import type { UserRole } from '../../types';
import { ImageUploader } from '../../components/shared/ImageUploader';

function inputClass(extra = '') {
  return `w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/40 ${extra}`;
}

export const ProfilePage: React.FC = () => {
  const { user, refreshUser } = useAuthStore();
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
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    setDisplayName(p?.displayName ?? '');
    setAvatarUrl(p?.avatarUrl ?? '');
    setDateOfBirth(p?.dateOfBirth ? String(p.dateOfBirth).slice(0, 10) : '');
    setGender(p?.gender ?? '');
    setHeight(p?.height != null ? String(p.height) : '');
    setWeight(p?.weight != null ? String(p.weight) : '');
    setFitnessGoal(p?.fitnessGoal ?? '');
    setFitnessLevel(p?.fitnessLevel ?? '');
    setMedicalNotes(p?.medicalNotes ?? '');
    setBio(p?.bio ?? '');
    setSpecialties(p?.specialties ?? '');
    setYearsExperience(p?.yearsExperience != null ? String(p.yearsExperience) : '');
    setBusinessName(p?.businessName ?? '');
    setBusinessAddress(p?.businessAddress ?? '');
    setBusinessPhone(p?.businessPhone ?? '');
    setWebsiteUrl(p?.websiteUrl ?? '');
  }, [user, p]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);

    const payload: Record<string, string | number | undefined> = {
      displayName: displayName.trim() || undefined,
      avatarUrl: avatarUrl.trim() || undefined,
      dateOfBirth: dateOfBirth || undefined,
      gender: gender.trim() || undefined,
      fitnessGoal: fitnessGoal.trim() || undefined,
      fitnessLevel: fitnessLevel.trim() || undefined,
      medicalNotes: medicalNotes.trim() || undefined,
    };

    const h = parseFloat(height);
    const w = parseFloat(weight);
    if (height.trim() !== '' && Number.isFinite(h)) payload.height = h;
    if (weight.trim() !== '' && Number.isFinite(w)) payload.weight = w;

    if (role === 'trainer') {
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
    setMessage('Profile saved.');
    await refreshUser();
  };

  if (!user) {
    return null;
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8 pb-20">
      <motion.div
        variants={staggerContainer(0.06)}
        initial="hidden"
        animate="visible"
        className="space-y-2"
      >
        <motion.h1 variants={contentRevealVariants} className="text-3xl md:text-4xl font-black tracking-tight">
          Your profile
        </motion.h1>
        <motion.p variants={contentRevealVariants} className="text-slate-500 text-sm font-medium">
          Signed in as <span className="text-white">{user.email}</span> · role{' '}
          <span className="text-primary font-bold uppercase text-xs">{role}</span>
        </motion.p>
      </motion.div>

      <form onSubmit={handleSubmit} className="space-y-10">
        <section className="glass-panel rounded-3xl p-6 md:p-8 border-white/10 space-y-4">
          <h2 className="text-lg font-black text-white">Public</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2 space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Display name</label>
              <input className={inputClass()} value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
            </div>
            <div className="md:col-span-2 space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Avatar</label>
              <ImageUploader
                folder="avatars"
                value={avatarUrl || null}
                onChange={(url) => setAvatarUrl(url ?? '')}
                size="size-20"
                label="Upload avatar"
              />
            </div>
          </div>
        </section>

        {(role === 'athlete' || role === 'trainer') && (
          <section className="glass-panel rounded-3xl p-6 md:p-8 border-white/10 space-y-4">
            <h2 className="text-lg font-black text-white">Body & goals</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Date of birth</label>
                <input type="date" className={inputClass()} value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Gender</label>
                <input className={inputClass()} value={gender} onChange={(e) => setGender(e.target.value)} placeholder="Optional" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Height (cm)</label>
                <input className={inputClass()} value={height} onChange={(e) => setHeight(e.target.value)} inputMode="decimal" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Weight (kg)</label>
                <input className={inputClass()} value={weight} onChange={(e) => setWeight(e.target.value)} inputMode="decimal" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Fitness goal</label>
                <input className={inputClass()} value={fitnessGoal} onChange={(e) => setFitnessGoal(e.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Fitness level</label>
                <input className={inputClass()} value={fitnessLevel} onChange={(e) => setFitnessLevel(e.target.value)} placeholder="e.g. beginner" />
              </div>
              <div className="md:col-span-2 space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Medical notes</label>
                <textarea className={inputClass('min-h-[100px] resize-y')} value={medicalNotes} onChange={(e) => setMedicalNotes(e.target.value)} />
              </div>
            </div>
          </section>
        )}

        {role === 'trainer' && (
          <section className="glass-panel rounded-3xl p-6 md:p-8 border-white/10 space-y-4">
            <h2 className="text-lg font-black text-white">Trainer</h2>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Bio</label>
              <textarea className={inputClass('min-h-[120px] resize-y')} value={bio} onChange={(e) => setBio(e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Specialties</label>
              <input className={inputClass()} value={specialties} onChange={(e) => setSpecialties(e.target.value)} placeholder="e.g. strength, fat loss" />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Years experience</label>
              <input className={inputClass()} value={yearsExperience} onChange={(e) => setYearsExperience(e.target.value)} inputMode="numeric" />
            </div>
          </section>
        )}

        {(role === 'gym' || role === 'trainer') && (
          <section className="glass-panel rounded-3xl p-6 md:p-8 border-white/10 space-y-4">
            <h2 className="text-lg font-black text-white">{role === 'gym' ? 'Business' : 'Business (optional)'}</h2>
            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Business name</label>
                <input className={inputClass()} value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Address</label>
                <textarea className={inputClass('min-h-[80px] resize-y')} value={businessAddress} onChange={(e) => setBusinessAddress(e.target.value)} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Phone</label>
                  <input className={inputClass()} value={businessPhone} onChange={(e) => setBusinessPhone(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Website</label>
                  <input className={inputClass()} value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} placeholder="https://..." />
                </div>
              </div>
            </div>
          </section>
        )}

        {role === 'gym' && (
          <section className="glass-panel rounded-3xl p-6 md:p-8 border-white/10 space-y-4">
            <h2 className="text-lg font-black text-white">Owner</h2>
            <p className="text-sm text-slate-500">
              Gym operations dashboards are under <strong className="text-white">Gym Dashboard</strong> in the sidebar. Fill business details here for your public listing later.
            </p>
          </section>
        )}

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
          {saving ? 'Saving…' : 'Save profile'}
        </motion.button>
      </form>
    </div>
  );
};
