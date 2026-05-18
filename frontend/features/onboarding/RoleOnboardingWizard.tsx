import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Logo } from '../../components/shared/Logo';
import { buttonPress, weightedTransition } from '../../lib/motion';
import { useAuthStore } from '../../store/useAuthStore';
import profileService from '../../services/profileService';
import type { UpdateProfileData } from '../../services/profileService';
import {
  answersFromOnboardingData,
  clearOnboardingBackup,
  saveOnboardingBackup,
  stepIndexFromOnboardingData,
  syncUserWithProfile,
} from '../../services/onboardingStorage';
import authService from '../../services/authService';

type FieldType = 'text' | 'date' | 'select' | 'textarea' | 'number';

interface Field {
  key: keyof UpdateProfileData;
  label: string;
  placeholder?: string;
  type: FieldType;
  options?: string[];
  unit?: string;
}

interface Step {
  title: string;
  subtitle: string;
  icon: string;
  fields: Field[];
}

const trainerSteps: Step[] = [
  {
    title: 'Your identity',
    subtitle: 'How clients will find and recognise you',
    icon: 'badge',
    fields: [
      { key: 'displayName', label: 'Full Name', placeholder: 'Your professional name', type: 'text' },
      { key: 'dateOfBirth', label: 'Date of Birth', type: 'date' },
      {
        key: 'gender',
        label: 'Gender',
        type: 'select',
        options: ['Male', 'Female', 'Non-binary', 'Prefer not to say'],
      },
    ],
  },
  {
    title: 'Your expertise',
    subtitle: 'Help athletes find the right coach',
    icon: 'military_tech',
    fields: [
      { key: 'bio', label: 'About You', placeholder: 'Describe your coaching style...', type: 'textarea' },
      { key: 'specialties', label: 'Specialties', placeholder: 'Strength, HIIT, Yoga...', type: 'textarea' },
      { key: 'yearsExperience', label: 'Years of Experience', placeholder: '5', type: 'number', unit: 'years' },
    ],
  },
];

const gymSteps: Step[] = [
  {
    title: 'Your gym identity',
    subtitle: 'How members will find your gym',
    icon: 'apartment',
    fields: [
      { key: 'displayName', label: 'Your Name', placeholder: 'Owner / manager name', type: 'text' },
      { key: 'businessName', label: 'Gym Name', placeholder: 'e.g. Iron Zone Fitness', type: 'text' },
    ],
  },
  {
    title: 'Business details',
    subtitle: 'Contact and location information',
    icon: 'location_on',
    fields: [
      { key: 'businessAddress', label: 'Address', placeholder: '123 Main St, Cairo', type: 'textarea' },
      { key: 'businessPhone', label: 'Phone Number', placeholder: '+20 100 000 0000', type: 'text' },
      { key: 'websiteUrl', label: 'Website (optional)', placeholder: 'https://yourgym.com', type: 'text' },
    ],
  },
];

export const RoleOnboardingWizard: React.FC = () => {
  const navigate = useNavigate();
  const { user, refreshUser } = useAuthStore();
  const role = user?.role ?? 'trainer';
  const steps = role === 'gym' ? gymSteps : trainerSteps;

  const [currentStep, setCurrentStep] = useState(0);
  const [form, setForm] = useState<Partial<UpdateProfileData>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const formRef = useRef(form);
  formRef.current = form;

  const step = steps[currentStep];
  const isLast = currentStep === steps.length - 1;

  useEffect(() => {
    const data = user?.profile?.onboardingData as Record<string, unknown> | undefined;
    if (!data || data.roleWizard !== role) return;
    setForm(answersFromOnboardingData(data) as Partial<UpdateProfileData>);
    const idx = stepIndexFromOnboardingData(data);
    if (idx !== null) setCurrentStep(Math.min(idx, steps.length - 1));
  }, [user?.profile?.onboardingData, role, steps.length]);

  const buildPayload = (stepIdx: number, completed = false) => ({
    ...formRef.current,
    onboardingData: {
      roleWizard: role,
      ...formRef.current,
      progressStepIndex: stepIdx,
      inProgress: !completed,
      ...(completed ? { completedAt: new Date().toISOString() } : {}),
      savedAt: new Date().toISOString(),
    },
  });

  const persistForm = async (stepIdx: number, completed = false) => {
    const result = await profileService.updateProfile(buildPayload(stepIdx, completed));
    if (result.data) {
      saveOnboardingBackup(
        { ...formRef.current, roleWizard: role } as Record<string, unknown>,
        stepIdx,
        result.data,
      );
      const u = authService.getStoredUser();
      if (u) syncUserWithProfile(u, result.data);
    }
    return result;
  };

  const scheduleSave = (stepIdx: number) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => void persistForm(stepIdx), 500);
  };

  const handleChange = (key: keyof UpdateProfileData, value: string | number) => {
    setForm(prev => {
      const next = { ...prev, [key]: value };
      formRef.current = next;
      scheduleSave(currentStep);
      return next;
    });
  };

  const handleNext = async () => {
    setError(null);
    if (saveTimer.current) clearTimeout(saveTimer.current);

    if (isLast) {
      setIsSaving(true);
      const result = await persistForm(currentStep, true);
      setIsSaving(false);
      if (result.error) {
        setError(result.error);
        return;
      }
      clearOnboardingBackup();
      await refreshUser();
      navigate('/dashboard');
    } else {
      const next = currentStep + 1;
      await persistForm(next);
      setCurrentStep(next);
    }
  };

  const renderField = (field: Field) => {
    const baseClass =
      'w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all font-bold text-white placeholder:text-slate-600';

    if (field.type === 'select' && field.options) {
      return (
        <select
          value={(form[field.key] as string) ?? ''}
          onChange={e => handleChange(field.key, e.target.value)}
          className={`${baseClass} appearance-none bg-surface`}
        >
          <option value="" disabled>
            Select {field.label}
          </option>
          {field.options.map(o => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      );
    }

    if (field.type === 'textarea') {
      return (
        <textarea
          rows={3}
          placeholder={field.placeholder}
          value={(form[field.key] as string) ?? ''}
          onChange={e => handleChange(field.key, e.target.value)}
          className={`${baseClass} resize-none`}
        />
      );
    }

    return (
      <div className="relative">
        <input
          type={field.type}
          placeholder={field.placeholder}
          value={(form[field.key] as string | number) ?? ''}
          onChange={e =>
            handleChange(
              field.key,
              field.type === 'number' ? parseFloat(e.target.value) || '' : e.target.value
            )
          }
          className={baseClass + (field.unit ? ' pr-16' : '')}
        />
        {field.unit && (
          <span className="absolute right-5 top-1/2 -translate-y-1/2 text-xs font-black text-slate-500 uppercase tracking-widest">
            {field.unit}
          </span>
        )}
      </div>
    );
  };

  return (
    <motion.div className="h-screen w-full flex flex-col items-center relative overflow-y-auto bg-background custom-scrollbar p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-lg relative z-10 my-auto py-10"
      >
        <motion.div className="text-center mb-8">
          <Logo size="md" className="mb-4 mx-auto" />
        </motion.div>

        <motion.div className="flex gap-2 mb-10">
          {steps.map((_, i) => (
            <motion.div
              key={i}
              className={`flex-1 h-1.5 rounded-full transition-all duration-500 ${
                i <= currentStep ? 'bg-primary' : 'bg-white/10'
              }`}
            />
          ))}
        </motion.div>

        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            transition={weightedTransition}
            className="glass-panel rounded-[2.5rem] p-10 space-y-8"
          >
            <motion.div className="flex items-center gap-5">
              <motion.div className="size-14 rounded-2xl bg-primary/20 border border-primary/30 flex items-center justify-center flex-shrink-0">
                <span className="material-symbols-outlined text-primary text-3xl">{step.icon}</span>
              </motion.div>
              <motion.div>
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-primary mb-1">
                  Step {currentStep + 1} of {steps.length}
                </p>
                <h2 className="text-2xl font-black text-white leading-tight">{step.title}</h2>
                <p className="text-slate-500 text-sm mt-1">{step.subtitle}</p>
              </motion.div>
            </motion.div>

            <motion.div className="space-y-5">
              {step.fields.map(field => (
                <motion.div key={field.key} className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-2">
                    {field.label}
                  </label>
                  {renderField(field)}
                </motion.div>
              ))}
            </motion.div>

            {error && (
              <motion.div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
                {error}
              </motion.div>
            )}

            <motion.div className="flex gap-3 pt-2">
              {currentStep > 0 && (
                <button
                  type="button"
                  onClick={() => setCurrentStep(s => s - 1)}
                  className="flex-1 bg-white/5 border border-white/10 text-white font-bold py-4 rounded-xl hover:bg-white/10 transition-all"
                >
                  Back
                </button>
              )}
              <motion.button
                variants={buttonPress}
                whileHover="hover"
                whileTap="tap"
                onClick={handleNext}
                disabled={isSaving}
                className="flex-1 bg-primary text-white font-black py-4 rounded-xl shadow-lg shadow-primary/30 disabled:opacity-50"
              >
                {isSaving ? 'Saving...' : isLast ? 'Launch Dashboard' : 'Continue'}
              </motion.button>
            </motion.div>

            <motion.div className="text-center pt-1">
              <button
                type="button"
                onClick={() => navigate('/dashboard')}
                className="text-xs text-slate-600 hover:text-slate-400 font-bold"
              >
                Skip for now
              </button>
            </motion.div>
          </motion.div>
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
};
