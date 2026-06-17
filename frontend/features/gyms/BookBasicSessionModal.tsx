import React, { useState, lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useI18n } from '../../lib/i18n/useI18n';
import gymService from '../../services/gymService';
import type { GymBasicSession } from '../../types';
import { isValidEgyptianPhone, normalizePhoneE164 } from '../../lib/phoneNormalize';
import { weightedTransition } from '../../lib/motion';

const LazyImageUploader = lazy(() =>
  import('../../components/shared/ImageUploader').then((m) => ({ default: m.ImageUploader })),
);

type PaymentMethod = 'cash' | 'card' | 'transfer' | 'online';
const PAYMENT_METHODS: PaymentMethod[] = ['cash', 'card', 'transfer', 'online'];

function sessionLabel(session: GymBasicSession, language: string) {
  if (language === 'ar' && session.nameAr) return session.nameAr;
  return session.name;
}

interface Props {
  gymId: string;
  session: GymBasicSession;
  onClose: () => void;
  onBooked?: () => void;
  onUnavailable?: () => void;
}

export const BookBasicSessionModal: React.FC<Props> = ({
  gymId,
  session,
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
      ? `${session.price.toLocaleString('ar-EG')} ج.م`
      : `${session.price.toLocaleString('en-US')} ${session.currency}`;

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
    const res = await gymService.bookBasicSession(gymId, session.id, {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim().toLowerCase(),
      phone: normalizedPhone,
      address: address.trim() || undefined,
      gender: gender || undefined,
      avatarUrl: avatarUrl || undefined,
      paymentMethod,
      paidAmount: session.price,
    });
    setSubmitting(false);

    if (res.error) {
      if (
        res.error === 'Session not found' ||
        res.error === 'This session is no longer available for booking'
      ) {
        onUnavailable?.();
        return;
      }
      setError(res.error);
      return;
    }

    const name = `${firstName.trim()} ${lastName.trim()}`.trim();
    setSuccess(
      res.data?.accountCreated
        ? t('basicSessions.bookingSuccessNew', { name })
        : t('basicSessions.bookingSuccess', { name }),
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
            <h3 className="text-2xl font-black">{t('basicSessions.bookSession')}</h3>
            <p className="mt-1 text-sm text-muted">{t('basicSessions.bookSessionHint')}</p>
          </div>

          <div className="rounded-2xl border border-subtle bg-elevated p-4 space-y-2">
            <p className="text-3xl leading-none">{session.icon ?? '✨'}</p>
            <p className="text-lg font-black text-primary">{sessionLabel(session, language)}</p>
            <p className="text-xs text-muted">{t('basicSessions.noSchedule')}</p>
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
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full rounded-xl border border-subtle bg-elevated px-4 py-3 font-bold focus:outline-none focus:ring-2 focus:ring-primary/40"
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
              <option value="">{t('reception.genderOptional')}</option>
              <option value="male">{t('reception.genderMale')}</option>
              <option value="female">{t('reception.genderFemale')}</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-faint">
              {t('reception.paymentMethod')}
            </label>
            <div className="grid grid-cols-2 gap-2">
              {PAYMENT_METHODS.map((method) => (
                <button
                  key={method}
                  type="button"
                  onClick={() => setPaymentMethod(method)}
                  className={`rounded-xl border px-3 py-2.5 text-xs font-bold transition-colors ${
                    paymentMethod === method
                      ? 'border-primary bg-primary/15 text-primary'
                      : 'border-subtle bg-elevated text-muted hover:border-primary/30'
                  }`}
                >
                  {t(`reception.payment.${method}` as 'reception.payment.cash')}
                </button>
              ))}
            </div>
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}
          {success && <p className="text-sm font-bold text-primary">{success}</p>}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-2xl border border-subtle py-3 text-sm font-bold text-muted"
            >
              {t('basicSessions.cancel')}
            </button>
            <button
              type="button"
              disabled={!canSubmit || submitting || Boolean(success)}
              onClick={() => void submit()}
              className="flex-1 rounded-2xl bg-primary py-3 text-sm font-black text-white disabled:opacity-40"
            >
              {submitting ? t('basicSessions.saving') : t('basicSessions.confirmBooking')}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
