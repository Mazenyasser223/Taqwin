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
const PAYMENT_METHODS: { id: PaymentMethod; icon: string }[] = [
  { id: 'cash', icon: 'payments' },
  { id: 'card', icon: 'credit_card' },
  { id: 'transfer', icon: 'account_balance' },
  { id: 'online', icon: 'language' },
];

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
  const modalIcon = bookingBasic?.icon ?? (bookingClass ? '🏋️' : '✨');
  const userDisplayName = user?.profile?.displayName ?? user?.name ?? user?.email ?? '';
  const userAvatar = user?.profile?.avatarUrl ?? user?.avatar;
  const userInitial = userDisplayName.trim().charAt(0).toUpperCase() || '?';

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
            className="fixed inset-0 z-[200] flex items-end justify-center bg-black/75 p-4 backdrop-blur-md safe-bottom sm:items-center"
            onClick={closeBookModal}
          >
            <motion.div
              initial={{ scale: 0.95, y: 12 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 12 }}
              transition={weightedTransition}
              onClick={(e) => e.stopPropagation()}
              className="flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl border border-subtle bg-surface shadow-2xl sm:rounded-3xl"
            >
              <div className="relative shrink-0 border-b border-subtle bg-gradient-to-br from-primary/15 via-surface to-surface px-6 pb-5 pt-6 sm:px-8 sm:pt-8">
                <button
                  type="button"
                  onClick={closeBookModal}
                  aria-label={t('common.cancel')}
                  className="absolute end-4 top-4 flex size-10 items-center justify-center rounded-xl bg-elevated/80 text-muted transition-colors hover:bg-elevated-hover hover:text-primary sm:end-6 sm:top-6"
                >
                  <span className="material-symbols-outlined text-xl">close</span>
                </button>
                <div className="flex items-start gap-4 pe-12">
                  <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary">
                    <span className="material-symbols-outlined text-2xl">event_available</span>
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-xl font-black leading-tight sm:text-2xl">{t('gyms.selfBookTitle')}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-muted">{t('gyms.selfBookHint')}</p>
                  </div>
                </div>
              </div>

              <div className="custom-scrollbar flex-1 space-y-5 overflow-y-auto bg-surface px-6 py-5 sm:px-8">
                {bookSuccess ? (
                  <div className="flex flex-col items-center gap-3 rounded-2xl border border-primary/25 bg-primary/10 px-6 py-10 text-center">
                    <div className="flex size-16 items-center justify-center rounded-full bg-primary/20 text-primary">
                      <span className="material-symbols-outlined text-4xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                        check_circle
                      </span>
                    </div>
                    <p className="text-base font-black text-primary">{bookSuccess}</p>
                  </div>
                ) : (
                  <>
                    <div className="overflow-hidden rounded-2xl border border-subtle bg-background">
                      <div className="flex items-center gap-4 border-b border-subtle bg-background px-4 py-4">
                        <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-3xl leading-none">
                          {modalIcon}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-lg font-black text-primary">{modalTitle}</p>
                          {bookingBasic && (
                            <p className="mt-0.5 text-xs text-muted">{t('basicSessions.noSchedule')}</p>
                          )}
                          {bookingClass && (
                            <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-muted">
                              <span className="material-symbols-outlined text-sm text-primary">schedule</span>
                              {formatClassSchedule(bookingClass, language)}
                            </p>
                          )}
                        </div>
                        <div className="shrink-0 text-end">
                          <p className="text-[10px] font-black uppercase tracking-widest text-faint">
                            {t('marketplace.total')}
                          </p>
                          <p className="text-lg font-black text-primary">
                            {formatMoney(modalPrice, language, modalCurrency)}
                          </p>
                        </div>
                      </div>

                      {user && (
                        <div className="flex items-center gap-3 px-4 py-3">
                          {userAvatar ? (
                            <img
                              src={resolveMediaUrl(userAvatar)}
                              alt=""
                              className="size-10 shrink-0 rounded-full border border-subtle object-cover"
                            />
                          ) : (
                            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-black text-primary">
                              {userInitial}
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-bold">{userDisplayName}</p>
                            {user.email && user.email !== userDisplayName && (
                              <p className="truncate text-xs text-muted">{user.email}</p>
                            )}
                          </div>
                          <span className="shrink-0 rounded-full bg-elevated px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-faint">
                            {t('gyms.selfBookGuestLabel')}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="space-y-3">
                      <p className="text-[10px] font-black uppercase tracking-widest text-faint">
                        {t('reception.paymentMethod')}
                      </p>
                      <div className="grid grid-cols-2 gap-2.5">
                        {PAYMENT_METHODS.map(({ id, icon }) => {
                          const selected = paymentMethod === id;
                          return (
                            <button
                              key={id}
                              type="button"
                              onClick={() => setPaymentMethod(id)}
                              className={`flex items-center gap-3 rounded-xl border p-3 text-start transition-all ${
                                selected
                                  ? 'border-primary bg-primary/12 shadow-[0_0_0_1px_rgba(var(--primary-rgb,21,139,141),0.25)]'
                                  : 'border-subtle bg-elevated hover:border-primary/30'
                              }`}
                            >
                              <span
                                className={`material-symbols-outlined text-xl ${selected ? 'text-primary' : 'text-muted'}`}
                                style={selected ? { fontVariationSettings: "'FILL' 1" } : undefined}
                              >
                                {icon}
                              </span>
                              <span className={`text-xs font-bold leading-tight ${selected ? 'text-primary' : 'text-muted'}`}>
                                {t(`reception.payment.${id}` as 'reception.payment.cash')}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {bookError && (
                      <div className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3">
                        <span className="material-symbols-outlined shrink-0 text-base text-red-400">error</span>
                        <p className="text-sm text-red-400">{bookError}</p>
                      </div>
                    )}
                  </>
                )}
              </div>

              {!bookSuccess && (
                <div className="shrink-0 space-y-3 border-t border-subtle bg-background px-6 py-4 sm:px-8">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-bold text-muted">{t('gyms.selfBookAmountDue')}</span>
                    <span className="text-lg font-black text-primary">
                      {formatMoney(modalPrice, language, modalCurrency)}
                    </span>
                  </div>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={closeBookModal}
                      className="flex-1 rounded-2xl border border-subtle bg-elevated py-3 text-sm font-bold text-muted transition-colors hover:border-primary/30"
                    >
                      {t('common.cancel')}
                    </button>
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => void (bookingBasic ? submitBasicBook() : submitClassBook())}
                      className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-primary py-3 text-sm font-black text-white transition-opacity disabled:opacity-40"
                    >
                      {submitting ? (
                        <>
                          <span className="material-symbols-outlined animate-spin text-lg">progress_activity</span>
                          {t('basicSessions.saving')}
                        </>
                      ) : (
                        <>
                          <span className="material-symbols-outlined text-lg">check</span>
                          {t('basicSessions.confirmBooking')}
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
