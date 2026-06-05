import React, { useEffect, useState } from 'react';
import aiService, { type AiPlan } from '../../services/aiService';
import { useI18n } from '../../lib/i18n/useI18n';

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
 * Shows the user's active official plan (Postgres) with targets and week preview.
 */
export const AIPlanCard: React.FC = () => {
  const { language } = useI18n();
  const isAr = language === 'ar';
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

  async function regenerate() {
    setState((s) => ({ ...s, regenerating: true, error: null }));
    const res = await aiService.regeneratePlan({
      locale: isAr ? 'ar' : 'en',
      reason: 'profile_button',
    });
    if (res.error) {
      setState((s) => ({ ...s, regenerating: false, error: res.error || null }));
      return;
    }
    setState({
      loading: false,
      plan: res.data?.plan || null,
      error: null,
      regenerating: false,
    });
  }

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
          <p className="mt-1 text-xs text-faint">
            {isAr
              ? 'اكمل استبيان النظام الغذائي علشان الكوتش يبني لك خطة ٧ أيام + ٤ أسابيع تدريب.'
              : 'Finish the diet questionnaire and the coach will build a 7-day diet + 4-week workout for you.'}
          </p>
        </div>
        <button
          type="button"
          onClick={regenerate}
          disabled={state.regenerating}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white shadow-lg shadow-primary/30 hover:brightness-110 disabled:opacity-60"
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
          onClick={regenerate}
          disabled={state.regenerating}
          className="inline-flex items-center gap-1.5 rounded-xl border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary hover:bg-primary/15 disabled:opacity-60"
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

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <TargetCell label={isAr ? 'سعرات' : 'Calories'} value={dt.calories} unit="kcal" />
        <TargetCell label={isAr ? 'بروتين' : 'Protein'} value={dt.protein} unit="g" />
        <TargetCell label={isAr ? 'كارب' : 'Carbs'} value={dt.carbs} unit="g" />
        <TargetCell label={isAr ? 'دهون' : 'Fat'} value={dt.fat} unit="g" />
        <TargetCell label={isAr ? 'ماء' : 'Water'} value={dt.waterMl} unit="ml" />
      </div>

      {insight && (
        <p className="rounded-2xl bg-elevated/50 p-3 text-xs leading-relaxed text-foreground/90">
          {insight}
        </p>
      )}

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
        {isAr
          ? 'نفس الخطة تظهر في لوحة التحكم — تمرين ووجبات لكل يوم في الأسبوع.'
          : 'The same plan powers your dashboard — workouts and meals for each day of the week.'}
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
