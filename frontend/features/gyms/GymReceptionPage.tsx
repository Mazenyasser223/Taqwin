import React, { useCallback, useEffect, useMemo, useState, lazy, Suspense, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useI18n } from '../../lib/i18n/useI18n';
import gymService from '../../services/gymService';
import dashboardService from '../../services/dashboardService';
import { communityProfilePath } from '../community/communityUtils';
import type { Gym, GymSubscriptionPlan, MembershipStatus, ReceptionMemberDetail, ReceptionMemberVisit, ReceptionMemberVisitStats, ReceptionPresentCounts, ReceptionPresentMember, ReceptionGender, GymClass, GymClassBooking, GymBasicSession, GymBasicSessionBooking } from '../../types';
import { staggerContainer, itemVariants, weightedTransition } from '../../lib/motion';
import { formatVisitDuration } from '../../lib/receptionVisits';
import { useAuthStore } from '../../store/useAuthStore';
import { gymBrandName } from '../../lib/gymBrandName';
import {
  formatMembershipRemaining,
  loadExpiryDisplayUnit,
  saveExpiryDisplayUnit,
  type ExpiryDisplayUnit,
} from '../../lib/membershipExpiry';
import { isValidEgyptianPhone, normalizePhoneE164 } from '../../lib/phoneNormalize';
import { PlanBenefitsList } from '../../components/gyms/PlanBenefitsFields';
import { GymClassesSection } from './GymClassesSection';
import { GymBasicSessionsSection } from './GymBasicSessionsSection';
import { canMarkSessionAttendance } from '../../lib/gymClassSchedule';
import {
  buildReceptionMembersFromGymMemberships,
  mergePresentOnlyMembers,
} from '../../lib/receptionMembers';

const LazyImageUploader = lazy(() =>
  import('../../components/shared/ImageUploader').then((m) => ({ default: m.ImageUploader })),
);

type PaymentMethod = 'cash' | 'card' | 'transfer' | 'online';

const PAYMENT_METHODS: PaymentMethod[] = ['cash', 'card', 'transfer', 'online'];

function planDisplayName(plan: Pick<GymSubscriptionPlan, 'name' | 'nameAr'>, language: string) {
  if (language === 'ar' && plan.nameAr) return plan.nameAr;
  return plan.name;
}

function formatPlanOption(plan: GymSubscriptionPlan, language: string) {
  const label = planDisplayName(plan, language);
  const money =
    language === 'ar'
      ? `${plan.price.toLocaleString('ar-EG')} ج.م`
      : `${plan.price.toLocaleString('en-US')} EGP`;
  return `${label} · ${money} · ${tPlanDays(plan.durationDays, language)}`;
}

function tPlanDays(days: number, language: string) {
  return language === 'ar' ? `${days} يوم` : `${days} days`;
}

function formatMoney(amount: number, language: string) {
  return language === 'ar'
    ? `${amount.toLocaleString('ar-EG')} ج.م`
    : `${amount.toLocaleString('en-US')} EGP`;
}

function gymFromDashboard(dash: { id: string; name: string; location: string }): Gym {
  return {
    id: dash.id,
    name: dash.name,
    location: dash.location,
    ownerId: '',
    maxCapacity: 100,
    isActive: true,
    createdAt: '',
    updatedAt: '',
  };
}

const FALLBACK_AVATAR = (id: string) =>
  `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(id)}`;

type PresentSort = 'nameAsc' | 'nameDesc' | 'checkInNewest' | 'checkInOldest';
type RosterTab = 'present' | 'session' | 'basic';
type SessionBookingSort = 'nameAsc' | 'nameDesc' | 'bookedNewest' | 'bookedOldest' | 'status';
type MemberSort = 'nameAsc' | 'nameDesc' | 'joinedNewest' | 'joinedOldest' | 'expirySoonest' | 'expiryLatest';
type VisitHistorySort = 'visitNewest' | 'visitOldest' | 'durationLongest' | 'durationShortest';

function memberName(user: ReceptionMemberDetail['user']) {
  return user.profile?.displayName ?? user.email.split('@')[0];
}

function membershipStatusBadge(status: MembershipStatus) {
  if (status === 'active') {
    return { className: 'text-green-400 bg-green-500/10', labelKey: 'reception.statusActive' as const };
  }
  if (status === 'expired') {
    return { className: 'text-red-400 bg-red-500/10', labelKey: 'reception.statusExpired' as const };
  }
  return { className: 'text-amber-400 bg-amber-500/10', labelKey: 'reception.statusInactive' as const };
}

function classSessionLabel(cls: GymClass, language: string) {
  if (language === 'ar' && cls.nameAr) return cls.nameAr;
  return cls.name;
}

function bookingStatusBadge(status: GymClassBooking['status']) {
  if (status === 'attended') {
    return { className: 'text-green-400 bg-green-500/10', labelKey: 'reception.sessionAttended' as const };
  }
  if (status === 'no_show') {
    return { className: 'text-slate-400 bg-slate-500/10', labelKey: 'reception.sessionNoShow' as const };
  }
  return { className: 'text-blue-400 bg-blue-500/10', labelKey: 'reception.sessionBooked' as const };
}

function bookingUserToDetail(booking: GymClassBooking): ReceptionMemberDetail {
  const user = booking.user!;
  const genderRaw = user.profile?.gender?.toLowerCase();
  const gender: ReceptionGender =
    genderRaw === 'male' || genderRaw === 'female' ? genderRaw : 'unknown';
  return {
    membershipId: '',
    userId: booking.userId,
    joinedAt: booking.createdAt ?? new Date().toISOString(),
    isActive: false,
    membershipStatus: 'inactive',
    daysRemaining: null,
    isPresent: false,
    gender,
    user: {
      id: user.id,
      email: user.email,
      phone: (user as { phone?: string | null }).phone ?? null,
      profile: user.profile,
    },
  };
}

function classBookingLabel(booking: GymClassBooking, language: string) {
  const cls = booking.class;
  if (!cls) return booking.sessionDate?.slice(0, 10) ?? '—';
  const name = language === 'ar' && cls.nameAr ? cls.nameAr : cls.name;
  const date = cls.sessionDate?.slice(0, 10) ?? booking.sessionDate?.slice(0, 10) ?? '';
  return `${name} · ${date} · ${cls.startTime}`;
}

function bookingStatusRank(status: GymClassBooking['status']) {
  if (status === 'booked') return 0;
  if (status === 'attended') return 1;
  return 2;
}

function isPendingRosterBooking(status: GymClassBooking['status']) {
  return status !== 'cancelled' && status !== 'attended';
}

function basicSessionLabel(session: GymBasicSessionBooking['session'], language: string) {
  if (!session) return '—';
  if (language === 'ar' && session.nameAr) return session.nameAr;
  return session.name;
}

function basicSessionOptionLabel(session: GymBasicSession, language: string) {
  const name = language === 'ar' && session.nameAr ? session.nameAr : session.name;
  const price =
    language === 'ar'
      ? `${session.price.toLocaleString('ar-EG')} ج.م`
      : `${session.price.toLocaleString('en-US')} EGP`;
  return session.icon ? `${session.icon} ${name} · ${price}` : `${name} · ${price}`;
}

function basicBookingStatusBadge(status: GymBasicSessionBooking['status']) {
  if (status === 'attended') {
    return { className: 'text-green-400 bg-green-500/10', labelKey: 'basicSessions.status.attended' as const };
  }
  if (status === 'cancelled') {
    return { className: 'text-red-400 bg-red-500/10', labelKey: 'basicSessions.status.cancelled' as const };
  }
  if (status === 'no_show') {
    return { className: 'text-slate-400 bg-slate-500/10', labelKey: 'basicSessions.status.no_show' as const };
  }
  return { className: 'text-blue-400 bg-blue-500/10', labelKey: 'basicSessions.status.booked' as const };
}

function basicBookingUserToDetail(booking: GymBasicSessionBooking): ReceptionMemberDetail {
  const user = booking.user!;
  const genderRaw = user.profile?.gender?.toLowerCase();
  const gender: ReceptionGender =
    genderRaw === 'male' || genderRaw === 'female' ? genderRaw : 'unknown';
  return {
    membershipId: '',
    userId: booking.userId,
    joinedAt: booking.createdAt ?? new Date().toISOString(),
    isActive: false,
    membershipStatus: 'inactive',
    daysRemaining: null,
    isPresent: false,
    gender,
    user: {
      id: user.id,
      email: user.email,
      phone: (user as { phone?: string | null }).phone ?? null,
      profile: user.profile,
    },
  };
}

function memberMatchesQuery(
  user: ReceptionMemberDetail['user'],
  query: string,
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const name = memberName(user).toLowerCase();
  const email = user.email.toLowerCase();
  const phone = (user.phone ?? '').toLowerCase();
  return name.includes(q) || email.includes(q) || phone.includes(q);
}

function sortReceptionMembers(
  list: ReceptionMemberDetail[],
  sort: MemberSort,
  locale: string,
): ReceptionMemberDetail[] {
  return [...list].sort((a, b) => {
    switch (sort) {
      case 'nameAsc':
        return memberName(a.user).localeCompare(memberName(b.user), locale);
      case 'nameDesc':
        return memberName(b.user).localeCompare(memberName(a.user), locale);
      case 'joinedOldest':
        return new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime();
      case 'expirySoonest': {
        const aExp = a.expiresAt ? new Date(a.expiresAt).getTime() : Number.POSITIVE_INFINITY;
        const bExp = b.expiresAt ? new Date(b.expiresAt).getTime() : Number.POSITIVE_INFINITY;
        return aExp - bExp;
      }
      case 'expiryLatest': {
        const aExp = a.expiresAt ? new Date(a.expiresAt).getTime() : Number.NEGATIVE_INFINITY;
        const bExp = b.expiresAt ? new Date(b.expiresAt).getTime() : Number.NEGATIVE_INFINITY;
        return bExp - aExp;
      }
      case 'joinedNewest':
      default:
        return new Date(b.joinedAt).getTime() - new Date(a.joinedAt).getTime();
    }
  });
}

function formatTime(iso: string, locale: string) {
  return new Date(iso).toLocaleTimeString(locale === 'ar' ? 'ar-EG' : 'en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDate(iso: string, locale: string) {
  return new Date(iso).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatDateTime(iso: string, locale: string) {
  return `${formatDate(iso, locale)} · ${formatTime(iso, locale)}`;
}

function isSameCalendarDay(iso: string, dateFilter: string) {
  if (!dateFilter) return true;
  const d = new Date(iso);
  const local = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return local === dateFilter;
}

export const GymReceptionPage: React.FC = () => {
  const { t, language } = useI18n();
  const { user } = useAuthStore();
  const [gym, setGym] = useState<Gym | null>(null);
  const [loading, setLoading] = useState(true);
  const [presentCounts, setPresentCounts] = useState<ReceptionPresentCounts>({
    total: 0,
    male: 0,
    female: 0,
    unknown: 0,
  });
  const [presentMembers, setPresentMembers] = useState<ReceptionPresentMember[]>([]);
  const [presentSearch, setPresentSearch] = useState('');
  const [presentSort, setPresentSort] = useState<PresentSort>('checkInOldest');
  const [rosterTab, setRosterTab] = useState<RosterTab>('present');
  const [sessionClasses, setSessionClasses] = useState<GymClass[]>([]);
  const [selectedSessionClassId, setSelectedSessionClassId] = useState('');
  const [sessionBookings, setSessionBookings] = useState<GymClassBooking[]>([]);
  const [sessionBookingsLoading, setSessionBookingsLoading] = useState(false);
  const [sessionSearch, setSessionSearch] = useState('');
  const [sessionSort, setSessionSort] = useState<SessionBookingSort>('status');
  const [basicSessions, setBasicSessions] = useState<GymBasicSession[]>([]);
  const [selectedBasicSessionId, setSelectedBasicSessionId] = useState('');
  const [basicSessionBookings, setBasicSessionBookings] = useState<GymBasicSessionBooking[]>([]);
  const [basicSessionBookingsLoading, setBasicSessionBookingsLoading] = useState(false);
  const [basicSessionSearch, setBasicSessionSearch] = useState('');
  const [basicSessionSort, setBasicSessionSort] = useState<SessionBookingSort>('status');
  const [attendanceLoadingId, setAttendanceLoadingId] = useState<string | null>(null);
  const [basicAttendanceLoadingId, setBasicAttendanceLoadingId] = useState<string | null>(null);
  const [bookingDeleteLoadingId, setBookingDeleteLoadingId] = useState<string | null>(null);
  const [basicBookingDeleteLoadingId, setBasicBookingDeleteLoadingId] = useState<string | null>(null);
  const [memberClassBookings, setMemberClassBookings] = useState<GymClassBooking[]>([]);
  const [memberClassBookingsLoading, setMemberClassBookingsLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [allMembers, setAllMembers] = useState<ReceptionMemberDetail[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [membersLoadError, setMembersLoadError] = useState<string | null>(null);
  const [memberSort, setMemberSort] = useState<MemberSort>('joinedNewest');
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [selected, setSelected] = useState<ReceptionMemberDetail | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [addFirstName, setAddFirstName] = useState('');
  const [addLastName, setAddLastName] = useState('');
  const [addEmail, setAddEmail] = useState('');
  const [addPhone, setAddPhone] = useState('');
  const [addAddress, setAddAddress] = useState('');
  const [addGender, setAddGender] = useState<'male' | 'female' | ''>('');
  const [addAvatarUrl, setAddAvatarUrl] = useState<string | null>(null);
  const [addExpiresAt, setAddExpiresAt] = useState('');
  const [addPlanId, setAddPlanId] = useState('');
  const [addPaymentMethod, setAddPaymentMethod] = useState<PaymentMethod>('cash');
  const [addSubmitting, setAddSubmitting] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [gymPlans, setGymPlans] = useState<GymSubscriptionPlan[]>([]);
  const [showEditPlan, setShowEditPlan] = useState(false);
  const [editPlanId, setEditPlanId] = useState('');
  const [editPaymentMethod, setEditPaymentMethod] = useState<PaymentMethod>('cash');
  const [editPlanSaving, setEditPlanSaving] = useState(false);
  const [editPlanError, setEditPlanError] = useState<string | null>(null);
  const [expiryUnit, setExpiryUnit] = useState<ExpiryDisplayUnit>(() => loadExpiryDisplayUnit());
  const [showProfile, setShowProfile] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileVisits, setProfileVisits] = useState<ReceptionMemberVisit[]>([]);
  const [profileStats, setProfileStats] = useState<ReceptionMemberVisitStats | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [visitDateFilter, setVisitDateFilter] = useState('');
  const [visitHistorySort, setVisitHistorySort] = useState<VisitHistorySort>('visitNewest');
  const initialMembersSelectRef = useRef(false);
  const [initTick, setInitTick] = useState(0);

  const handleExpiryUnitChange = (unit: ExpiryDisplayUnit) => {
    setExpiryUnit(unit);
    saveExpiryDisplayUnit(unit);
  };

  const resetAddForm = () => {
    setAddFirstName('');
    setAddLastName('');
    setAddEmail('');
    setAddPhone('');
    setAddAddress('');
    setAddGender('');
    setAddAvatarUrl(null);
    setAddExpiresAt('');
    setAddPlanId('');
    setAddPaymentMethod('cash');
    setAddError(null);
  };

  const closeAddModal = () => {
    setShowAdd(false);
    resetAddForm();
  };

  const loadPresent = useCallback(async (gymId: string, opts?: { silent?: boolean }) => {
    const res = await gymService.getReceptionPresent(gymId);
    if (res.error) {
      if (!opts?.silent) setError(res.error);
      return false;
    }
    setPresentCounts(res.data?.counts ?? { total: 0, male: 0, female: 0, unknown: 0 });
    setPresentMembers(res.data?.members ?? []);
    return true;
  }, []);

  const loadBasicSessionBookings = useCallback(async (gymId: string, sessionId: string) => {
    if (!sessionId) {
      setBasicSessionBookings([]);
      setBasicSessionBookingsLoading(false);
      return;
    }
    setBasicSessionBookingsLoading(true);
    const res = await gymService.getBasicSessionBookings(gymId, sessionId);
    setBasicSessionBookingsLoading(false);
    if (res.error) {
      setError(res.error);
      setBasicSessionBookings([]);
      return;
    }
    setBasicSessionBookings(res.data?.bookings ?? []);
  }, []);

  const loadBasicSessions = useCallback(
    async (gymId: string, preferredSessionId?: string) => {
      setBasicSessionBookingsLoading(true);
      const res = await gymService.getBasicSessions(gymId);
      const sessions = (res.error ? [] : (res.data ?? [])).filter((s) => s.isActive);
      setBasicSessions(sessions);
      const pickId =
        preferredSessionId && sessions.some((s) => s.id === preferredSessionId)
          ? preferredSessionId
          : (sessions[0]?.id ?? '');
      setSelectedBasicSessionId(pickId);
      if (pickId) await loadBasicSessionBookings(gymId, pickId);
      else setBasicSessionBookingsLoading(false);
    },
    [loadBasicSessionBookings],
  );

  const loadSessionBookings = useCallback(async (gymId: string, classId: string) => {
    if (!classId) {
      setSessionBookings([]);
      setSessionBookingsLoading(false);
      return;
    }
    setSessionBookingsLoading(true);
    const res = await gymService.getClassBookings(gymId, classId);
    setSessionBookingsLoading(false);
    if (res.error) {
      setError(res.error);
      setSessionBookings([]);
      return;
    }
    setSessionBookings(res.data?.bookings ?? []);
  }, []);

  const loadSessionClasses = useCallback(
    async (gymId: string, preferredClassId?: string) => {
      setSessionBookingsLoading(true);
      const res = await gymService.getClasses(gymId);
      const classes = res.error ? [] : (res.data ?? []);
      setSessionClasses(classes);
      const pickId =
        preferredClassId && classes.some((c) => c.id === preferredClassId)
          ? preferredClassId
          : (classes[0]?.id ?? '');
      setSelectedSessionClassId(pickId);
      if (pickId) await loadSessionBookings(gymId, pickId);
      else setSessionBookingsLoading(false);
    },
    [loadSessionBookings],
  );

  const loadAllMembers = useCallback(async (gymId: string, selectUserId?: string) => {
    setMembersLoading(true);
    setMembersLoadError(null);

    const applyMembers = (members: ReceptionMemberDetail[]) => {
      setAllMembers(members);
      if (selectUserId) {
        const picked = members.find((m) => m.userId === selectUserId);
        if (picked) setSelected(picked);
      }
    };

    try {
      const res = await gymService.getReceptionMembers(gymId);
      if (!res.error) {
        applyMembers(res.data?.members ?? []);
        return;
      }

      const membersRes = await gymService.getMyGymMembers(gymId);
      const presentRes =
        membersRes.error ? null : await gymService.getReceptionPresent(gymId);

      if (membersRes.error) {
        setMembersLoadError(res.error || membersRes.error);
        setAllMembers([]);
        return;
      }

      const present = presentRes?.data?.members ?? [];
      const built = mergePresentOnlyMembers(
        buildReceptionMembersFromGymMemberships(membersRes.data ?? [], present),
        present,
      );
      applyMembers(built);
      setMembersLoadError(res.error);
    } finally {
      setMembersLoading(false);
    }
  }, []);

  const loadGymPlans = useCallback(async (gymId: string) => {
    const res = await gymService.getGymPlans(gymId);
    if (!res.error) setGymPlans(res.data ?? []);
  }, []);

  useEffect(() => {
    let mounted = true;

    async function init() {
      setLoading(true);
      setError(null);
      try {
        const ctxRes = await dashboardService.gymContext();
        if (!mounted) return;
        if (ctxRes.error) {
          setError(ctxRes.error);
          return;
        }
        if (!ctxRes.data?.hasGym || !ctxRes.data.gym) {
          setGym(null);
          return;
        }
        const dashGym = ctxRes.data.gym;
        setGym(gymFromDashboard(dashGym));
        // One request at a time — avoids Supabase pooler P2024 on localhost dev.
        await loadPresent(dashGym.id, { silent: true });
        if (!mounted) return;
        await loadAllMembers(dashGym.id);
        if (!mounted) return;
        await loadGymPlans(dashGym.id);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void init();
    return () => {
      mounted = false;
    };
  }, [loadPresent, loadAllMembers, loadGymPlans, initTick]);

  useEffect(() => {
    if (!gym?.id) return;
    const id = window.setInterval(() => {
      void loadPresent(gym.id, { silent: true });
    }, 30_000);
    return () => window.clearInterval(id);
  }, [gym?.id, loadPresent]);

  useEffect(() => {
    if (!gym?.id || rosterTab !== 'session') return;
    void loadSessionClasses(gym.id);
  }, [gym?.id, rosterTab, loadSessionClasses]);

  useEffect(() => {
    if (!gym?.id || rosterTab !== 'basic') return;
    void loadBasicSessions(gym.id);
  }, [gym?.id, rosterTab, loadBasicSessions]);

  const handleSessionClassChange = (classId: string) => {
    setSelectedSessionClassId(classId);
    if (gym?.id) void loadSessionBookings(gym.id, classId);
  };

  const handleBasicSessionChange = (sessionId: string) => {
    setSelectedBasicSessionId(sessionId);
    if (gym?.id) void loadBasicSessionBookings(gym.id, sessionId);
  };

  const handleCancelClassBooking = async (booking: GymClassBooking) => {
    if (!gym?.id || booking.status !== 'booked') return;
    const label = classBookingLabel(booking, language);
    if (!window.confirm(t('reception.deleteClassBookingConfirm', { name: label }))) return;

    setBookingDeleteLoadingId(booking.id);
    setError(null);
    const res = await gymService.updateClassBookingStatus(
      gym.id,
      booking.classId,
      booking.id,
      'cancelled',
    );
    setBookingDeleteLoadingId(null);
    if (res.error) {
      setError(res.error);
      return;
    }
    if (selected?.userId) {
      await loadMemberClassBookings(gym.id, selected.userId);
    }
    if (selectedSessionClassId === booking.classId) {
      await loadSessionBookings(gym.id, selectedSessionClassId);
    } else if (rosterTab === 'session') {
      await loadSessionClasses(gym.id, selectedSessionClassId || undefined);
    }
  };

  const handleCancelBasicBooking = async (booking: GymBasicSessionBooking) => {
    if (!gym?.id || booking.status !== 'booked') return;
    const label = booking.user ? memberName(booking.user) : booking.userId;
    if (!window.confirm(t('reception.deleteBasicBookingConfirm', { name: label }))) return;

    setBasicBookingDeleteLoadingId(booking.id);
    setError(null);
    const res = await gymService.updateBasicSessionBookingStatus(
      gym.id,
      booking.sessionId,
      booking.id,
      'cancelled',
    );
    setBasicBookingDeleteLoadingId(null);
    if (res.error) {
      setError(res.error);
      return;
    }
    await loadBasicSessionBookings(gym.id, selectedBasicSessionId);
  };

  const handleMarkBasicAttended = async (booking: GymBasicSessionBooking) => {
    if (!gym?.id) return;
    setBasicAttendanceLoadingId(booking.id);
    setError(null);
    const res = await gymService.updateBasicSessionBookingStatus(
      gym.id,
      booking.sessionId,
      booking.id,
      'attended',
    );
    setBasicAttendanceLoadingId(null);
    if (res.error) {
      setError(res.error);
      return;
    }
    await loadBasicSessionBookings(gym.id, selectedBasicSessionId);
  };

  const handleMarkSessionAttended = async (booking: GymClassBooking) => {
    if (!gym?.id) return;
    setAttendanceLoadingId(booking.id);
    setError(null);
    const res = await gymService.updateClassBookingStatus(
      gym.id,
      booking.classId,
      booking.id,
      'attended',
    );
    setAttendanceLoadingId(null);
    if (res.error) {
      setError(res.error);
      return;
    }
    if (selectedSessionClassId) {
      await loadSessionBookings(gym.id, selectedSessionClassId);
    }
    if (selected?.userId) {
      await loadMemberClassBookings(gym.id, selected.userId);
    }
  };

  const loadMemberClassBookings = useCallback(async (gymId: string, userId: string) => {
    setMemberClassBookingsLoading(true);
    const res = await gymService.getMemberClassBookings(gymId, userId);
    setMemberClassBookingsLoading(false);
    if (res.error) {
      setMemberClassBookings([]);
      return;
    }
    setMemberClassBookings(res.data?.bookings ?? []);
  }, []);

  const selectFromBooking = useCallback(
    async (booking: GymClassBooking) => {
      if (!booking.user || !gym?.id) return;
      const found = allMembers.find((row) => row.userId === booking.userId);
      if (found) {
        setSelected(found);
        return;
      }
      const res = await gymService.getReceptionMember(gym.id, booking.userId);
      if (res.data) {
        setSelected(res.data);
      } else {
        setSelected(bookingUserToDetail(booking));
      }
    },
    [allMembers, gym?.id],
  );

  const selectFromBasicBooking = useCallback(
    async (booking: GymBasicSessionBooking) => {
      if (!booking.user || !gym?.id) return;
      const found = allMembers.find((row) => row.userId === booking.userId);
      if (found) {
        setSelected(found);
        return;
      }
      const res = await gymService.getReceptionMember(gym.id, booking.userId);
      if (res.data) {
        setSelected(res.data);
      } else {
        setSelected(basicBookingUserToDetail(booking));
      }
    },
    [allMembers, gym?.id],
  );

  const handleMainSearchChange = (value: string) => {
    setSearch(value);
  };

  const refreshSelected = useCallback(
    async (userId: string) => {
      if (!gym?.id) return;
      const res = await gymService.getReceptionMember(gym.id, userId);
      if (res.data) setSelected(res.data);
    },
    [gym?.id],
  );

  const loadMemberVisits = useCallback(
    async (userId: string) => {
      if (!gym?.id) return;
      setProfileLoading(true);
      setProfileError(null);
      const res = await gymService.getReceptionMemberVisits(gym.id, userId);
      setProfileLoading(false);
      if (res.error) {
        setProfileError(res.error);
        return;
      }
      setProfileVisits(res.data?.visits ?? []);
      setProfileStats(res.data?.stats ?? null);
    },
    [gym?.id],
  );

  const openProfile = () => {
    if (!selected) return;
    setShowProfile(true);
    void loadMemberVisits(selected.userId);
  };

  const closeProfile = () => {
    setShowProfile(false);
    setShowEditPlan(false);
    setProfileVisits([]);
    setProfileStats(null);
    setProfileError(null);
    setEditPlanError(null);
    setVisitDateFilter('');
    setVisitHistorySort('visitNewest');
  };

  const openEditPlan = () => {
    if (!selected) return;
    setEditPlanId(selected.planId ?? '');
    setEditPaymentMethod((selected.paymentMethod as PaymentMethod) ?? 'cash');
    setEditPlanError(null);
    setShowEditPlan(true);
  };

  const closeEditPlan = () => {
    if (editPlanSaving) return;
    setShowEditPlan(false);
    setEditPlanError(null);
  };

  const submitEditPlan = async () => {
    if (!gym?.id || !selected || !editPlanId) {
      setEditPlanError(t('reception.selectPlan'));
      return;
    }
    setEditPlanSaving(true);
    setEditPlanError(null);
    const res = await gymService.updateMemberMembership(gym.id, selected.userId, {
      planId: editPlanId,
      paymentMethod: editPaymentMethod,
    });
    setEditPlanSaving(false);
    if (res.error) {
      setEditPlanError(res.error);
      return;
    }
    if (res.data) {
      setSelected(res.data);
      setAllMembers((prev) => prev.map((m) => (m.userId === res.data!.userId ? res.data! : m)));
    }
    setShowEditPlan(false);
  };

  const handleCheckIn = async () => {
    if (!gym?.id || !selected) return;
    setActionLoading(true);
    setError(null);
    const res = await gymService.receptionCheckIn(gym.id, selected.userId);
    setActionLoading(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    await loadPresent(gym.id);
    await refreshSelected(selected.userId);
    if (gym?.id) await loadAllMembers(gym.id, selected.userId);
    if (showProfile) void loadMemberVisits(selected.userId);
  };

  const handleCheckOut = async () => {
    if (!gym?.id || !selected) return;
    setActionLoading(true);
    setError(null);
    const res = await gymService.receptionCheckOut(gym.id, selected.userId);
    setActionLoading(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    await loadPresent(gym.id);
    await refreshSelected(selected.userId);
    if (gym?.id) await loadAllMembers(gym.id, selected.userId);
    if (showProfile) void loadMemberVisits(selected.userId);
  };

  const handleDeleteMember = async () => {
    if (!gym?.id || !selected) return;
    const name = memberName(selected.user);
    const confirmKey = selected.accountCreatedAtDesk
      ? 'reception.deleteUserConfirmDeskAccount'
      : 'reception.deleteUserConfirm';
    if (!window.confirm(t(confirmKey, { name }))) return;

    setDeleteLoading(true);
    setError(null);
    const deletedId = selected.userId;
    const res = await gymService.deleteReceptionMember(gym.id, deletedId);
    setDeleteLoading(false);
    if (res.error) {
      setError(res.error || t('reception.deleteUserFailed'));
      return;
    }

    closeProfile();
    await loadPresent(gym.id);
    await loadAllMembers(gym.id);
    setSelected((prev) => (prev?.userId === deletedId ? null : prev));
  };

  useEffect(() => {
    if (!selected) {
      setShowProfile(false);
    }
  }, [selected]);

  const submitAdd = async () => {
    if (!gym?.id) return;
    const firstName = addFirstName.trim();
    const lastName = addLastName.trim();
    const email = addEmail.trim().toLowerCase();
    if (!firstName || !lastName || !email) {
      setAddError(t('reception.registerRequired'));
      return;
    }

    const phoneRaw = addPhone.trim();
    let normalizedPhone: string | undefined;
    if (phoneRaw) {
      if (!isValidEgyptianPhone(phoneRaw)) {
        setAddError(t('reception.phoneInvalid'));
        return;
      }
      normalizedPhone = normalizePhoneE164(phoneRaw) ?? undefined;
    }

    setAddSubmitting(true);
    setAddError(null);
    const res = await gymService.registerReceptionMember(gym.id, {
      firstName,
      lastName,
      email,
      phone: normalizedPhone,
      address: addAddress.trim() || undefined,
      gender: addGender || undefined,
      planId: addPlanId || undefined,
      paymentMethod: addPlanId ? addPaymentMethod : undefined,
      expiresAt: addExpiresAt ? new Date(addExpiresAt).toISOString() : undefined,
      avatarUrl: addAvatarUrl || undefined,
    });
    setAddSubmitting(false);
    if (res.error) {
      setAddError(res.error);
      return;
    }
    const member = res.data?.member;
    if (member) {
      setSelected(member);
      setSearch('');
      await loadAllMembers(gym.id, member.userId);
    }
    closeAddModal();
  };

  const canSubmitAdd =
    addFirstName.trim().length > 0 &&
    addLastName.trim().length > 0 &&
    addEmail.trim().length > 0 &&
    (!addPhone.trim() || isValidEgyptianPhone(addPhone.trim()));

  const selectedPlanPreview = useMemo(
    () => gymPlans.find((p) => p.id === addPlanId) ?? null,
    [gymPlans, addPlanId],
  );

  const membershipLabel = useMemo(() => {
    if (!selected) return null;
    if (selected.membershipStatus === 'expired') return t('reception.membershipExpired');
    if (selected.membershipStatus === 'inactive') return t('reception.membershipInactive');
    return t('reception.membershipActive');
  }, [selected, t]);

  const remainingLabel = useMemo(() => {
    if (!selected) return t('reception.noExpiry');
    return formatMembershipRemaining(selected.daysRemaining, selected.expiresAt, expiryUnit, t);
  }, [selected, expiryUnit, t]);

  const expiryLabel = useMemo(() => {
    if (!selected?.expiresAt) return null;
    return t('reception.expiresOn', { date: formatDate(selected.expiresAt, language) });
  }, [selected, t, language]);

  const filteredMembers = useMemo(() => {
    const locale = language === 'ar' ? 'ar' : 'en';
    const filtered = allMembers.filter((m) => memberMatchesQuery(m.user, search));
    return sortReceptionMembers(filtered, memberSort, locale);
  }, [allMembers, search, memberSort, language]);

  useEffect(() => {
    if (initialMembersSelectRef.current || filteredMembers.length === 0) return;
    initialMembersSelectRef.current = true;
    setSelected(filteredMembers[0]);
  }, [filteredMembers]);

  const filteredPresentMembers = useMemo(() => {
    const q = presentSearch.trim().toLowerCase();
    const locale = language === 'ar' ? 'ar' : 'en';
    let list = presentMembers.filter((m) => {
      if (!q) return true;
      const name = memberName(m.user).toLowerCase();
      const email = m.user.email.toLowerCase();
      const phone = (m.user.phone ?? '').toLowerCase();
      return name.includes(q) || email.includes(q) || phone.includes(q);
    });

    list = [...list].sort((a, b) => {
      switch (presentSort) {
        case 'nameAsc':
          return memberName(a.user).localeCompare(memberName(b.user), locale);
        case 'nameDesc':
          return memberName(b.user).localeCompare(memberName(a.user), locale);
        case 'checkInNewest':
          return new Date(b.checkedInAt).getTime() - new Date(a.checkedInAt).getTime();
        case 'checkInOldest':
        default:
          return new Date(a.checkedInAt).getTime() - new Date(b.checkedInAt).getTime();
      }
    });

    return list;
  }, [presentMembers, presentSearch, presentSort, language]);

  const selectedSessionClass = useMemo(
    () => sessionClasses.find((c) => c.id === selectedSessionClassId) ?? null,
    [sessionClasses, selectedSessionClassId],
  );

  const sessionRosterCount = useMemo(
    () => sessionBookings.filter((b) => isPendingRosterBooking(b.status)).length,
    [sessionBookings],
  );

  const basicSessionRosterCount = useMemo(
    () => basicSessionBookings.filter((b) => isPendingRosterBooking(b.status)).length,
    [basicSessionBookings],
  );

  const isSelectedGymMember = Boolean(selected?.membershipId);

  const focusClassBooking = useMemo(() => {
    if (!selected) return null;
    if (selectedSessionClassId) {
      const match = memberClassBookings.find((b) => b.classId === selectedSessionClassId);
      if (match) return match;
    }
    return (
      memberClassBookings.find((b) => b.status === 'booked') ?? memberClassBookings[0] ?? null
    );
  }, [selected, memberClassBookings, selectedSessionClassId]);

  const canAttendFocusBooking = useMemo(() => {
    if (!focusClassBooking || focusClassBooking.status !== 'booked' || !focusClassBooking.class) {
      return false;
    }
    return canMarkSessionAttendance({
      sessionDate: focusClassBooking.class.sessionDate ?? focusClassBooking.sessionDate,
    });
  }, [focusClassBooking]);

  const filteredSessionBookings = useMemo(() => {
    const q = sessionSearch.trim().toLowerCase();
    const locale = language === 'ar' ? 'ar' : 'en';
    let list = sessionBookings.filter((b) => {
      if (!isPendingRosterBooking(b.status)) return false;
      if (!b.user) return !q;
      return memberMatchesQuery(b.user, q);
    });

    list = [...list].sort((a, b) => {
      const nameA = a.user ? memberName(a.user) : '';
      const nameB = b.user ? memberName(b.user) : '';
      switch (sessionSort) {
        case 'nameAsc':
          return nameA.localeCompare(nameB, locale);
        case 'nameDesc':
          return nameB.localeCompare(nameA, locale);
        case 'bookedNewest':
          return new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime();
        case 'bookedOldest':
          return new Date(a.createdAt ?? 0).getTime() - new Date(b.createdAt ?? 0).getTime();
        case 'status':
        default:
          return bookingStatusRank(a.status) - bookingStatusRank(b.status) || nameA.localeCompare(nameB, locale);
      }
    });

    return list;
  }, [sessionBookings, sessionSearch, sessionSort, language]);

  const filteredBasicSessionBookings = useMemo(() => {
    const q = basicSessionSearch.trim().toLowerCase();
    const locale = language === 'ar' ? 'ar' : 'en';
    let list = basicSessionBookings.filter((b) => {
      if (!isPendingRosterBooking(b.status)) return false;
      if (!b.user) return !q;
      return memberMatchesQuery(b.user, q);
    });

    list = [...list].sort((a, b) => {
      const nameA = a.user ? memberName(a.user) : '';
      const nameB = b.user ? memberName(b.user) : '';
      switch (basicSessionSort) {
        case 'nameAsc':
          return nameA.localeCompare(nameB, locale);
        case 'nameDesc':
          return nameB.localeCompare(nameA, locale);
        case 'bookedNewest':
          return new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime();
        case 'bookedOldest':
          return new Date(a.createdAt ?? 0).getTime() - new Date(b.createdAt ?? 0).getTime();
        case 'status':
        default:
          return bookingStatusRank(a.status) - bookingStatusRank(b.status) || nameA.localeCompare(nameB, locale);
      }
    });

    return list;
  }, [basicSessionBookings, basicSessionSearch, basicSessionSort, language]);

  useEffect(() => {
    if (!gym?.id || !selected?.userId) {
      setMemberClassBookings([]);
      return;
    }
    void loadMemberClassBookings(gym.id, selected.userId);
  }, [gym?.id, selected?.userId, loadMemberClassBookings]);

  const filteredProfileVisits = useMemo(() => {
    let list = profileVisits.filter((v) => isSameCalendarDay(v.checkedInAt, visitDateFilter));

    list = [...list].sort((a, b) => {
      switch (visitHistorySort) {
        case 'visitOldest':
          return new Date(a.checkedInAt).getTime() - new Date(b.checkedInAt).getTime();
        case 'durationLongest':
          return b.durationMinutes - a.durationMinutes;
        case 'durationShortest':
          return a.durationMinutes - b.durationMinutes;
        case 'visitNewest':
        default:
          return new Date(b.checkedInAt).getTime() - new Date(a.checkedInAt).getTime();
      }
    });

    return list;
  }, [profileVisits, visitDateFilter, visitHistorySort]);

  if (loading) {
    return <div className="text-primary animate-pulse p-8">{t('reception.loading')}</div>;
  }

  if (error && !gym) {
    return (
      <div className="max-w-2xl mx-auto p-12 glass-panel rounded-3xl text-center space-y-4">
        <p className="text-red-400">{error}</p>
        <button
          type="button"
          onClick={() => setInitTick((n) => n + 1)}
          className="inline-block bg-primary text-white font-bold px-6 py-3 rounded-xl"
        >
          {t('common.retry')}
        </button>
      </div>
    );
  }

  if (!gym) {
    return (
      <div className="max-w-2xl mx-auto p-12 glass-panel rounded-3xl text-center space-y-6">
        <h2 className="text-2xl font-black">{t('reception.title')}</h2>
        <p className="text-muted">{t('reception.setupGym')}</p>
        <Link to="/profile" className="inline-block bg-primary text-white font-bold px-6 py-3 rounded-xl">
          {t('gymDash.setupCta')}
        </Link>
      </div>
    );
  }

  return (
    <div className="page-shell pb-2 space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight">
            {gymBrandName(user?.profile?.businessName, gym.name)} {t('reception.title')}
          </h1>
          <p className="text-muted mt-1">
            {gymBrandName(user?.profile?.businessName, gym.name)} · {t('reception.subtitle')}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowAdd(true)}
          className="bg-primary text-white px-5 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg"
        >
          <span className="material-symbols-outlined text-base">person_add</span>
          {t('reception.registerMember')}
        </button>
      </div>

      {gym.id && (
        <GymBasicSessionsSection
          gymId={gym.id}
          readOnly
          onBookingComplete={() => {
            void loadSessionClasses(gym.id, selectedSessionClassId || undefined);
            void loadBasicSessions(gym.id, selectedBasicSessionId || undefined);
          }}
        />
      )}

      {gym.id && (
        <GymClassesSection
          gymId={gym.id}
          readOnly
          onBookingComplete={() => {
            void loadSessionClasses(gym.id, selectedSessionClassId || undefined);
            void loadBasicSessions(gym.id, selectedBasicSessionId || undefined);
          }}
        />
      )}

      <motion.div
        variants={staggerContainer(0.08)}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-1 lg:grid-cols-3 gap-6"
      >
        <motion.div variants={itemVariants} className="lg:col-span-1 space-y-4">
          <div className="glass-panel rounded-3xl p-6 border-subtle space-y-5">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-faint">{t('reception.presentNow')}</p>
              <p className="text-4xl font-black mt-1">
                {presentCounts.total}{' '}
                <span className="text-lg font-bold text-muted">{t('reception.inGym')}</span>
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-elevated rounded-xl p-3 text-center border border-subtle">
                <p className="text-[10px] font-bold text-faint uppercase">{t('reception.male')}</p>
                <p className="text-2xl font-black text-[#004eff]">{presentCounts.male}</p>
              </div>
              <div className="bg-elevated rounded-xl p-3 text-center border border-subtle">
                <p className="text-[10px] font-bold text-faint uppercase">{t('reception.female')}</p>
                <p className="text-2xl font-black text-[#ff00ff]">{presentCounts.female}</p>
              </div>
            </div>
          </div>

          <div className="glass-panel rounded-3xl p-4 border-subtle space-y-3">
            <div className="flex rounded-xl bg-elevated p-1 border border-subtle">
              <button
                type="button"
                onClick={() => setRosterTab('present')}
                className={`flex-1 rounded-lg px-1.5 py-2 text-[9px] font-black uppercase tracking-wide transition-colors ${
                  rosterTab === 'present'
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-muted hover:text-primary'
                }`}
              >
                {t('reception.rosterTabPresent')} ({presentCounts.total})
              </button>
              <button
                type="button"
                onClick={() => setRosterTab('session')}
                className={`flex-1 rounded-lg px-1.5 py-2 text-[9px] font-black uppercase tracking-wide transition-colors ${
                  rosterTab === 'session'
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-muted hover:text-primary'
                }`}
              >
                {t('reception.rosterTabSession')} ({sessionRosterCount})
              </button>
              <button
                type="button"
                onClick={() => setRosterTab('basic')}
                className={`flex-1 rounded-lg px-1.5 py-2 text-[9px] font-black uppercase tracking-wide transition-colors ${
                  rosterTab === 'basic'
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-muted hover:text-primary'
                }`}
              >
                {t('reception.rosterTabBasic')} ({basicSessionRosterCount})
              </button>
            </div>

            {rosterTab === 'session' && sessionClasses.length > 0 && (
              <label className="block space-y-1">
                <span className="text-[10px] font-bold text-faint uppercase">{t('reception.sessionSelectClass')}</span>
                <select
                  value={selectedSessionClassId}
                  onChange={(e) => handleSessionClassChange(e.target.value)}
                  className="w-full bg-elevated border border-subtle rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-primary/40"
                >
                  {sessionClasses.map((cls) => (
                    <option key={cls.id} value={cls.id}>
                      {classSessionLabel(cls, language)} · {cls.sessionDate.slice(0, 10)} · {cls.startTime}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {rosterTab === 'basic' && basicSessions.length > 0 && (
              <label className="block space-y-1">
                <span className="text-[10px] font-bold text-faint uppercase">{t('reception.basicSelectSession')}</span>
                <select
                  value={selectedBasicSessionId}
                  onChange={(e) => handleBasicSessionChange(e.target.value)}
                  className="w-full bg-elevated border border-subtle rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-primary/40"
                >
                  {basicSessions.map((session) => (
                    <option key={session.id} value={session.id}>
                      {basicSessionOptionLabel(session, language)}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <div className="relative">
              <span className="material-symbols-outlined absolute start-3 top-1/2 -translate-y-1/2 text-faint text-base pointer-events-none">
                search
              </span>
              <input
                type="search"
                value={
                  rosterTab === 'present'
                    ? presentSearch
                    : rosterTab === 'session'
                      ? sessionSearch
                      : basicSessionSearch
                }
                onChange={(e) => {
                  const value = e.target.value;
                  if (rosterTab === 'present') setPresentSearch(value);
                  else if (rosterTab === 'session') setSessionSearch(value);
                  else setBasicSessionSearch(value);
                }}
                placeholder={
                  rosterTab === 'present'
                    ? t('reception.presentSearchPlaceholder')
                    : rosterTab === 'session'
                      ? t('reception.sessionSearchPlaceholder')
                      : t('reception.basicSearchPlaceholder')
                }
                className="w-full bg-elevated border border-subtle rounded-xl ps-10 pe-3 py-2.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
            <div className="flex items-center gap-2">
              <label
                htmlFor="roster-sort"
                className="text-[10px] font-bold text-faint uppercase shrink-0"
              >
                {t('reception.sort')}
              </label>
              <select
                id="roster-sort"
                value={
                  rosterTab === 'present'
                    ? presentSort
                    : rosterTab === 'session'
                      ? sessionSort
                      : basicSessionSort
                }
                onChange={(e) => {
                  const value = e.target.value as PresentSort | SessionBookingSort;
                  if (rosterTab === 'present') setPresentSort(value as PresentSort);
                  else if (rosterTab === 'session') setSessionSort(value as SessionBookingSort);
                  else setBasicSessionSort(value as SessionBookingSort);
                }}
                className="flex-1 min-w-0 bg-elevated border border-subtle rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                {rosterTab === 'present' ? (
                  <>
                    <option value="checkInOldest">{t('reception.sortCheckInOldest')}</option>
                    <option value="checkInNewest">{t('reception.sortCheckInNewest')}</option>
                    <option value="nameAsc">{t('reception.sortNameAsc')}</option>
                    <option value="nameDesc">{t('reception.sortNameDesc')}</option>
                  </>
                ) : (
                  <>
                    <option value="status">{t('reception.sortStatus')}</option>
                    <option value="nameAsc">{t('reception.sortNameAsc')}</option>
                    <option value="nameDesc">{t('reception.sortNameDesc')}</option>
                    <option value="bookedNewest">{t('reception.sortBookedNewest')}</option>
                    <option value="bookedOldest">{t('reception.sortBookedOldest')}</option>
                  </>
                )}
              </select>
            </div>
            <div className="max-h-[320px] overflow-y-auto custom-scrollbar -mx-1 px-1">
              {rosterTab === 'present' ? (
                presentMembers.length === 0 ? (
                  <p className="text-sm text-muted text-center py-8">{t('reception.empty')}</p>
                ) : filteredPresentMembers.length === 0 ? (
                  <p className="text-sm text-muted text-center py-8">{t('reception.presentNoMatch')}</p>
                ) : (
                  <ul className="space-y-2">
                    {filteredPresentMembers.map((m) => (
                      <li key={m.visitId}>
                        <button
                          type="button"
                          onClick={() => {
                            const found = allMembers.find((row) => row.userId === m.userId);
                            if (found) {
                              setSelected(found);
                              return;
                            }
                            if (!gym.id) return;
                            void gymService.getReceptionMember(gym.id, m.userId).then((res) => {
                              if (res.data) setSelected(res.data);
                            });
                          }}
                          className={`w-full flex items-center gap-3 p-3 rounded-xl text-start transition-all ${
                            selected?.userId === m.userId
                              ? 'bg-primary/15 border border-primary/30'
                              : 'hover:bg-elevated-hover border border-transparent'
                          }`}
                        >
                          <img
                            src={m.user.profile?.avatarUrl || FALLBACK_AVATAR(m.userId)}
                            alt=""
                            className="size-10 rounded-lg object-cover shrink-0"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="font-bold truncate">{memberName(m.user)}</p>
                            <p className="text-xs text-muted">
                              {t('reception.checkedInAt', { time: formatTime(m.checkedInAt, language) })}
                            </p>
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                )
              ) : rosterTab === 'session' ? (
                sessionBookingsLoading ? (
                  <p className="text-sm text-muted text-center py-8">{t('reception.loading')}</p>
                ) : sessionClasses.length === 0 ? (
                  <p className="text-sm text-muted text-center py-8">{t('reception.sessionNoUpcoming')}</p>
                ) : filteredSessionBookings.length === 0 ? (
                  <p className="text-sm text-muted text-center py-8">
                    {sessionBookings.filter((b) => isPendingRosterBooking(b.status)).length === 0
                      ? t('reception.sessionNoBookings')
                      : t('reception.sessionNoMatch')}
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {filteredSessionBookings.map((booking) => {
                      if (!booking.user) return null;
                      const badge = bookingStatusBadge(booking.status);
                      const canAttend =
                        booking.status === 'booked' &&
                        selectedSessionClass &&
                        canMarkSessionAttendance(selectedSessionClass);
                      return (
                        <li key={booking.id}>
                          <div
                            className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                              selected?.userId === booking.userId
                                ? 'bg-primary/15 border-primary/30'
                                : 'border-transparent bg-elevated/40'
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => void selectFromBooking(booking)}
                              className="flex min-w-0 flex-1 items-center gap-3 text-start"
                            >
                              <img
                                src={booking.user.profile?.avatarUrl || FALLBACK_AVATAR(booking.userId)}
                                alt=""
                                className="size-10 rounded-lg object-cover shrink-0"
                              />
                              <div className="min-w-0 flex-1">
                                <p className="font-bold truncate">{memberName(booking.user)}</p>
                                <span
                                  className={`inline-block mt-0.5 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${badge.className}`}
                                >
                                  {t(badge.labelKey)}
                                </span>
                              </div>
                            </button>
                            {canAttend ? (
                              <button
                                type="button"
                                disabled={attendanceLoadingId === booking.id}
                                onClick={() => void handleMarkSessionAttended(booking)}
                                className="shrink-0 rounded-lg bg-green-500/15 border border-green-500/30 px-2.5 py-1.5 text-[10px] font-black uppercase text-green-400 hover:bg-green-500/25 disabled:opacity-50"
                              >
                                {t('reception.sessionMarkAttended')}
                              </button>
                            ) : booking.status === 'booked' ? (
                              <span className="shrink-0 text-[9px] font-bold uppercase text-faint max-w-[72px] text-end leading-tight">
                                {t('reception.sessionNotToday')}
                              </span>
                            ) : null}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )
              ) : basicSessionBookingsLoading ? (
                <p className="text-sm text-muted text-center py-8">{t('reception.loading')}</p>
              ) : basicSessions.length === 0 ? (
                <p className="text-sm text-muted text-center py-8">{t('reception.basicNoSessions')}</p>
              ) : filteredBasicSessionBookings.length === 0 ? (
                <p className="text-sm text-muted text-center py-8">
                  {basicSessionBookings.filter((b) => isPendingRosterBooking(b.status)).length === 0
                    ? t('reception.basicNoBookings')
                    : t('reception.basicNoMatch')}
                </p>
              ) : (
                <ul className="space-y-2">
                  {filteredBasicSessionBookings.map((booking) => {
                    if (!booking.user) return null;
                    const badge = basicBookingStatusBadge(booking.status);
                    return (
                      <li key={booking.id}>
                        <div
                          className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                            selected?.userId === booking.userId
                              ? 'bg-primary/15 border-primary/30'
                              : 'border-transparent bg-elevated/40'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => void selectFromBasicBooking(booking)}
                            className="flex min-w-0 flex-1 items-center gap-3 text-start"
                          >
                            <img
                              src={booking.user.profile?.avatarUrl || FALLBACK_AVATAR(booking.userId)}
                              alt=""
                              className="size-10 rounded-lg object-cover shrink-0"
                            />
                            <div className="min-w-0 flex-1">
                              <p className="font-bold truncate">{memberName(booking.user)}</p>
                              <p className="text-xs text-muted truncate">
                                {basicSessionLabel(booking.session, language)} · {formatTime(booking.createdAt ?? '', language)}
                              </p>
                              <span
                                className={`inline-block mt-0.5 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${badge.className}`}
                              >
                                {t(badge.labelKey)}
                              </span>
                            </div>
                          </button>
                          {booking.status === 'booked' ? (
                            <div className="flex shrink-0 flex-col gap-1">
                              <button
                                type="button"
                                disabled={basicAttendanceLoadingId === booking.id}
                                onClick={() => void handleMarkBasicAttended(booking)}
                                className="rounded-lg bg-green-500/15 border border-green-500/30 px-2 py-1 text-[9px] font-black uppercase text-green-400 hover:bg-green-500/25 disabled:opacity-50"
                              >
                                {t('basicSessions.markAttended')}
                              </button>
                              <button
                                type="button"
                                disabled={basicBookingDeleteLoadingId === booking.id}
                                onClick={() => void handleCancelBasicBooking(booking)}
                                className="rounded-lg bg-red-500/10 border border-red-500/25 px-2 py-1 text-[9px] font-black uppercase text-red-400 hover:bg-red-500/20 disabled:opacity-50"
                              >
                                {t('basicSessions.cancel')}
                              </button>
                            </div>
                          ) : null}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </motion.div>

        <motion.div variants={itemVariants} className="lg:col-span-2 space-y-4">
          <div className="relative">
            <span className="material-symbols-outlined absolute start-4 top-1/2 -translate-y-1/2 text-faint">search</span>
            <input
              type="search"
              value={search}
              onChange={(e) => handleMainSearchChange(e.target.value)}
              placeholder={t('reception.searchPlaceholder')}
              className="w-full bg-elevated border border-subtle rounded-2xl ps-12 pe-12 py-4 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
            {membersLoading && (
              <span
                className="absolute end-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-primary text-xl animate-spin"
                aria-hidden
              >
                progress_activity
              </span>
            )}
          </div>

          {membersLoadError && (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-200 text-sm">
              {membersLoadError}
            </div>
          )}

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <p className="text-xs font-bold text-muted">
              {membersLoading
                ? t('reception.loadingMembers')
                : t('reception.allMembers', { count: String(filteredMembers.length) })}
            </p>
            <div className="flex items-center gap-2">
              <label htmlFor="member-sort" className="text-[10px] font-bold text-faint uppercase shrink-0">
                {t('reception.sort')}
              </label>
              <select
                id="member-sort"
                value={memberSort}
                onChange={(e) => setMemberSort(e.target.value as MemberSort)}
                className="flex-1 min-w-[160px] bg-elevated border border-subtle rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                <option value="joinedNewest">{t('reception.sortJoinedNewest')}</option>
                <option value="joinedOldest">{t('reception.sortJoinedOldest')}</option>
                <option value="nameAsc">{t('reception.sortNameAsc')}</option>
                <option value="nameDesc">{t('reception.sortNameDesc')}</option>
                <option value="expirySoonest">{t('reception.sortExpirySoonest')}</option>
                <option value="expiryLatest">{t('reception.sortExpiryLatest')}</option>
              </select>
            </div>
          </div>

          <div className="glass-panel rounded-2xl border-subtle overflow-hidden max-h-[220px] overflow-y-auto custom-scrollbar">
            {membersLoading && allMembers.length === 0 ? (
              <p className="text-sm text-muted text-center py-8">{t('reception.loadingMembers')}</p>
            ) : filteredMembers.length === 0 ? (
              <p className="text-sm text-muted text-center py-8">
                {search.trim() ? t('reception.noResults') : t('reception.noMembersYet')}
              </p>
            ) : (
              filteredMembers.map((m) => {
                const statusBadge = membershipStatusBadge(m.membershipStatus);
                return (
                <button
                  key={m.userId}
                  type="button"
                  onClick={() => setSelected(m)}
                  className={`w-full flex items-center gap-4 px-4 py-3 border-b border-subtle last:border-0 text-start hover:bg-elevated-hover transition-colors ${
                    selected?.userId === m.userId ? 'bg-primary/10' : ''
                  }`}
                >
                  <img
                    src={m.user.profile?.avatarUrl || FALLBACK_AVATAR(m.userId)}
                    alt=""
                    className="size-11 rounded-xl object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-bold truncate">{memberName(m.user)}</p>
                    <p className="text-xs text-muted truncate">{m.user.email}</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                    {m.isPresent && (
                      <span className="text-[10px] font-bold uppercase text-green-400 bg-green-500/10 px-2 py-1 rounded-full">
                        {t('reception.alreadyIn')}
                      </span>
                    )}
                    <span
                      className={`text-[10px] font-bold uppercase px-2 py-1 rounded-full ${statusBadge.className}`}
                    >
                      {t(statusBadge.labelKey)}
                    </span>
                  </div>
                </button>
                );
              })
            )}
          </div>

          <div className="glass-panel rounded-3xl p-6 sm:p-8 border-subtle min-h-[280px]">
            {!selected ? (
              <div className="flex flex-col items-center justify-center h-full py-12 text-center text-muted">
                <span className="material-symbols-outlined text-5xl mb-3 opacity-40">person_search</span>
                <p>{membersLoading ? t('reception.loadingMembers') : t('reception.selectMember')}</p>
              </div>
            ) : !isSelectedGymMember ? (
              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <img
                    src={selected.user.profile?.avatarUrl || FALLBACK_AVATAR(selected.userId)}
                    alt=""
                    className="size-16 rounded-2xl object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <h2 className="text-2xl font-black truncate">{memberName(selected.user)}</h2>
                    <p className="text-sm text-muted truncate">{selected.user.email}</p>
                    {selected.user.phone && (
                      <p className="text-sm text-muted mt-1">{selected.user.phone}</p>
                    )}
                  </div>
                </div>

                {focusClassBooking && (
                  <div className="bg-elevated rounded-xl p-4 border border-subtle">
                    <p className="text-[10px] font-bold text-faint uppercase">{t('reception.sessionSelectClass')}</p>
                    <p className="text-lg font-black mt-1">{classBookingLabel(focusClassBooking, language)}</p>
                    <span
                      className={`inline-block mt-2 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${bookingStatusBadge(focusClassBooking.status).className}`}
                    >
                      {t(bookingStatusBadge(focusClassBooking.status).labelKey)}
                    </span>
                  </div>
                )}

                {error && (
                  <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>
                )}

                {canAttendFocusBooking && focusClassBooking ? (
                  <button
                    type="button"
                    disabled={attendanceLoadingId === focusClassBooking.id}
                    onClick={() => void handleMarkSessionAttended(focusClassBooking)}
                    className="w-full bg-green-500 text-white font-bold py-3 px-6 rounded-xl disabled:opacity-50"
                  >
                    {attendanceLoadingId === focusClassBooking.id
                      ? t('common.loading')
                      : t('reception.sessionMarkAttended')}
                  </button>
                ) : focusClassBooking?.status === 'booked' ? (
                  <p className="text-sm text-center text-muted">{t('reception.sessionNotToday')}</p>
                ) : null}
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <img
                    src={selected.user.profile?.avatarUrl || FALLBACK_AVATAR(selected.userId)}
                    alt=""
                    className="size-16 rounded-2xl object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <h2 className="text-2xl font-black truncate">{memberName(selected.user)}</h2>
                    <p className="text-sm text-muted truncate">{selected.user.email}</p>
                    {selected.user.phone && (
                      <p className="text-sm text-muted mt-1">{selected.user.phone}</p>
                    )}
                    {selected.address && (
                      <p className="text-sm text-muted mt-1">{selected.address}</p>
                    )}
                  </div>
                  <div className="shrink-0 flex flex-col items-end gap-2">
                    <span
                      className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase ${
                        selected.membershipStatus === 'active'
                          ? 'bg-green-500/10 text-green-400'
                          : 'bg-red-500/10 text-red-400'
                      }`}
                    >
                      {membershipLabel}
                    </span>
                    <button
                      type="button"
                      onClick={() => void handleDeleteMember()}
                      disabled={deleteLoading || actionLoading}
                      className="px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-50"
                    >
                      {deleteLoading ? t('common.loading') : t('reception.deleteUser')}
                    </button>
                    <button
                      type="button"
                      onClick={openProfile}
                      className="px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase bg-elevated border border-subtle text-primary hover:bg-primary/10 transition-colors"
                    >
                      {t('reception.viewProfile')}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="bg-elevated rounded-xl p-4 border border-subtle sm:col-span-2">
                    <p className="text-[10px] font-bold text-faint uppercase">{t('reception.currentPlan')}</p>
                    <p className="text-lg font-black mt-1">
                      {selected.plan
                        ? planDisplayName(selected.plan, language)
                        : t('reception.noPlanAssigned')}
                    </p>
                    {selected.plan && (
                      <p className="text-xs text-muted mt-1">
                        {formatMoney(selected.plan.price, language)} · {tPlanDays(selected.plan.durationDays, language)}
                      </p>
                    )}
                    {selected.plan?.benefits && (
                      <PlanBenefitsList benefits={selected.plan.benefits} className="mt-2" />
                    )}
                  </div>
                  <div className="bg-elevated rounded-xl p-4 border border-subtle">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-[10px] font-bold text-faint uppercase">{t('members.expires')}</p>
                      {selected.expiresAt &&
                        selected.daysRemaining !== null &&
                        selected.daysRemaining > 0 &&
                        selected.membershipStatus === 'active' && (
                          <div
                            className="flex rounded-lg bg-background/60 p-0.5 border border-subtle shrink-0"
                            role="group"
                            aria-label={t('members.expires')}
                          >
                            {(
                              [
                                ['days', 'reception.expiryUnitDays'],
                                ['months', 'reception.expiryUnitMonths'],
                                ['years', 'reception.expiryUnitYears'],
                              ] as const
                            ).map(([unit, labelKey]) => (
                              <button
                                key={unit}
                                type="button"
                                onClick={() => handleExpiryUnitChange(unit)}
                                className={`px-2 py-0.5 rounded-md text-[9px] font-bold uppercase transition-colors ${
                                  expiryUnit === unit
                                    ? 'bg-primary text-white'
                                    : 'text-muted hover:text-primary'
                                }`}
                              >
                                {t(labelKey)}
                              </button>
                            ))}
                          </div>
                        )}
                    </div>
                    <p className="text-lg font-black mt-1">{remainingLabel}</p>
                    {expiryLabel && <p className="text-xs text-muted mt-1">{expiryLabel}</p>}
                  </div>
                  <div className="bg-elevated rounded-xl p-4 border border-subtle">
                    <p className="text-[10px] font-bold text-faint uppercase">{t('reception.status')}</p>
                    <p className="text-lg font-black mt-1">
                      {selected.isPresent ? t('reception.alreadyIn') : t('reception.notIn')}
                    </p>
                    {selected.checkedInAt && selected.isPresent && (
                      <p className="text-xs text-muted mt-1">
                        {t('reception.checkedInAt', { time: formatTime(selected.checkedInAt, language) })}
                      </p>
                    )}
                  </div>
                </div>

                {memberClassBookings.length > 0 && (
                  <div className="bg-elevated rounded-xl p-4 border border-subtle">
                    <p className="text-[10px] font-bold text-faint uppercase">{t('reception.memberClassBookings')}</p>
                    {memberClassBookingsLoading ? (
                      <p className="text-sm text-muted mt-3">{t('reception.loading')}</p>
                    ) : (
                      <ul className="mt-3 space-y-2">
                        {memberClassBookings.map((booking) => {
                          const badge = bookingStatusBadge(booking.status);
                          const canRemove = booking.status === 'booked';
                          return (
                            <li
                              key={booking.id}
                              className="flex items-center gap-3 rounded-xl border border-subtle bg-background/40 p-3"
                            >
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-bold truncate">{classBookingLabel(booking, language)}</p>
                                <span
                                  className={`inline-block mt-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${badge.className}`}
                                >
                                  {t(badge.labelKey)}
                                </span>
                              </div>
                              {canRemove && (
                                <button
                                  type="button"
                                  disabled={bookingDeleteLoadingId === booking.id || actionLoading}
                                  onClick={() => void handleCancelClassBooking(booking)}
                                  className="shrink-0 size-9 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-50 flex items-center justify-center"
                                  title={t('reception.deleteClassBooking')}
                                  aria-label={t('reception.deleteClassBooking')}
                                >
                                  <span className="material-symbols-outlined text-base">
                                    {bookingDeleteLoadingId === booking.id ? 'progress_activity' : 'delete'}
                                  </span>
                                </button>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                )}

                {error && (
                  <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>
                )}

                <div className="flex flex-col gap-3">
                  {selected.isPresent ? (
                    <button
                      type="button"
                      onClick={() => void handleCheckOut()}
                      disabled={actionLoading}
                      className="w-full bg-accent text-white font-bold py-3 px-6 rounded-xl disabled:opacity-50"
                    >
                      {actionLoading ? t('common.loading') : t('reception.checkOut')}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void handleCheckIn()}
                      disabled={actionLoading || selected.membershipStatus !== 'active'}
                      className="w-full bg-primary text-white font-bold py-3 px-6 rounded-xl disabled:opacity-50"
                    >
                      {actionLoading ? t('common.loading') : t('reception.checkIn')}
                    </button>
                  )}
                  {canAttendFocusBooking && focusClassBooking && (
                    <button
                      type="button"
                      disabled={attendanceLoadingId === focusClassBooking.id}
                      onClick={() => void handleMarkSessionAttended(focusClassBooking)}
                      className="w-full bg-green-500 text-white font-bold py-3 px-6 rounded-xl disabled:opacity-50"
                    >
                      {attendanceLoadingId === focusClassBooking.id
                        ? t('common.loading')
                        : t('reception.sessionMarkAttended')}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>

      <AnimatePresence>
        {showAdd && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 safe-bottom"
            onClick={closeAddModal}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              transition={weightedTransition}
              onClick={(e) => e.stopPropagation()}
              className="glass-panel w-full max-w-md max-h-[90vh] overflow-y-auto custom-scrollbar rounded-t-3xl sm:rounded-3xl p-6 sm:p-8 space-y-5"
            >
              <h3 className="text-2xl font-black">{t('reception.registerMember')}</h3>
              <p className="text-sm text-muted">{t('reception.registerMemberHint')}</p>

              <div className="flex justify-center">
                <Suspense fallback={<div className="size-24 rounded-full bg-elevated animate-pulse" />}>
                  <LazyImageUploader
                    folder="avatars"
                    value={addAvatarUrl}
                    onChange={setAddAvatarUrl}
                    size="size-24"
                    layout="stacked"
                    label={t('reception.uploadPhoto')}
                  />
                </Suspense>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className="text-[10px] uppercase font-black tracking-widest text-faint">
                    {t('reception.firstName')}
                  </label>
                  <input
                    type="text"
                    value={addFirstName}
                    onChange={(e) => setAddFirstName(e.target.value)}
                    className="w-full bg-elevated border border-subtle rounded-xl px-4 py-3 font-bold focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] uppercase font-black tracking-widest text-faint">
                    {t('reception.lastName')}
                  </label>
                  <input
                    type="text"
                    value={addLastName}
                    onChange={(e) => setAddLastName(e.target.value)}
                    className="w-full bg-elevated border border-subtle rounded-xl px-4 py-3 font-bold focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] uppercase font-black tracking-widest text-faint">
                  {t('members.memberEmail')}
                </label>
                <input
                  type="email"
                  value={addEmail}
                  onChange={(e) => setAddEmail(e.target.value)}
                  className="w-full bg-elevated border border-subtle rounded-xl px-4 py-3 font-bold focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] uppercase font-black tracking-widest text-faint">
                  {t('reception.phone')}
                </label>
                <input
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  value={addPhone}
                  onChange={(e) => setAddPhone(e.target.value)}
                  placeholder={t('settings.phonePlaceholder')}
                  className={`w-full bg-elevated border rounded-xl px-4 py-3 font-bold focus:outline-none focus:ring-2 focus:ring-primary/40 ${
                    addPhone.trim() && !isValidEgyptianPhone(addPhone.trim())
                      ? 'border-red-500/50'
                      : 'border-subtle'
                  }`}
                />
                {addPhone.trim() && !isValidEgyptianPhone(addPhone.trim()) ? (
                  <p className="text-xs text-red-400">{t('reception.phoneInvalid')}</p>
                ) : (
                  <p className="text-xs text-muted">{t('reception.phoneHint')}</p>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-[10px] uppercase font-black tracking-widest text-faint">
                  {t('reception.address')}
                </label>
                <textarea
                  value={addAddress}
                  onChange={(e) => setAddAddress(e.target.value)}
                  rows={3}
                  className="w-full bg-elevated border border-subtle rounded-xl px-4 py-3 font-bold focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] uppercase font-black tracking-widest text-faint">
                  {t('reception.genderOptional')}
                </label>
                <select
                  value={addGender}
                  onChange={(e) => setAddGender(e.target.value as 'male' | 'female' | '')}
                  className="w-full bg-elevated border border-subtle rounded-xl px-4 py-3 font-bold focus:outline-none focus:ring-2 focus:ring-primary/40"
                >
                  <option value="">—</option>
                  <option value="male">{t('reception.genderMale')}</option>
                  <option value="female">{t('reception.genderFemale')}</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] uppercase font-black tracking-widest text-faint">
                  {t('reception.subscriptionPlan')}
                </label>
                {gymPlans.length === 0 ? (
                  <p className="text-xs text-muted py-2">{t('reception.noPlansAvailable')}</p>
                ) : (
                  <select
                    value={addPlanId}
                    onChange={(e) => setAddPlanId(e.target.value)}
                    className="w-full bg-elevated border border-subtle rounded-xl px-4 py-3 font-bold focus:outline-none focus:ring-2 focus:ring-primary/40"
                  >
                    <option value="">{t('reception.selectPlan')}</option>
                    {gymPlans.map((plan) => (
                      <option key={plan.id} value={plan.id}>
                        {formatPlanOption(plan, language)}
                      </option>
                    ))}
                  </select>
                )}
                {selectedPlanPreview && (
                  <p className="text-xs text-primary font-bold">
                    {t('reception.planAutoExpiry', { days: String(selectedPlanPreview.durationDays) })}
                  </p>
                )}
                {selectedPlanPreview?.benefits && (
                  <PlanBenefitsList benefits={selectedPlanPreview.benefits} className="mt-2" />
                )}
              </div>

              {addPlanId && (
                <div className="space-y-2">
                  <label className="text-[10px] uppercase font-black tracking-widest text-faint">
                    {t('reception.paymentMethod')}
                  </label>
                  <select
                    value={addPaymentMethod}
                    onChange={(e) => setAddPaymentMethod(e.target.value as PaymentMethod)}
                    className="w-full bg-elevated border border-subtle rounded-xl px-4 py-3 font-bold focus:outline-none focus:ring-2 focus:ring-primary/40"
                  >
                    {PAYMENT_METHODS.map((method) => (
                      <option key={method} value={method}>
                        {t(`reception.payment.${method}`)}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-[10px] uppercase font-black tracking-widest text-faint">
                  {addPlanId ? t('reception.expiresOverride') : t('members.expiresOptional')}
                </label>
                <input
                  type="date"
                  value={addExpiresAt}
                  onChange={(e) => setAddExpiresAt(e.target.value)}
                  className="w-full bg-elevated border border-subtle rounded-xl px-4 py-3 font-bold focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
              {addError && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{addError}</div>
              )}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={closeAddModal}
                  className="flex-1 bg-elevated border border-subtle py-3 rounded-xl font-bold"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="button"
                  onClick={() => void submitAdd()}
                  disabled={addSubmitting || !canSubmitAdd}
                  className="flex-1 bg-primary text-white font-bold py-3 rounded-xl disabled:opacity-50"
                >
                  {addSubmitting ? t('members.adding') : t('members.addMember')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
        {showProfile && selected && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 safe-bottom"
            onClick={closeProfile}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              transition={weightedTransition}
              onClick={(e) => e.stopPropagation()}
              className="glass-panel w-full max-w-lg max-h-[90vh] overflow-y-auto custom-scrollbar rounded-t-3xl sm:rounded-3xl p-6 sm:p-8 space-y-6"
            >
              <div className="flex items-start justify-between gap-4">
                <h3 className="text-2xl font-black">{t('reception.memberProfile')}</h3>
                <div className="flex items-center gap-2 shrink-0">
                  {selected.userId && (
                    <Link
                      to={communityProfilePath(selected.userId)}
                      onClick={closeProfile}
                      className="size-10 rounded-xl bg-elevated border border-subtle flex items-center justify-center text-muted hover:text-primary hover:bg-primary/10 transition-colors"
                      title={t('reception.viewCommunityProfile')}
                      aria-label={t('reception.viewCommunityProfile')}
                    >
                      <span className="material-symbols-outlined text-xl">groups</span>
                    </Link>
                  )}
                  <button
                    type="button"
                    onClick={closeProfile}
                    className="size-10 rounded-xl bg-elevated border border-subtle flex items-center justify-center text-muted hover:text-foreground"
                    aria-label={t('common.cancel')}
                  >
                    <span className="material-symbols-outlined text-xl">close</span>
                  </button>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <img
                  src={selected.user.profile?.avatarUrl || FALLBACK_AVATAR(selected.userId)}
                  alt=""
                  className="size-16 rounded-2xl object-cover shrink-0"
                />
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="text-xl font-black truncate">{memberName(selected.user)}</p>
                  <p className="text-sm text-muted truncate">{selected.user.email}</p>
                  {selected.user.phone && <p className="text-sm text-muted">{selected.user.phone}</p>}
                  {selected.address && <p className="text-sm text-muted">{selected.address}</p>}
                  {selected.gender !== 'unknown' && (
                    <p className="text-sm text-muted">
                      {selected.gender === 'male' ? t('reception.genderMale') : t('reception.genderFemale')}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-elevated rounded-xl p-3 border border-subtle col-span-2 sm:col-span-4">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[10px] font-bold text-faint uppercase">{t('reception.currentPlan')}</p>
                    <button
                      type="button"
                      onClick={openEditPlan}
                      className="size-8 rounded-lg bg-primary/10 border border-primary/30 text-primary hover:bg-primary/20 transition-colors flex items-center justify-center shrink-0"
                      title={t('reception.editPlan')}
                      aria-label={t('reception.editPlan')}
                    >
                      <span className="material-symbols-outlined text-base">edit</span>
                    </button>
                  </div>
                  <p className="text-sm font-bold mt-1">
                    {selected.plan
                      ? planDisplayName(selected.plan, language)
                      : t('reception.noPlanAssigned')}
                  </p>
                  {selected.plan && (
                    <p className="text-xs text-muted mt-0.5">
                      {formatMoney(selected.plan.price, language)}
                      {selected.paymentMethod
                        ? ` · ${t(`reception.payment.${selected.paymentMethod}`)}`
                        : ''}
                    </p>
                  )}
                  {selected.plan?.benefits && (
                    <PlanBenefitsList benefits={selected.plan.benefits} className="mt-2" />
                  )}
                </div>
                <div className="bg-elevated rounded-xl p-3 border border-subtle">
                  <p className="text-[10px] font-bold text-faint uppercase">{t('reception.joinedOn')}</p>
                  <p className="text-sm font-bold mt-1">{formatDate(selected.joinedAt, language)}</p>
                </div>
                <div className="bg-elevated rounded-xl p-3 border border-subtle">
                  <p className="text-[10px] font-bold text-faint uppercase">{t('members.expires')}</p>
                  <p className="text-sm font-bold mt-1">
                    {selected.expiresAt ? formatDate(selected.expiresAt, language) : '—'}
                  </p>
                </div>
                {profileStats && (
                  <>
                    <div className="bg-elevated rounded-xl p-3 border border-subtle">
                      <p className="text-[10px] font-bold text-faint uppercase">{t('reception.totalVisits')}</p>
                      <p className="text-sm font-bold mt-1">{profileStats.totalVisits}</p>
                    </div>
                    <div className="bg-elevated rounded-xl p-3 border border-subtle">
                      <p className="text-[10px] font-bold text-faint uppercase">{t('reception.totalTimeInGym')}</p>
                      <p className="text-sm font-bold mt-1">
                        {formatVisitDuration(profileStats.totalMinutes, t)}
                      </p>
                    </div>
                  </>
                )}
              </div>

              <div>
                <h4 className="text-[10px] font-black uppercase tracking-widest text-faint mb-3">
                  {t('reception.visitHistory')}
                </h4>
                {!profileLoading && !profileError && profileVisits.length > 0 && (
                  <div className="space-y-2 mb-4">
                    <div className="relative">
                      <span className="material-symbols-outlined absolute start-3 top-1/2 -translate-y-1/2 text-faint text-base pointer-events-none">
                        calendar_today
                      </span>
                      <input
                        type="date"
                        value={visitDateFilter}
                        onChange={(e) => setVisitDateFilter(e.target.value)}
                        aria-label={t('reception.visitDateLabel')}
                        className="w-full bg-elevated border border-subtle rounded-xl ps-10 pe-10 py-2.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary/40"
                      />
                      {visitDateFilter && (
                        <button
                          type="button"
                          onClick={() => setVisitDateFilter('')}
                          className="absolute end-2 top-1/2 -translate-y-1/2 size-8 flex items-center justify-center rounded-lg text-muted hover:text-foreground hover:bg-elevated-hover"
                          aria-label={t('reception.clearVisitDate')}
                        >
                          <span className="material-symbols-outlined text-base">close</span>
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <label
                        htmlFor="visit-history-sort"
                        className="text-[10px] font-bold text-faint uppercase shrink-0"
                      >
                        {t('reception.sort')}
                      </label>
                      <select
                        id="visit-history-sort"
                        value={visitHistorySort}
                        onChange={(e) => setVisitHistorySort(e.target.value as VisitHistorySort)}
                        className="flex-1 min-w-0 bg-elevated border border-subtle rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-primary/40"
                      >
                        <option value="visitNewest">{t('reception.sortVisitNewest')}</option>
                        <option value="visitOldest">{t('reception.sortVisitOldest')}</option>
                        <option value="durationLongest">{t('reception.sortDurationLongest')}</option>
                        <option value="durationShortest">{t('reception.sortDurationShortest')}</option>
                      </select>
                    </div>
                  </div>
                )}
                {profileLoading && (
                  <p className="text-sm text-muted animate-pulse">{t('common.loading')}</p>
                )}
                {profileError && (
                  <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                    {profileError}
                  </div>
                )}
                {!profileLoading && !profileError && profileVisits.length === 0 && (
                  <p className="text-sm text-muted text-center py-6">{t('reception.noVisits')}</p>
                )}
                {!profileLoading && !profileError && profileVisits.length > 0 && filteredProfileVisits.length === 0 && (
                  <p className="text-sm text-muted text-center py-6">{t('reception.visitsNoMatch')}</p>
                )}
                {!profileLoading && filteredProfileVisits.length > 0 && (
                  <ul className="space-y-3">
                    {filteredProfileVisits.map((visit) => (
                      <li
                        key={visit.visitId}
                        className="bg-elevated rounded-xl p-4 border border-subtle space-y-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-bold text-muted">
                            {formatDate(visit.checkedInAt, language)}
                          </p>
                          {visit.isOpen && (
                            <span className="text-[10px] font-bold uppercase text-green-400 bg-green-500/10 px-2 py-0.5 rounded-full shrink-0">
                              {t('reception.stillInGym')}
                            </span>
                          )}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
                          <div>
                            <p className="text-[10px] font-bold text-faint uppercase">{t('reception.checkedIn')}</p>
                            <p className="font-bold">{formatDateTime(visit.checkedInAt, language)}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-faint uppercase">{t('reception.checkedOut')}</p>
                            <p className="font-bold">
                              {visit.checkedOutAt
                                ? formatDateTime(visit.checkedOutAt, language)
                                : '—'}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-faint uppercase">{t('reception.duration')}</p>
                            <p className="font-bold text-primary">
                              {formatVisitDuration(visit.durationMinutes, t)}
                            </p>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
        {showEditPlan && selected && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-background/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 safe-bottom"
            onClick={closeEditPlan}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              transition={weightedTransition}
              onClick={(e) => e.stopPropagation()}
              className="glass-panel w-full max-w-md rounded-t-3xl sm:rounded-3xl p-6 sm:p-8 space-y-5"
            >
              <h3 className="text-xl font-black">{t('reception.editPlanTitle')}</h3>
              <p className="text-sm text-muted">{memberName(selected.user)}</p>

              {gymPlans.length === 0 ? (
                <p className="text-sm text-muted">{t('reception.noPlansAvailable')}</p>
              ) : (
                <>
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase font-black tracking-widest text-faint">
                      {t('reception.subscriptionPlan')}
                    </label>
                    <select
                      value={editPlanId}
                      onChange={(e) => setEditPlanId(e.target.value)}
                      className="w-full bg-elevated border border-subtle rounded-xl px-4 py-3 font-bold focus:outline-none focus:ring-2 focus:ring-primary/40"
                    >
                      <option value="">{t('reception.selectPlan')}</option>
                      {gymPlans.map((plan) => (
                        <option key={plan.id} value={plan.id}>
                          {formatPlanOption(plan, language)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase font-black tracking-widest text-faint">
                      {t('reception.paymentMethod')}
                    </label>
                    <select
                      value={editPaymentMethod}
                      onChange={(e) => setEditPaymentMethod(e.target.value as PaymentMethod)}
                      className="w-full bg-elevated border border-subtle rounded-xl px-4 py-3 font-bold focus:outline-none focus:ring-2 focus:ring-primary/40"
                    >
                      {PAYMENT_METHODS.map((method) => (
                        <option key={method} value={method}>
                          {t(`reception.payment.${method}`)}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              {editPlanError && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                  {editPlanError}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={closeEditPlan}
                  disabled={editPlanSaving}
                  className="flex-1 bg-elevated border border-subtle py-3 rounded-xl font-bold"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="button"
                  onClick={() => void submitEditPlan()}
                  disabled={editPlanSaving || gymPlans.length === 0}
                  className="flex-1 bg-primary text-white font-bold py-3 rounded-xl disabled:opacity-50"
                >
                  {editPlanSaving ? t('gymDash.savingPlan') : t('reception.editPlan')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
