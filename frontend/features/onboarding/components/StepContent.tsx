import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useI18n } from '../../../lib/i18n/useI18n';
import type { OnboardingAnswers, OnboardingStep, CatalogPickItem } from '../types';
import { mapAnswersToProfile } from '../mapToProfile';
import { OnboardingHero3D } from './OnboardingHero3D';
import { OptionCard } from './OptionCard';
import { TestimonialsPanel } from './TestimonialsPanel';
import { CatalogPickerStep } from './CatalogPickerStep';
import { GymPickerStep } from './GymPickerStep';
import { MealsSnacksStep } from './MealsSnacksStep';
import { ProgressPhotoUpload } from './ProgressPhotoUpload';
import { ASSETS } from '../onboardingAssets';

/** liftExperience: new vs comfortable are mutually exclusive per lift. */
const LIFT_EXPERIENCE_OPPOSITE: Record<string, string> = {
  deadlift_new: 'deadlift_ok',
  deadlift_ok: 'deadlift_new',
  squat_new: 'squat_ok',
  squat_ok: 'squat_new',
  bench_new: 'bench_ok',
  bench_ok: 'bench_new',
};

export type StepPresentationMode = 'hero' | 'card' | 'chat';

type StepAnswerValue = string | string[] | number | boolean | CatalogPickItem[];

interface StepContentProps {
  step: OnboardingStep;
  answers: OnboardingAnswers;
  mode: StepPresentationMode;
  onAnswer: (stepId: string, value: StepAnswerValue) => void;
  onContinue: (pending?: OnboardingAnswers) => void;
  /** Inline dossier edit: hide Continue UI; parent Save button persists answers */
  hideContinue?: boolean;
}

export const StepContent: React.FC<StepContentProps> = ({
  step,
  answers,
  mode,
  onAnswer,
  onContinue,
  hideContinue = false,
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
    if (step.type === 'multi') {
      const saved = answers[step.id];
      setLocalMulti(Array.isArray(saved) ? (saved as string[]) : []);
      if (step.id === 'otherSports') {
        setTextVal(String(answers.otherSportsOther ?? ''));
      } else if (step.id === 'foodAllergies') {
        setTextVal(String(answers.foodAllergiesOther ?? ''));
      } else {
        setTextVal('');
      }
    } else {
      setLocalMulti([]);
    }
    setLikert(null);
    setConsent(false);
    if (step.type === 'text') {
      setTextVal(String(answers[step.field] ?? answers[step.id] ?? ''));
    } else if (step.type === 'single' && step.followUp) {
      setTextVal(String(answers[step.followUp.field] ?? ''));
    } else if (step.type !== 'multi' || (step.id !== 'otherSports' && step.id !== 'foodAllergies')) {
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
      <p className={`text-sm text-primary/90 font-medium text-center ${isCard ? 'mb-2' : 'mb-4'}`}>
        {step.encouragement}
      </p>
    ) : null;

  const titleBlock = !isChat && (
    <>
      <h1
        className={`font-black leading-tight tracking-tight shrink-0 ${
          isCard ? 'text-base sm:text-xl md:text-2xl text-center mb-0.5 sm:mb-1' : 'text-2xl md:text-3xl mb-2'
        }`}
      >
        {step.title}
      </h1>
      {'subtitle' in step && step.subtitle && !(
        isCard &&
        (step.id === 'exercisesAvoid' ||
          step.id === 'exercisesLove' ||
          (step.type === 'catalogPicker' &&
            'categoryFilter' in step &&
            step.categoryFilter?.length) ||
          step.id === 'injuries' ||
          step.id === 'pastInjuriesHistory' ||
          step.id === 'bodyFocus')
      ) && (
        <p className={`text-muted shrink-0 ${isCard ? 'text-[11px] sm:text-sm text-center mb-1.5 sm:mb-2' : 'text-sm mb-6'}`}>
          {step.subtitle}
        </p>
      )}
    </>
  );

  const optionContainerClass = (
    count: number,
    opts: { grid: boolean; row: boolean; photoRow: boolean },
  ) => {
    const { grid, row, photoRow } = opts;
    if (photoRow) return 'flex flex-wrap gap-2 justify-center';
    if (row) {
      return isChat ? 'flex flex-wrap gap-2 justify-center' : 'grid grid-cols-2 gap-2 sm:gap-3';
    }
    if (grid) {
      if (isChat) return 'flex flex-wrap gap-2 justify-center';
      if (isCard) {
        if (count === 3) return 'grid grid-cols-3 gap-1.5 sm:gap-2 flex-1 min-h-0 auto-rows-fr';
        if (count === 2) return 'grid grid-cols-2 gap-1.5 sm:gap-2 flex-1 min-h-0 auto-rows-fr';
        return 'grid grid-cols-2 gap-1.5 sm:gap-2 flex-1 min-h-0 auto-rows-fr';
      }
      return 'grid grid-cols-1 sm:grid-cols-2 gap-3';
    }
    return isChat ? 'space-y-2' : 'space-y-2 sm:space-y-3';
  };

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
        <ContinueBar hidden={hideContinue}
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

  if (step.type === 'mealsSnacks') {
    return (
      <motion.div
        key={step.id}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className={
          isChat ? 'space-y-2' : isCard ? 'flex flex-col flex-1 min-h-0 gap-2 overflow-hidden' : 'pb-24 space-y-4'
        }
      >
        {!isChat && titleBlock}
        <MealsSnacksStep
          mealsField={step.mealsField}
          snacksField={step.snacksField}
          answers={answers}
          onAnswer={onAnswer}
          onContinue={onContinue}
          hideContinue={hideContinue}
          compact={isCard}
        />
      </motion.div>
    );
  }

  if (step.type === 'single') {
    const grid = useVisualGrid(step);
    const row = step.optionsLayout === 'row';
    const photoRow = isChat && row && step.options.some(o => o.imageVariant === 'photo');
    const useCompactList = isCard && !grid && !row;
    const followUp = step.followUp;
    const selectedValue = answers[step.id];
    const hasChoice =
      selectedValue !== undefined && selectedValue !== null && selectedValue !== '';
    const whyRequired = followUp?.required ?? false;
    const canContinueFollowUp = hasChoice && (!whyRequired || textVal.trim().length > 0);

    return (
      <motion.div
        key={step.id}
        initial={{ opacity: 0, y: isCard ? 12 : 0 }}
        animate={{ opacity: 1, y: 0 }}
        className={
          isChat
            ? 'space-y-3'
            : followUp && isCard
              ? 'flex flex-col flex-1 min-h-0 gap-2'
              : isCard
                ? 'flex flex-col flex-1 min-h-0 space-y-1.5 sm:space-y-2'
                : 'pb-28'
        }
      >
        {titleBlock}
        {encouragement}
        <motion.div
          className={
            useCompactList
              ? 'flex-1 min-h-0 flex flex-col justify-center gap-1.5 sm:gap-2'
              : followUp && isCard
                ? 'grid grid-cols-2 gap-2 shrink-0 auto-rows-[minmax(5.25rem,auto)] max-h-[42%] sm:max-h-[9.5rem]'
                : optionContainerClass(step.options.length, { grid, row, photoRow })
          }
        >
          {step.options.map(opt => (
            <OptionCard
              key={opt.value}
              opt={opt}
              variant={isChat ? 'chat' : 'default'}
              cardLayout={row || grid || photoRow ? 'grid' : 'default'}
              layout={useCompactList ? 'row' : 'stack'}
              compact={isCard}
              selected={selectedValue === opt.value}
              onSelect={() => {
                const pending = { [step.id]: opt.value };
                onAnswer(step.id, opt.value);
                if (!followUp && !hideContinue && step.autoAdvance !== false) {
                  setTimeout(() => onContinue(pending), 320);
                }
              }}
            />
          ))}
        </motion.div>
        {followUp && hasChoice && (
          <div className="flex flex-col flex-1 min-h-0 gap-1.5 sm:gap-2">
            <label className="block text-xs sm:text-sm font-bold text-foreground text-center shrink-0">
              {t('onboarding.planFailed.whyLabel')}
            </label>
            <textarea
              value={textVal}
              onChange={(e) => {
                setTextVal(e.target.value);
                onAnswer(followUp.field, e.target.value);
              }}
              placeholder={
                step.followUp?.placeholder ?? t('onboarding.planFailed.whyPlaceholder')
              }
              rows={3}
              className="w-full min-h-[5rem] sm:min-h-[5.5rem] flex-1 resize-none bg-elevated/90 border border-primary/25 rounded-xl sm:rounded-2xl px-3 sm:px-4 py-2.5 sm:py-3 text-sm font-medium text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/40 custom-scrollbar"
            />
          </div>
        )}
        {followUp ? (
          <ContinueBar
            hidden={hideContinue}
            disabled={!canContinueFollowUp}
            chat={isChat}
            pinned={isCard}
            onClick={() => {
              const pending: OnboardingAnswers = { [step.id]: selectedValue as string };
              if (followUp) pending[followUp.field] = textVal.trim();
              onContinue(pending);
            }}
          />
        ) : null}
      </motion.div>
    );
  }

  if (step.type === 'multi') {
    const isOtherSports = step.id === 'otherSports';
    const isFoodAllergies = step.id === 'foodAllergies';
    const isReligiousDiet = step.id === 'religiousDiet';
    const isBodyFocus = step.id === 'bodyFocus';
    const isLiftExperience = step.id === 'liftExperience';
    const isInjuryMulti = step.id === 'injuries' || step.id === 'pastInjuriesHistory';
    const otherField = isOtherSports
      ? 'otherSportsOther'
      : isFoodAllergies
        ? 'foodAllergiesOther'
        : null;

    const clearOtherText = () => {
      if (otherField) {
        setTextVal('');
        onAnswer(otherField, '');
      }
    };

    const toggle = (v: string) => {
      if (isOtherSports && v === 'none') {
        const pending: OnboardingAnswers = { [step.id]: ['none'], otherSportsOther: '' };
        onAnswer(step.id, ['none']);
        onAnswer('otherSportsOther', '');
        setLocalMulti(['none']);
        setTextVal('');
        if (!hideContinue) setTimeout(() => onContinue(pending), 320);
        return;
      }

      setLocalMulti(prev => {
        let next: string[];

        if ((isInjuryMulti || isFoodAllergies || isReligiousDiet) && v === 'none') {
          next = prev.includes('none') ? [] : ['none'];
          if (next.includes('none')) clearOtherText();
        } else if (isBodyFocus && v === 'full_body') {
          next = prev.includes('full_body') ? [] : ['full_body'];
        } else if (isInjuryMulti || isFoodAllergies || isReligiousDiet) {
          const base = prev.filter(x => x !== 'none');
          if (otherField && v === 'other' && base.includes('other')) {
            clearOtherText();
            next = base.filter(x => x !== 'other');
          } else if (base.includes(v)) {
            next = base.filter(x => x !== v);
          } else if (step.maxSelect && base.length >= step.maxSelect) {
            next = base;
          } else {
            next = [...base, v];
          }
        } else if (isBodyFocus) {
          const base = prev.filter(x => x !== 'full_body');
          if (base.includes(v)) {
            next = base.filter(x => x !== v);
          } else if (step.maxSelect && base.length >= step.maxSelect) {
            next = base;
          } else {
            next = [...base, v];
          }
        } else if (isLiftExperience) {
          const opposite = LIFT_EXPERIENCE_OPPOSITE[v];
          const base = opposite ? prev.filter(x => x !== opposite) : prev;
          if (base.includes(v)) {
            next = base.filter(x => x !== v);
          } else if (step.maxSelect && base.length >= step.maxSelect) {
            next = base;
          } else {
            next = [...base, v];
          }
        } else if (isOtherSports) {
          const base = prev.filter(x => x !== 'none');
          if (v === 'other' && base.includes('other')) {
            setTextVal('');
            onAnswer('otherSportsOther', '');
            next = base.filter(x => x !== 'other');
          } else if (base.includes(v)) {
            next = base.filter(x => x !== v);
          } else if (step.maxSelect && base.length >= step.maxSelect) {
            next = base;
          } else {
            next = [...base, v];
          }
          onAnswer(step.id, next);
        } else if (prev.includes(v)) {
          next = prev.filter(x => x !== v);
        } else if (step.maxSelect && prev.length >= step.maxSelect) {
          next = prev;
        } else {
          next = [...prev, v];
        }

        return next;
      });
    };
    const list = localMulti;
    const visual = step.visualOptions;
    const isCompactTextMulti = isCard && (isInjuryMulti || isBodyFocus);
    const useMultiGrid = isCard && !visual && step.options.length >= 4 && !isCompactTextMulti;
    const needsOtherText = Boolean(otherField) && list.includes('other') && !textVal.trim();
    const continueDisabled = list.length === 0 || needsOtherText;
    const injuryBodyOptions = isInjuryMulti ? step.options.filter((o) => o.value !== 'none') : [];
    const injuryNoneOption = isInjuryMulti ? step.options.find((o) => o.value === 'none') : undefined;
    const bodyFocusPartOptions = isBodyFocus ? step.options.filter((o) => o.value !== 'full_body') : [];
    const bodyFocusFullOption = isBodyFocus ? step.options.find((o) => o.value === 'full_body') : undefined;

    const renderMultiOption = (
      opt: (typeof step.options)[number],
      opts?: { grid?: boolean; dense?: boolean; textOnly?: boolean },
    ) => {
      const useGrid = opts?.grid === true;
      const displayOpt =
        opts?.textOnly === true
          ? { ...opt, imageUrl: undefined, icon: undefined, imageVariant: undefined }
          : opt;
      return (
      <OptionCard
        key={opt.value}
        opt={displayOpt}
        variant={isChat ? 'chat' : 'default'}
        cardLayout={useGrid ? 'grid' : 'default'}
        layout={useGrid ? 'stack' : 'row'}
        compact={isCard && (useGrid || useMultiGrid || Boolean(opts?.dense) || Boolean(opts?.textOnly))}
        dense={opts?.dense ?? useMultiGrid}
        selected={list.includes(opt.value)}
        onSelect={() => toggle(opt.value)}
        trailing={
          !useGrid && !isChat ? (
            <span
              className={`rounded-lg border flex-shrink-0 flex items-center justify-center ${
                useMultiGrid || isCompactTextMulti || opts?.dense || opts?.textOnly ? 'size-5' : 'size-6'
              } ${
                list.includes(opt.value) ? 'bg-primary border-primary' : 'border-subtle bg-background/50'
              }`}
            >
              {list.includes(opt.value) && (
                <span
                  className={`material-symbols-outlined text-foreground ${
                    useMultiGrid || isCompactTextMulti || opts?.dense || opts?.textOnly ? 'text-xs' : 'text-sm'
                  }`}
                >
                  check
                </span>
              )}
            </span>
          ) : undefined
        }
      />
    );
    };

    return (
      <motion.div
        key={step.id}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className={
          isChat
            ? 'space-y-3'
            : isCard
              ? 'flex flex-col flex-1 min-h-0 gap-1.5 sm:gap-2'
              : 'space-y-3 pb-28'
        }
      >
        {titleBlock}
        {encouragement}
        {isCompactTextMulti ? (
          <motion.div className="shrink-0">
            <motion.div
              className={`grid gap-1 sm:gap-1.5 auto-rows-[minmax(1.75rem,auto)] ${
                isBodyFocus ? 'grid-cols-2' : 'grid-cols-3'
              }`}
            >
              {(isInjuryMulti ? injuryBodyOptions : isBodyFocus ? bodyFocusPartOptions : step.options).map((opt) =>
                renderMultiOption(opt, { textOnly: true, dense: true }),
              )}
              {isInjuryMulti && injuryNoneOption && (
                <div className="col-span-3 pt-0.5 border-t border-subtle/50 mt-0.5">
                  {renderMultiOption(injuryNoneOption, { textOnly: true, dense: true })}
                </div>
              )}
              {isBodyFocus && bodyFocusFullOption && (
                <div className="col-span-2 pt-0.5 border-t border-subtle/50 mt-0.5">
                  {renderMultiOption(bodyFocusFullOption, { textOnly: true, dense: true })}
                </div>
              )}
            </motion.div>
          </motion.div>
        ) : (
        <motion.div
          className={
            visual
              ? optionContainerClass(step.options.length, { grid: true, row: false, photoRow: false })
              : useMultiGrid
                ? 'grid grid-cols-2 gap-1.5 sm:gap-2 shrink-0 auto-rows-[minmax(2rem,auto)] sm:auto-rows-[minmax(2.25rem,auto)]'
                : isCard
                  ? 'flex flex-col gap-1.5 sm:gap-2 shrink-0 content-start'
                  : `space-y-2 ${isChat ? 'max-h-[min(46vh,380px)] overflow-y-auto overscroll-contain custom-scrollbar' : ''}`
          }
        >
          {step.options.map((opt) => renderMultiOption(opt))}
        </motion.div>
        )}
        {otherField && list.includes('other') && (
          <input
            type="text"
            value={textVal}
            onChange={(e) => {
              setTextVal(e.target.value);
              onAnswer(otherField, e.target.value);
            }}
            placeholder={t(
              isFoodAllergies
                ? 'onboarding.foodAllergies.otherPlaceholder'
                : 'onboarding.otherSports.otherPlaceholder',
            )}
            className="w-full shrink-0 bg-surface border border-subtle rounded-xl sm:rounded-2xl px-3 sm:px-4 py-2.5 sm:py-3 text-sm font-bold text-foreground placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        )}
        <ContinueBar
          hidden={hideContinue}
          disabled={continueDisabled}
          chat={isChat}
          pinned={isCard}
          onClick={() => {
            const pending: OnboardingAnswers = { [step.id]: list };
            if (otherField) {
              pending[otherField] = list.includes('other') ? textVal.trim() : '';
            }
            onContinue(pending);
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
        <ContinueBar hidden={hideContinue}
          disabled={likert === null}
          chat={isChat}
          onClick={() => onContinue({ [step.id]: String(likert) })}
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
          <ContinueBar hidden={hideContinue} label={step.cta ?? continueLabel} chat={isChat} onClick={onContinue} />
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
        <ContinueBar hidden={hideContinue} label={step.cta ?? continueLabel} chat={isChat} onClick={onContinue} />
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
            onChange={(e) => {
              setNumVal(e.target.value);
              if (hideContinue && e.target.value !== '') {
                onAnswer(step.id, Number(e.target.value));
              }
            }}
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
        <ContinueBar hidden={hideContinue}
          disabled={!canContinue}
          chat={isChat}
          onClick={() => onContinue({ [step.id]: Number(numVal) })}
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
        <ContinueBar hidden={hideContinue}
          chat={isChat}
          onClick={() => onContinue({ [step.field]: level.value })}
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
          onClick={() => onContinue({ [step.field]: 'unknown' })}
          className="w-full py-3 text-muted font-bold mb-3 rounded-xl border border-subtle hover:bg-surface"
        >
          {t('onboarding.unknown')}
        </button>
        <ContinueBar hidden={hideContinue}
          disabled={!optionalWeight}
          chat={isChat}
          onClick={() => onContinue({ [step.field]: Number(optionalWeight) })}
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
        <ContinueBar hidden={hideContinue} chat={isChat} onClick={() => onContinue()} />
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
        <ContinueBar hidden={hideContinue} disabled={!canContinue} chat={isChat} onClick={onContinue} />
      </motion.div>
    );
  }

  if (step.type === 'photos') {
    const frontUrl = typeof answers.photoFrontUrl === 'string' ? answers.photoFrontUrl : null;
    const backUrl = typeof answers.photoBackUrl === 'string' ? answers.photoBackUrl : null;

    return (
      <motion.div
        key={step.id}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className={
          isCard
            ? 'flex flex-col flex-1 min-h-0 space-y-2 sm:space-y-3'
            : isChat
              ? 'space-y-3'
              : 'space-y-4'
        }
      >
        {!isChat && titleBlock}
        <p className={`text-muted text-center shrink-0 ${isCard ? 'text-[11px] sm:text-xs' : 'text-xs'}`}>
          {t('onboarding.photos.optionalHint')}
        </p>
        <motion.div
          className={
            isCard
              ? 'grid grid-cols-2 gap-2 sm:gap-3 flex-1 min-h-0 auto-rows-fr'
              : 'space-y-3'
          }
        >
          <ProgressPhotoUpload
            compact={isCard}
            label={t('onboarding.photos.front')}
            value={frontUrl}
            onChange={(url) => {
              onAnswer('photoFrontUrl', url ?? '');
              if (url) onAnswer('photoFrontDone', true);
              else onAnswer('photoFrontDone', false);
            }}
          />
          <ProgressPhotoUpload
            compact={isCard}
            label={t('onboarding.photos.back')}
            value={backUrl}
            onChange={(url) => {
              onAnswer('photoBackUrl', url ?? '');
              if (url) onAnswer('photoBackDone', true);
              else onAnswer('photoBackDone', false);
            }}
          />
        </motion.div>
        <ContinueBar hidden={hideContinue} chat={isChat} onClick={onContinue} pinned={isCard} />
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
        <ContinueBar hidden={hideContinue} chat={isChat} onClick={onContinue} />
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

  if (step.type === 'catalogPicker') {
    return (
      <motion.div
        key={step.id}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className={
          isChat ? 'space-y-2' : isCard ? 'flex flex-col flex-1 min-h-0 gap-1.5 overflow-hidden' : 'pb-24'
        }
      >
        {!isChat && titleBlock}
        <div className={isCard ? 'flex flex-1 min-h-0 flex flex-col' : undefined}>
        <CatalogPickerStep
          stepId={step.id}
          catalog={step.catalog}
          multi={step.multi}
          maxSelect={step.maxSelect}
          minSelect={step.minSelect}
          categoryId={step.categoryId}
          searchHints={step.searchHints}
          optional={step.optional}
          allowCustomText={step.allowCustomText}
          customTextField={step.customTextField}
          categoryFilter={step.categoryFilter}
          minProtein={step.minProtein}
          minCarbs={step.minCarbs}
          minFat={step.minFat}
          foodSort={step.foodSort}
          compact={isCard}
          answers={answers}
          onAnswer={onAnswer}
          onContinue={onContinue}
          hideContinue={hideContinue}
        />
        </div>
      </motion.div>
    );
  }

  if (step.type === 'gymPicker') {
    return (
      <motion.div
        key={step.id}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className={
          isChat ? 'space-y-2' : isCard ? 'flex flex-col flex-1 min-h-0 gap-1.5 overflow-hidden' : 'pb-24'
        }
      >
        {!isChat && titleBlock}
        <motion.div className={isCard ? 'flex flex-1 min-h-0 flex flex-col' : undefined}>
          <GymPickerStep
            field={step.field}
            placeholder={step.placeholder}
            optional={step.optional}
            answers={answers}
            onAnswer={onAnswer}
            onContinue={onContinue}
            hideContinue={hideContinue}
            compact={isCard}
          />
        </motion.div>
      </motion.div>
    );
  }

  if (step.type === 'text') {
    const min = step.minLength ?? 0;
    const max = step.maxLength ?? 500;
    const optional = 'optional' in step && step.optional === true;
    const ok =
      optional ||
      (textVal.trim().length >= min && textVal.trim().length <= max);
    return (
      <motion.div key={step.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={isChat ? '' : 'space-y-5'}>
        {!isChat && titleBlock}
        <motion.div className={isChat ? 'flex gap-2' : 'flex flex-col gap-4'}>
          <input
            type={step.inputType ?? 'text'}
            value={textVal}
            onChange={(e) => {
              const v = e.target.value;
              setTextVal(v);
              if (hideContinue) onAnswer(step.field, v);
            }}
            placeholder={step.placeholder}
            maxLength={max}
            autoComplete={step.field === 'phone' ? 'tel' : step.field === 'displayName' ? 'name' : 'street-address'}
            className={`${isChat ? 'flex-1' : 'w-full'} bg-surface border border-subtle rounded-2xl px-4 py-3.5 sm:py-4 text-base sm:text-lg font-bold focus:outline-none focus:ring-2 focus:ring-primary/40`}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && ok && !hideContinue) {
                onContinue({ [step.field]: textVal.trim() });
              }
            }}
          />
          {!hideContinue && (
            <motion.button
              type="button"
              disabled={!ok}
              onClick={() => onContinue({ [step.field]: textVal.trim() })}
              whileTap={ok ? { scale: 0.96 } : undefined}
              className={`${isChat ? 'flex-shrink-0 px-5' : 'w-full py-3.5'} rounded-2xl bg-primary text-white font-black disabled:opacity-40`}
            >
              {isChat ? t('onboarding.send') : t('common.continue')}
            </motion.button>
          )}
        </motion.div>
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
  hidden?: boolean;
  pinned?: boolean;
}> = ({ onClick, disabled, label, inline, chat, hidden, pinned }) => {
  const { t } = useI18n();
  if (hidden) return null;
  const text = label ?? t('common.continue');
  const btn = (
    <motion.button
      type="button"
      disabled={disabled}
      onClick={onClick}
      whileHover={disabled ? undefined : { scale: 1.02 }}
      whileTap={disabled ? undefined : { scale: 0.98 }}
      className={`w-full bg-gradient-to-r from-primary to-primary/80 text-white font-black rounded-2xl disabled:opacity-40 shadow-lg shadow-primary/25 border border-primary/30 ${
        pinned ? 'py-3 sm:py-3.5 text-sm sm:text-base' : 'py-4'
      }`}
    >
      {text}
    </motion.button>
  );
  if (inline) return <div className="pt-2">{btn}</div>;
  if (chat) return <div className="pt-1">{btn}</div>;
  if (pinned) return <motion.div className="pt-1.5 sm:pt-2 mt-auto shrink-0">{btn}</motion.div>;
  return <motion.div className="pt-2 sm:pt-4 shrink-0">{btn}</motion.div>;
};
