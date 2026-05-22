import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useI18n } from '../../../lib/i18n/useI18n';
import type { OnboardingAnswers, OnboardingStep } from '../types';
import { mapAnswersToProfile } from '../mapToProfile';
import { OnboardingHero3D } from './OnboardingHero3D';
import { OptionCard } from './OptionCard';
import { TestimonialsPanel } from './TestimonialsPanel';
import { ASSETS } from '../onboardingAssets';

export type StepPresentationMode = 'hero' | 'card' | 'chat';

interface StepContentProps {
  step: OnboardingStep;
  answers: OnboardingAnswers;
  mode: StepPresentationMode;
  onAnswer: (stepId: string, value: string | string[] | number | boolean) => void;
  onContinue: () => void;
}

export const StepContent: React.FC<StepContentProps> = ({
  step,
  answers,
  mode,
  onAnswer,
  onContinue,
}) => {
  const { t } = useI18n();
  const continueLabel = t('common.continue');
  const [localMulti, setLocalMulti] = useState<string[]>([]);
  const [likert, setLikert] = useState<number | null>(null);
  const [consent, setConsent] = useState(false);
  const [genProgress, setGenProgress] = useState({ goals: 0, activity: 0, motivation: 0 });
  const [textVal, setTextVal] = useState('');
  const [numVal, setNumVal] = useState('');
  const [optionalWeight, setOptionalWeight] = useState('');
  const [sliderIdx, setSliderIdx] = useState(2);

  const isCard = mode === 'card';
  const isChat = mode === 'chat';

  useEffect(() => {
    setLocalMulti([]);
    setLikert(null);
    setConsent(false);
    if (step.type === 'text') {
      setTextVal(String(answers[step.field] ?? answers[step.id] ?? ''));
    } else {
      setTextVal('');
    }
    setNumVal(String(answers[step.id] ?? (step.type === 'number' ? answers[step.field] : '') ?? ''));
    setOptionalWeight(
      step.type === 'weightOptional'
        ? String(answers[step.field] ?? answers[step.id] ?? '')
        : '',
    );
    if (step.type === 'slider') {
      const idx = step.levels.findIndex(l => l.value === answers.bodyFat);
      setSliderIdx(idx >= 0 ? idx : 2);
    }
  }, [step.id, step.type]);

  useEffect(() => {
    if (step.type !== 'generating') return;
    const t1 = setTimeout(() => setGenProgress(p => ({ ...p, goals: 100 })), 400);
    const t2 = setTimeout(() => setGenProgress(p => ({ ...p, activity: 100 })), 1200);
    const t3 = setTimeout(() => setGenProgress(p => ({ ...p, motivation: 100 })), 2000);
    const t4 = setTimeout(onContinue, 2800);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
    };
  }, [step.type, onContinue]);

  const encouragement =
    'encouragement' in step && step.encouragement ? (
      <p className="text-sm text-primary/90 font-medium mb-4 text-center">{step.encouragement}</p>
    ) : null;

  const titleBlock = !isChat && (
    <>
      <h1
        className={`font-black leading-tight tracking-tight mb-2 ${
          isCard ? 'text-2xl sm:text-3xl text-center' : 'text-2xl md:text-3xl'
        }`}
      >
        {step.title}
      </h1>
      {'subtitle' in step && step.subtitle && (
        <p className={`text-muted text-sm mb-6 ${isCard ? 'text-center' : ''}`}>{step.subtitle}</p>
      )}
    </>
  );

  const useVisualGrid = (s: { visualOptions?: boolean; optionsLayout?: string }) =>
    s.visualOptions || s.optionsLayout === 'row';

  if (step.type === 'hero') {
    return (
      <motion.div
        key={step.id}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="pb-28 space-y-6"
      >
        <OnboardingHero3D className="h-48 w-full" />
        {titleBlock}
        <p className="text-muted leading-relaxed">{step.body}</p>
        <ContinueBar
          label={step.cta ?? continueLabel}
          onClick={() => {
            onAnswer(step.id, 'started');
            onContinue();
          }}
          inline
          chat={false}
        />
      </motion.div>
    );
  }

  if (step.type === 'single') {
    const grid = useVisualGrid(step);
    const row = step.optionsLayout === 'row';
    const photoRow = isChat && row && step.options.some(o => o.imageVariant === 'photo');
    return (
      <motion.div
        key={step.id}
        initial={{ opacity: 0, y: isCard ? 12 : 0 }}
        animate={{ opacity: 1, y: 0 }}
        className={isChat ? 'space-y-3' : 'pb-28'}
      >
        {titleBlock}
        {encouragement}
        <motion.div
          className={
            photoRow
              ? 'flex flex-wrap gap-2 justify-center'
              : row
                ? isChat
                  ? 'flex flex-wrap gap-2 justify-center'
                  : 'grid grid-cols-2 gap-3 sm:gap-4'
                : grid
                  ? isChat
                    ? 'flex flex-wrap gap-2 justify-center'
                    : 'grid grid-cols-1 sm:grid-cols-2 gap-3'
                  : isChat
                    ? 'space-y-2'
                    : 'space-y-3'
          }
        >
          {step.options.map(opt => (
            <OptionCard
              key={opt.value}
              opt={opt}
              variant={isChat ? 'chat' : 'default'}
              cardLayout={row || grid || photoRow ? 'grid' : 'default'}
              layout="stack"
              selected={answers[step.id] === opt.value}
              onSelect={() => {
                onAnswer(step.id, opt.value);
                if (step.autoAdvance !== false) setTimeout(onContinue, 320);
              }}
            />
          ))}
        </motion.div>
      </motion.div>
    );
  }

  if (step.type === 'multi') {
    const toggle = (v: string) => {
      setLocalMulti(prev => {
        if (step.id === 'injuries' && v === 'none') {
          return prev.includes('none') ? [] : ['none'];
        }
        if (step.id === 'injuries') {
          const base = prev.filter(x => x !== 'none');
          if (base.includes(v)) return base.filter(x => x !== v);
          return [...base, v];
        }
        if (prev.includes(v)) return prev.filter(x => x !== v);
        if (step.maxSelect && prev.length >= step.maxSelect) return prev;
        return [...prev, v];
      });
    };
    const selected = (answers[step.id] as string[]) ?? localMulti;
    const list = Array.isArray(selected) && selected.length ? selected : localMulti;
    const visual = step.visualOptions;

    return (
      <motion.div
        key={step.id}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className={isChat ? 'space-y-3' : 'space-y-3 pb-28'}
      >
        {titleBlock}
        {encouragement}
        <motion.div
          className={
            visual
              ? `flex flex-wrap gap-2 justify-center ${isChat ? 'max-h-[min(46vh,380px)] overflow-y-auto overscroll-contain pr-0.5 custom-scrollbar' : 'grid grid-cols-2 gap-2.5 sm:gap-3'}`
              : `space-y-2 ${isChat ? 'max-h-[min(46vh,380px)] overflow-y-auto overscroll-contain custom-scrollbar' : ''}`
          }
        >
          {step.options.map(opt => (
            <OptionCard
              key={opt.value}
              opt={opt}
              variant={isChat ? 'chat' : 'default'}
              cardLayout={visual ? 'grid' : 'default'}
              layout={visual ? 'stack' : 'row'}
              selected={list.includes(opt.value)}
              onSelect={() => toggle(opt.value)}
              trailing={
                !visual && !isChat ? (
                  <span
                    className={`size-6 rounded-lg border flex-shrink-0 flex items-center justify-center ${
                      list.includes(opt.value) ? 'bg-primary border-primary' : 'border-subtle bg-background/50'
                    }`}
                  >
                    {list.includes(opt.value) && (
                      <span className="material-symbols-outlined text-foreground text-sm">check</span>
                    )}
                  </span>
                ) : undefined
              }
            />
          ))}
        </motion.div>
        <ContinueBar
          disabled={list.length === 0}
          chat={isChat}
          onClick={() => {
            onAnswer(step.id, list);
            onContinue();
          }}
        />
      </motion.div>
    );
  }

  if (step.type === 'likert') {
    return (
      <motion.div key={step.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={isChat ? '' : 'pb-24'}>
        {!isChat && titleBlock}
        {isChat && (
          <p className="text-sm text-muted italic mb-4 border-s-2 border-primary/40 ps-3">
            &ldquo;{step.statement}&rdquo;
          </p>
        )}
        <div className="flex gap-2 justify-between mb-2">
          {[1, 2, 3, 4, 5].map(n => (
            <button
              key={n}
              type="button"
              onClick={() => setLikert(n)}
              className={`flex-1 aspect-[0.95] rounded-xl font-black text-lg border transition-colors ${
                likert === n ? 'bg-primary border-primary text-white shadow-lg shadow-primary/25' : 'bg-surface border-subtle hover:border-primary/30'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
        <div className="flex justify-between text-xs text-faint mb-4">
          <span>{t('onboarding.likert.low')}</span>
          <span>{t('onboarding.likert.high')}</span>
        </div>
        <ContinueBar
          disabled={likert === null}
          chat={isChat}
          onClick={() => {
            onAnswer(step.id, String(likert));
            onContinue();
          }}
        />
      </motion.div>
    );
  }

  if (step.type === 'info') {
    if (step.variant === 'testimonials') {
      return (
        <motion.div key={step.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          {!isChat && titleBlock}
          {isChat && <p className="text-sm font-bold text-center mb-2">{step.title}</p>}
          <TestimonialsPanel />
          <p className="text-xs text-muted text-center px-2">{step.body}</p>
          <ContinueBar label={step.cta ?? continueLabel} chat={isChat} onClick={onContinue} />
        </motion.div>
      );
    }
    return (
      <motion.div key={step.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={isChat ? 'space-y-4' : 'pb-8'}>
        {titleBlock}
        <p className="text-muted mb-6">{step.body}</p>
        <div className="relative h-36 rounded-2xl bg-gradient-to-br from-primary/25 to-accent/15 border border-subtle mb-6 flex items-end p-4 overflow-hidden">
          <img src={ASSETS.heroStrength} alt="" className="absolute inset-0 w-full h-full object-cover opacity-30" />
          <div className="relative w-full h-20 flex items-end gap-1">
            {[40, 55, 70, 85, 100].map((h, i) => (
              <motion.div
                key={i}
                initial={{ height: 0 }}
                animate={{ height: `${h}%` }}
                className="flex-1 bg-primary rounded-t"
              />
            ))}
          </div>
        </div>
        <ContinueBar label={step.cta ?? continueLabel} chat={isChat} onClick={onContinue} />
      </motion.div>
    );
  }

  if (step.type === 'number') {
    const canContinue = numVal.length > 0 && (!step.requireConsent || consent);
    return (
      <motion.div key={step.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={isChat ? '' : 'pb-24'}>
        {!isChat && titleBlock}
        {encouragement}
        <div className="relative mb-4">
          <input
            type="number"
            value={numVal}
            onChange={e => setNumVal(e.target.value)}
            placeholder={step.placeholder}
            min={step.min}
            max={step.max}
            className="w-full bg-surface border border-subtle rounded-2xl px-5 py-4 text-lg font-bold focus:outline-none focus:ring-2 focus:ring-primary/40 text-center sm:text-start"
          />
          {step.unit && (
            <span className="absolute end-5 top-1/2 -translate-y-1/2 text-xs font-black text-faint uppercase">
              {step.unit}
            </span>
          )}
        </div>
        {step.requireConsent && (
          <label className="flex gap-3 items-start text-sm text-muted mb-4 cursor-pointer">
            <input
              type="checkbox"
              checked={consent}
              onChange={e => setConsent(e.target.checked)}
              className="mt-1 accent-primary"
            />
            <span>{t('onboarding.healthConsent')}</span>
          </label>
        )}
        <ContinueBar
          disabled={!canContinue}
          chat={isChat}
          onClick={() => {
            onAnswer(step.id, Number(numVal));
            onContinue();
          }}
        />
      </motion.div>
    );
  }

  if (step.type === 'slider') {
    const level = step.levels[sliderIdx];
    const img = level?.imageUrl ?? ASSETS.default;
    return (
      <motion.div key={step.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={isChat ? 'space-y-4' : 'pb-24'}>
        {!isChat && titleBlock}
        {encouragement}
        <div className="relative rounded-2xl overflow-hidden border border-subtle bg-surface aspect-[4/3] max-h-52 mx-auto mb-4">
          <img src={img} alt="" className="w-full h-full object-contain p-4" />
          <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-background to-transparent" />
          <p className="absolute bottom-3 inset-x-0 text-center text-2xl font-black text-primary">{level?.label}</p>
        </div>
        <input
          type="range"
          min={0}
          max={step.levels.length - 1}
          value={sliderIdx}
          onChange={e => setSliderIdx(Number(e.target.value))}
          className="w-full accent-primary mb-4 h-2"
        />
        <div className="flex justify-between text-[10px] text-faint px-1 mb-2">
          <span>{step.levels[0]?.label}</span>
          <span>{step.levels[step.levels.length - 1]?.label}</span>
        </div>
        <ContinueBar
          chat={isChat}
          onClick={() => {
            onAnswer(step.field, level.value);
            onContinue();
          }}
        />
      </motion.div>
    );
  }

  if (step.type === 'weightOptional') {
    return (
      <motion.div key={step.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={isChat ? '' : 'pb-24'}>
        {!isChat && titleBlock}
        <input
          type="number"
          value={optionalWeight}
          onChange={e => setOptionalWeight(e.target.value)}
          placeholder="70"
          className="w-full bg-surface border border-subtle rounded-2xl px-5 py-4 text-lg font-bold mb-3"
        />
        <button
          type="button"
          onClick={() => {
            onAnswer(step.field, 'unknown');
            onContinue();
          }}
          className="w-full py-3 text-muted font-bold mb-3 rounded-xl border border-subtle hover:bg-surface"
        >
          {t('onboarding.unknown')}
        </button>
        <ContinueBar
          disabled={!optionalWeight}
          chat={isChat}
          onClick={() => {
            onAnswer(step.field, Number(optionalWeight));
            onContinue();
          }}
        />
      </motion.div>
    );
  }

  if (step.type === 'measurements') {
    const chest = String(answers.measureChest ?? '');
    const waist = String(answers.measureWaist ?? '');
    const hips = String(answers.measureHips ?? '');
    return (
      <motion.div key={step.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={isChat ? 'space-y-3' : 'pb-24'}>
        {!isChat && titleBlock}
        <div className="grid grid-cols-2 gap-3">
          {(
            [
              ['measureChest', 'Chest (cm)', chest],
              ['measureWaist', 'Waist (cm)', waist],
              ['measureHips', 'Hips (cm)', hips],
              ['measureArm', 'Arm (cm)', String(answers.measureArm ?? '')],
            ] as const
          ).map(([key, label, val]) => (
            <label key={key} className="block">
              <span className="text-[10px] font-bold text-faint uppercase tracking-wider">{label}</span>
              <input
                type="number"
                value={val}
                onChange={(e) => onAnswer(key, e.target.value)}
                className="mt-1 w-full bg-surface border border-subtle rounded-xl px-3 py-2.5 font-bold"
                placeholder="—"
              />
            </label>
          ))}
        </div>
        <ContinueBar chat={isChat} onClick={() => onContinue()} />
      </motion.div>
    );
  }

  if (step.type === 'inbody') {
    const bf = String(answers.inbodyBodyFat ?? '');
    const muscle = String(answers.inbodyMuscle ?? '');
    const bmr = String(answers.inbodyBmr ?? '');
    const done = answers.inbodyAcknowledged === true || answers.inbodyAcknowledged === 'true';
    const hasData = bf.trim() || muscle.trim() || bmr.trim();
    const canContinue = done || hasData;
    return (
      <motion.div key={step.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={isChat ? 'space-y-3' : 'pb-24'}>
        {!isChat && titleBlock}
        <div className="space-y-3">
          <input
            type="text"
            value={bf}
            onChange={(e) => onAnswer('inbodyBodyFat', e.target.value)}
            placeholder="Body fat %"
            className="w-full bg-surface border border-subtle rounded-2xl px-4 py-3 font-bold"
          />
          <input
            type="text"
            value={muscle}
            onChange={(e) => onAnswer('inbodyMuscle', e.target.value)}
            placeholder="Muscle mass (kg)"
            className="w-full bg-surface border border-subtle rounded-2xl px-4 py-3 font-bold"
          />
          <input
            type="text"
            value={bmr}
            onChange={(e) => onAnswer('inbodyBmr', e.target.value)}
            placeholder="BMR (kcal)"
            className="w-full bg-surface border border-subtle rounded-2xl px-4 py-3 font-bold"
          />
          <label className="flex items-center gap-2 text-sm text-muted cursor-pointer">
            <input
              type="checkbox"
              checked={Boolean(done)}
              onChange={(e) => onAnswer('inbodyAcknowledged', e.target.checked)}
              className="size-4 rounded border-subtle"
            />
            {t('onboarding.inbody.confirm')}
          </label>
        </div>
        <ContinueBar disabled={!canContinue} chat={isChat} onClick={onContinue} />
      </motion.div>
    );
  }

  if (step.type === 'photos') {
    const front = Boolean(answers.photoFrontDone);
    const back = Boolean(answers.photoBackDone);
    const canContinue = front && back;
    return (
      <motion.div key={step.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={isChat ? 'space-y-3' : 'pb-24'}>
        {!isChat && titleBlock}
        <div className="space-y-4">
          <label className="flex items-center gap-3 p-4 rounded-2xl border border-subtle bg-surface/60 cursor-pointer">
            <input
              type="checkbox"
              checked={front}
              onChange={(e) => onAnswer('photoFrontDone', e.target.checked)}
              className="size-5"
            />
            <span className="font-bold">{t('onboarding.photos.front')}</span>
          </label>
          <label className="flex items-center gap-3 p-4 rounded-2xl border border-subtle bg-surface/60 cursor-pointer">
            <input
              type="checkbox"
              checked={back}
              onChange={(e) => onAnswer('photoBackDone', e.target.checked)}
              className="size-5"
            />
            <span className="font-bold">{t('onboarding.photos.back')}</span>
          </label>
        </div>
        <ContinueBar disabled={!canContinue} chat={isChat} onClick={onContinue} />
      </motion.div>
    );
  }

  if (step.type === 'summary') {
    const mapped = mapAnswersToProfile(answers);
    const bmi =
      mapped.height && mapped.weight
        ? (mapped.weight / ((mapped.height / 100) ** 2)).toFixed(1)
        : '—';
    return (
      <motion.div key={step.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={isChat ? 'space-y-4' : 'pb-8'}>
        {titleBlock}
        <div className="glass-panel rounded-2xl p-6 space-y-4 border border-subtle">
          <Row label={t('onboarding.summary.goal')} value={mapped.fitnessGoal ?? '—'} />
          <Row label={t('onboarding.summary.level')} value={mapped.fitnessLevel ?? '—'} />
          <Row label="BMI" value={String(bmi)} />
        </div>
        <ContinueBar chat={isChat} onClick={onContinue} />
      </motion.div>
    );
  }

  if (step.type === 'generating') {
    const bars = [
      { label: t('onboarding.planCheck.analysis'), pct: genProgress.goals },
      { label: t('onboarding.planCheck.calories'), pct: genProgress.activity },
      { label: t('onboarding.planCheck.workouts'), pct: genProgress.motivation },
    ];
    return (
      <motion.div key={step.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-4">
        <h1 className="text-xl font-black mb-6 text-center">{step.title}</h1>
        <div className="space-y-4">
          {bars.map(b => (
            <motion.div key={b.label}>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-muted">{b.label}</span>
                <span className="text-primary font-bold">{b.pct}%</span>
              </div>
              <div className="h-2 bg-border rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-primary to-accent"
                  initial={{ width: 0 }}
                  animate={{ width: `${b.pct}%` }}
                  transition={{ duration: 0.5 }}
                />
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>
    );
  }

  if (step.type === 'text') {
    const min = step.minLength ?? 0;
    const max = step.maxLength ?? 500;
    const ok = textVal.trim().length >= min && textVal.trim().length <= max;
    return (
      <motion.div key={step.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={isChat ? '' : 'pb-24'}>
        {!isChat && titleBlock}
        <div className="flex gap-2">
          <input
            type={step.inputType ?? 'text'}
            value={textVal}
            onChange={e => setTextVal(e.target.value)}
            placeholder={step.placeholder}
            maxLength={max}
            autoComplete={step.field === 'phone' ? 'tel' : step.field === 'displayName' ? 'name' : 'street-address'}
            className="flex-1 bg-surface border border-subtle rounded-2xl px-4 py-3.5 text-base font-bold focus:outline-none focus:ring-2 focus:ring-primary/40"
            onKeyDown={e => {
              if (e.key === 'Enter' && ok) {
                onAnswer(step.field, textVal.trim());
                onContinue();
              }
            }}
          />
          <motion.button
            type="button"
            disabled={!ok}
            onClick={() => {
              onAnswer(step.field, textVal.trim());
              onContinue();
            }}
            whileTap={ok ? { scale: 0.96 } : undefined}
            className="flex-shrink-0 px-5 rounded-2xl bg-primary text-white font-black disabled:opacity-40"
          >
            {t('onboarding.send')}
          </motion.button>
        </div>
      </motion.div>
    );
  }

  return null;
};

const Row: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="flex justify-between text-sm gap-4">
    <span className="text-faint">{label}</span>
    <span className="font-bold text-end">{value}</span>
  </div>
);

const ContinueBar: React.FC<{
  onClick: () => void;
  disabled?: boolean;
  label?: string;
  inline?: boolean;
  chat?: boolean;
}> = ({ onClick, disabled, label, inline, chat }) => {
  const { t } = useI18n();
  const text = label ?? t('common.continue');
  const btn = (
    <motion.button
      type="button"
      disabled={disabled}
      onClick={onClick}
      whileHover={disabled ? undefined : { scale: 1.02 }}
      whileTap={disabled ? undefined : { scale: 0.98 }}
      className="w-full bg-gradient-to-r from-primary to-primary/80 text-white font-black py-4 rounded-2xl disabled:opacity-40 shadow-lg shadow-primary/25 border border-primary/30"
    >
      {text}
    </motion.button>
  );
  if (inline) return <div className="pt-2">{btn}</div>;
  if (chat) return <div className="pt-1">{btn}</div>;
  return (
    <motion.div className="fixed bottom-20 left-0 right-0 z-20 px-4 md:px-6 pointer-events-none max-w-xl mx-auto">
      <div className="pointer-events-auto bg-gradient-to-t from-background via-background/95 to-transparent pt-6 pb-2">
        {btn}
      </div>
    </motion.div>
  );
};
