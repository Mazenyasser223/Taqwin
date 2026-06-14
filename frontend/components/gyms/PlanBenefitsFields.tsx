import React from 'react';
import { useI18n } from '../../lib/i18n/useI18n';
import { planBenefitLines, type GymPlanBenefits, type PlanBenefitsForm } from '../../lib/gymPlanBenefits';

type Props = {
  value: PlanBenefitsForm;
  onChange: (next: PlanBenefitsForm) => void;
};

function BenefitInput({
  label,
  value,
  onChange,
  placeholder,
  unlimitedLabel,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  unlimitedLabel: string;
}) {
  const isUnlimited = value === 'unlimited';

  return (
    <div className="block space-y-1.5">
      <span className="text-xs font-bold text-faint uppercase">{label}</span>
      <input
        type="number"
        min={0}
        inputMode="numeric"
        value={isUnlimited ? '' : value}
        disabled={isUnlimited}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-elevated border border-white/10 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-50"
      />
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={isUnlimited}
          onChange={(e) => onChange(e.target.checked ? 'unlimited' : '')}
          className="rounded accent-primary"
        />
        <span className="text-xs text-muted">{unlimitedLabel}</span>
      </label>
    </div>
  );
}

export const PlanBenefitsFields: React.FC<Props> = ({ value, onChange }) => {
  const { t } = useI18n();
  const placeholder = t('gymDash.benefitInputPlaceholder');
  const unlimitedLabel = t('gymDash.benefitUnlimited');

  return (
    <div className="space-y-3 rounded-2xl border border-white/10 bg-elevated/30 p-4">
      <div>
        <p className="text-xs font-bold text-faint uppercase">{t('gymDash.planPerks')}</p>
        <p className="text-xs text-muted mt-1">{t('gymDash.planPerksHint')}</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <BenefitInput
          label={t('gymDash.benefitFreezeWeeksLabel')}
          value={value.freezeWeeks}
          onChange={(freezeWeeks) => onChange({ ...value, freezeWeeks })}
          placeholder={placeholder}
          unlimitedLabel={unlimitedLabel}
        />
        <BenefitInput
          label={t('gymDash.benefitInvitationsLabel')}
          value={value.invitations}
          onChange={(invitations) => onChange({ ...value, invitations })}
          placeholder={placeholder}
          unlimitedLabel={unlimitedLabel}
        />
        <BenefitInput
          label={t('gymDash.benefitCoachSessionsLabel')}
          value={value.privateCoachSessions}
          onChange={(privateCoachSessions) => onChange({ ...value, privateCoachSessions })}
          placeholder={placeholder}
          unlimitedLabel={unlimitedLabel}
        />
        <BenefitInput
          label={t('gymDash.benefitSpaLabel')}
          value={value.spa}
          onChange={(spa) => onChange({ ...value, spa })}
          placeholder={placeholder}
          unlimitedLabel={unlimitedLabel}
        />
        <BenefitInput
          label={t('gymDash.benefitJacuzziLabel')}
          value={value.jacuzzi}
          onChange={(jacuzzi) => onChange({ ...value, jacuzzi })}
          placeholder={placeholder}
          unlimitedLabel={unlimitedLabel}
        />
        <BenefitInput
          label={t('gymDash.benefitSaunaLabel')}
          value={value.sauna}
          onChange={(sauna) => onChange({ ...value, sauna })}
          placeholder={placeholder}
          unlimitedLabel={unlimitedLabel}
        />
      </div>
    </div>
  );
};

export const PlanBenefitsList: React.FC<{
  benefits?: GymPlanBenefits | null;
  className?: string;
}> = ({ benefits, className = '' }) => {
  const { t } = useI18n();
  const lines = planBenefitLines(benefits, t);
  if (!lines.length) return null;
  return (
    <ul className={`space-y-1 ${className}`}>
      {lines.map((line) => (
        <li key={line} className="text-xs text-muted flex items-center gap-1.5">
          <span className="material-symbols-outlined text-sm text-primary">check_circle</span>
          {line}
        </li>
      ))}
    </ul>
  );
};
