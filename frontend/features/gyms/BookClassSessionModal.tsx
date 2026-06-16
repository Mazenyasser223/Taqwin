import React, { useState, lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useI18n } from '../../lib/i18n/useI18n';
import gymService from '../../services/gymService';
import type { GymClass } from '../../types';
import { formatClassSchedule } from '../../lib/gymClassSchedule';
import { isValidEgyptianPhone, normalizePhoneE164 } from '../../lib/phoneNormalize';
import { weightedTransition } from '../../lib/motion';

const LazyImageUploader = lazy(() =>
  import('../../components/shared/ImageUploader').then((m) => ({ default: m.ImageUploader })),
);

type PaymentMethod = 'cash' | 'card' | 'transfer' | 'online';
const PAYMENT_METHODS: PaymentMethod[] = ['cash', 'card', 'transfer', 'online'];

function classLabel(cls: GymClass, language: string) {
  if (language === 'ar' && cls.nameAr) return cls.nameAr;
  return cls.name;
}

interface Props {
  gymId: string;
  gymClass: GymClass;
  onClose: () => void;
  onBooked?: () => void;
  onUnavailable?: () => void;
}

export const BookClassSessionModal: React.FC<Props> = ({
  gymId,
  gymClass,
  onClose,
  onBooked,
  onUnavailable,
}) => {
  const { t, language } = useI18n();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | ''>('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const priceLabel =
    language === 'ar'
      ? `${gymClass.price.toLocaleString('ar-EG')} ج.م`
      : `${gymClass.price.toLocaleString('en-US')} ${gymClass.currency}`;

  const canSubmit =
    firstName.trim().length > 0 &&
    lastName.trim().length > 0 &&
    email.trim().length > 0 &&
    (!phone.trim() || isValidEgyptianPhone(phone.trim()));

  const submit = async () => {
    if (!canSubmit) {
      setError(t('reception.registerRequired'));
      return;
    }
    const phoneRaw = phone.trim();
    let normalizedPhone: string | undefined;
    if (phoneRaw) {
      if (!isValidEgyptianPhone(phoneRaw)) {
        setError(t('reception.phoneInvalid'));
        return;
      }
      normalizedPhone = normalizePhoneE164(phoneRaw) ?? undefined;
    }

    setSubmitting(true);
    setError(null);
    const res = await gymService.bookClassSession(gymId, gymClass.id, {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim().toLowerCase(),
      phone: normalizedPhone,
      address: address.trim() || undefined,
      gender: gender || undefined,
      avatarUrl: avatarUrl || undefined,
      paymentMethod,
      paidAmount: gymClass.price,
    });
    setSubmitting(false);

    if (res.error) {
      const unavailable =
        res.error === 'Class not found' ||
        res.error === 'This class is no longer available for booking' ||
        res.error === 'This class session has already ended';
      if (unavailable) {
        onUnavailable?.();
        return;
      }
      if (res.code === 'MEMBER_CLASS_CONFLICT' && res.conflict?.name) {
        setError(
          t('gymClasses.errorMemberConflict', {
            name: res.conflict.name,
            startTime: res.conflict.startTime ?? '',
            endTime: res.conflict.endTime ?? '',
          }),
        );
        return;
      }
      setError(res.error);
      return;
    }

    const name = `${firstName.trim()} ${lastName.trim()}`.trim();
    setSuccess(
      res.data?.accountCreated
        ? t('gymClasses.bookingSuccessNew', { name })
        : t('gymClasses.bookingSuccess', { name }),
    );
    onBooked?.();
    window.setTimeout(onClose, 1400);
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[60] flex items-end justify-center bg-background/80 p-4 backdrop-blur-sm safe-bottom sm:items-center"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95 }}
          animate={{ scale: 1 }}
          exit={{ scale: 0.95 }}
          transition={weightedTransition}
          onClick={(e) => e.stopPropagation()}
          className="glass-panel custom-scrollbar max-h-[90vh] w-full max-w-md space-y-5 overflow-y-auto rounded-t-3xl p-6 sm:rounded-3xl sm:p-8"
        >
          <div>
            <h3 className="text-2xl font-black">{t('gymClasses.bookSession')}</h3>
            <p className="mt-1 text-sm text-muted">{t('gymClasses.bookSessionHint')}</p>
          </div>

          <div className="rounded-2xl border border-subtle bg-elevated p-4 space-y-2">
            <p className="text-lg font-black text-primary">{classLabel(gymClass, language)}</p>
            <p className="text-sm font-bold">{gymClass.staff?.fullName}</p>
            <p className="text-xs text-muted">{formatClassSchedule(gymClass, language)}</p>
            <p className="text-sm font-black">{priceLabel}</p>
          </div>

          <div className="flex justify-center">
            <Suspense fallback={<div className="size-24 animate-pulse rounded-full bg-elevated" />}>
              <LazyImageUploader
                folder="avatars"
                value={avatarUrl}
                onChange={setAvatarUrl}
                size="size-24"
                layout="stacked"
                label={t('reception.uploadPhoto')}
              />
            </Suspense>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-faint">
                {t('reception.firstName')}
              </label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full rounded-xl border border-subtle bg-elevated px-4 py-3 font-bold focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-faint">
                {t('reception.lastName')}
              </label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full rounded-xl border border-subtle bg-elevated px-4 py-3 font-bold focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-faint">
              {t('members.memberEmail')}
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-subtle bg-elevated px-4 py-3 font-bold focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-faint">
              {t('reception.phone')}
            </label>
            <input
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder={t('settings.phonePlaceholder')}
              className={`w-full rounded-xl border bg-elevated px-4 py-3 font-bold focus:outline-none focus:ring-2 focus:ring-primary/40 ${
                phone.trim() && !isValidEgyptianPhone(phone.trim()) ? 'border-red-500/50' : 'border-subtle'
              }`}
            />
            {phone.trim() && !isValidEgyptianPhone(phone.trim()) ? (
              <p className="text-xs text-red-400">{t('reception.phoneInvalid')}</p>
            ) : (
              <p className="text-xs text-muted">{t('reception.phoneHint')}</p>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-faint">
              {t('reception.address')}
            </label>
            <textarea
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              rows={3}
              className="w-full resize-none rounded-xl border border-subtle bg-elevated px-4 py-3 font-bold focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-faint">
              {t('reception.genderOptional')}
            </label>
            <select
              value={gender}
              onChange={(e) => setGender(e.target.value as 'male' | 'female' | '')}
              className="w-full rounded-xl border border-subtle bg-elevated px-4 py-3 font-bold focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              <option value="">—</option>
              <option value="male">{t('reception.genderMale')}</option>
              <option value="female">{t('reception.genderFemale')}</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-faint">
              {t('reception.paymentMethod')}
            </label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
              className="w-full rounded-xl border border-subtle bg-elevated px-4 py-3 font-bold focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              {PAYMENT_METHODS.map((method) => (
                <option key={method} value={method}>
                  {t(`reception.payment.${method}`)}
                </option>
              ))}
            </select>
          </div>

          {error && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">{error}</div>
          )}
          {success && (
            <div className="rounded-xl border border-primary/20 bg-primary/10 p-3 text-sm font-bold text-primary">
              {success}
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="flex-1 rounded-xl border border-subtle bg-elevated py-3 font-bold"
            >
              {t('common.cancel')}
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={submitting || !canSubmit || !!success}
              className="flex-1 rounded-xl bg-primary py-3 font-bold text-white shadow-lg disabled:opacity-50"
            >
              {submitting ? t('gymClasses.saving') : t('gymClasses.confirmBooking')}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
