import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import aiService, { type AiPlan, type PlanDietDay, type PlanMeal, type PlanWorkoutDay } from '../../services/aiService';
import { useI18n } from '../../lib/i18n/useI18n';
import { useAuthStore } from '../../store/useAuthStore';
import { buildProfileDossier } from './profileDossier';
import profileService from '../../services/profileService';
import {
  clearPlanGenerationRequested,
  kickOffOfficialPlanGeneration,
  waitForOfficialPlan,
} from '../../services/planGenerationPoll';
import { invalidateAthleteHomeCache } from '../../services/dashboardService';
import { emitDashboardRefresh } from '../dashboard/wellnessWidgets';
import type { TranslationKey } from '../../lib/i18n/translations';

interface State {
  loading: boolean;
  plan: AiPlan | null;
  error: string | null;
  regenerating: boolean;
}

const BOILERPLATE_COACH_NOTES =
  /safe baseline plan generated automatically|open the chat coach for personalized/i;

const SPLIT_LABELS: Record<string, { en: string; ar: string }> = {
  push_pull_legs: { en: 'PPL', ar: 'دفع/سحب/أرجل' },
  ppl: { en: 'PPL', ar: 'دفع/سحب/أرجل' },
  upper_lower: { en: 'Upper / Lower', ar: 'علوي / سفلي' },
  full_body: { en: 'Full body', ar: 'جسم كامل' },
  bro_split: { en: 'Bro split', ar: 'تقسيم عضلات' },
};

function splitChipLabel(raw: unknown, isAr: boolean): string | null {
  const key = String(raw || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '_');
  if (!key) return null;
  const hit = SPLIT_LABELS[key];
  if (hit) return isAr ? hit.ar : hit.en;
  return String(raw)
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function shortInsight(text: string, max = 140): string {
  const t = text.trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const last = cut.lastIndexOf('. ');
  return (last > 60 ? cut.slice(0, last + 1) : `${cut}…`).trim();
}

function dietDaySummary(day: PlanDietDay): { meals: number; kcal: number; protein: number } {
  let kcal = 0;
  let protein = 0;
  let meals = 0;
  for (const m of day.meals || []) {
    meals += 1;
    const nested = (m as PlanDietDay['meals'][0] & { items?: PlanMeal[] }).items;
    if (Array.isArray(nested) && nested.length) {
      for (const it of nested) {
        kcal += it.calories ?? 0;
        protein += it.protein ?? 0;
      }
    } else {
      kcal += m.calories ?? 0;
      protein += m.protein ?? 0;
    }
  }
  return { meals, kcal, protein };
}

function workoutDayChip(day: PlanWorkoutDay, isAr: boolean): string {
  const tag = day.label || day.type || (isAr ? 'تمرين' : 'Train');
  const n = day.exercises?.length ?? 0;
  return `${tag} · ${n} ${isAr ? 'تمارين' : 'moves'}`;
}

function planInsight(plan: AiPlan): string {
  const explain = String(plan.explainabilityText || '').trim();
  if (explain) return explain;
  const notes = String(plan.coachNotes || '').trim();
  if (notes && !BOILERPLATE_COACH_NOTES.test(notes)) return notes;
  return '';
}

function sourceLabel(plan: AiPlan, isAr: boolean): string {
  if (plan.source === 'ai') {
    return isAr ? 'مخصّصة بالذكاء الاصطناعي' : 'AI personalized';
  }
  if (plan.source === 'fallback') {
    const explain = String(plan.explainabilityText || '');
    if (/خطة أسبوعية|weekly plan from your profile/i.test(explain)) {
      return isAr ? 'خطة رسمية من ملفك' : 'Official profile plan';
    }
    return isAr ? 'خطة آمنة افتراضية' : 'Safe baseline plan';
  }
  return isAr ? 'يدوي' : 'Manual';
}

function sourceTone(plan: AiPlan): string {
  if (plan.source === 'ai') return 'text-primary';
  if (plan.source === 'fallback') {
    const explain = String(plan.explainabilityText || '');
    if (/خطة أسبوعية|weekly plan from your profile/i.test(explain)) {
      return 'text-emerald-500';
    }
    return 'text-amber-500';
  }
  return 'text-faint';
}

/**
 * Official AI plan — generated only when the athlete taps the button (profile dossier at 100%).
 */
export const AIPlanCard: React.FC = () => {
  const { language, t } = useI18n();
  const isAr = language === 'ar';
  const user = useAuthStore((s) => s.user);
  const refreshUser = useAuthStore((s) => s.refreshUser);
  const profile = user?.profile;
  const onboardingData = profile?.onboardingData as Record<string, unknown> | undefined;

  const dossier = useMemo(
    () => buildProfileDossier(onboardingData, profile ?? undefined, language),
    [onboardingData, profile, language],
  );

  const [state, setState] = useState<State>({
    loading: true,
    plan: null,
    error: null,
    regenerating: false,
  });

  async function loadPlan() {
    setState((s) => ({ ...s, loading: true, error: null }));
    const res = await aiService.getActivePlan();
    const benignError =
      res.error &&
      /no active plan|storage unavailable|not found/i.test(res.error);
    setState({
      loading: false,
      plan: res.data?.plan || null,
      error: res.error && !benignError ? res.error : null,
      regenerating: false,
    });
  }

  useEffect(() => {
    void loadPlan();
  }, []);

  async function markPlanGenerationRequested() {
    const existing =
      onboardingData && typeof onboardingData === 'object' ? { ...onboardingData } : {};
    await profileService.updateProfile({
      onboardingData: {
        ...existing,
        planGenerationRequestedAt: new Date().toISOString(),
      },
    });
    await refreshUser();
  }

  async function clearPlanGenerationRequestedFlag() {
    await clearPlanGenerationRequested(onboardingData);
  }

  async function regenerate() {
    if (!dossier?.canGeneratePlan) return;
    setState((s) => ({ ...s, regenerating: true, error: null }));
    await markPlanGenerationRequested();
    const kick = await kickOffOfficialPlanGeneration({
      locale: isAr ? 'ar' : 'en',
      reason: 'profile_button',
    });
    if (kick.error) {
      setState((s) => ({
        ...s,
        regenerating: false,
        error: kick.pending ? t('dashboard.planGenPendingBody') : kick.error || null,
      }));
      if (kick.pending) {
        await clearPlanGenerationRequestedFlag();
        await refreshUser();
      }
      return;
    }

    let plan: AiPlan | null = kick.planReady ? (await aiService.getActivePlan()).data?.plan ?? null : null;
    if (!plan) {
      const wait = await waitForOfficialPlan({
        maxMs: 6 * 60 * 1000,
        intervalMs: 4000,
        jobId: kick.jobId,
      });
      if (wait.ok) {
        const loaded = await aiService.getActivePlan();
        plan = loaded.data?.plan ?? null;
      } else if (!wait.timedOut) {
        setState((s) => ({
          ...s,
          regenerating: false,
          error: wait.error || (isAr ? 'تعذّر توليد الخطة' : 'Plan generation failed'),
        }));
        return;
      }
    }

    await clearPlanGenerationRequestedFlag();
    await refreshUser();
    invalidateAthleteHomeCache();
    emitDashboardRefresh();

    setState({
      loading: false,
      plan,
      error: plan
        ? null
        : isAr
          ? 'الخطة ما زالت تُولَّد — افتح «خططي» خلال دقيقة.'
          : 'Plan is still generating — open My Plans in a minute.',
      regenerating: false,
    });
  }

  const completionPct = dossier?.completionPct ?? 0;
  const canGenerate = Boolean(dossier?.canGeneratePlan);

  const missingFlowLabels = useMemo(() => {
    if (!dossier?.missingFlows.length || !dossier) return '';
    return dossier.missingFlows
      .map((f) => {
        const cat = dossier.categories.find((c) => c.flow === f);
        return cat ? t(cat.titleKey as TranslationKey) : f;
      })
      .join(', ');
  }, [dossier, t]);

  if (state.loading) {
    return (
      <div className="glass-panel rounded-3xl border border-border p-5 sm:p-6">
        <p className="text-sm font-semibold text-faint">
          {isAr ? 'جاري تحميل خطتك…' : 'Loading your plan…'}
        </p>
      </div>
    );
  }

  if (!state.plan) {
    return (
      <div className="glass-panel rounded-3xl border border-border p-5 sm:p-6 space-y-3">
        <div>
          <h3 className="text-base font-black text-foreground">
            {isAr ? 'لسه ما عملتش خطة' : 'No active plan yet'}
          </h3>
          <p className="mt-1 text-xs text-faint leading-relaxed">
            {isAr
              ? 'أكمل ملفك إلى ١٠٠٪ ثم اضغط الزر — الكوتش يبني خطة ٧ أيام أكل + ٤ أسابيع تمرين من إجاباتك العلمية (الهدف، المعدات، الماكروز، النوم…).'
              : 'Complete your profile to 100%, then tap the button — the coach builds a 7-day meal + 4-week workout plan from your answers (goals, equipment, macros, sleep…).'}
          </p>
          <p className="mt-2 text-xs font-semibold text-foreground/80">
            {isAr ? 'اكتمال الملف:' : 'Profile completion:'}{' '}
            <span className={completionPct === 100 ? 'text-primary' : 'text-amber-500'}>
              {completionPct}%
            </span>
            {!canGenerate && missingFlowLabels ? (
              <span className="mt-1 block text-[11px] font-medium text-amber-600 dark:text-amber-400">
                {isAr ? 'ناقص في: ' : 'Still needed in: '}
                {missingFlowLabels}
              </span>
            ) : null}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void regenerate()}
          disabled={state.regenerating || !canGenerate}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white shadow-lg shadow-primary/30 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span className="material-symbols-outlined text-base">auto_awesome</span>
          {state.regenerating
            ? isAr
              ? 'جاري التوليد…'
              : 'Generating…'
            : isAr
              ? 'ولّد خطتي الآن'
              : 'Generate my plan now'}
        </button>
        {state.regenerating ? (
          <p className="text-[11px] text-faint">
            {isAr ? (
              <>
                افتح{' '}
                <Link to="/dashboard/plans" className="font-bold text-primary hover:underline">
                  خططي
                </Link>{' '}
                لمشاهدة الخطة وهي تُكتب أمامك.
              </>
            ) : (
              <>
                Open{' '}
                <Link to="/dashboard/plans" className="font-bold text-primary hover:underline">
                  My Plans
                </Link>{' '}
                to watch your plan being written live.
              </>
            )}
          </p>
        ) : null}
        {!canGenerate ? (
          <p className="text-[11px] text-faint">
            {isAr
              ? 'أكمل الاستبيانات الناقصة من ملفك أعلاه، ثم ارجع هنا.'
              : 'Finish the missing questionnaires in your dossier above, then return here.'}
          </p>
        ) : (
          <p className="text-[11px] text-faint">
            {isAr
              ? '«خططي» في القائمة تبقى فاضية لحد ما تضغط الزر. التمارين والأكل اللي تسجّلهما يومياً في التمرين والتغذية = سجلاتك، مش الخطة.'
              : 'My Plans stays empty until you generate. Workouts & Nutrition pages are for your daily logs — separate from the AI schedule.'}
          </p>
        )}
        {state.error && (
          <p className="text-xs font-semibold text-red-400">{state.error}</p>
        )}
      </div>
    );
  }

  const plan = state.plan;
  const dt = plan.dailyTargets;
  const insight = planInsight(plan);
  const insightShort = insight ? shortInsight(insight) : '';
  const splitLabel = splitChipLabel(onboardingData?.preferredSplit, isAr);
  const trainingDays = (plan.workoutWeeks[0]?.days || []).filter((d) => !d.isRest && (d.exercises?.length ?? 0) > 0);
  const dietPreview = plan.dietDays.slice(0, 3);
  const trainingPreview = trainingDays.slice(0, 4);

  return (
    <div className="glass-panel relative overflow-hidden rounded-3xl border border-border p-5 sm:p-6 space-y-4">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary via-violet-500 to-cyan-500"
        aria-hidden
      />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary">
            <span className="material-symbols-outlined text-xl">auto_awesome</span>
          </div>
          <div>
            <h3 className="text-base font-black text-foreground">
              {isAr ? 'خطتك الأسبوعية' : 'Your week at a glance'}
            </h3>
            <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] font-semibold text-faint">
              <span>v{plan.version}</span>
              <span>·</span>
              <span className={sourceTone(plan)}>{sourceLabel(plan, isAr)}</span>
              {splitLabel ? (
                <>
                  <span>·</span>
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-primary">{splitLabel}</span>
                </>
              ) : null}
            </p>
          </div>
        </div>
        <p className="text-[11px] font-medium leading-relaxed text-faint">
          {t('profile.planAgentOnlyRegenerate')}
        </p>
      </div>

      {state.regenerating ? (
        <p className="text-[11px] text-faint">
          {isAr ? (
            <>
              افتح{' '}
              <Link to="/dashboard/plans" className="font-bold text-primary hover:underline">
                خططي
              </Link>{' '}
              لمتابعة التوليد مباشرة.
            </>
          ) : (
            <>
              Open{' '}
              <Link to="/dashboard/plans" className="font-bold text-primary hover:underline">
                My Plans
              </Link>{' '}
              to follow generation live.
            </>
          )}
        </p>
      ) : null}

      {insightShort ? (
        <p className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/8 to-transparent px-3 py-2.5 text-xs italic leading-relaxed text-foreground/90">
          “{insightShort}”
        </p>
      ) : null}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <TargetCell icon="local_fire_department" label={isAr ? 'سعرات' : 'Cal'} value={dt.calories} unit="kcal" accent="orange" />
        <TargetCell icon="egg" label={isAr ? 'بروتين' : 'Protein'} value={dt.protein} unit="g" accent="rose" />
        <TargetCell icon="bakery_dining" label={isAr ? 'كارب' : 'Carbs'} value={dt.carbs} unit="g" accent="amber" />
        <TargetCell icon="water_drop" label={isAr ? 'دهون' : 'Fat'} value={dt.fat} unit="g" accent="sky" />
        <TargetCell icon="humidity_low" label={isAr ? 'ماء' : 'Water'} value={dt.waterMl} unit="ml" accent="cyan" />
      </div>

      {trainingPreview.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-[10px] font-black uppercase tracking-widest text-faint">
            {isAr ? 'التمرين' : 'Training'}
            <span className="ms-2 font-semibold normal-case tracking-normal text-foreground/70">
              {trainingDays.length} {isAr ? 'أيام' : 'days'}
            </span>
          </h4>
          <div className="flex flex-wrap gap-2">
            {trainingPreview.map((day) => (
              <span
                key={day.dayIndex}
                className="inline-flex items-center gap-1 rounded-full border border-border bg-surface/80 px-3 py-1.5 text-xs font-semibold text-foreground"
              >
                <span className="text-[10px] font-bold uppercase text-faint">
                  {isAr ? 'ي' : 'D'}
                  {day.dayIndex}
                </span>
                {workoutDayChip(day, isAr)}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-2">
        <h4 className="text-[10px] font-black uppercase tracking-widest text-faint">
          {isAr ? 'التغذية' : 'Nutrition'}
          <span className="ms-2 font-semibold normal-case tracking-normal text-foreground/70">
            7 {isAr ? 'أيام' : 'days'}
          </span>
        </h4>
        <div className="space-y-1.5">
          {dietPreview.map((day) => {
            const s = dietDaySummary(day);
            return (
              <div
                key={day.dayIndex}
                className="flex items-center justify-between gap-2 rounded-xl border border-border/80 bg-surface/50 px-3 py-2 text-xs"
              >
                <span className="font-bold text-foreground">
                  {isAr ? `اليوم ${day.dayIndex}` : `Day ${day.dayIndex}`}
                </span>
                <span className="text-faint tabular-nums">
                  {s.meals} {isAr ? 'وجبات' : 'meals'} · ~{s.kcal || dt.calories} kcal · P{s.protein || dt.protein}g
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {state.error && <p className="text-xs font-semibold text-red-400">{state.error}</p>}
      <Link
        to="/dashboard/plans"
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-foreground/5 py-2.5 text-xs font-bold text-primary hover:bg-primary/10"
      >
        <span className="material-symbols-outlined text-base">calendar_month</span>
        {isAr ? 'افتح خططي' : 'Open My Plans'}
      </Link>
    </div>
  );
};

function TargetCell({
  label,
  value,
  unit,
  icon,
  accent,
}: {
  label: string;
  value: number;
  unit: string;
  icon: string;
  accent: 'orange' | 'rose' | 'amber' | 'sky' | 'cyan';
}) {
  const accentClass = {
    orange: 'text-orange-500',
    rose: 'text-rose-500',
    amber: 'text-amber-500',
    sky: 'text-sky-500',
    cyan: 'text-cyan-500',
  }[accent];

  return (
    <div className="rounded-2xl border border-border bg-surface/60 p-2.5 sm:p-3 text-center">
      <span className={`material-symbols-outlined text-base ${accentClass}`}>{icon}</span>
      <p className="mt-0.5 text-[9px] font-bold uppercase tracking-wider text-faint">{label}</p>
      <p className="text-sm font-black tabular-nums text-foreground sm:text-base">
        {value}
        <span className="ms-0.5 text-[9px] font-bold text-faint">{unit}</span>
      </p>
    </div>
  );
}

export default AIPlanCard;
