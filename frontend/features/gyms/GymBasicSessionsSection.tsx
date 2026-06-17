import React, { useCallback, useEffect, useState } from 'react';
import { useI18n } from '../../lib/i18n/useI18n';
import gymService from '../../services/gymService';
import type { GymBasicSession } from '../../types';
import { BookBasicSessionModal } from './BookBasicSessionModal';
import { Badge, Button, Card, Modal, INPUT_CLASS } from '../../components/tailadmin';

type SessionForm = {
  name: string;
  nameAr: string;
  price: string;
  isActive: boolean;
};

function sessionLabel(session: GymBasicSession, language: string) {
  if (language === 'ar' && session.nameAr) return session.nameAr;
  return session.name;
}

function formFromSession(session: GymBasicSession): SessionForm {
  return {
    name: session.name,
    nameAr: session.nameAr ?? '',
    price: String(session.price),
    isActive: session.isActive,
  };
}

interface Props {
  gymId: string;
  readOnly?: boolean;
  onBookingComplete?: () => void;
  onAddClass?: () => void;
  addClassDisabled?: boolean;
}

export const GymBasicSessionsSection: React.FC<Props> = ({
  gymId,
  readOnly,
  onBookingComplete,
  onAddClass,
  addClassDisabled,
}) => {
  const { t, language } = useI18n();
  const [sessions, setSessions] = useState<GymBasicSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<GymBasicSession | null>(null);
  const [form, setForm] = useState<SessionForm>({ name: '', nameAr: '', price: '', isActive: true });
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [bookingSession, setBookingSession] = useState<GymBasicSession | null>(null);

  const reload = useCallback(async () => {
    const sessionsRes = await gymService.getBasicSessions(gymId);
    if (sessionsRes.error) setError(sessionsRes.error);
    else {
      setError(null);
      setSessions(sessionsRes.data ?? []);
    }
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

  const openEdit = (session: GymBasicSession) => {
    setEditing(session);
    setForm(formFromSession(session));
    setFormError(null);
  };

  const closeEdit = () => {
    setEditing(null);
    setFormError(null);
  };

  const saveSession = async () => {
    if (!editing) return;
    const name = form.name.trim();
    const price = parseFloat(form.price);
    if (name.length < 1) {
      setFormError(t('basicSessions.errorName'));
      return;
    }
    if (!Number.isFinite(price) || price <= 0) {
      setFormError(t('basicSessions.errorPrice'));
      return;
    }

    setSaving(true);
    setFormError(null);
    const res = await gymService.updateBasicSession(gymId, editing.id, {
      name,
      nameAr: form.nameAr.trim() || null,
      price,
      isActive: form.isActive,
    });
    setSaving(false);
    if (res.error) {
      setFormError(res.error);
      return;
    }
    closeEdit();
    await reload();
  };

  const formatMoney = (amount: number) =>
    language === 'ar'
      ? `${amount.toLocaleString('ar-EG')} ج.م`
      : `${amount.toLocaleString('en-US')} EGP`;

  const activeSessions = sessions.filter((s) => s.isActive);

  return (
    <Card
      icon="spa"
      title={t('basicSessions.title')}
      subtitle={readOnly ? t('basicSessions.subtitleReception') : t('basicSessions.subtitle')}
      headerBorder
      actions={
        !loading ? (
          <>
            <Badge color="light">{t('basicSessions.sessionCount', { count: String(activeSessions.length) })}</Badge>
            {!readOnly && onAddClass && (
              <Button size="sm" icon="add" onClick={onAddClass} disabled={addClassDisabled}>
                {t('gymClasses.addClass')}
              </Button>
            )}
          </>
        ) : null
      }
      className="space-y-6"
    >
      {error && (
        <div className="rounded-xl border border-error-500/20 bg-error-500/10 p-3 text-theme-sm text-error-500">
          {error}
        </div>
      )}

      {loading ? (
        <div className="py-10 text-center text-theme-sm text-gray-500">{t('basicSessions.loading')}</div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {sessions.map((session) => (
            <article
              key={session.id}
              className={`flex flex-col rounded-2xl border p-5 shadow-default transition-shadow ${
                session.isActive
                  ? 'border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]'
                  : 'border-gray-200/60 bg-gray-50 opacity-70 dark:border-gray-800/60 dark:bg-white/[0.02]'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-4xl leading-none">{session.icon ?? '✨'}</span>
                {!session.isActive && (
                  <Badge color="light">{t('basicSessions.inactive')}</Badge>
                )}
              </div>
              <h4 className="mt-3 text-lg font-bold text-gray-900 dark:text-white">
                {sessionLabel(session, language)}
              </h4>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{t('basicSessions.noSchedule')}</p>
              <p className="mt-2 text-sm font-black text-brand-500">{formatMoney(session.price)}</p>
              <div className="mt-auto flex flex-wrap gap-2 pt-4">
                {readOnly && session.isActive && (
                  <button
                    type="button"
                    onClick={() => setBookingSession(session)}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-gray-50 py-2.5 text-sm font-bold text-gray-700 transition-colors hover:bg-gray-100 dark:border-gray-700 dark:bg-white/5 dark:text-gray-200"
                  >
                    <span className="material-symbols-outlined text-base">event_available</span>
                    {t('basicSessions.bookSession')}
                  </button>
                )}
                {!readOnly && (
                  <button
                    type="button"
                    onClick={() => openEdit(session)}
                    className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-xs font-bold text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300"
                  >
                    {t('basicSessions.edit')}
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      {bookingSession && (
        <BookBasicSessionModal
          gymId={gymId}
          session={bookingSession}
          onClose={() => setBookingSession(null)}
          onBooked={() => {
            onBookingComplete?.();
            void reload();
          }}
          onUnavailable={async () => {
            setBookingSession(null);
            setError(t('basicSessions.sessionUnavailable'));
            await reload();
          }}
        />
      )}

      {editing && (
        <Modal onClose={closeEdit} title={t('basicSessions.editSession')} maxWidth="md">
          <div className="space-y-4">
            {formError && (
              <div className="rounded-xl border border-error-500/20 bg-error-500/10 p-3 text-theme-sm text-error-500">
                {formError}
              </div>
            )}
            <label className="block space-y-1.5">
              <span className="text-theme-xs font-medium text-gray-500">{t('basicSessions.name')}</span>
              <input
                className={INPUT_CLASS}
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-theme-xs font-medium text-gray-500">{t('basicSessions.nameAr')}</span>
              <input
                className={INPUT_CLASS}
                value={form.nameAr}
                onChange={(e) => setForm((f) => ({ ...f, nameAr: e.target.value }))}
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-theme-xs font-medium text-gray-500">{t('basicSessions.price')}</span>
              <input
                className={INPUT_CLASS}
                inputMode="decimal"
                value={form.price}
                onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
              />
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                className="rounded accent-primary"
              />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {t('basicSessions.active')}
              </span>
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={closeEdit}>
                {t('basicSessions.cancel')}
              </Button>
              <Button disabled={saving} onClick={() => void saveSession()}>
                {saving ? t('basicSessions.saving') : t('basicSessions.save')}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </Card>
  );
};
