import React from 'react';
import { useI18n } from '../../lib/i18n/useI18n';
import { EGYPT_GOVERNORATES, governorateLabel } from './egGovernorates';
import type { ShippingAddress } from './shippingAddressStorage';

interface CartShippingFormProps {
  value: ShippingAddress;
  onChange: (next: ShippingAddress) => void;
  disabled?: boolean;
}

const inputClass =
  'w-full rounded-xl border border-subtle bg-elevated px-3 py-2.5 text-sm font-medium text-foreground outline-none focus:border-primary';

const selectClass = `${inputClass} ui-select`;

export const CartShippingForm: React.FC<CartShippingFormProps> = ({
  value,
  onChange,
  disabled,
}) => {
  const { t, language } = useI18n();

  const setField = <K extends keyof ShippingAddress>(key: K, fieldValue: ShippingAddress[K]) => {
    onChange({ ...value, [key]: fieldValue });
  };

  return (
    <div className="glass-panel space-y-4 rounded-2xl border border-subtle p-5 sm:p-6">
      <div>
        <h2 className="text-base font-black text-foreground">{t('marketplace.shippingTitle')}</h2>
        <p className="text-xs text-muted">{t('marketplace.shippingSubtitle')}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block space-y-1.5 sm:col-span-1">
          <span className="text-[10px] font-black uppercase tracking-widest text-faint">
            {t('marketplace.shippingGovernorate')}
          </span>
          <select
            value={value.governorate}
            disabled={disabled}
            onChange={(e) => setField('governorate', e.target.value)}
            className={selectClass}
          >
            <option value="">{t('marketplace.shippingGovernoratePlaceholder')}</option>
            {EGYPT_GOVERNORATES.map((gov) => (
              <option key={gov.id} value={governorateLabel(gov, language)}>
                {governorateLabel(gov, language)}
              </option>
            ))}
          </select>
        </label>

        <label className="block space-y-1.5 sm:col-span-1">
          <span className="text-[10px] font-black uppercase tracking-widest text-faint">
            {t('marketplace.shippingCity')}
          </span>
          <input
            type="text"
            value={value.city}
            disabled={disabled}
            onChange={(e) => setField('city', e.target.value)}
            placeholder={t('marketplace.shippingCityPlaceholder')}
            className={inputClass}
          />
        </label>

        <label className="block space-y-1.5 sm:col-span-2">
          <span className="text-[10px] font-black uppercase tracking-widest text-faint">
            {t('marketplace.shippingAddress')}
          </span>
          <textarea
            value={value.address}
            disabled={disabled}
            onChange={(e) => setField('address', e.target.value)}
            placeholder={t('marketplace.shippingAddressPlaceholder')}
            rows={3}
            className={`${inputClass} resize-none`}
          />
        </label>

        <label className="block space-y-1.5 sm:col-span-2">
          <span className="text-[10px] font-black uppercase tracking-widest text-faint">
            {t('marketplace.shippingPhone')}
          </span>
          <input
            type="tel"
            inputMode="tel"
            value={value.phone}
            disabled={disabled}
            onChange={(e) => setField('phone', e.target.value)}
            placeholder={t('marketplace.shippingPhonePlaceholder')}
            className={inputClass}
          />
        </label>
      </div>
    </div>
  );
};
