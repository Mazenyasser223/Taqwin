import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useI18n } from '../../lib/i18n/useI18n';
import { staggerContainer, itemVariants } from '../../lib/motion';
import gymService from '../../services/gymService';
import type { GymStaff, GymStaffPayout, GymStaffRole, WorkingHourSlot } from '../../types';
import {
  Badge,
  Button,
  Card,
  DataTable,
  DataTableBody,
  DataTableHead,
  DataTableRow,
  DataTableTd,
  DataTableTh,
  FilterPills,
  Modal,
  SearchInput,
  CARD_INNER,
  INPUT_CLASS,
} from '../../components/tailadmin';
import { cn } from '../../lib/cn';

type RoleFilter = 'all' | GymStaffRole;
type ModalKind = 'form' | 'schedule' | 'paySalary' | 'addBonus' | 'history' | null;

type DaySchedule = {
  enabled: boolean;
  start: string;
  end: string;
};

type StaffForm = {
  fullName: string;
  email: string;
  phone: string;
  role: GymStaffRole;
  baseSalary: string;
  notes: string;
  days: DaySchedule[];
};

const ROLE_FILTERS: { value: RoleFilter; labelKey: string }[] = [
  { value: 'all', labelKey: 'gymStaff.filterAll' },
  { value: 'trainer', labelKey: 'gymStaff.filterTrainer' },
  { value: 'receptionist', labelKey: 'gymStaff.filterReceptionist' },
  { value: 'cleaner', labelKey: 'gymStaff.filterCleaner' },
];

const ROLES: GymStaffRole[] = ['trainer', 'receptionist', 'cleaner', 'other'];

const ROLE_BADGE_COLOR: Record<GymStaffRole, 'primary' | 'success' | 'warning' | 'light'> = {
  trainer: 'primary',
  receptionist: 'warning',
  cleaner: 'success',
  other: 'light',
};

const ROLE_ICON: Record<GymStaffRole, string> = {
  trainer: 'fitness_center',
  receptionist: 'support_agent',
  cleaner: 'cleaning_services',
  other: 'badge',
};

function emptyDays(): DaySchedule[] {
  return Array.from({ length: 7 }, () => ({ enabled: false, start: '09:00', end: '17:00' }));
}

function emptyForm(): StaffForm {
  return { fullName: '', email: '', phone: '', role: 'trainer', baseSalary: '', notes: '', days: emptyDays() };
}

function slotsFromDays(days: DaySchedule[]): WorkingHourSlot[] {
  return days
    .map((d, day) => (d.enabled ? { day, start: d.start, end: d.end } : null))
    .filter((s): s is WorkingHourSlot => s !== null);
}

function daysFromSlots(slots: WorkingHourSlot[]): DaySchedule[] {
  const days = emptyDays();
  for (const slot of slots) {
    if (slot.day >= 0 && slot.day <= 6) {
      days[slot.day] = { enabled: true, start: slot.start, end: slot.end };
    }
  }
  return days;
}

function formFromStaff(staff: GymStaff): StaffForm {
  return {
    fullName: staff.fullName,
    email: staff.email ?? '',
    phone: staff.phone ?? '',
    role: staff.role,
    baseSalary: String(staff.baseSalary ?? ''),
    notes: staff.notes ?? '',
    days: daysFromSlots(staff.workingHours ?? []),
  };
}

function staffInitials(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function isValidEmail(email: string) {
  if (!email.trim()) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function applyWeekdayPreset(days: DaySchedule[]): DaySchedule[] {
  return days.map((d, idx) =>
    idx >= 1 && idx <= 5 ? { enabled: true, start: '09:00', end: '17:00' } : { ...d, enabled: false },
  );
}

function friendlyStaffError(message: string | undefined, t: (key: string) => string) {
  if (!message) return t('gymStaff.apiUnavailable');
  if (message === 'Not found' || message.includes('404')) return t('gymStaff.apiUnavailable');
  return message;
}

function formatMoney(amount: number, language: string) {
  const suffix = language === 'ar' ? ' ج.م' : ' EGP';
  return `${amount.toLocaleString(language === 'ar' ? 'ar-EG' : 'en-US')}${suffix}`;
}

function formatDate(iso: string | null | undefined, language: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function StaffActionsMenu({
  member,
  busy,
  onPay,
  onSchedule,
  onBonus,
  onHistory,
  onEdit,
  onDeactivate,
  t,
}: {
  member: GymStaff;
  busy: boolean;
  onPay: () => void;
  onSchedule: () => void;
  onBonus: () => void;
  onHistory: () => void;
  onEdit: () => void;
  onDeactivate: () => void;
  t: (key: string) => string;
}) {
  const [open, setOpen] = useState(false);
  const items = [
    { label: t('gymStaff.paySalary'), icon: 'payments', onClick: onPay },
    { label: t('gymStaff.viewSchedule'), icon: 'schedule', onClick: onSchedule },
    { label: t('gymStaff.addBonus'), icon: 'redeem', onClick: onBonus },
    { label: t('gymStaff.paymentHistory'), icon: 'history', onClick: onHistory },
    { label: t('gymStaff.editStaff'), icon: 'edit', onClick: onEdit },
    { label: t('gymStaff.deactivate'), icon: 'person_off', onClick: onDeactivate, danger: true },
  ];

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={busy}
        className="flex size-9 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-white/5"
        aria-label="Actions"
      >
        <span className="material-symbols-outlined text-lg">more_vert</span>
      </button>
      {open && (
        <>
          <button type="button" className="fixed inset-0 z-10" onClick={() => setOpen(false)} aria-hidden />
          <div className="absolute end-0 z-20 mt-1 min-w-[180px] overflow-hidden rounded-xl border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-900">
            {items.map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => {
                  setOpen(false);
                  item.onClick();
                }}
                className={cn(
                  'flex w-full items-center gap-2 px-3 py-2 text-start text-theme-sm transition-colors hover:bg-gray-50 dark:hover:bg-white/5',
                  item.danger ? 'text-error-500' : 'text-gray-700 dark:text-gray-200'
                )}
              >
                <span className="material-symbols-outlined text-base">{item.icon}</span>
                {item.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function SectionTitle({ icon, label }: { icon: string; label: string }) {
  return (
    <div className="flex items-center gap-2 pb-1">
      <span className="material-symbols-outlined text-lg text-brand-500">{icon}</span>
      <p className="text-theme-sm font-semibold text-gray-900 dark:text-white">{label}</p>
    </div>
  );
}

interface Props {
  gymId: string;
  onStaffChange?: () => void;
}

export const GymStaffSection: React.FC<Props> = ({ gymId, onStaffChange }) => {
  const { t, language } = useI18n();
  const [staff, setStaff] = useState<GymStaff[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [search, setSearch] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const [modal, setModal] = useState<ModalKind>(null);
  const [activeStaff, setActiveStaff] = useState<GymStaff | null>(null);
  const [form, setForm] = useState<StaffForm>(emptyForm());
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [payProvider, setPayProvider] = useState<'mock' | 'cash' | 'manual'>('mock');
  const [payMonth, setPayMonth] = useState(String(new Date().getMonth() + 1));
  const [payYear, setPayYear] = useState(String(new Date().getFullYear()));
  const [extraBonus, setExtraBonus] = useState('');
  const [bonusOnly, setBonusOnly] = useState('');
  const [payNotes, setPayNotes] = useState('');
  const [pendingPayout, setPendingPayout] = useState<GymStaffPayout | null>(null);

  const [payouts, setPayouts] = useState<GymStaffPayout[]>([]);
  const [payoutsLoading, setPayoutsLoading] = useState(false);

  const reload = useCallback(async () => {
    const res = await gymService.getStaff(gymId);
    if (res.error) setError(friendlyStaffError(res.error, t));
    else {
      setError(null);
      setStaff(res.data ?? []);
    }
  }, [gymId, t]);

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

  const filteredStaff = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = staff;
    if (roleFilter !== 'all') {
      list = list.filter((m) => m.role === roleFilter);
    }
    if (!q) return list;
    return list.filter(
      (m) =>
        m.fullName.toLowerCase().includes(q) ||
        (m.email ?? '').toLowerCase().includes(q) ||
        (m.phone ?? '').includes(q),
    );
  }, [staff, search, roleFilter]);

  const closeModal = () => {
    setModal(null);
    setActiveStaff(null);
    setFormError(null);
    setPendingPayout(null);
    setPayouts([]);
  };

  const openAdd = () => {
    setActiveStaff(null);
    setForm(emptyForm());
    setFormError(null);
    setModal('form');
  };

  const openEdit = (member: GymStaff) => {
    setActiveStaff(member);
    setForm(formFromStaff(member));
    setFormError(null);
    setModal('form');
  };

  const openSchedule = (member: GymStaff) => {
    setActiveStaff(member);
    setModal('schedule');
  };

  const openPaySalary = (member: GymStaff) => {
    setActiveStaff(member);
    setPayProvider('mock');
    setPayMonth(String(new Date().getMonth() + 1));
    setPayYear(String(new Date().getFullYear()));
    setExtraBonus('');
    setPayNotes('');
    setPendingPayout(null);
    setFormError(null);
    setModal('paySalary');
  };

  const openAddBonus = (member: GymStaff) => {
    setActiveStaff(member);
    setPayProvider('cash');
    setBonusOnly('');
    setPayNotes('');
    setPendingPayout(null);
    setFormError(null);
    setModal('addBonus');
  };

  const openHistory = async (member: GymStaff) => {
    setActiveStaff(member);
    setModal('history');
    setPayoutsLoading(true);
    const res = await gymService.getStaffPayouts(gymId, member.id);
    setPayoutsLoading(false);
    if (res.error) setFormError(res.error);
    else setPayouts(res.data?.payouts ?? []);
  };

  const validateForm = () => {
    if (!form.fullName.trim()) return t('gymStaff.fullNameRequired');
    if (!isValidEmail(form.email)) return t('gymStaff.emailInvalid');
    return null;
  };

  const handleSaveStaff = async () => {
    const validationError = validateForm();
    if (validationError) {
      setFormError(validationError);
      return;
    }
    setSaving(true);
    setFormError(null);
    const payload = {
      fullName: form.fullName.trim(),
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      role: form.role,
      baseSalary: Number(form.baseSalary) || 0,
      workingHours: slotsFromDays(form.days),
      notes: form.notes.trim() || null,
    };
    const res = activeStaff
      ? await gymService.updateStaff(gymId, activeStaff.id, payload)
      : await gymService.createStaff(gymId, payload);
    setSaving(false);
    if (res.error) {
      setFormError(friendlyStaffError(res.error, t));
      return;
    }
    closeModal();
    await reload();
    onStaffChange?.();
  };

  const handleDeactivate = async (member: GymStaff) => {
    if (!window.confirm(t('gymStaff.deactivateConfirm'))) return;
    setBusyId(member.id);
    await gymService.deactivateStaff(gymId, member.id);
    setBusyId(null);
    await reload();
    onStaffChange?.();
  };

  const handlePaySalary = async () => {
    if (!activeStaff) return;
    setSaving(true);
    setFormError(null);
    const res = await gymService.payStaff(gymId, activeStaff.id, {
      type: 'salary',
      provider: payProvider,
      bonusAmount: Number(extraBonus) || 0,
      periodMonth: Number(payMonth),
      periodYear: Number(payYear),
      notes: payNotes.trim() || null,
    });
    setSaving(false);
    if (res.error) {
      setFormError(friendlyStaffError(res.error, t));
      return;
    }
    if (res.data?.requiresConfirm && res.data.payout) {
      setPendingPayout(res.data.payout);
      return;
    }
    closeModal();
    await reload();
  };

  const handleAddBonus = async () => {
    if (!activeStaff) return;
    const amount = Number(bonusOnly);
    if (!amount || amount <= 0) {
      setFormError(t('gymStaff.bonusOnly'));
      return;
    }
    setSaving(true);
    setFormError(null);
    const res = await gymService.payStaff(gymId, activeStaff.id, {
      type: 'bonus',
      provider: payProvider,
      bonusOnlyAmount: amount,
      notes: payNotes.trim() || null,
    });
    setSaving(false);
    if (res.error) {
      setFormError(friendlyStaffError(res.error, t));
      return;
    }
    if (res.data?.requiresConfirm && res.data.payout) {
      setPendingPayout(res.data.payout);
      return;
    }
    closeModal();
    await reload();
  };

  const handleConfirmPayment = async () => {
    if (!activeStaff || !pendingPayout) return;
    setSaving(true);
    const res = await gymService.confirmStaffPayout(gymId, activeStaff.id, pendingPayout.id);
    setSaving(false);
    if (res.error) {
      setFormError(friendlyStaffError(res.error, t));
      return;
    }
    closeModal();
    await reload();
  };

  const handleExport = async () => {
    setExporting(true);
    const res = await gymService.exportPayrollCsv(gymId, Number(payMonth), Number(payYear));
    setExporting(false);
    if (res.error) setError(friendlyStaffError(res.error, t));
  };

  const roleLabel = (role: GymStaffRole) => t(`gymStaff.roles.${role}` as 'gymStaff.roles.trainer');

  const monthOptions = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) => ({
        value: String(i + 1),
        label: new Date(2000, i, 1).toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US', { month: 'long' }),
      })),
    [language],
  );

  const enabledDaysCount = form.days.filter((d) => d.enabled).length;
  const canSaveForm = form.fullName.trim().length > 0 && isValidEmail(form.email);

  const filterOptions = ROLE_FILTERS.map((f) => ({
    value: f.value,
    label: t(f.labelKey as 'gymStaff.filterAll'),
  }));

  const lastPaidLabel = (member: GymStaff) => {
    if (member.lastPayout?.status === 'paid' && member.lastPayout.paidAt) {
      return `${formatDate(member.lastPayout.paidAt, language)} · ${formatMoney(member.lastPayout.totalAmount, language)}`;
    }
    if (member.lastPayout?.status === 'pending') return t('gymStaff.pendingPayment');
    return t('gymStaff.neverPaid');
  };

  return (
    <Card
      icon="groups"
      title={t('gymStaff.title')}
      subtitle={t('gymStaff.subtitle')}
      headerBorder
      actions={
        <>
          {!loading && (
            <Badge color="light">{t('gymStaff.staffCount', { count: String(staff.length) })}</Badge>
          )}
          <Button variant="outline" size="sm" icon="download" onClick={handleExport} disabled={exporting}>
            {exporting ? t('gymStaff.exporting') : t('gymStaff.exportPayroll')}
          </Button>
          <Button size="sm" icon="person_add" onClick={openAdd}>
            {t('gymStaff.addStaff')}
          </Button>
        </>
      }
      className="space-y-6"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SearchInput
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('gymStaff.searchPlaceholder')}
          className="max-w-md flex-1"
        />
        <FilterPills value={roleFilter} options={filterOptions} onChange={(v) => setRoleFilter(v as RoleFilter)} />
      </div>

      {error && (
        <div className="rounded-xl border border-error-500/20 bg-error-500/10 p-3 text-theme-sm text-error-500">{error}</div>
      )}

      {loading ? (
        <div className="py-12 text-center text-theme-sm text-gray-500">{t('gymStaff.loading')}</div>
      ) : staff.length === 0 ? (
        <div className="space-y-4 py-12 text-center">
          <span className="material-symbols-outlined text-5xl text-brand-500/70">groups</span>
          <p className="mx-auto max-w-sm text-theme-sm text-gray-500">{t('gymStaff.empty')}</p>
          <Button icon="person_add" onClick={openAdd}>
            {t('gymStaff.addStaff')}
          </Button>
        </div>
      ) : filteredStaff.length === 0 ? (
        <p className="py-8 text-center text-theme-sm text-gray-500">{t('gymStaff.noResults')}</p>
      ) : (
        <>
          <div className="hidden lg:block">
            <DataTable>
              <DataTableHead>
                <DataTableTh>{t('gymStaff.fullName')}</DataTableTh>
                <DataTableTh>{t('gymStaff.sectionJob')}</DataTableTh>
                <DataTableTh>{t('gymStaff.baseSalary')}</DataTableTh>
                <DataTableTh>{t('gymStaff.workingHours')}</DataTableTh>
                <DataTableTh>{t('gymStaff.lastPaid')}</DataTableTh>
                <DataTableTh className="text-end">Actions</DataTableTh>
              </DataTableHead>
              <DataTableBody>
                {filteredStaff.map((member) => (
                  <DataTableRow key={member.id}>
                    <DataTableTd>
                      <div className="flex items-center gap-3">
                        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-500/10 text-sm font-bold text-brand-500">
                          {staffInitials(member.fullName)}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-gray-900 dark:text-white">{member.fullName}</p>
                          {member.email && <p className="truncate text-theme-xs text-gray-500">{member.email}</p>}
                        </div>
                      </div>
                    </DataTableTd>
                    <DataTableTd>
                      <Badge color={ROLE_BADGE_COLOR[member.role]} className="gap-1">
                        <span className="material-symbols-outlined text-xs">{ROLE_ICON[member.role]}</span>
                        {roleLabel(member.role)}
                      </Badge>
                    </DataTableTd>
                    <DataTableTd>
                      <span className="font-semibold text-brand-500">{formatMoney(member.baseSalary, language)}</span>
                    </DataTableTd>
                    <DataTableTd>
                      <span className="text-theme-xs text-gray-600 dark:text-gray-300">
                        {member.workingHoursSummary || t('gymStaff.noSchedule')}
                      </span>
                    </DataTableTd>
                    <DataTableTd>
                      <span className="text-theme-xs text-gray-500">{lastPaidLabel(member)}</span>
                    </DataTableTd>
                    <DataTableTd className="text-end">
                      <StaffActionsMenu
                        member={member}
                        busy={busyId === member.id}
                        onPay={() => openPaySalary(member)}
                        onSchedule={() => openSchedule(member)}
                        onBonus={() => openAddBonus(member)}
                        onHistory={() => openHistory(member)}
                        onEdit={() => openEdit(member)}
                        onDeactivate={() => handleDeactivate(member)}
                        t={t}
                      />
                    </DataTableTd>
                  </DataTableRow>
                ))}
              </DataTableBody>
            </DataTable>
          </div>

          <motion.div
            variants={staggerContainer(0.05)}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-1 gap-4 lg:hidden"
          >
            {filteredStaff.map((member) => (
              <motion.div key={member.id} variants={itemVariants}>
                <div className={cn(CARD_INNER, 'space-y-4 p-5')}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex size-11 items-center justify-center rounded-xl bg-brand-500/10 font-bold text-brand-500">
                        {staffInitials(member.fullName)}
                      </div>
                      <div>
                        <p className="font-bold text-gray-900 dark:text-white">{member.fullName}</p>
                        <Badge color={ROLE_BADGE_COLOR[member.role]} className="mt-1 gap-1">
                          {roleLabel(member.role)}
                        </Badge>
                      </div>
                    </div>
                    <StaffActionsMenu
                      member={member}
                      busy={busyId === member.id}
                      onPay={() => openPaySalary(member)}
                      onSchedule={() => openSchedule(member)}
                      onBonus={() => openAddBonus(member)}
                      onHistory={() => openHistory(member)}
                      onEdit={() => openEdit(member)}
                      onDeactivate={() => handleDeactivate(member)}
                      t={t}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-theme-sm">
                    <div>
                      <p className="text-theme-xs text-gray-500">{t('gymStaff.baseSalary')}</p>
                      <p className="font-bold text-brand-500">{formatMoney(member.baseSalary, language)}</p>
                    </div>
                    <div>
                      <p className="text-theme-xs text-gray-500">{t('gymStaff.lastPaid')}</p>
                      <p className="text-theme-xs">{lastPaidLabel(member)}</p>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </>
      )}

      <AnimatePresence>
        {modal === 'form' && (
          <Modal
            title={activeStaff ? t('gymStaff.editStaff') : t('gymStaff.addStaff')}
            subtitle={t('gymStaff.subtitle')}
            onClose={closeModal}
          >
            <div className="space-y-4">
              <SectionTitle icon="person" label={t('gymStaff.sectionPersonal')} />
              <label className="block space-y-1.5">
                <span className="text-xs text-muted">{t('gymStaff.fullName')} *</span>
                <input
                  value={form.fullName}
                  onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
                  className={INPUT_CLASS}
                  placeholder="Ahmed Hassan"
                  autoFocus
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-xs text-muted">{t('gymStaff.email')}</span>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  className={INPUT_CLASS}
                  placeholder="staff@example.com"
                />
                <p className="text-[11px] text-muted">{t('gymStaff.emailHint')}</p>
              </label>
              <label className="block space-y-1.5">
                <span className="text-xs text-muted">{t('gymStaff.phone')}</span>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  className={INPUT_CLASS}
                  placeholder="01xxxxxxxxx"
                />
              </label>
            </div>

            <div className="space-y-4 pt-2">
              <SectionTitle icon="work" label={t('gymStaff.sectionJob')} />
              <div className="grid grid-cols-2 gap-2">
                {ROLES.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, role: r }))}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-bold border transition-colors ${
                      form.role === r
                        ? 'border-primary bg-primary/15 text-primary'
                        : 'border-white/10 bg-white/[0.02] text-muted hover:bg-white/5'
                    }`}
                  >
                    <span className="material-symbols-outlined text-base">{ROLE_ICON[r]}</span>
                    {roleLabel(r)}
                  </button>
                ))}
              </div>
              <label className="block space-y-1.5">
                <span className="text-xs text-muted">{t('gymStaff.baseSalary')}</span>
                <input
                  type="number"
                  min={0}
                  value={form.baseSalary}
                  onChange={(e) => setForm((f) => ({ ...f, baseSalary: e.target.value }))}
                  className={INPUT_CLASS}
                  placeholder="6000"
                />
              </label>
            </div>

            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <SectionTitle icon="schedule" label={t('gymStaff.sectionSchedule')} />
                <span className="text-[11px] text-muted">{enabledDaysCount}/7</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, days: applyWeekdayPreset(f.days) }))}
                  className="text-xs font-bold px-3 py-1.5 rounded-lg bg-primary/15 text-primary hover:bg-primary/25"
                >
                  {t('gymStaff.schedulePresetWeekdays')}
                </button>
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, days: emptyDays() }))}
                  className="text-xs font-bold px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10"
                >
                  {t('gymStaff.schedulePresetClear')}
                </button>
              </div>
              <div className="space-y-2 rounded-2xl border border-white/10 p-3 bg-white/[0.02]">
                {form.days.map((day, idx) => (
                  <div
                    key={idx}
                    className={`flex items-center gap-2 text-sm flex-wrap rounded-xl px-2 py-1.5 ${
                      day.enabled ? 'bg-primary/5' : ''
                    }`}
                  >
                    <label className="flex items-center gap-2 min-w-[110px] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={day.enabled}
                        onChange={(e) =>
                          setForm((f) => {
                            const days = [...f.days];
                            days[idx] = { ...days[idx], enabled: e.target.checked };
                            return { ...f, days };
                          })
                        }
                        className="rounded accent-primary"
                      />
                      <span className="text-xs font-medium">{t(`gymStaff.days.${idx}` as 'gymStaff.days.0')}</span>
                    </label>
                    <input
                      type="time"
                      value={day.start}
                      disabled={!day.enabled}
                      onChange={(e) =>
                        setForm((f) => {
                          const days = [...f.days];
                          days[idx] = { ...days[idx], start: e.target.value };
                          return { ...f, days };
                        })
                      }
                      className="rounded-lg bg-white/5 border border-white/10 px-2 py-1 text-xs disabled:opacity-40"
                    />
                    <span className="text-muted">–</span>
                    <input
                      type="time"
                      value={day.end}
                      disabled={!day.enabled}
                      onChange={(e) =>
                        setForm((f) => {
                          const days = [...f.days];
                          days[idx] = { ...days[idx], end: e.target.value };
                          return { ...f, days };
                        })
                      }
                      className="rounded-lg bg-white/5 border border-white/10 px-2 py-1 text-xs disabled:opacity-40"
                    />
                  </div>
                ))}
              </div>
            </div>

            <label className="block space-y-1.5">
              <span className="text-xs text-muted">{t('gymStaff.notes')}</span>
              <textarea
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                rows={2}
                className={INPUT_CLASS}
              />
            </label>

            {formError && <p className="text-sm text-red-400">{formError}</p>}

            <button
              type="button"
              onClick={handleSaveStaff}
              disabled={saving || !canSaveForm}
              className="w-full py-3 rounded-xl font-bold bg-primary text-white disabled:opacity-40 shadow-lg shadow-primary/20"
            >
              {saving ? t('gymStaff.saving') : t('gymStaff.save')}
            </button>
          </Modal>
        )}

        {modal === 'schedule' && activeStaff && (
          <Modal title={activeStaff.fullName} subtitle={t('gymStaff.workingHours')} onClose={closeModal}>
            <div className="space-y-2">
              {(activeStaff.workingHours ?? []).length === 0 ? (
                <p className="text-sm text-muted">{t('gymStaff.noSchedule')}</p>
              ) : (
                (activeStaff.workingHours ?? [])
                  .sort((a, b) => a.day - b.day)
                  .map((slot) => (
                    <div
                      key={slot.day}
                      className="flex justify-between items-center text-sm rounded-xl bg-white/[0.03] px-4 py-3"
                    >
                      <span className="font-medium">{t(`gymStaff.days.${slot.day}` as 'gymStaff.days.0')}</span>
                      <span className="font-bold text-primary">
                        {slot.start} – {slot.end}
                      </span>
                    </div>
                  ))
              )}
            </div>
          </Modal>
        )}

        {(modal === 'paySalary' || modal === 'addBonus') && activeStaff && (
          <Modal
            title={modal === 'paySalary' ? t('gymStaff.paySalary') : t('gymStaff.addBonus')}
            subtitle={activeStaff.fullName}
            onClose={closeModal}
          >
            {pendingPayout ? (
              <div className="space-y-4 text-center py-4">
                <span className="material-symbols-outlined text-5xl text-primary">payments</span>
                <p className="text-sm text-muted">{t('gymStaff.confirmPaymentHint')}</p>
                <p className="text-2xl font-black text-primary">{formatMoney(pendingPayout.totalAmount, language)}</p>
                {formError && <p className="text-sm text-red-400">{formError}</p>}
                <button
                  type="button"
                  onClick={handleConfirmPayment}
                  disabled={saving}
                  className="w-full py-3 rounded-xl font-bold bg-primary text-white disabled:opacity-50"
                >
                  {saving ? t('gymStaff.saving') : t('gymStaff.confirmPayment')}
                </button>
              </div>
            ) : (
              <>
                <label className="block space-y-1.5">
                  <span className="text-xs text-muted">{t('gymStaff.paymentMethod')}</span>
                  <select
                    value={payProvider}
                    onChange={(e) => setPayProvider(e.target.value as 'mock' | 'cash' | 'manual')}
                    className={INPUT_CLASS}
                  >
                    <option value="mock">{t('gymStaff.providerMock')}</option>
                    <option value="cash">{t('gymStaff.providerCash')}</option>
                    <option value="manual">{t('gymStaff.providerManual')}</option>
                  </select>
                </label>

                {modal === 'paySalary' && (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <label className="block space-y-1.5">
                        <span className="text-xs text-muted">{t('gymStaff.payPeriod')}</span>
                        <select
                          value={payMonth}
                          onChange={(e) => setPayMonth(e.target.value)}
                          className={INPUT_CLASS}
                        >
                          {monthOptions.map((m) => (
                            <option key={m.value} value={m.value}>
                              {m.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="block space-y-1.5">
                        <span className="text-xs text-muted">&nbsp;</span>
                        <input
                          type="number"
                          value={payYear}
                          onChange={(e) => setPayYear(e.target.value)}
                          className={INPUT_CLASS}
                        />
                      </label>
                    </div>
                    <div className="rounded-xl bg-primary/10 border border-primary/20 px-4 py-3 text-sm">
                      {t('gymStaff.baseSalary')}: <strong>{formatMoney(activeStaff.baseSalary, language)}</strong>
                    </div>
                    <label className="block space-y-1.5">
                      <span className="text-xs text-muted">{t('gymStaff.extraBonus')}</span>
                      <input
                        type="number"
                        min={0}
                        value={extraBonus}
                        onChange={(e) => setExtraBonus(e.target.value)}
                        className={INPUT_CLASS}
                      />
                    </label>
                  </>
                )}

                {modal === 'addBonus' && (
                  <label className="block space-y-1.5">
                    <span className="text-xs text-muted">{t('gymStaff.bonusOnly')}</span>
                    <input
                      type="number"
                      min={1}
                      value={bonusOnly}
                      onChange={(e) => setBonusOnly(e.target.value)}
                      className={INPUT_CLASS}
                    />
                  </label>
                )}

                <label className="block space-y-1.5">
                  <span className="text-xs text-muted">{t('gymStaff.notes')}</span>
                  <input value={payNotes} onChange={(e) => setPayNotes(e.target.value)} className={INPUT_CLASS} />
                </label>

                {formError && <p className="text-sm text-red-400">{formError}</p>}
                <button
                  type="button"
                  onClick={modal === 'paySalary' ? handlePaySalary : handleAddBonus}
                  disabled={saving}
                  className="w-full py-3 rounded-xl font-bold bg-primary text-white disabled:opacity-50"
                >
                  {saving ? t('gymStaff.saving') : modal === 'paySalary' ? t('gymStaff.paySalary') : t('gymStaff.addBonus')}
                </button>
              </>
            )}
          </Modal>
        )}

        {modal === 'history' && activeStaff && (
          <Modal title={t('gymStaff.paymentHistory')} subtitle={activeStaff.fullName} onClose={closeModal}>
            {payoutsLoading ? (
              <p className="text-sm text-muted">{t('gymStaff.loading')}</p>
            ) : payouts.length === 0 ? (
              <p className="text-sm text-muted">{t('gymStaff.noPayouts')}</p>
            ) : (
              <div className="space-y-2">
                {payouts.map((p) => (
                  <div
                    key={p.id}
                    className="flex justify-between items-start text-sm rounded-xl bg-white/[0.03] px-4 py-3 gap-2"
                  >
                    <div>
                      <p className="font-bold">
                        {t(`gymStaff.payoutType.${p.type}` as 'gymStaff.payoutType.salary')} ·{' '}
                        {formatMoney(p.totalAmount, language)}
                      </p>
                      <p className="text-xs text-muted mt-0.5">{formatDate(p.paidAt ?? p.createdAt, language)}</p>
                    </div>
                    <span className="text-xs font-bold px-2 py-1 rounded-full bg-white/10">
                      {t(`gymStaff.payoutStatus.${p.status}` as 'gymStaff.payoutStatus.paid')}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Modal>
        )}
      </AnimatePresence>
    </Card>
  );
};

export default GymStaffSection;
