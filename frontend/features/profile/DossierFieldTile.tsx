import React, { useCallback, useEffect, useState } from 'react';
import type { TranslationKey } from '../../lib/i18n/translations';
import type { AppLanguage } from '../../services/settingsService';
import { getLocalizedQuestionnaireStep } from '../onboarding/flows';
import { StepContent } from '../onboarding/components/StepContent';
import { getStepPresentation } from '../onboarding/stepPresentation';
import { persistDossierFieldUpdate } from '../onboarding/persistQuestionnaire';
import type { OnboardingAnswers, CatalogPickItem } from '../onboarding/types';
import type { QuestionnaireFlowId } from '../onboarding/flows/types';
import type { DossierField } from './profileDossier';

type StepAnswerValue = string | string[] | number | boolean | CatalogPickItem[];

interface DossierFieldTileProps {
  field: DossierField;
  flow: QuestionnaireFlowId;
  answers: OnboardingAnswers;
  language: AppLanguage;
  t: (key: TranslationKey, params?: Record<string, string>) => string;
  onSaved: () => void;
}

export const DossierFieldTile: React.FC<DossierFieldTileProps> = ({
  field,
  flow,
  answers,
  language,
  t,
  onSaved,
}) => {
  const [editing, setEditing] = useState(false);
  const [localAnswers, setLocalAnswers] = useState<OnboardingAnswers>(answers);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const step = getLocalizedQuestionnaireStep(field.id, language);
  const presentation = step ? getStepPresentation(step) : 'card';

  useEffect(() => {
    if (!editing) setLocalAnswers(answers);
  }, [answers, editing]);

  const statusLabel =
    field.status === 'answered'
      ? null
      : field.status === 'skipped'
        ? t('profile.dossier.skipped')
        : t('profile.dossier.notAnswered');

  const setAnswer = useCallback((stepId: string, value: StepAnswerValue) => {
    setLocalAnswers((prev) => ({ ...prev, [stepId]: value }));
  }, []);

  const saveAndClose = useCallback(async () => {
    if (!step) return;
    setSaving(true);
    setError(null);

    let payload = { ...localAnswers };
    if (step.type === 'text' && 'field' in step) {
      const raw = String(payload[step.field] ?? '').trim();
      if (raw.length < (step.minLength ?? 0)) {
        setSaving(false);
        setError(t('profile.dossier.saveFailed'));
        return;
      }
      payload = { ...payload, [step.field]: raw };
    }
    if (step.type === 'number') {
      const n = Number(payload[step.id]);
      if (!Number.isFinite(n)) {
        setSaving(false);
        setError(t('profile.dossier.saveFailed'));
        return;
      }
      payload = { ...payload, [step.id]: n };
    }

    const result = await persistDossierFieldUpdate(flow, payload, field.id);
    setSaving(false);
    if (!result.ok) {
      setError(result.error ?? t('profile.dossier.saveFailed'));
      return;
    }
    onSaved();
    setEditing(false);
  }, [flow, localAnswers, field.id, onSaved, step, t]);

  const cancelEdit = useCallback(
    (e?: React.MouseEvent) => {
      e?.stopPropagation();
      if (saving) return;
      setLocalAnswers(answers);
      setError(null);
      setEditing(false);
    },
    [answers, saving],
  );

  const startEdit = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!step) return;
      setLocalAnswers(answers);
      setError(null);
      setEditing(true);
    },
    [answers, step],
  );

  const handleSave = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      void saveAndClose();
    },
    [saveAndClose],
  );

  return (
    <div
      className={`rounded-xl sm:rounded-2xl border p-2.5 max-[374px]:p-2 sm:p-4 min-w-0 max-w-full flex flex-col gap-2 max-[374px]:gap-1.5 sm:gap-2.5 ${
        editing ? 'col-span-full' : ''
      } ${
        field.status === 'answered'
          ? 'bg-surface/60 border-subtle/80'
          : field.status === 'skipped'
            ? 'bg-amber-500/5 border-amber-500/20'
            : 'bg-elevated/40 border-dashed border-subtle/60'
      }`}
    >
      <div className="flex items-start justify-between gap-2 pb-1 border-b border-subtle/50">
        <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.18em] text-primary/75 line-clamp-2 flex-1 min-w-0" dir="auto">
          {field.label}
        </p>
        {!editing && (
          <button
            type="button"
            onClick={startEdit}
            disabled={!step}
            className="shrink-0 text-[10px] font-black uppercase tracking-wider text-primary hover:underline px-2 py-1 rounded-lg bg-primary/10 border border-primary/15 disabled:opacity-40"
          >
            {t('profile.dossier.edit')}
          </button>
        )}
      </div>

      {editing && step ? (
        <div className="overflow-hidden">
          <div className="mt-2 rounded-xl sm:rounded-2xl border border-primary/20 bg-background/80 p-2.5 max-[374px]:p-2 sm:p-3 md:p-4 max-h-[min(36dvh,18rem)] sm:max-h-[min(42dvh,22rem)] lg:max-h-[min(46dvh,26rem)] overflow-y-auto overflow-x-hidden custom-scrollbar dossier-inline-editor">
            <StepContent
              step={step}
              answers={localAnswers}
              mode={presentation}
              onAnswer={setAnswer}
              onContinue={() => {}}
              hideContinue
            />
          </div>
          <div className="flex flex-wrap items-center gap-2 mt-3">
            <button
              type="button"
              disabled={saving}
              onClick={handleSave}
              className="text-[10px] font-black uppercase tracking-wider px-3 py-2 rounded-xl bg-primary text-white disabled:opacity-50"
            >
              {saving ? t('profile.dossier.saving') : t('profile.dossier.save')}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={cancelEdit}
              className="text-[10px] font-black uppercase tracking-wider px-3 py-2 rounded-xl border border-subtle text-muted"
            >
              {t('profile.dossier.cancel')}
            </button>
          </div>
          {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
        </div>
      ) : (
        <div>
          {field.status === 'answered' && field.value ? (
            field.chips ? (
              <div className="flex flex-wrap gap-1.5">
                {field.chips.map((chip) => (
                  <span
                    key={chip}
                    className="text-[10px] font-bold px-2 py-1 rounded-lg bg-primary/10 text-primary border border-primary/15"
                  >
                    {chip}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm max-[374px]:text-sm sm:text-lg font-black text-foreground leading-tight break-words tracking-tight">{field.value}</p>
            )
          ) : (
            <p
              className={`text-xs font-bold ${
                field.status === 'skipped' ? 'text-amber-400/90' : 'text-faint italic'
              }`}
            >
              {statusLabel}
            </p>
          )}
        </div>
      )}
    </div>
  );
};
