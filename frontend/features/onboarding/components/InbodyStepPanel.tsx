import React, { useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useI18n } from '../../../lib/i18n/useI18n';
import {
  HISTORY_FIELDS,
  IMPEDANCE_BANDS,
  INBODY_FIELD_GROUPS,
  SEGMENT_PART_LABELS,
  SEGMENT_PARTS,
  emptySegmental,
  getFlatValue,
  hasNestedValue,
  inbodyDataForOnboarding,
  parseFlatValue,
  pickHiddenScanMetrics,
  stripOnboardingDuplicates,
  type InbodyFieldType,
  type SegmentPartKey,
} from '../../../lib/inbody/fields';
import inbodyService, {
  emptyInbodyData,
  hasAnyInbodyValue,
  inbodyFromAnswers,
  type InbodyExtractedData,
  type InbodyHistory,
  type InbodyImpedance,
  type InbodySegmentPart,
  type InbodySegmental,
  type InbodySource,
} from '../../../services/inbodyService';
import { prepareInbodyUpload } from '../../../lib/inbody/prepareUpload';
import type { OnboardingAnswers } from '../types';
import { InbodyEducationIntro } from './InbodyEducationIntro';

function ExtractingProgress({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="space-y-3">
      <p className="font-bold text-sm">{title}</p>
      <p className="text-xs text-muted">{hint}</p>
      <div className="relative h-2 overflow-hidden rounded-full bg-subtle">
        <motion.div
          className="absolute inset-y-0 w-2/5 rounded-full bg-accent"
          animate={{ left: ['-40%', '100%'] }}
          transition={{ repeat: Infinity, duration: 1.3, ease: 'easeInOut' }}
        />
      </div>
    </div>
  );
}

type PanelMode = 'idle' | 'extracting' | 'review' | 'manual';

interface InbodyStepPanelProps {
  answers: OnboardingAnswers;
  onAnswer: (key: string, value: unknown) => void;
  onContinue: (pending?: OnboardingAnswers) => void;
  hideContinue?: boolean;
  continueLoading?: boolean;
  isCard?: boolean;
  isChat?: boolean;
}

function FieldInput({
  label,
  unit,
  value,
  type = 'number',
  onChange,
}: {
  label: string;
  unit?: string;
  value: string;
  type?: InbodyFieldType;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-[10px] font-bold text-faint uppercase tracking-wider">
        {label}
        {unit ? ` (${unit})` : ''}
      </span>
      <input
        type={type === 'date' ? 'date' : 'text'}
        inputMode={type === 'number' ? 'decimal' : 'text'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="—"
        className="mt-1 w-full bg-surface border border-subtle rounded-xl px-3 py-2.5 font-bold text-sm"
      />
    </label>
  );
}

export const InbodyStepPanel: React.FC<InbodyStepPanelProps> = ({
  answers,
  onAnswer,
  onContinue,
  hideContinue = false,
  continueLoading = false,
  isCard = false,
}) => {
  const { t } = useI18n();
  const fileRef = useRef<HTMLInputElement>(null);
  const initial = useMemo(() => inbodyFromAnswers(answers), [answers]);

  const [mode, setMode] = useState<PanelMode>(() =>
    hasAnyInbodyValue(initial.data) ? 'manual' : 'idle',
  );
  const [formData, setFormData] = useState<InbodyExtractedData>(() =>
    stripOnboardingDuplicates(initial.data),
  );
  const [hiddenScan, setHiddenScan] = useState<{ weightKg: number | null }>(() =>
    pickHiddenScanMetrics(initial.data),
  );
  const [reportUrl, setReportUrl] = useState<string | null>(initial.reportUrl);
  const [source, setSource] = useState<InbodySource>('manual');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [showManual, setShowManual] = useState(hasAnyInbodyValue(initial.data));

  const updateFlat = (key: keyof InbodyExtractedData, raw: string, type: InbodyFieldType = 'number') => {
    setFormData((prev) => ({ ...prev, [key]: parseFlatValue(key, raw, type) }));
    if (!reportUrl) setSource('manual');
  };

  const updateSegment = (
    group: 'segmentalLean' | 'segmentalFat',
    part: SegmentPartKey,
    field: keyof InbodySegmentPart,
    raw: string,
  ) => {
    setFormData((prev) => {
      const current = prev[group] ?? emptySegmental();
      const partData = current[part];
      const nextVal =
        field === 'status'
          ? raw.trim() || null
          : (() => {
              const n = Number(raw.replace(/,/g, ''));
              return Number.isFinite(n) ? n : null;
            })();
      return {
        ...prev,
        [group]: {
          ...current,
          [part]: { ...partData, [field]: nextVal },
        },
      };
    });
    if (!reportUrl) setSource('manual');
  };

  const updateHistory = (key: keyof InbodyHistory, raw: string) => {
    setFormData((prev) => {
      const current = prev.history ?? {
        previousTestDate: null,
        previousWeightKg: null,
        previousSkeletalMuscleMassKg: null,
        previousBodyFatPercent: null,
      };
      let val: string | number | null = raw.trim() || null;
      if (key !== 'previousTestDate' && val != null) {
        const n = Number(val);
        val = Number.isFinite(n) ? n : null;
      }
      return { ...prev, history: { ...current, [key]: val } };
    });
    if (!reportUrl) setSource('manual');
  };

  const updateImpedance = (
    band: 'at20kHz' | 'at100kHz',
    part: SegmentPartKey,
    raw: string,
  ) => {
    setFormData((prev) => {
      const imp = prev.impedance ?? { at20kHz: null, at100kHz: null };
      const bandData = imp[band] ?? {
        rightArm: null,
        leftArm: null,
        trunk: null,
        rightLeg: null,
        leftLeg: null,
      };
      const n = Number(raw.replace(/,/g, ''));
      return {
        ...prev,
        impedance: {
          ...imp,
          [band]: { ...bandData, [part]: Number.isFinite(n) ? n : null },
        },
      };
    });
    if (!reportUrl) setSource('manual');
  };

  const handleReload = () => {
    if (saving || isExtracting) return;
    setSaveError(null);
    setUploadError(null);
    fileRef.current?.click();
  };

  const handleFile = async (file?: File) => {
    if (!file || saving || isExtracting) return;
    setUploadError(null);
    setSaveError(null);
    const keepReview = mode === 'review';
    if (!keepReview) setMode('extracting');
    setIsExtracting(true);

    const prepared = await prepareInbodyUpload(file);
    const res = await inbodyService.extractReport(prepared);
    setIsExtracting(false);

    if (res.error) {
      setUploadError(res.error);
      if (res.data?.reportUrl) {
        setReportUrl(res.data.reportUrl);
        setSource('inbody_upload');
        setShowManual(true);
        setMode('manual');
      } else {
        setMode(keepReview ? 'review' : 'idle');
      }
      return;
    }
    const extracted = res.data?.extracted ?? emptyInbodyData();
    setHiddenScan(pickHiddenScanMetrics(extracted));
    setFormData(stripOnboardingDuplicates(extracted));
    setReportUrl(res.data?.reportUrl ?? null);
    setSource('ai_extracted');
    setMode('review');
  };

  const buildPendingAnswers = (bodyMetricId?: string): OnboardingAnswers => {
    const pending: OnboardingAnswers = {
      inbodyData: inbodyDataForOnboarding(formData),
      inbodyReportUrl: reportUrl ?? undefined,
      inbodySource: source,
    };
    if (bodyMetricId) pending.inbodyBodyMetricId = bodyMetricId;
    if (formData.bodyFatPercent != null) pending.inbodyBodyFat = String(formData.bodyFatPercent);
    if (formData.skeletalMuscleMassKg != null) pending.inbodyMuscle = String(formData.skeletalMuscleMassKg);
    if (formData.basalMetabolicRate != null) pending.inbodyBmr = String(formData.basalMetabolicRate);
    if (hasAnyInbodyValue(formData) || reportUrl) pending.inbodyAcknowledged = true;
    return pending;
  };

  const persistAndContinue = async () => {
    setSaveError(null);
    if (!hasAnyInbodyValue(formData) && !reportUrl) {
      onContinue();
      return;
    }

    setSaving(true);
    const measuredAt = formData.testDate
      ? new Date(`${formData.testDate}T12:00:00Z`).toISOString()
      : undefined;

    const res = await inbodyService.saveMetrics({
      ...formData,
      weightKg: hiddenScan.weightKg,
      reportUrl,
      source: reportUrl && source === 'manual' ? 'inbody_upload' : source,
      measuredAt,
    });
    setSaving(false);

    if (res.error) {
      setSaveError(res.error);
      return;
    }

    const id = res.data?.bodyMetric?.id;
    for (const [k, v] of Object.entries(buildPendingAnswers(id))) {
      onAnswer(k, v);
    }
    onContinue(buildPendingAnswers(id));
  };

  const handleSkipContinue = () => {
    if (mode === 'review' || (showManual && hasAnyInbodyValue(formData))) {
      void persistAndContinue();
      return;
    }
    onContinue();
  };

  const canContinue =
    !isExtracting &&
    !saving &&
    !continueLoading &&
    (mode !== 'review' || hasAnyInbodyValue(formData) || Boolean(reportUrl));

  const continueLabel =
    mode === 'review'
      ? t('onboarding.inbody.confirmSave')
      : showManual && hasAnyInbodyValue(formData)
        ? t('onboarding.inbody.saveAndContinue')
        : undefined;

  const renderSegmentGroup = (groupKey: 'segmentalLean' | 'segmentalFat', titleKey: string) => {
    const data = formData[groupKey];
    if (!data && mode !== 'review' && !showManual) return null;
    const segmental = data ?? emptySegmental();

    return (
      <div key={groupKey} className="space-y-2">
        <h4 className="text-xs font-black uppercase tracking-wider text-accent">{t(titleKey)}</h4>
        {SEGMENT_PARTS.map((part) => {
          const partData = segmental[part];
          return (
            <div key={part} className="rounded-xl border border-subtle bg-surface/40 p-3 space-y-2">
              <p className="text-xs font-bold">{t(SEGMENT_PART_LABELS[part])}</p>
              <div className="grid grid-cols-3 gap-2">
                <FieldInput
                  label={t('onboarding.inbody.segment.kg')}
                  unit={t('onboarding.inbody.units.kg')}
                  value={partData.kg != null ? String(partData.kg) : ''}
                  onChange={(v) => updateSegment(groupKey, part, 'kg', v)}
                />
                <FieldInput
                  label={t('onboarding.inbody.segment.percent')}
                  unit="%"
                  value={partData.percent != null ? String(partData.percent) : ''}
                  onChange={(v) => updateSegment(groupKey, part, 'percent', v)}
                />
                <FieldInput
                  label={t('onboarding.inbody.segment.status')}
                  type="string"
                  value={partData.status ?? ''}
                  onChange={(v) => updateSegment(groupKey, part, 'status', v)}
                />
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderImpedance = () => {
    if (!hasNestedValue(formData.impedance) && mode !== 'review') return null;
    const imp: InbodyImpedance = formData.impedance ?? { at20kHz: null, at100kHz: null };

    return (
      <div className="space-y-2">
        <h4 className="text-xs font-black uppercase tracking-wider text-accent">
          {t('onboarding.inbody.groups.impedance')}
        </h4>
        {IMPEDANCE_BANDS.map(({ key, labelKey }) => {
          const band = imp[key];
          if (!band && mode !== 'review') return null;
          return (
            <div key={key} className="rounded-xl border border-subtle bg-surface/40 p-3 space-y-2">
              <p className="text-xs font-bold">{t(labelKey)}</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {SEGMENT_PARTS.map((part) => (
                  <FieldInput
                    key={part}
                    label={t(SEGMENT_PART_LABELS[part])}
                    value={band?.[part] != null ? String(band[part]) : ''}
                    onChange={(v) => updateImpedance(key, part, v)}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderHistory = () => {
    const hist = formData.history;
    if (!hasNestedValue(hist) && mode !== 'review' && !showManual) return null;
    const h: InbodyHistory = hist ?? {
      previousTestDate: null,
      previousWeightKg: null,
      previousSkeletalMuscleMassKg: null,
      previousBodyFatPercent: null,
    };

    return (
      <div className="space-y-2">
        <h4 className="text-xs font-black uppercase tracking-wider text-accent">
          {t('onboarding.inbody.groups.history')}
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {HISTORY_FIELDS.map((field) => (
            <FieldInput
              key={field.key}
              label={t(field.labelKey)}
              unit={field.unitKey ? t(field.unitKey) : undefined}
              type={field.type}
              value={h[field.key as keyof InbodyHistory] != null ? String(h[field.key as keyof InbodyHistory]) : ''}
              onChange={(v) => updateHistory(field.key as keyof InbodyHistory, v)}
            />
          ))}
        </div>
      </div>
    );
  };

  const renderAllFields = () => (
    <div className="space-y-5">
      {INBODY_FIELD_GROUPS.filter((g) => g.id !== 'history').map((group) => (
        <div key={group.id} className="space-y-2">
          <h4 className="text-xs font-black uppercase tracking-wider text-accent">{t(group.labelKey)}</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {group.fields.map((field) => (
              <FieldInput
                key={String(field.key)}
                label={t(field.labelKey)}
                unit={field.unitKey ? t(field.unitKey) : undefined}
                type={field.type}
                value={getFlatValue(formData, field.key)}
                onChange={(v) => updateFlat(field.key, v, field.type)}
              />
            ))}
          </div>
        </div>
      ))}
      {renderSegmentGroup('segmentalLean', 'onboarding.inbody.groups.segmentalLean')}
      {renderSegmentGroup('segmentalFat', 'onboarding.inbody.groups.segmentalFat')}
      {renderHistory()}
      {renderImpedance()}
    </div>
  );

  const continueText =
    saving || continueLoading
      ? t('onboarding.savingHint')
      : continueLabel ?? t('common.continue');

  const body = (
    <>
      {mode === 'idle' || mode === 'manual' ? (
        <>
          <InbodyEducationIntro compact={isCard} />

          <motion.button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={saving || isExtracting}
            className={`w-full rounded-2xl border-2 border-dashed border-subtle bg-surface/60 text-center hover:border-accent/50 transition-colors ${
              isCard ? 'px-3 py-4' : 'px-4 py-6'
            }`}
          >
            <span className={`material-symbols-outlined text-accent mb-1.5 block ${isCard ? 'text-2xl' : 'text-3xl'}`}>
              upload_file
            </span>
            <p className={`font-bold ${isCard ? 'text-xs sm:text-sm' : 'text-sm'}`}>
              {t('onboarding.inbody.uploadTitle')}
            </p>
            <p className={`text-muted mt-0.5 ${isCard ? 'text-[10px] sm:text-xs' : 'text-xs'}`}>
              {t('onboarding.inbody.uploadHint')}
            </p>
          </motion.button>

          {uploadError && (
            <div className="space-y-2">
              <p className="text-sm text-red-400 font-medium">
                {uploadError === 'Internal server error'
                  ? t('onboarding.inbody.errorExtract')
                  : uploadError}
              </p>
              {reportUrl && (
                <button
                  type="button"
                  onClick={handleReload}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-subtle bg-surface/60 px-3 py-2 text-xs font-bold text-accent transition-colors hover:border-accent/50 disabled:opacity-40"
                >
                  <span className="material-symbols-outlined text-base">upload_file</span>
                  {t('onboarding.inbody.reloadReport')}
                </button>
              )}
            </div>
          )}

          <div className="flex items-center gap-3 text-xs text-muted">
            <div className="flex-1 h-px bg-subtle" />
            <span>{t('onboarding.inbody.orManual')}</span>
            <div className="flex-1 h-px bg-subtle" />
          </div>

          <button
            type="button"
            onClick={() => setShowManual((v) => !v)}
            className="text-sm font-bold text-accent"
          >
            {showManual ? t('onboarding.inbody.hideManual') : t('onboarding.inbody.showManual')}
          </button>

          {showManual && renderAllFields()}

          {!isCard && <p className="text-xs text-muted">{t('onboarding.inbody.skipHint')}</p>}
        </>
      ) : null}

      {mode === 'extracting' && isExtracting && (
        <div className="rounded-2xl border border-subtle bg-surface/60 p-6">
          <ExtractingProgress
            title={t('onboarding.inbody.extracting')}
            hint={t('onboarding.inbody.extractingHint')}
          />
        </div>
      )}

      {mode === 'review' && (
        <div className="relative space-y-3">
          {isExtracting && (
            <div className="absolute inset-0 z-10 flex items-start justify-center rounded-2xl bg-background/75 p-4 backdrop-blur-[2px]">
              <div className="w-full max-w-sm rounded-2xl border border-subtle bg-surface/95 p-4 shadow-lg">
                <ExtractingProgress
                  title={t('onboarding.inbody.reanalyzing')}
                  hint={t('onboarding.inbody.extractingHint')}
                />
              </div>
            </div>
          )}
          <div className={isExtracting ? 'pointer-events-none opacity-60' : undefined}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-bold text-accent">{t('onboarding.inbody.reviewTitle')}</p>
                <p className="text-xs text-muted">{t('onboarding.inbody.reviewHint')}</p>
              </div>
              <button
                type="button"
                onClick={handleReload}
                disabled={saving || isExtracting}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-subtle bg-surface/60 px-3 py-2 text-xs font-bold text-accent transition-colors hover:border-accent/50 disabled:opacity-40"
              >
                <span className="material-symbols-outlined text-base">upload_file</span>
                {t('onboarding.inbody.reloadReport')}
              </button>
            </div>
            {renderAllFields()}
            {reportUrl && (
              <a
                href={reportUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-bold text-accent"
              >
                <span className="material-symbols-outlined text-base">description</span>
                {t('onboarding.inbody.viewReport')}
              </a>
            )}
          </div>
        </div>
      )}

      {saveError && (
        <p className="text-sm text-red-400 font-medium">
          {saveError === 'Internal server error' ? t('onboarding.inbody.errorSave') : saveError}
        </p>
      )}
    </>
  );

  return (
    <div className={isCard ? 'flex flex-col flex-1 min-h-0 min-w-0' : 'space-y-3'}>
      <input
        ref={fileRef}
        type="file"
        accept="application/pdf,image/png,image/jpeg,.jpg,.jpeg,.png,.pdf"
        className="hidden"
        onChange={(e) => {
          void handleFile(e.target.files?.[0]);
          e.target.value = '';
        }}
      />

      <div
        className={
          isCard
            ? 'flex-1 min-h-0 overflow-y-auto custom-scrollbar space-y-2.5 sm:space-y-3 pe-0.5'
            : 'space-y-3'
        }
      >
        {body}
      </div>

      {!hideContinue && (
        <motion.div className={isCard ? 'pt-1.5 sm:pt-2 mt-auto shrink-0' : 'pt-2 shrink-0'}>
          <motion.button
            type="button"
            disabled={!canContinue || saving || continueLoading}
            onClick={() => void handleSkipContinue()}
            whileHover={canContinue && !saving ? { scale: 1.02 } : undefined}
            whileTap={canContinue && !saving ? { scale: 0.98 } : undefined}
            className={`w-full font-black rounded-2xl shadow-lg border disabled:opacity-40 ${
              isCard
                ? 'py-3 sm:py-3.5 text-sm sm:text-base bg-gradient-to-r from-primary to-primary/80 text-white shadow-primary/25 border-primary/30'
                : `py-3.5 ${
                    canContinue
                      ? 'bg-accent text-background hover:opacity-90'
                      : 'bg-subtle text-faint cursor-not-allowed'
                  }`
            }`}
          >
            {continueText}
          </motion.button>
        </motion.div>
      )}
    </div>
  );
};
