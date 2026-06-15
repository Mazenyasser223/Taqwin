import React, { useCallback, useEffect, useState, lazy, Suspense } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useI18n } from '../../lib/i18n/useI18n';
import gymService from '../../services/gymService';
import type { GymClass, GymStaff } from '../../types';
import { GymClassCard } from '../../components/gyms/GymClassCard';
import { BookClassSessionModal } from './BookClassSessionModal';
import { Badge, Button, Card, Modal, INPUT_CLASS } from '../../components/tailadmin';

const LazyImageUploader = lazy(() =>
  import('../../components/shared/ImageUploader').then((m) => ({ default: m.ImageUploader })),
);

type ClassForm = {
  name: string;
  nameAr: string;
  description: string;
  price: string;
  staffId: string;
  sessionDate: string;
  startTime: string;
  endTime: string;
  imageUrl: string | null;
};

function defaultSessionDate() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

function emptyForm(): ClassForm {
  return {
    name: '',
    nameAr: '',
    description: '',
    price: '',
    staffId: '',
    sessionDate: defaultSessionDate(),
    startTime: '10:00',
    endTime: '11:00',
    imageUrl: null,
  };
}

function formFromClass(cls: GymClass): ClassForm {
  return {
    name: cls.name,
    nameAr: cls.nameAr ?? '',
    description: cls.description ?? '',
    price: String(cls.price),
    staffId: cls.staffId,
    sessionDate: cls.sessionDate?.slice(0, 10) ?? defaultSessionDate(),
    startTime: cls.startTime,
    endTime: cls.endTime,
    imageUrl: cls.imageUrl ?? null,
  };
}

interface Props {
  gymId: string;
  trainers?: GymStaff[];
  readOnly?: boolean;
  onBookingComplete?: () => void;
}

export const GymClassesSection: React.FC<Props> = ({ gymId, trainers: trainersProp, readOnly, onBookingComplete }) => {
  const { t } = useI18n();
  const [classes, setClasses] = useState<GymClass[]>([]);
  const [trainers, setTrainers] = useState<GymStaff[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<GymClass | null>(null);
  const [form, setForm] = useState<ClassForm>(emptyForm());
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [bookingClass, setBookingClass] = useState<GymClass | null>(null);

  const refreshTrainers = useCallback(async () => {
    const staffRes = await gymService.getStaff(gymId, 'trainer');
    if (!staffRes.error) setTrainers((staffRes.data ?? []).filter((s) => s.isActive));
  }, [gymId]);

  const reload = useCallback(async () => {
    const classesRes = await gymService.getClasses(gymId);
    if (classesRes.error) setError(classesRes.error);
    else {
      setError(null);
      setClasses(classesRes.data ?? []);
    }
    await refreshTrainers();
  }, [gymId, refreshTrainers]);

  useEffect(() => {
    if (trainersProp) setTrainers(trainersProp.filter((s) => s.isActive));
  }, [trainersProp]);

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

  const closeModal = () => {
    setModalOpen(false);
    setEditing(null);
    setFormError(null);
    setForm(emptyForm());
  };

  const openCreate = async () => {
    const staffRes = await gymService.getStaff(gymId, 'trainer');
    const active = (staffRes.data ?? []).filter((s) => s.isActive);
    setTrainers(active);
    setEditing(null);
    const next = emptyForm();
    if (active.length === 1) next.staffId = active[0].id;
    setForm(next);
    setFormError(null);
    setModalOpen(true);
  };

  const openEdit = async (cls: GymClass) => {
    const staffRes = await gymService.getStaff(gymId, 'trainer');
    const active = (staffRes.data ?? []).filter((s) => s.isActive);
    setTrainers(active);
    setEditing(cls);
    setForm(formFromClass(cls));
    setFormError(null);
    setModalOpen(true);
  };

  const openBook = async (cls: GymClass) => {
    const classesRes = await gymService.getClasses(gymId);
    if (classesRes.error) {
      setError(classesRes.error);
      return;
    }
    const freshList = classesRes.data ?? [];
    setClasses(freshList);
    const fresh = freshList.find((row) => row.id === cls.id);
    if (!fresh) {
      setError(t('gymClasses.classUnavailable'));
      return;
    }
    setBookingClass(fresh);
  };

  const validateForm = (): string | null => {
    if (!form.name.trim()) return t('gymClasses.errorName');
    const price = Number(form.price);
    if (!Number.isFinite(price) || price <= 0) return t('gymClasses.errorPrice');
    if (!form.staffId) return t('gymClasses.errorTrainer');
    if (!form.sessionDate) return t('gymClasses.errorSessionDate');
    if (form.startTime >= form.endTime) return t('gymClasses.errorTime');
    return null;
  };

  const handleSave = async () => {
    const err = validateForm();
    if (err) {
      setFormError(err);
      return;
    }
    setSaving(true);
    setFormError(null);
    const payload = {
      name: form.name.trim(),
      nameAr: form.nameAr.trim() || null,
      description: form.description.trim() || null,
      price: Number(form.price),
      staffId: form.staffId,
      sessionDate: form.sessionDate,
      startTime: form.startTime,
      endTime: form.endTime,
      imageUrl: form.imageUrl,
    };
    const res = editing
      ? await gymService.updateClass(gymId, editing.id, payload)
      : await gymService.createClass(gymId, payload);
    setSaving(false);
    if (res.error) {
      if (res.code === 'TRAINER_SCHEDULE_CONFLICT' && res.conflict?.name) {
        setFormError(
          t('gymClasses.errorTrainerConflict', {
            name: res.conflict.name,
            startTime: res.conflict.startTime ?? '',
            endTime: res.conflict.endTime ?? '',
          }),
        );
      } else {
        setFormError(res.error);
      }
      return;
    }
    closeModal();
    await reload();
  };

  const handleDelete = async (cls: GymClass) => {
    if (!window.confirm(t('gymClasses.deleteConfirm'))) return;
    const res = await gymService.deactivateClass(gymId, cls.id);
    if (res.error) setError(res.error);
    else await reload();
  };

  return (
    <Card
      icon="fitness_center"
      title={t('gymClasses.title')}
      subtitle={readOnly ? t('gymClasses.subtitleReception') : t('gymClasses.subtitle')}
      headerBorder
      actions={
        !readOnly ? (
          <>
            {!loading && (
              <Badge color="light">{t('gymClasses.classCount', { count: String(classes.length) })}</Badge>
            )}
            <Button size="sm" icon="add" onClick={openCreate} disabled={trainers.length === 0}>
              {t('gymClasses.addClass')}
            </Button>
          </>
        ) : !loading ? (
          <Badge color="light">{t('gymClasses.classCount', { count: String(classes.length) })}</Badge>
        ) : null
      }
      className="space-y-6"
    >
      {error && (
        <div className="rounded-xl border border-error-500/20 bg-error-500/10 p-3 text-theme-sm text-error-500">
          {error}
        </div>
      )}

      {!readOnly && trainers.length === 0 && !loading && (
        <div className="rounded-xl border border-warning-500/20 bg-warning-500/10 p-3 text-theme-sm text-warning-600 dark:text-warning-400">
          {t('gymClasses.needTrainer')}
        </div>
      )}

      {loading ? (
        <div className="py-12 text-center text-theme-sm text-gray-500">{t('gymClasses.loading')}</div>
      ) : classes.length === 0 ? (
        <div className="space-y-4 py-12 text-center">
          <span className="material-symbols-outlined text-5xl text-brand-500/70">fitness_center</span>
          <p className="mx-auto max-w-sm text-theme-sm text-gray-500">{t('gymClasses.empty')}</p>
          {!readOnly && trainers.length > 0 && (
            <Button icon="add" onClick={openCreate}>
              {t('gymClasses.addClass')}
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {classes.map((cls) => (
            <GymClassCard
              key={cls.id}
              gymClass={cls}
              showBook={readOnly}
              onBook={readOnly ? () => void openBook(cls) : undefined}
              onEdit={readOnly ? undefined : () => openEdit(cls)}
              onDelete={readOnly ? undefined : () => handleDelete(cls)}
            />
          ))}
        </div>
      )}

      {bookingClass && (
        <BookClassSessionModal
          gymId={gymId}
          gymClass={bookingClass}
          onClose={() => setBookingClass(null)}
          onBooked={() => {
            onBookingComplete?.();
          }}
          onUnavailable={async () => {
            setBookingClass(null);
            setError(t('gymClasses.classUnavailable'));
            await reload();
          }}
        />
      )}

      <AnimatePresence>
        {modalOpen && (
          <Modal
            onClose={closeModal}
            title={editing ? t('gymClasses.editClass') : t('gymClasses.addClass')}
            maxWidth="lg"
          >
            <div className="space-y-4">
              {formError && (
                <div className="rounded-xl border border-error-500/20 bg-error-500/10 p-3 text-theme-sm text-error-500">
                  {formError}
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-theme-xs font-semibold text-gray-500">{t('gymClasses.name')}</label>
              <input
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                className={INPUT_CLASS}
                placeholder={t('gymClasses.namePlaceholder')}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-theme-xs font-semibold text-gray-500">{t('gymClasses.nameAr')}</label>
              <input
                value={form.nameAr}
                onChange={(e) => setForm((p) => ({ ...p, nameAr: e.target.value }))}
                className={INPUT_CLASS}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-theme-xs font-semibold text-gray-500">{t('gymClasses.price')}</label>
              <input
                type="number"
                min="1"
                step="1"
                value={form.price}
                onChange={(e) => setForm((p) => ({ ...p, price: e.target.value }))}
                className={INPUT_CLASS}
                placeholder="200"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-theme-xs font-semibold text-gray-500">{t('gymClasses.trainer')}</label>
              <select
                value={form.staffId}
                onChange={(e) => setForm((p) => ({ ...p, staffId: e.target.value }))}
                className={INPUT_CLASS}
              >
                <option value="">{t('gymClasses.selectTrainer')}</option>
                {trainers.map((tr) => (
                  <option key={tr.id} value={tr.id}>
                    {tr.fullName}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <label className="text-theme-xs font-semibold text-gray-500">{t('gymClasses.sessionDate')}</label>
              <input
                type="date"
                value={form.sessionDate}
                min={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setForm((p) => ({ ...p, sessionDate: e.target.value }))}
                className={INPUT_CLASS}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-theme-xs font-semibold text-gray-500">{t('gymClasses.startTime')}</label>
              <input
                type="time"
                value={form.startTime}
                onChange={(e) => setForm((p) => ({ ...p, startTime: e.target.value }))}
                className={INPUT_CLASS}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-theme-xs font-semibold text-gray-500">{t('gymClasses.endTime')}</label>
              <input
                type="time"
                value={form.endTime}
                onChange={(e) => setForm((p) => ({ ...p, endTime: e.target.value }))}
                className={INPUT_CLASS}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-theme-xs font-semibold text-gray-500">{t('gymClasses.description')}</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              rows={2}
              className={INPUT_CLASS}
            />
          </div>

              <div className="space-y-1.5">
                <label className="text-theme-xs font-semibold text-gray-500">{t('gymClasses.image')}</label>
                <Suspense fallback={<div className="text-sm text-gray-500">{t('gymClasses.loading')}</div>}>
                  <LazyImageUploader
                    folder="gyms"
                    value={form.imageUrl}
                    onChange={(url) => setForm((p) => ({ ...p, imageUrl: url }))}
                    layout="stacked"
                    size="size-32"
                    label={t('gymClasses.image')}
                  />
                </Suspense>
              </div>

              <div className="flex flex-wrap justify-end gap-2 pt-2">
                <Button variant="outline" onClick={closeModal} disabled={saving}>
                  {t('gymClasses.cancel')}
                </Button>
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? t('gymClasses.saving') : editing ? t('gymClasses.save') : t('gymClasses.create')}
                </Button>
              </div>
            </div>
          </Modal>
        )}
      </AnimatePresence>
    </Card>
  );
};
