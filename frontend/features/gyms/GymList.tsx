import React, { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useI18n } from '../../lib/i18n/useI18n';
import { motion, AnimatePresence } from 'framer-motion';
import { staggerContainer, weightedTransition } from '../../lib/motion';
import gymService from '../../services/gymService';
import { useNotificationStore } from '../../store/useNotificationStore';
import { GymDetailDrawer } from '../../components/gyms/GymDetailDrawer';
import type { Gym, GymMembership } from '../../types';
import { listGymAmenityLabels } from '../../lib/gymAmenities';
import { findNearestGym, formatDistanceKm } from '../../lib/gymGeo';
import { isAuthSessionError, withTransientRetry } from '../../lib/apiTransientError';
import { useAuthStore } from '../../store/useAuthStore';
import { GymFilterMenu } from './GymFilterMenu';
import {
  applyGymFilters,
  countActiveGymFilters,
  DEFAULT_GYM_FILTERS,
  getGymOccupancyStatus,
  sanitizeGymFilters,
  type GymFilterState,
} from './gymFilters';

const GymMapView = lazy(() =>
  import('../../components/gyms/GymMapView').then((m) => ({ default: m.GymMapView })),
);

const FALLBACK_IMG =
  'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?q=80&w=600';

type ViewMode = 'map' | 'list';

export const GymList: React.FC = () => {
  const [gyms, setGyms] = useState<Gym[]>([]);
  const [memberships, setMemberships] = useState<GymMembership[]>([]);
  const { t, language, isRtl } = useI18n();
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedGym, setSelectedGym] = useState<Gym | null>(null);
  const [checkInSuccess, setCheckInSuccess] = useState<string | null>(null);
  const [checkInError, setCheckInError] = useState<string | null>(null);
  const [userPos, setUserPos] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState<string | null>(null);
  const [locateKey, setLocateKey] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<GymFilterState>(DEFAULT_GYM_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const { addLocal } = useNotificationStore();
  const logout = useAuthStore((s) => s.logout);

  const loadGyms = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [g, m] = await Promise.all([
      withTransientRetry(() => gymService.getGyms(), { attempts: 3, baseDelayMs: 1200 }),
      withTransientRetry(() => gymService.getMyMemberships(), { attempts: 3, baseDelayMs: 1200 }),
    ]);
    if (g.error) setError(g.error);
    else setGyms(g.data ?? []);
    setMemberships(m.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadGyms();
  }, [loadGyms]);

  useEffect(() => {
    if (gyms.length === 0) return;
    setFilters((prev) => sanitizeGymFilters(prev, gyms));
  }, [gyms]);

  const isMember = useCallback(
    (gymId: string) => memberships.some((m) => m.gymId === gymId && m.isActive),
    [memberships],
  );

  const activeFilterCount = useMemo(() => countActiveGymFilters(filters), [filters]);
  const hasActiveBrowse = searchQuery.trim().length > 0 || activeFilterCount > 0;

  const filteredGyms = useMemo(
    () =>
      applyGymFilters(gyms, {
        query: searchQuery,
        filters,
        isMember,
        userPos,
        language,
      }),
    [gyms, searchQuery, filters, isMember, userPos, language],
  );

  const clearBrowse = () => {
    setSearchQuery('');
    setFilters(DEFAULT_GYM_FILTERS);
    setFiltersOpen(false);
  };

  const handleCheckIn = async (gym: Gym) => {
    setCheckInError(null);
    const res = await gymService.checkIn(gym.id);
    if (res.error) {
      setCheckInError(res.error);
      setTimeout(() => setCheckInError(null), 3000);
      return;
    }
    setCheckInSuccess(gym.name);
    addLocal({
      type: 'gym.checkin.self',
      title: t('gyms.checkedInTitle'),
      message: t('gyms.welcome', { name: gym.name }),
      link: '/gyms',
    });
    setTimeout(() => setCheckInSuccess(null), 2500);
  };

  const nearest = useMemo(
    () => (userPos ? findNearestGym(filteredGyms.length > 0 ? filteredGyms : gyms, userPos) : null),
    [filteredGyms, gyms, userPos],
  );

  const handleLocateNearMe = useCallback(() => {
    setLocateError(null);
    if (!navigator.geolocation) {
      setLocateError(t('gyms.locationUnsupported'));
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserPos({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocateKey((k) => k + 1);
        setFilters((prev) => (prev.sort === 'default' ? { ...prev, sort: 'nearest' } : prev));
        setLocating(false);
      },
      () => {
        setLocating(false);
        setLocateError(t('gyms.locationDenied'));
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 },
    );
  }, [t]);

  const showMap = viewMode === 'map';
  const toggleMap = () => setViewMode((m) => (m === 'map' ? 'list' : 'map'));

  return (
    <div className="page-shell pb-2 relative">
      <motion.div
        initial={{ opacity: 0, x: -30 }}
        animate={{ opacity: 1, x: 0 }}
        transition={weightedTransition}
        className="relative z-10"
        data-tour="gyms-hero"
      >
        <div className="flex items-center gap-3 text-primary mb-2">
          <span className="material-symbols-outlined font-black">apartment</span>
          <span className="text-[10px] font-black uppercase tracking-[0.3em]">{t('gyms.heroBadge')}</span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-foreground drop-shadow-2xl">
          {t('gyms.heroTitle')}
        </h1>
        <p className="text-muted mt-4 max-w-lg font-medium">{t('gyms.subtitleDetail')}</p>
      </motion.div>

      {!loading && !error && gyms.length > 0 && (
        <div className="mt-6 space-y-3" data-testid="gym-search-bar" data-tour="gyms-controls">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1 min-w-0">
              <span className="material-symbols-outlined absolute start-4 top-1/2 -translate-y-1/2 text-faint pointer-events-none">
                search
              </span>
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('gyms.searchPlaceholder')}
                className="w-full rounded-2xl border border-subtle bg-elevated ps-12 pe-10 py-3.5 text-sm font-semibold text-foreground placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-primary/40"
                dir={isRtl ? 'rtl' : 'ltr'}
                autoComplete="off"
                enterKeyHint="search"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute end-3 top-1/2 -translate-y-1/2 rounded-lg p-1 text-faint hover:text-foreground"
                  aria-label={t('gyms.clearSearch')}
                >
                  <span className="material-symbols-outlined text-lg">close</span>
                </button>
              )}
            </div>

            <div className="flex shrink-0 items-stretch gap-2 self-end sm:self-auto">
              <GymFilterMenu
                open={filtersOpen}
                onOpenChange={setFiltersOpen}
                filters={filters}
                onChange={setFilters}
                activeCount={activeFilterCount}
                hasLocation={Boolean(userPos)}
                gyms={gyms}
                resultCount={filteredGyms.length}
                hasMembershipOption={memberships.some((m) => m.isActive)}
              />
              <button
                type="button"
                data-tour="gyms-view-map"
                onClick={toggleMap}
                aria-pressed={showMap}
                title={showMap ? t('gyms.viewList') : t('gyms.viewMap')}
                className={`inline-flex items-center justify-center gap-1.5 rounded-2xl border px-4 py-3 text-xs font-black uppercase tracking-wider transition-all min-w-[3.25rem] ${
                  showMap
                    ? 'border-primary bg-primary text-primary-foreground shadow-lg shadow-primary/20'
                    : 'border-subtle bg-elevated text-muted hover:border-primary/40 hover:text-foreground'
                }`}
              >
                <span className="material-symbols-outlined text-xl">{showMap ? 'view_list' : 'map'}</span>
                <span className="hidden sm:inline">{showMap ? t('gyms.viewList') : t('gyms.viewMap')}</span>
              </button>
              {showMap && (
                <button
                  type="button"
                  onClick={handleLocateNearMe}
                  disabled={locating}
                  className="inline-flex items-center justify-center gap-1.5 rounded-2xl border border-primary/40 bg-primary/10 px-4 py-3 text-xs font-black uppercase tracking-wider text-primary transition-colors hover:bg-primary/20 disabled:opacity-40"
                >
                  <span className={`material-symbols-outlined text-xl ${locating ? 'animate-spin' : ''}`}>
                    {locating ? 'progress_activity' : 'my_location'}
                  </span>
                  <span className="hidden sm:inline">{locating ? t('gyms.locating') : t('gyms.locateNearMe')}</span>
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="space-y-1">
              <p className="text-xs font-bold text-muted">
                {hasActiveBrowse
                  ? t('gyms.resultsCountFiltered', {
                      shown: String(filteredGyms.length),
                      total: String(gyms.length),
                    })
                  : t('gyms.resultsCount', { count: String(gyms.length) })}
              </p>
              {nearest && userPos && showMap && (
                <p className="text-xs font-bold text-primary">
                  {t('gyms.nearestGym', {
                    name: nearest.gym.name,
                    distance: formatDistanceKm(nearest.distanceKm, language),
                  })}
                </p>
              )}
              {locateError && showMap && <p className="text-xs text-red-400">{locateError}</p>}
            </div>
            {hasActiveBrowse && (
              <button
                type="button"
                onClick={clearBrowse}
                className="text-[10px] font-black uppercase tracking-wider text-primary hover:underline"
              >
                {t('gyms.clearFilters')}
              </button>
            )}
          </div>
        </div>
      )}

      {checkInError && (
        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{checkInError}</div>
      )}
      {loading && <div className="text-primary animate-pulse mt-6">{t('gyms.loading')}</div>}
      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm mt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <span>{isAuthSessionError(error) ? t('auth.sessionExpired') : error}</span>
          <button
            type="button"
            onClick={() => (isAuthSessionError(error) ? logout() : void loadGyms())}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-xs font-black uppercase tracking-wider text-red-300 hover:bg-red-500/20 transition-colors"
          >
            <span className="material-symbols-outlined text-sm">
              {isAuthSessionError(error) ? 'login' : 'refresh'}
            </span>
            {isAuthSessionError(error) ? t('auth.signIn') : t('common.retry')}
          </button>
        </div>
      )}
      {!loading && !error && gyms.length === 0 && (
        <div className="glass-panel p-10 rounded-3xl text-center text-muted mt-6">{t('gyms.empty')}</div>
      )}

      <div className="mt-4 min-h-[280px]" data-tour="gyms-browse">
      {!loading && gyms.length > 0 && filteredGyms.length === 0 && (
        <div className="glass-panel p-10 rounded-3xl text-center text-muted mt-2 space-y-4">
          <span className="material-symbols-outlined text-4xl text-faint">search_off</span>
          <p>{t('gyms.noFilterResults')}</p>
          <button
            type="button"
            onClick={clearBrowse}
            className="inline-flex items-center gap-1.5 rounded-xl border border-primary/30 bg-primary/10 px-4 py-2 text-xs font-black uppercase tracking-wider text-primary"
          >
            {t('gyms.clearFilters')}
          </button>
        </div>
      )}
      {!loading && filteredGyms.length > 0 && showMap && (
        <div>
          <Suspense fallback={<div className="text-primary animate-pulse min-h-[420px]">{t('gyms.loading')}</div>}>
            <GymMapView
              gyms={filteredGyms}
              onSelectGym={setSelectedGym}
              userPos={userPos}
              locateKey={locateKey}
              nearestGymId={nearest?.gym.id ?? null}
            />
          </Suspense>
        </div>
      )}

      {!loading && filteredGyms.length > 0 && !showMap && (
      <motion.div
        variants={staggerContainer(0.06)}
        initial="hidden"
        animate="visible"
        className="flex flex-col gap-3 mt-2"
      >
        {filteredGyms.map((gym) => {
          const amenities = listGymAmenityLabels(gym.amenities, t);
          const presentNow = gym.currentOccupancy ?? 0;
          const maxCapacity = gym.maxCapacity || 100;
          const utilization = maxCapacity ? (presentNow / maxCapacity) * 100 : 0;
          const status = getGymOccupancyStatus(gym);
          const statusLabel =
            status === 'busy' ? t('gyms.statusBusy') : status === 'active' ? t('gyms.statusActive') : t('gyms.statusQuiet');
          return (
            <motion.article
              key={gym.id}
              variants={{
                hidden: { opacity: 0, y: 12 },
                visible: { opacity: 1, y: 0 },
              }}
              className="glass-panel group flex flex-col overflow-hidden rounded-2xl border border-subtle transition-colors hover:border-primary/40 sm:flex-row sm:items-stretch"
            >
              <div className="relative h-40 w-full shrink-0 bg-black/30 sm:h-auto sm:w-40 md:w-48">
                <img
                  src={gym.imageUrl || FALLBACK_IMG}
                  className="size-full object-cover opacity-80 transition-opacity duration-500 group-hover:opacity-100"
                  alt={gym.name}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent sm:bg-gradient-to-r" />
                <div className="absolute start-3 top-3 flex flex-wrap gap-1.5">
                  <span
                    className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest backdrop-blur-xl border border-subtle ${
                      status === 'active'
                        ? 'bg-teal-500/20 text-teal-400'
                        : status === 'busy'
                          ? 'bg-accent/20 text-accent'
                          : 'bg-blue-500/20 text-blue-400'
                    }`}
                  >
                    {statusLabel}
                  </span>
                  {isMember(gym.id) && (
                    <span className="px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest backdrop-blur-xl border border-primary/30 bg-primary/15 text-primary">
                      {t('gyms.filterMembershipMine')}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex min-w-0 flex-1 flex-col gap-4 p-4 sm:flex-row sm:items-center sm:p-5">
                <div className="min-w-0 flex-1 space-y-3">
                  <div>
                    <h3 className="truncate text-lg font-black text-foreground transition-colors group-hover:text-primary sm:text-xl">
                      {gym.name}
                    </h3>
                    <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-muted">
                      <span className="material-symbols-outlined text-base shrink-0">location_on</span>
                      <span className="truncate">{gym.location}</span>
                    </p>
                  </div>

                  <div className="space-y-1.5 max-w-md">
                    <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-faint">
                      <span>{t('gyms.gymCapacity')}</span>
                      <span>{t('gyms.gymCapacityNow', { present: String(presentNow), max: String(maxCapacity) })}</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-elevated">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(100, utilization)}%` }}
                        transition={{ duration: 1, ease: 'circOut' }}
                        className={`h-full rounded-full ${status === 'busy' ? 'bg-accent' : 'bg-teal-400'}`}
                      />
                    </div>
                  </div>

                  {amenities.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {amenities.slice(0, 5).map((a) => (
                        <span
                          key={a}
                          className="rounded-full border border-subtle bg-elevated px-2.5 py-0.5 text-[9px] font-black uppercase tracking-widest text-muted"
                        >
                          {a}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedGym(gym)}
                  className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl border border-subtle bg-elevated px-4 py-3 text-xs font-black uppercase tracking-wider text-foreground transition-colors hover:border-primary hover:bg-primary hover:text-primary-foreground sm:min-w-[9rem]"
                >
                  {t('gyms.viewProfile')}
                  <span className="material-symbols-outlined text-base rtl:rotate-180">arrow_forward</span>
                </button>
              </div>
            </motion.article>
          );
        })}
      </motion.div>
      )}
      </div>

      <AnimatePresence>
        {checkInSuccess && (
          <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} className="fixed inset-0 z-[200] flex items-center justify-center pointer-events-none">
            <div className="bg-primary/90 backdrop-blur-3xl p-12 rounded-[4rem] text-center shadow-[0_50px_100px_rgba(21,139,141,0.5)] border border-primary/40">
              <motion.div initial={{ rotate: -90 }} animate={{ rotate: 0 }} className="size-24 bg-white rounded-full flex items-center justify-center text-primary mx-auto mb-8">
                <span className="material-symbols-outlined text-6xl font-black">verified</span>
              </motion.div>
              <h2 className="text-4xl font-black text-foreground mb-2 tracking-tighter">{t('gyms.checkInSuccessTitle')}</h2>
              <p className="text-foreground/80 font-bold uppercase tracking-widest text-sm">{t('gyms.welcome', { name: checkInSuccess })}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <GymDetailDrawer gym={selectedGym} onClose={() => setSelectedGym(null)} />
    </div>
  );
};
