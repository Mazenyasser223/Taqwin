import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useI18n } from '../../../lib/i18n/useI18n';
import gymService from '../../../services/gymService';
import type { Gym } from '../../../types';
import type { OnboardingAnswers } from '../types';
import { OptionCard } from './OptionCard';

const OTHER_VALUE = '__other__';
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

export interface GymPickerStepProps {
  field: 'gymLink';
  placeholder?: string;
  optional?: boolean;
  answers: OnboardingAnswers;
  onAnswer: (stepId: string, value: string) => void;
  onContinue: (pending?: OnboardingAnswers) => void;
  hideContinue?: boolean;
  compact?: boolean;
}

export const GymPickerStep: React.FC<GymPickerStepProps> = ({
  field,
  placeholder,
  optional = false,
  answers,
  onAnswer,
  onContinue,
  hideContinue = false,
  compact = false,
}) => {
  const { t } = useI18n();
  const saved = String(answers[field] ?? '');
  const savedIsUuid = saved.length > 0 && isUuid(saved);

  const [gyms, setGyms] = useState<Gym[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(savedIsUuid ? saved : null);
  const [mode, setMode] = useState<'list' | 'other'>(saved && !savedIsUuid ? 'other' : 'list');
  const [customText, setCustomText] = useState(saved && !savedIsUuid ? saved : '');

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setLoadError(null);
    gymService.getGyms().then((res) => {
      if (!mounted) return;
      if (res.error) setLoadError(res.error);
      else setGyms((res.data ?? []).filter((g) => g.isActive !== false));
      setLoading(false);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const filteredGyms = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return gyms;
    return gyms.filter(
      (g) =>
        g.name.toLowerCase().includes(q) ||
        g.location.toLowerCase().includes(q),
    );
  }, [gyms, search]);

  const selectGym = (gym: Gym) => {
    setMode('list');
    setSelectedId(gym.id);
    setCustomText('');
    onAnswer(field, gym.id);
    onAnswer('gymLinkName', gym.name);
  };

  const selectOther = () => {
    setMode('other');
    setSelectedId(null);
    onAnswer(field, '');
    onAnswer('gymLinkName', '');
  };

  const canContinue =
    optional ||
    (mode === 'list' && Boolean(selectedId)) ||
    (mode === 'other' && customText.trim().length >= 2);

  const showSkipLabel = optional && !selectedId && !customText.trim();

  return (
    <motion.div
      className={`flex flex-col min-h-0 ${compact ? 'flex-1 gap-1.5' : 'gap-3'}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={t('onboarding.gymLink.search')}
        className="w-full shrink-0 bg-surface border border-subtle rounded-xl sm:rounded-2xl px-3 sm:px-4 py-2.5 sm:py-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary/40"
      />

      <motion.div
        className={`flex flex-col gap-1 sm:gap-1.5 min-h-0 ${
          compact ? 'flex-1 overflow-y-auto overscroll-contain custom-scrollbar' : 'max-h-[min(42vh,320px)] overflow-y-auto custom-scrollbar'
        }`}
      >
        {loading && (
          <p className="text-sm text-faint text-center py-4">{t('onboarding.gymLink.loading')}</p>
        )}
        {loadError && (
          <p className="text-sm text-red-400 text-center py-2 px-1">{loadError}</p>
        )}
        {!loading && filteredGyms.length === 0 && (
          <p className="text-sm text-faint text-center py-3">{t('onboarding.gymLink.empty')}</p>
        )}
        {!loading &&
          filteredGyms.map((gym) => (
            <OptionCard
              key={gym.id}
              opt={{ value: gym.id, label: gym.name, description: gym.location }}
              variant="default"
              layout="row"
              compact
              dense
              selected={mode === 'list' && selectedId === gym.id}
              onSelect={() => selectGym(gym)}
              trailing={
                <span
                  className={`rounded-lg border flex-shrink-0 flex items-center justify-center size-5 ${
                    mode === 'list' && selectedId === gym.id
                      ? 'bg-primary border-primary'
                      : 'border-subtle bg-background/50'
                  }`}
                >
                  {mode === 'list' && selectedId === gym.id && (
                    <span className="material-symbols-outlined text-foreground text-xs">check</span>
                  )}
                </span>
              }
            />
          ))}
      </motion.div>

      <motion.div className="shrink-0 pt-0.5 border-t border-subtle/50 space-y-1.5">
        <OptionCard
          opt={{ value: OTHER_VALUE, label: t('onboarding.gymLink.other') }}
          variant="default"
          layout="row"
          compact
          dense
          selected={mode === 'other'}
          onSelect={selectOther}
          trailing={
            <span
              className={`rounded-lg border flex-shrink-0 flex items-center justify-center size-5 ${
                mode === 'other' ? 'bg-primary border-primary' : 'border-subtle bg-background/50'
              }`}
            >
              {mode === 'other' && (
                <span className="material-symbols-outlined text-foreground text-xs">check</span>
              )}
            </span>
          }
        />
        {mode === 'other' && (
          <input
            type="text"
            value={customText}
            onChange={(e) => {
              const v = e.target.value;
              setCustomText(v);
              onAnswer(field, v);
              onAnswer('gymLinkName', v.trim());
            }}
            placeholder={placeholder ?? t('onboarding.gymLink.otherPlaceholder')}
            maxLength={120}
            className="w-full bg-surface border border-subtle rounded-xl px-3 py-2.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        )}
      </motion.div>

      {!hideContinue && (
        <motion.button
          type="button"
          disabled={!canContinue}
          onClick={() => {
            const pending: OnboardingAnswers = {};
            if (mode === 'list' && selectedId) {
              pending[field] = selectedId;
              const gym = gyms.find((g) => g.id === selectedId);
              if (gym) pending.gymLinkName = gym.name;
            } else if (mode === 'other') {
              const trimmed = customText.trim();
              pending[field] = trimmed;
              pending.gymLinkName = trimmed;
            }
            onContinue(Object.keys(pending).length > 0 ? pending : undefined);
          }}
          whileTap={canContinue ? { scale: 0.98 } : undefined}
          className={`w-full rounded-2xl bg-primary text-white font-black text-sm disabled:opacity-40 shadow-lg shadow-primary/20 ${
            compact ? 'shrink-0 py-3' : 'py-3.5'
          }`}
        >
          {showSkipLabel ? t('onboarding.catalog.skipStep') : t('common.continue')}
        </motion.button>
      )}
    </motion.div>
  );
};
