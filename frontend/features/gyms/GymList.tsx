import React, { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useI18n } from '../../lib/i18n/useI18n';
import { motion, AnimatePresence } from 'framer-motion';
import { staggerContainer, buttonPress, weightedTransition } from '../../lib/motion';
import { TiltCard, Magnetic } from '../../components/shared/MotionWrappers';
import gymService from '../../services/gymService';
import { useNotificationStore } from '../../store/useNotificationStore';
import { GymDetailDrawer } from '../../components/gyms/GymDetailDrawer';
import type { Gym, GymMembership } from '../../types';
import { listGymAmenityLabels } from '../../lib/gymAmenities';
import { findNearestGym, formatDistanceKm } from '../../lib/gymGeo';

const GymMapView = lazy(() =>
  import('../../components/gyms/GymMapView').then((m) => ({ default: m.GymMapView })),
);

const FALLBACK_IMG =
  'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?q=80&w=600';

type ViewMode = 'map' | 'list';

export const GymList: React.FC = () => {
  const [gyms, setGyms] = useState<Gym[]>([]);
  const [memberships, setMemberships] = useState<GymMembership[]>([]);
  const { t, language } = useI18n();
  const [viewMode, setViewMode] = useState<ViewMode>('map');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedGym, setSelectedGym] = useState<Gym | null>(null);
  const [checkInSuccess, setCheckInSuccess] = useState<string | null>(null);
  const [checkInError, setCheckInError] = useState<string | null>(null);
  const [userPos, setUserPos] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState<string | null>(null);
  const [locateKey, setLocateKey] = useState(0);
  const { addLocal } = useNotificationStore();

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    Promise.all([gymService.getGyms(), gymService.getMyMemberships()]).then(([g, m]) => {
      if (!mounted) return;
      if (g.error) setError(g.error);
      else setGyms(g.data ?? []);
      setMemberships(m.data ?? []);
      setLoading(false);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const isMember = (gymId: string) => memberships.some((m) => m.gymId === gymId && m.isActive);

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
    () => (userPos ? findNearestGym(gyms, userPos) : null),
    [gyms, userPos],
  );

  const handleLocateNearMe = useCallback(() => {
    setLocateError(null);
    if (!navigator.geolocation) {
      setLocateError(t('gyms.locationUnsupported'));
      return;
    }
    setLocating(true);
    if (viewMode !== 'map') setViewMode('map');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserPos({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocateKey((k) => k + 1);
        setLocating(false);
      },
      () => {
        setLocating(false);
        setLocateError(t('gyms.locationDenied'));
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 },
    );
  }, [t, viewMode]);

  return (
    <div className="page-shell pb-2 relative">
      <div className="flex flex-col lg:flex-row lg:justify-between lg:items-end gap-6 relative">
        <motion.div initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={weightedTransition} className="relative z-10" data-tour="gyms-hero">
          <div className="flex items-center gap-3 text-primary mb-2">
            <span className="material-symbols-outlined font-black">apartment</span>
            <span className="text-[10px] font-black uppercase tracking-[0.3em]">{t('gyms.heroBadge')}</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-foreground drop-shadow-2xl">{t('gyms.heroTitle')}</h1>
          <p className="text-muted mt-4 max-w-lg font-medium">{t('gyms.subtitleDetail')}</p>
        </motion.div>
        <div className="flex flex-col items-end gap-2 self-start lg:self-auto" data-tour="gyms-controls">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleLocateNearMe}
              disabled={locating || loading || gyms.length === 0}
              className="inline-flex items-center gap-1.5 rounded-2xl border border-primary/40 bg-primary/10 px-4 py-2 text-xs font-black uppercase tracking-wider text-primary transition-colors hover:bg-primary/20 disabled:opacity-40"
            >
              <span
                className={`material-symbols-outlined text-sm ${locating ? 'animate-spin' : ''}`}
              >
                {locating ? 'progress_activity' : 'my_location'}
              </span>
              {locating ? t('gyms.locating') : t('gyms.locateNearMe')}
            </button>
            <div className="inline-flex rounded-2xl border border-subtle bg-elevated p-1">
              {(['map', 'list'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  data-tour={mode === 'map' ? 'gyms-view-map' : undefined}
                  onClick={() => setViewMode(mode)}
                  className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-black uppercase tracking-wider transition-colors ${
                    viewMode === mode ? 'bg-primary text-white' : 'text-muted hover:text-foreground'
                  }`}
                >
                  <span className="material-symbols-outlined text-sm">{mode === 'map' ? 'map' : 'view_list'}</span>
                  {mode === 'map' ? t('gyms.viewMap') : t('gyms.viewList')}
                </button>
              ))}
            </div>
          </div>
          {nearest && userPos && (
            <p className="text-xs font-bold text-primary text-end max-w-xs">
              {t('gyms.nearestGym', {
                name: nearest.gym.name,
                distance: formatDistanceKm(nearest.distanceKm, language),
              })}
            </p>
          )}
          {locateError && (
            <p className="text-xs text-red-400 text-end max-w-xs">{locateError}</p>
          )}
        </div>
      </div>

      {checkInError && (
        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{checkInError}</div>
      )}
      {loading && <div className="text-primary animate-pulse mt-6">{t('gyms.loading')}</div>}
      {error && <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm mt-6">{error}</div>}
      {!loading && gyms.length === 0 && (
        <div className="glass-panel p-10 rounded-3xl text-center text-muted mt-6">{t('gyms.empty')}</div>
      )}

      <div className="mt-8 min-h-[280px]" data-tour="gyms-browse">
      {!loading && gyms.length > 0 && viewMode === 'map' && (
        <div>
          <Suspense fallback={<div className="text-primary animate-pulse min-h-[420px]">{t('gyms.loading')}</div>}>
            <GymMapView
              gyms={gyms}
              onSelectGym={setSelectedGym}
              userPos={userPos}
              locateKey={locateKey}
              nearestGymId={nearest?.gym.id ?? null}
            />
          </Suspense>
        </div>
      )}

      {!loading && gyms.length > 0 && viewMode === 'list' && (
      <motion.div variants={staggerContainer(0.08)} initial="hidden" animate="visible" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10 mt-8">
        {gyms.map((gym) => {
          const amenities = listGymAmenityLabels(gym.amenities, t);
          const presentNow = gym.currentOccupancy ?? 0;
          const maxCapacity = gym.maxCapacity || 100;
          const utilization = maxCapacity ? (presentNow / maxCapacity) * 100 : 0;
          const status = utilization > 75 ? 'Busy' : utilization > 30 ? 'Active' : 'Quiet';
          const statusLabel =
            status === 'Busy' ? t('gyms.statusBusy') : status === 'Active' ? t('gyms.statusActive') : t('gyms.statusQuiet');
          return (
            <TiltCard key={gym.id} maxTilt={4}>
              <div className="glass-panel rounded-[3rem] overflow-hidden group hover:border-primary/50 transition-all border border-subtle">
                <div className="h-56 relative overflow-hidden bg-black/40">
                  <img src={gym.imageUrl || FALLBACK_IMG} className="size-full object-cover opacity-60 group-hover:opacity-100 transition-all duration-700" alt={gym.name} />
                  <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
                  <div className="absolute top-6 left-6">
                    <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest backdrop-blur-xl border border-subtle ${
                      status === 'Active' ? 'bg-teal-500/20 text-teal-400' : status === 'Busy' ? 'bg-accent/20 text-accent' : 'bg-blue-500/20 text-blue-400'
                    }`}>{statusLabel}</span>
                  </div>
                </div>
                <div className="p-10 space-y-6">
                  <div>
                    <h3 className="text-3xl font-black mb-2 group-hover:text-primary transition-colors">{gym.name}</h3>
                    <p className="text-faint font-bold flex items-center gap-2 text-sm">
                      <span className="material-symbols-outlined text-sm">location_on</span>
                      {gym.location}
                    </p>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-faint">
                      <span>{t('gyms.gymCapacity')}</span>
                      <span>{t('gyms.gymCapacityNow', { present: String(presentNow), max: String(maxCapacity) })}</span>
                    </div>
                    <div className="h-2 w-full bg-elevated rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(100, utilization)}%` }}
                        transition={{ duration: 1.2, ease: 'circOut' }}
                        className={`h-full rounded-full ${status === 'Busy' ? 'bg-accent' : 'bg-teal-400'}`}
                      />
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <Magnetic strength={0.3} className="flex-1">
                      <motion.button
                        variants={buttonPress}
                        whileHover="hover"
                        whileTap="tap"
                        onClick={() => setSelectedGym(gym)}
                        title={t('gyms.viewProfile')}
                        className="w-full bg-white text-background font-black py-4 rounded-2xl shadow-2xl hover:bg-primary hover:text-foreground transition-all"
                      >
                        {t('gyms.viewProfile')}
                      </motion.button>
                    </Magnetic>
                  </div>
                  {amenities.length > 0 && (
                    <div className="pt-4 border-t border-subtle flex flex-wrap gap-2">
                      {amenities.slice(0, 4).map((a) => (
                        <span key={a} className="text-[9px] font-black uppercase tracking-widest bg-elevated border border-subtle px-3 py-1 rounded-full text-muted">{a}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </TiltCard>
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
