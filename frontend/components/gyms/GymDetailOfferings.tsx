import React, { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useI18n } from '../../lib/i18n/useI18n';
import gymService from '../../services/gymService';
import type { GymBasicSession, GymClass } from '../../types';
import { formatClassSchedule } from '../../lib/gymClassSchedule';
import { resolveMediaUrl } from '../../lib/mediaUrl';
import { useAuthStore } from '../../store/useAuthStore';
import { weightedTransition } from '../../lib/motion';

type PaymentMethod = 'cash' | 'card' | 'transfer' | 'online';
const PAYMENT_METHODS: PaymentMethod[] = ['cash', 'card', 'transfer', 'online'];

const FALLBACK_CLASS_IMAGE =
  'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=600&h=400&fit=crop';

function sessionLabel(session: GymBasicSession, language: string) {
  if (language === 'ar' && session.nameAr) return session.nameAr;
  return session.name;
}

function classLabel(cls: GymClass, language: string) {
  if (language === 'ar' && cls.nameAr) return cls.nameAr;
  return cls.name;
}

function formatMoney(amount: number, language: string, currency = 'EGP') {
  const suffix = language === 'ar' ? ' ج.م' : ` ${currency}`;
  return `${amount.toLocaleString(language === 'ar' ? 'ar-EG' : 'en-US')}${suffix}`;
}

interface Props {
  gymId: string;
}

export const GymDetailOfferings: React.FC<Props> = ({ gymId }) => {
  const { t, language } = useI18n();
  const { isAuthenticated, user } = useAuthStore();
  const [basicSessions, setBasicSessions] = useState<GymBasicSession[]>([]);
  const [classes, setClasses] = useState<GymClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bookingBasic, setBookingBasic] = useState<GymBasicSession | null>(null);
  const [bookingClass, setBookingClass] = useState<GymClass | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('online');
  const [submitting, setSubmitting] = useState(false);
  const [bookError, setBookError] = useState<string | null>(null);
  const [bookSuccess, setBookSuccess] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const [sessionsRes, classesRes] = await Promise.all([
      gymService.getCatalogBasicSessions(gymId),
      gymService.getCatalogClasses(gymId),
    ]);
    if (sessionsRes.error && classesRes.error) {
      setError(sessionsRes.error);
    } else {
      setError(null);
    }
    setBasicSessions(sessionsRes.data ?? []);
    setClasses(classesRes.data ?? []);
  }, [gymId]);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    reload().finally(() => {
      if (mounted) setLoading(false);
    });
    return () => {
      mounted = false;
    };
  }, [reload]);

  const closeBookModal = () => {
    setBookingBasic(null);
    setBookingClass(null);
    setBookError(null);
    setBookSuccess(null);
    setPaymentMethod('online');
  };

  const submitBasicBook = async () => {
    if (!bookingBasic) return;
    setSubmitting(true);
    setBookError(null);
    const res = await gymService.selfBookBasicSession(gymId, bookingBasic.id, { paymentMethod });
    setSubmitting(false);
    if (res.error) {
      setBookError(res.error);
      return;
    }
    setBookSuccess(t('gyms.selfBookSuccess', { name: sessionLabel(bookingBasic, language) }));
    window.setTimeout(closeBookModal, 1400);
  };

  const submitClassBook = async () => {
    if (!bookingClass) return;
    setSubmitting(true);
    setBookError(null);
    const res = await gymService.selfBookClassSession(gymId, bookingClass.id, { paymentMethod });
    setSubmitting(false);
    if (res.error) {
      if (res.code === 'MEMBER_CLASS_CONFLICT' && res.conflict?.name) {
        setBookError(
          t('gymClasses.errorMemberConflict', {
            name: res.conflict.name,
            startTime: res.conflict.startTime ?? '',
            endTime: res.conflict.endTime ?? '',
          }),
        );
        return;
      }
      setBookError(res.error);
      return;
    }
    setBookSuccess(t('gyms.selfBookSuccess', { name: classLabel(bookingClass, language) }));
    window.setTimeout(closeBookModal, 1400);
  };

  const handleBookClick = (type: 'basic' | 'class', item: GymBasicSession | GymClass) => {
    if (!isAuthenticated) return;
    setBookError(null);
    setBookSuccess(null);
    setPaymentMethod('online');
    if (type === 'basic') setBookingBasic(item as GymBasicSession);
    else setBookingClass(item as GymClass);
  };

  if (loading) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted text-center py-6">{t('gyms.offeringsLoading')}</p>
      </div>
    );
  }

  if (error && basicSessions.length === 0 && classes.length === 0) {
    return null;
  }

  const showBasic = basicSessions.length > 0;
  const showClasses = classes.length > 0;
  if (!showBasic && !showClasses) return null;

  const activeModal = bookingBasic ?? bookingClass;
  const modalTitle = bookingBasic
    ? sessionLabel(bookingBasic, language)
    : bookingClass
      ? classLabel(bookingClass, language)
      : '';
  const modalPrice = bookingBasic?.price ?? bookingClass?.price ?? 0;
  const modalCurrency = bookingBasic?.currency ?? bookingClass?.currency ?? 'EGP';

  return (
    <>
      {showBasic && (
        <div className="space-y-3">
          <h4 className="text-xs font-black uppercase tracking-widest text-primary">
            {t('basicSessions.title')}
          </h4>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {basicSessions.map((session) => (
              <article
                key={session.id}
                className="flex flex-col rounded-2xl border border-subtle bg-elevated/60 p-4"
              >
                <span className="text-3xl leading-none">{session.icon ?? '✨'}</span>
                <h5 className="mt-2 font-bold">{sessionLabel(session, language)}</h5>
                <p className="mt-1 text-xs text-muted">{t('basicSessions.noSchedule')}</p>
                <p className="mt-2 text-sm font-black text-primary">
                  {formatMoney(session.price, language, session.currency)}
                </p>
                <button
                  type="button"
                  disabled={!isAuthenticated}
                  onClick={() => handleBookClick('basic', session)}
                  className="mt-auto flex w-full items-center justify-center gap-2 rounded-xl border border-subtle bg-elevated py-2.5 text-sm font-bold transition-colors hover:border-primary/40 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <span className="material-symbols-outlined text-base">event_available</span>
                  {t('basicSessions.bookSession')}
                </button>
              </article>
            ))}
          </div>
        </div>
      )}

      {showClasses && (
        <div className="space-y-3">
          <h4 className="text-xs font-black uppercase tracking-widest text-primary">
            {t('gymClasses.title')}
          </h4>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {classes.map((cls) => {
              const image = cls.imageUrl ? resolveMediaUrl(cls.imageUrl) : FALLBACK_CLASS_IMAGE;
              return (
                <article
                  key={cls.id}
                  className="flex flex-col overflow-hidden rounded-2xl border border-subtle bg-elevated/60"
                >
                  <div className="relative aspect-[16/9] overflow-hidden bg-elevated">
                    <img src={image} alt="" className="size-full object-cover" />
                    <div className="absolute end-2 top-2 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-bold text-white">
                      {formatMoney(cls.price, language, cls.currency)}
                    </div>
                  </div>
                  <div className="flex flex-1 flex-col p-4">
                    <h5 className="font-bold">{classLabel(cls, language)}</h5>
                    <p className="mt-1 text-xs font-semibold text-primary">
                      {cls.staff?.fullName ?? t('gymClasses.noTrainer')}
                    </p>
                    <p className="mt-1 text-xs text-muted">{formatClassSchedule(cls, language)}</p>
                    <button
                      type="button"
                      disabled={!isAuthenticated}
                      onClick={() => handleBookClick('class', cls)}
                      className="mt-auto flex w-full items-center justify-center gap-2 rounded-xl border border-subtle bg-elevated py-2.5 text-sm font-bold transition-colors hover:border-primary/40 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <span className="material-symbols-outlined text-base">calendar_month</span>
                      {t('gymClasses.bookSession')}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      )}

      {!isAuthenticated && (showBasic || showClasses) && (
        <p className="text-xs text-muted">{t('gyms.bookSignInRequired')}</p>
      )}

      <AnimatePresence>
        {activeModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-end justify-center bg-background/80 p-4 backdrop-blur-sm safe-bottom sm:items-center"
            onClick={closeBookModal}
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
                <h3 className="text-2xl font-black">{t('gyms.selfBookTitle')}</h3>
                <p className="mt-1 text-sm text-muted">{t('gyms.selfBookHint')}</p>
              </div>

              <div className="rounded-2xl border border-subtle bg-elevated p-4 space-y-2">
                <p className="text-lg font-black text-primary">{modalTitle}</p>
                <p className="text-sm font-black">{formatMoney(modalPrice, language, modalCurrency)}</p>
                {bookingClass && (
                  <p className="text-xs text-muted">{formatClassSchedule(bookingClass, language)}</p>
                )}
                {user && (
                  <p className="text-xs text-muted pt-1">
                    {user.profile?.displayName ?? user.email}
                  </p>
                )}
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

              {bookError && <p className="text-sm text-red-400">{bookError}</p>}
              {bookSuccess && <p className="text-sm font-bold text-primary">{bookSuccess}</p>}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeBookModal}
                  className="flex-1 rounded-2xl border border-subtle py-3 text-sm font-bold text-muted"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="button"
                  disabled={submitting || Boolean(bookSuccess)}
                  onClick={() => void (bookingBasic ? submitBasicBook() : submitClassBook())}
                  className="flex-1 rounded-2xl bg-primary py-3 text-sm font-black text-white disabled:opacity-40"
                >
                  {submitting ? t('basicSessions.saving') : t('basicSessions.confirmBooking')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
