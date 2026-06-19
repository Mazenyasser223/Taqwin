import React, { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useI18n } from '../../lib/i18n/useI18n';
import { staggerContainer, itemVariants } from '../../lib/motion';
import gymService from '../../services/gymService';
import dashboardService from '../../services/dashboardService';
import type { Gym, GymEquipment } from '../../types';

const LazyImageUploader = lazy(() =>
  import('../../components/shared/ImageUploader').then((m) => ({ default: m.ImageUploader })),
);

function formatDate(iso: string | null | undefined, locale: string) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function toDateInputValue(iso: string | null | undefined) {
  if (!iso) return '';
  return iso.slice(0, 10);
}

function equipmentLabel(item: GymEquipment, language: string) {
  if (language === 'ar' && item.nameAr) return item.nameAr;
  return item.name;
}

function cardGlowClass(item: GymEquipment) {
  if (item.needsMaintenance && item.needsCleaning) {
    return 'ring-2 ring-red-500 shadow-[0_0_16px_rgba(239,68,68,0.45),0_0_24px_#f2ec7e80]';
  }
  if (item.needsMaintenance) {
    return 'ring-2 ring-red-500 shadow-[0_0_20px_rgba(239,68,68,0.5)]';
  }
  if (item.needsCleaning) {
    return 'ring-2 ring-[#f2ec7e] shadow-[0_0_20px_#f2ec7e80]';
  }
  return 'border border-white/10';
}

type FormState = {
  name: string;
  nameAr: string;
  imageUrl: string | null;
  nextMaintenanceAt: string;
  maintenanceIntervalDays: string;
};

const emptyForm = (): FormState => ({
  name: '',
  nameAr: '',
  imageUrl: null,
  nextMaintenanceAt: '',
  maintenanceIntervalDays: '90',
});

export const GymEquipmentPage: React.FC = () => {
  const location = useLocation();
  const { t, language } = useI18n();
  const [myGym, setMyGym] = useState<Gym | null>(null);
  const [items, setItems] = useState<GymEquipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<GymEquipment | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const reload = useCallback(async (gymId: string) => {
    const res = await gymService.getEquipment(gymId);
    if (res.error) setError(res.error);
    else setItems(res.data ?? []);
  }, []);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const ctxRes = await dashboardService.gymContext();
        if (!mounted) return;
        if (!ctxRes.data?.hasGym || !ctxRes.data.gym) {
          setMyGym(null);
          setItems([]);
          return;
        }
        const gymRes = await gymService.getGym(ctxRes.data.gym.id);
        if (!mounted) return;
        if (gymRes.data) {
          setMyGym(gymRes.data);
          await reload(gymRes.data.id);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void load();
    return () => {
      mounted = false;
    };
  }, [location.pathname, reload]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setFormError(null);
    setModalOpen(true);
  };

  const openEdit = (item: GymEquipment) => {
    setEditing(item);
    setForm({
      name: item.name,
      nameAr: item.nameAr ?? '',
      imageUrl: item.imageUrl ?? null,
      nextMaintenanceAt: toDateInputValue(item.nextMaintenanceAt),
      maintenanceIntervalDays: String(item.maintenanceIntervalDays ?? 90),
    });
    setFormError(null);
    setModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;
    setModalOpen(false);
    setEditing(null);
    setForm(emptyForm());
    setFormError(null);
  };

  const patchItem = (updated: GymEquipment) => {
    setItems((prev) => prev.map((row) => (row.id === updated.id ? updated : row)));
  };

  const runAction = async (equipmentId: string, action: () => Promise<{ data?: GymEquipment; error?: string }>) => {
    if (!myGym || busyId) return;
    setBusyId(equipmentId);
    setError(null);
    const res = await action();
    setBusyId(null);
    if (res.error) {
      setError(res.error);
      return;
    }
    if (res.data) patchItem(res.data);
  };

  const submitForm = async () => {
    if (!myGym) return;
    const name = form.name.trim();
    if (!name) {
      setFormError(t('equipment.name'));
      return;
    }
    setSaving(true);
    setFormError(null);
    const payload = {
      name,
      nameAr: form.nameAr.trim() || undefined,
      imageUrl: form.imageUrl,
      nextMaintenanceAt: form.nextMaintenanceAt
        ? new Date(`${form.nextMaintenanceAt}T12:00:00`).toISOString()
        : null,
      maintenanceIntervalDays: Number(form.maintenanceIntervalDays) || 90,
    };
    const res = editing
      ? await gymService.updateEquipment(myGym.id, editing.id, payload)
      : await gymService.createEquipment(myGym.id, payload);
    setSaving(false);
    if (res.error) {
      setFormError(res.error);
      return;
    }
    closeModal();
    await reload(myGym.id);
  };

  const deleteItem = async (item: GymEquipment) => {
    if (!myGym || !window.confirm(t('equipment.deleteConfirm'))) return;
    setBusyId(item.id);
    const res = await gymService.deleteEquipment(myGym.id, item.id);
    setBusyId(null);
    if (res.error) {
      setError(res.error);
      return;
    }
    setItems((prev) => prev.filter((row) => row.id !== item.id));
  };

  const sortedItems = useMemo(
    () =>
      [...items].sort((a, b) => {
        const score = (row: GymEquipment) =>
          (row.needsMaintenance ? 2 : 0) + (row.needsCleaning ? 1 : 0);
        return score(b) - score(a) || equipmentLabel(a, language).localeCompare(equipmentLabel(b, language));
      }),
    [items, language],
  );

  return (
    <div className="page-shell pb-2">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8" data-tour="gym-tour-equipment-header">
        <div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight">{t('equipment.title')}</h1>
          <p className="text-muted mt-2">{myGym ? t('equipment.subtitle') : t('equipment.setupGym')}</p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          disabled={!myGym}
          data-tour="gym-tour-equipment-add"
          className="bg-primary text-white px-5 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg disabled:opacity-40"
        >
          <span className="material-symbols-outlined text-base">add</span>
          {t('equipment.add')}
        </button>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>
      )}

      {loading ? (
        <div className="glass-panel rounded-3xl p-10 text-center text-muted" data-tour="gym-tour-equipment-list">{t('equipment.loading')}</div>
      ) : sortedItems.length === 0 ? (
        <div
          className="glass-panel rounded-3xl p-10 text-center space-y-4 max-w-xl mx-auto"
          data-tour="gym-tour-equipment-list"
        >
          <span className="material-symbols-outlined text-5xl text-primary">exercise</span>
          <p className="text-muted">{t('equipment.empty')}</p>
          <p className="text-xs text-muted">
            {t('equipment.markMaintenance')} · {t('equipment.markCleaning')}
          </p>
          {myGym && (
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex items-center gap-2 bg-primary text-white font-bold px-5 py-3 rounded-xl"
            >
              <span className="material-symbols-outlined text-base">add</span>
              {t('equipment.add')}
            </button>
          )}
        </div>
      ) : (
        <motion.div
          variants={staggerContainer(0.06)}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4"
          data-tour="gym-tour-equipment-list"
        >
          {sortedItems.map((item, index) => {
            const isBusy = busyId === item.id;
            return (
              <motion.div
                key={item.id}
                variants={itemVariants}
                data-tour={index === 0 ? 'gym-tour-equipment-maintenance' : undefined}
              >
                <div
                  className={`rounded-3xl bg-elevated/40 overflow-hidden transition-all ${cardGlowClass(item)}`}
                >
                  <div className="relative aspect-[4/3] bg-black/20">
                    {item.imageUrl ? (
                      <img
                        src={item.imageUrl}
                        alt={equipmentLabel(item, language)}
                        className="size-full object-cover"
                      />
                    ) : (
                      <div className="size-full flex items-center justify-center">
                        <span className="material-symbols-outlined text-6xl text-primary/60">exercise</span>
                      </div>
                    )}
                    <div className="absolute top-3 end-3 flex gap-2">
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => openEdit(item)}
                        className="size-9 rounded-xl bg-background/70 backdrop-blur border border-white/10 flex items-center justify-center hover:bg-background"
                        aria-label={t('equipment.edit')}
                      >
                        <span className="material-symbols-outlined text-base">edit</span>
                      </button>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => void deleteItem(item)}
                        className="size-9 rounded-xl bg-background/70 backdrop-blur border border-white/10 flex items-center justify-center hover:bg-red-500/20 text-red-400"
                        aria-label={t('equipment.delete')}
                      >
                        <span className="material-symbols-outlined text-base">delete</span>
                      </button>
                    </div>
                  </div>

                  <div className="p-5 space-y-4">
                    <h3 className="text-lg font-black">{equipmentLabel(item, language)}</h3>

                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between gap-3">
                        <span className="text-muted">{t('equipment.lastMaintenance')}</span>
                        <span className="font-bold">
                          {formatDate(item.lastMaintenanceAt, language) ?? t('equipment.noDate')}
                        </span>
                      </div>
                      <div className="flex justify-between gap-3">
                        <span className="text-muted">{t('equipment.nextMaintenance')}</span>
                        <span className="font-bold">
                          {formatDate(item.nextMaintenanceAt, language) ?? t('equipment.noDate')}
                        </span>
                      </div>
                      <div className="flex justify-between gap-3">
                        <span className="text-muted">{t('equipment.lastCleaned')}</span>
                        <span className="font-bold">
                          {formatDate(item.lastCleanedAt, language) ?? t('equipment.noDate')}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {!item.needsMaintenance ? (
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() =>
                            void runAction(item.id, () => gymService.markEquipmentMaintenance(myGym!.id, item.id))
                          }
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-elevated border border-subtle text-xs font-bold hover:border-red-500/40 hover:text-red-400"
                        >
                          <span className="material-symbols-outlined text-base">build</span>
                          {t('equipment.markMaintenance')}
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() =>
                            void runAction(item.id, () =>
                              gymService.completeEquipmentMaintenance(myGym!.id, item.id),
                            )
                          }
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs font-bold"
                        >
                          <span className="material-symbols-outlined text-base">check</span>
                          {isBusy ? t('equipment.actionBusy') : t('equipment.completeMaintenance')}
                        </button>
                      )}

                      {!item.needsCleaning ? (
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() =>
                            void runAction(item.id, () => gymService.markEquipmentCleaning(myGym!.id, item.id))
                          }
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-elevated border border-subtle text-xs font-bold hover:border-[#f2ec7e]/50 hover:text-[#f2ec7e]"
                        >
                          <span className="material-symbols-outlined text-base">cleaning_services</span>
                          {t('equipment.markCleaning')}
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() =>
                            void runAction(item.id, () => gymService.completeEquipmentCleaning(myGym!.id, item.id))
                          }
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#f2ec7e]/15 border border-[#f2ec7e]/40 text-[#f2ec7e] text-xs font-bold"
                        >
                          <span className="material-symbols-outlined text-base">check</span>
                          {isBusy ? t('equipment.actionBusy') : t('equipment.completeCleaning')}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      )}

      <AnimatePresence>
        {modalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 sm:p-6 safe-bottom"
            onClick={closeModal}
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="glass-panel w-full max-w-md rounded-t-3xl sm:rounded-3xl p-6 sm:p-8 space-y-5 max-h-[90dvh] overflow-y-auto"
            >
              <h3 className="text-2xl font-black">
                {editing ? t('equipment.editTitle') : t('equipment.addTitle')}
              </h3>

              <div className="space-y-2">
                <label className="text-[10px] uppercase font-black tracking-widest text-faint">
                  {t('equipment.name')}
                </label>
                <input
                  value={form.name}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                  className="w-full bg-elevated border border-subtle rounded-xl px-4 py-3 font-bold focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] uppercase font-black tracking-widest text-faint">
                  {t('equipment.nameAr')}
                </label>
                <input
                  value={form.nameAr}
                  onChange={(e) => setForm((prev) => ({ ...prev, nameAr: e.target.value }))}
                  className="w-full bg-elevated border border-subtle rounded-xl px-4 py-3 font-bold focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] uppercase font-black tracking-widest text-faint">
                  {t('equipment.image')}
                </label>
                <Suspense fallback={<div className="text-sm text-muted">{t('equipment.loading')}</div>}>
                  <LazyImageUploader
                    folder="gyms"
                    value={form.imageUrl}
                    onChange={(url) => setForm((prev) => ({ ...prev, imageUrl: url }))}
                    layout="stacked"
                    size="size-32"
                    label={t('equipment.image')}
                  />
                </Suspense>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] uppercase font-black tracking-widest text-faint">
                  {t('equipment.nextMaintenance')}
                </label>
                <input
                  type="date"
                  value={form.nextMaintenanceAt}
                  onChange={(e) => setForm((prev) => ({ ...prev, nextMaintenanceAt: e.target.value }))}
                  className="w-full bg-elevated border border-subtle rounded-xl px-4 py-3 font-bold focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] uppercase font-black tracking-widest text-faint">
                  {t('equipment.maintenanceInterval')}
                </label>
                <input
                  type="number"
                  min={1}
                  max={3650}
                  value={form.maintenanceIntervalDays}
                  onChange={(e) => setForm((prev) => ({ ...prev, maintenanceIntervalDays: e.target.value }))}
                  className="w-full bg-elevated border border-subtle rounded-xl px-4 py-3 font-bold focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>

              {formError && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                  {formError}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 bg-elevated border border-subtle py-3 rounded-xl font-bold"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="button"
                  onClick={() => void submitForm()}
                  disabled={saving || !form.name.trim()}
                  className="flex-1 bg-primary text-white font-bold py-3 rounded-xl disabled:opacity-50"
                >
                  {saving ? t('equipment.saving') : t('equipment.save')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
