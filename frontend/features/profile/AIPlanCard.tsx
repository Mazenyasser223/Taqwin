import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import aiService, { type AiPlan } from '../../services/aiService';
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
  const dietPreview = plan.dietDays.slice(0, 3);
  const trainingPreview = (plan.workoutWeeks[0]?.days || [])
    .filter((d) => !d.isRest && (d.exercises?.length ?? 0) > 0)
    .slice(0, 3);

  return (
    <div className="glass-panel rounded-3xl border border-border p-5 sm:p-6 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-black text-foreground">
            {isAr ? 'خطتك الرسمية' : 'Your official plan'}
          </h3>
          <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-widest text-faint">
            {isAr ? 'إصدار' : 'Version'} {plan.version}
            <span className="mx-2">·</span>
            <span className={sourceTone(plan)}>{sourceLabel(plan, isAr)}</span>
          </p>
        </div>
        <button
          type="button"
          onClick={() => void regenerate()}
          disabled={state.regenerating || !canGenerate}
          className="inline-flex items-center gap-1.5 rounded-xl border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary hover:bg-primary/15 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span className="material-symbols-outlined text-sm">refresh</span>
          {state.regenerating
            ? isAr
              ? 'جاري التوليد…'
              : 'Generating…'
            : isAr
              ? 'إعادة توليد'
              : 'Regenerate'}
        </button>
      </div>

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

      {insight ? (
        <div className="rounded-2xl border border-primary/25 bg-primary/5 p-3 space-y-1.5">
          <p className="text-[10px] font-black uppercase tracking-widest text-primary">
            {isAr ? 'كيف بُنيت الخطة' : 'How this plan was built'}
          </p>
          <p className="text-xs leading-relaxed text-foreground/90">{insight}</p>
          <p className="text-[10px] text-faint">
            {isAr
              ? 'مبنية على استبيانات ملفك + مكتبة التمارين والأكل + قواعد المدرب. عدّل الإجابات في الملف ثم أعد التوليد لتحسين الدقة.'
              : 'Built from your dossier answers + exercise/meal catalog + coach rules. Edit dossier fields and regenerate to improve accuracy.'}
          </p>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <TargetCell label={isAr ? 'سعرات' : 'Calories'} value={dt.calories} unit="kcal" />
        <TargetCell label={isAr ? 'بروتين' : 'Protein'} value={dt.protein} unit="g" />
        <TargetCell label={isAr ? 'كارب' : 'Carbs'} value={dt.carbs} unit="g" />
        <TargetCell label={isAr ? 'دهون' : 'Fat'} value={dt.fat} unit="g" />
        <TargetCell label={isAr ? 'ماء' : 'Water'} value={dt.waterMl} unit="ml" />
      </div>

      {trainingPreview.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-[11px] font-black uppercase tracking-widest text-faint">
            {isAr ? 'معاينة التمرين (٣ أيام)' : 'Workout preview (3 days)'}
          </h4>
          <div className="space-y-2">
            {trainingPreview.map((day) => (
              <div key={day.dayIndex} className="rounded-2xl border border-border bg-surface/60 p-3">
                <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-faint">
                  {isAr ? 'اليوم' : 'Day'} {day.dayIndex}
                  {day.label || day.type ? (
                    <span className="ms-2 text-primary">{day.label || day.type}</span>
                  ) : null}
                </div>
                <ul className="space-y-1 text-xs">
                  {day.exercises.slice(0, 5).map((ex, i) => (
                    <li key={`${day.dayIndex}-${i}`} className="font-semibold text-foreground">
                      {ex.name}
                      <span className="ms-2 font-normal text-faint">
                        {ex.sets}×{ex.reps}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-2">
        <h4 className="text-[11px] font-black uppercase tracking-widest text-faint">
          {isAr ? 'معاينة الوجبات (٣ أيام)' : 'Meal preview (3 days)'}
        </h4>
        <div className="space-y-2">
          {dietPreview.map((day) => (
            <div key={day.dayIndex} className="rounded-2xl border border-border bg-surface/60 p-3">
              <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-faint">
                {isAr ? 'اليوم' : 'Day'} {day.dayIndex}
              </div>
              <ul className="space-y-1 text-xs">
                {day.meals.map((m, i) => (
                  <li key={`${day.dayIndex}-${i}`} className="flex justify-between gap-2">
                    <span className="truncate font-semibold text-foreground">
                      {m.slot}: {m.name}
                    </span>
                    <span className="shrink-0 text-faint">
                      {m.calories}kcal · P{m.protein}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {state.error && <p className="text-xs font-semibold text-red-400">{state.error}</p>}
      <p className="text-[10px] text-faint">
        {isAr ? (
          <>
            الخطة تظهر في{' '}
            <Link to="/dashboard/plans" className="font-bold text-primary hover:underline">
              خططي
            </Link>
            . سجلاتك اليومية في التمرين والتغذية منفصلة.
          </>
        ) : (
          <>
            Schedule lives in{' '}
            <Link to="/dashboard/plans" className="font-bold text-primary hover:underline">
              My Plans
            </Link>
            . Daily logs on Workouts & Nutrition are separate.
          </>
        )}
      </p>
    </div>
  );
};

function TargetCell({ label, value, unit }: { label: string; value: number; unit: string }) {
  return (
    <div className="rounded-2xl border border-border bg-surface/60 p-3 text-center">
      <p className="text-[10px] font-bold uppercase tracking-widest text-faint">{label}</p>
      <p className="mt-1 text-base font-black tabular-nums text-foreground">
        {value}
        <span className="ms-0.5 text-[10px] font-bold text-faint">{unit}</span>
      </p>
    </div>
  );
}

export default AIPlanCard;
