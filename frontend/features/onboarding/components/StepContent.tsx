import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import type { OnboardingAnswers, OnboardingStep } from '../types';
import { mapAnswersToProfile } from '../mapToProfile';
import { OnboardingHero3D } from './OnboardingHero3D';
import { OptionCard } from './OptionCard';

interface StepContentProps {
  step: OnboardingStep;
  answers: OnboardingAnswers;
  onAnswer: (stepId: string, value: string | string[] | number | boolean) => void;
  onContinue: () => void;
}

export const StepContent: React.FC<StepContentProps> = ({
  step,
  answers,
  onAnswer,
  onContinue,
}) => {
  const [localMulti, setLocalMulti] = useState<string[]>([]);
  const [likert, setLikert] = useState<number | null>(null);
  const [consent, setConsent] = useState(false);
  const [genProgress, setGenProgress] = useState({ goals: 0, activity: 0, motivation: 0 });
  const [textVal, setTextVal] = useState('');
  const [numVal, setNumVal] = useState('');
  const [optionalWeight, setOptionalWeight] = useState('');
  const [sliderIdx, setSliderIdx] = useState(2);

  useEffect(() => {
    setLocalMulti([]);
    setLikert(null);
    setConsent(false);
    setTextVal(String(answers[step.id] ?? answers.displayName ?? ''));
    setNumVal(String(answers[step.id] ?? ''));
    setOptionalWeight('');
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

  const titleBlock = (
    <>
      <h1 className="text-2xl md:text-3xl font-black leading-tight mb-2 tracking-tight">{step.title}</h1>
      {'subtitle' in step && step.subtitle && (
        <p className="text-slate-400 text-sm mb-6">{step.subtitle}</p>
      )}
    </>
  );

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
        <p className="text-slate-400 leading-relaxed">{step.body}</p>
        <ContinueBar
          label={step.cta ?? 'Continue'}
          onClick={() => {
            onAnswer(step.id, 'started');
            onContinue();
          }}
          inline
        />
      </motion.div>
    );
  }

  if (step.type === 'single') {
    return (
      <motion.div key={step.id} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} className="space-y-3 pb-28">
        {titleBlock}
        {step.options.map(opt => (
          <OptionCard
            key={opt.value}
            opt={opt}
            selected={answers[step.id] === opt.value}
            onSelect={() => {
              onAnswer(step.id, opt.value);
              if (step.autoAdvance !== false) setTimeout(onContinue, 320);
            }}
          />
        ))}
      </motion.div>
    );
  }

  if (step.type === 'multi') {
    const toggle = (v: string) => {
      setLocalMulti(prev => {
        if (prev.includes(v)) return prev.filter(x => x !== v);
        if (step.maxSelect && prev.length >= step.maxSelect) return prev;
        return [...prev, v];
      });
    };
    const selected = (answers[step.id] as string[]) ?? localMulti;
    const list = Array.isArray(selected) && selected.length ? selected : localMulti;

    return (
      <motion.div key={step.id} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} className="space-y-3 pb-28">
        {titleBlock}
        {step.options.map(opt => (
          <OptionCard
            key={opt.value}
            opt={opt}
            layout="row"
            selected={list.includes(opt.value)}
            onSelect={() => toggle(opt.value)}
            trailing={
              <span
                className={`size-6 rounded-lg border flex-shrink-0 flex items-center justify-center ${
                  list.includes(opt.value) ? 'bg-primary border-primary' : 'border-slate-600 bg-background/50'
                }`}
              >
                {list.includes(opt.value) && (
                  <span className="material-symbols-outlined text-white text-sm">check</span>
                )}
              </span>
            }
          />
        ))}
        <ContinueBar
          disabled={list.length === 0}
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
      <motion.div key={step.id} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} className="pb-24">
        {titleBlock}
        <blockquote className="border-l-4 border-primary pl-4 py-2 mb-8 text-slate-300 italic">
          &ldquo;{step.statement}&rdquo;
        </blockquote>
        <div className="flex gap-2 justify-between mb-2">
          {[1, 2, 3, 4, 5].map(n => (
            <button
              key={n}
              type="button"
              onClick={() => setLikert(n)}
              className={`flex-1 aspect-[0.95] rounded-xl font-black text-lg border ${
                likert === n ? 'bg-primary border-primary text-white' : 'bg-surface border-border'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
        <div className="flex justify-between text-xs text-slate-500 mb-8">
          <span>Not at all</span>
          <span>Completely</span>
        </div>
        <ContinueBar
          disabled={likert === null}
          onClick={() => {
            onAnswer(step.id, String(likert));
            onContinue();
          }}
        />
      </motion.div>
    );
  }

  if (step.type === 'info') {
    return (
      <motion.div key={step.id} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} className="pb-8">
        {titleBlock}
        <p className="text-slate-400 mb-8">{step.body}</p>
        <div className="h-40 rounded-2xl bg-gradient-to-br from-primary/30 to-accent/20 border border-border mb-8 flex items-end p-4">
          <div className="w-full h-24 flex items-end gap-1">
            {[40, 55, 70, 85, 100].map((h, i) => (
              <div key={i} className="flex-1 bg-primary rounded-t" style={{ height: `${h}%` }} />
            ))}
          </div>
        </div>
        <ContinueBar label={step.cta ?? 'Continue'} onClick={onContinue} />
      </motion.div>
    );
  }

  if (step.type === 'number') {
    const canContinue =
      numVal.length > 0 && (!step.requireConsent || consent);
    return (
      <motion.div key={step.id} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} className="pb-24">
        {titleBlock}
        <motion.div layout className="relative mb-4">
          <input
            type="number"
            value={numVal}
            onChange={e => setNumVal(e.target.value)}
            placeholder={step.placeholder}
            min={step.min}
            max={step.max}
            className="w-full bg-surface border border-border rounded-2xl px-5 py-4 text-lg font-bold focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
          {step.unit && (
            <span className="absolute right-5 top-1/2 -translate-y-1/2 text-xs font-black text-slate-500 uppercase">
              {step.unit}
            </span>
          )}
        </motion.div>
        {step.requireConsent && (
          <label className="flex gap-3 items-start text-sm text-slate-400 mb-6 cursor-pointer">
            <input
              type="checkbox"
              checked={consent}
              onChange={e => setConsent(e.target.checked)}
              className="mt-1 accent-primary"
            />
            <span>
              You consent to processing health data for Taqwin services. See our privacy policy.
            </span>
          </label>
        )}
        <ContinueBar
          disabled={!canContinue}
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
    return (
      <motion.div key={step.id} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} className="pb-24">
        {titleBlock}
        <p className="text-center text-2xl font-black text-primary mb-6">{level?.label}</p>
        <input
          type="range"
          min={0}
          max={step.levels.length - 1}
          value={sliderIdx}
          onChange={e => setSliderIdx(Number(e.target.value))}
          className="w-full accent-primary mb-8"
        />
        <ContinueBar
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
      <motion.div key={step.id} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} className="pb-24">
        {titleBlock}
        <input
          type="number"
          value={optionalWeight}
          onChange={e => setOptionalWeight(e.target.value)}
          placeholder="70"
          className="w-full bg-surface border border-border rounded-2xl px-5 py-4 text-lg font-bold mb-4"
        />
        <button
          type="button"
          onClick={() => {
            onAnswer(step.field, 'unknown');
            onContinue();
          }}
          className="w-full py-3 text-slate-400 font-bold mb-4"
        >
          I don&apos;t know
        </button>
        <ContinueBar
          disabled={!optionalWeight}
          onClick={() => {
            onAnswer(step.field, Number(optionalWeight));
            onContinue();
          }}
        />
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
      <motion.div key={step.id} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} className="pb-8">
        {titleBlock}
        <div className="glass-panel rounded-2xl p-6 space-y-4 mb-8">
          <Row label="Goal" value={mapped.fitnessGoal ?? '—'} />
          <Row label="Level" value={mapped.fitnessLevel ?? '—'} />
          <Row label="BMI" value={String(bmi)} />
          <Row label="Lifestyle" value="Active" />
        </div>
        <ContinueBar onClick={onContinue} />
      </motion.div>
    );
  }

  if (step.type === 'generating') {
    const bars = [
      { label: 'Goals and preferences', pct: genProgress.goals },
      { label: 'Activity level', pct: genProgress.activity },
      { label: 'Motivation', pct: genProgress.motivation },
    ];
    return (
      <motion.div key={step.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="pb-8">
        <h1 className="text-2xl font-black mb-8 text-center">{step.title}</h1>
        <div className="space-y-5">
          {bars.map(b => (
            <div key={b.label}>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-slate-400">{b.label}</span>
                <span className="text-primary font-bold">{b.pct}%</span>
              </div>
              <div className="h-2 bg-border rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-primary"
                  initial={{ width: 0 }}
                  animate={{ width: `${b.pct}%` }}
                  transition={{ duration: 0.5 }}
                />
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    );
  }

  if (step.type === 'text') {
    const min = step.minLength ?? 2;
    const max = step.maxLength ?? 40;
    const ok = textVal.trim().length >= min && textVal.trim().length <= max;
    return (
      <motion.div key={step.id} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} className="pb-24">
        {titleBlock}
        <input
          type="text"
          value={textVal}
          onChange={e => setTextVal(e.target.value)}
          placeholder={step.placeholder}
          maxLength={max}
          className="w-full bg-surface border border-border rounded-2xl px-5 py-4 text-lg font-bold mb-2"
        />
        <p className="text-xs text-slate-500 mb-6">
          {min}–{max} characters
        </p>
        <ContinueBar
          disabled={!ok}
          label="Finish"
          onClick={() => {
            onAnswer(step.field, textVal.trim());
            onContinue();
          }}
        />
      </motion.div>
    );
  }

  return null;
};

const Row: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="flex justify-between text-sm">
    <span className="text-slate-500">{label}</span>
    <span className="font-bold">{value}</span>
  </div>
);

const ContinueBar: React.FC<{
  onClick: () => void;
  disabled?: boolean;
  label?: string;
  inline?: boolean;
}> = ({ onClick, disabled, label = 'Continue', inline }) => {
  const btn = (
    <motion.button
      type="button"
      disabled={disabled}
      onClick={onClick}
      whileHover={disabled ? undefined : { scale: 1.02 }}
      whileTap={disabled ? undefined : { scale: 0.98 }}
      className="w-full bg-gradient-to-r from-primary to-primary/80 text-white font-black py-4 rounded-2xl disabled:opacity-40 shadow-lg shadow-primary/30 border border-primary/30"
    >
      {label}
    </motion.button>
  );
  if (inline) return <div className="pt-2">{btn}</div>;
  return (
    <motion.div className="fixed bottom-20 left-0 right-0 z-20 px-4 md:px-6 pointer-events-none max-w-xl mx-auto">
      <div className="pointer-events-auto bg-gradient-to-t from-background via-background/95 to-transparent pt-6 pb-2">
        {btn}
      </div>
    </motion.div>
  );
};
