import React, { useEffect, useState } from 'react';
import { useI18n } from '../../lib/i18n/useI18n';
import { motion, AnimatePresence } from 'framer-motion';
import { staggerContainer, weightedTransition, buttonPress } from '../../lib/motion';
import { TiltCard, Magnetic } from '../../components/shared/MotionWrappers';
import { ClientsVisual } from '../../3d/PageSpecificVisuals';
import apiClient from '../../services/api';
import bookingService from '../../services/bookingService';
import type { TrainerBooking } from '../../types';

interface Client {
  id: string;
  email: string;
  profile?: {
    displayName?: string;
    avatarUrl?: string;
    fitnessGoal?: string;
    fitnessLevel?: string;
    weight?: number;
    height?: number;
  } | null;
  lastSessionAt: string;
  totalSessions: number;
}

const FALLBACK_AVATAR = (id: string) => `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(id)}`;

function timeAgo(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.floor(hr / 24);
  return `${d}d ago`;
}

export const ClientList: React.FC = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [bookings, setBookings] = useState<TrainerBooking[]>([]);
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Client | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    Promise.all([
      apiClient.get<Client[]>('/api/bookings/clients'),
      bookingService.getTrainerBookings(),
    ]).then(([clientsRes, bookingsRes]) => {
      if (!mounted) return;
      if (clientsRes.error) setError(clientsRes.error);
      else setClients(clientsRes.data ?? []);
      if (bookingsRes.data) setBookings(bookingsRes.data);
      setLoading(false);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const handleStatusChange = async (id: string, status: TrainerBooking['status']) => {
    const res = await bookingService.updateBookingStatus(id, status);
    if (res.data) {
      setBookings((bs) => bs.map((b) => (b.id === id ? res.data! : b)));
    }
  };

  const upcoming = bookings
    .filter((b) => new Date(b.scheduledAt) >= new Date() && (b.status === 'pending' || b.status === 'confirmed'))
    .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());

  return (
    <div className="page-shell pb-2 relative overflow-x-hidden lg:overflow-visible">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6 relative px-1">
        <motion.div initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={weightedTransition} className="relative z-10 max-w-2xl">
          <div className="flex items-center gap-3 text-primary mb-3">
            <span className="material-symbols-outlined font-black">person_search</span>
            <span className="text-[10px] font-black uppercase tracking-[0.3em]">Client Management</span>
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-foreground leading-tight">
            Client <span className="text-primary italic">Sync</span>
          </h1>
          <p className="text-muted mt-4 font-medium text-sm sm:text-base leading-relaxed">
            Active athletes you've booked with. Confirm sessions and review their stats.
          </p>
        </motion.div>
        <div className="hidden sm:block absolute -top-16 -right-16 lg:right-0 w-64 h-64 lg:w-80 lg:h-80 pointer-events-none opacity-40 z-0">
          <ClientsVisual />
        </div>
      </div>

      {loading && <div className="text-primary animate-pulse">{t('clients.loading')}</div>}
      {error && <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">{error}</div>}

      {upcoming.length > 0 && (
        <div className="glass-panel p-6 rounded-3xl space-y-4">
          <h3 className="text-xs font-black uppercase tracking-widest text-primary">Upcoming Sessions</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {upcoming.slice(0, 6).map((b) => (
              <div key={b.id} className="flex items-center justify-between bg-elevated rounded-xl p-3 border border-subtle">
                <div className="min-w-0">
                  <p className="font-bold truncate">{b.athlete?.profile?.displayName ?? b.athlete?.email ?? 'Athlete'}</p>
                  <p className="text-xs text-muted">{new Date(b.scheduledAt).toLocaleString()}</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  {b.status === 'pending' && (
                    <button onClick={() => handleStatusChange(b.id, 'confirmed')} className="px-3 py-1.5 text-xs font-bold bg-primary text-white rounded-lg">Confirm</button>
                  )}
                  {b.status === 'confirmed' && (
                    <button onClick={() => handleStatusChange(b.id, 'completed')} className="px-3 py-1.5 text-xs font-bold bg-emerald-600 text-white rounded-lg">Complete</button>
                  )}
                  <button onClick={() => handleStatusChange(b.id, 'cancelled')} className="px-3 py-1.5 text-xs font-bold bg-elevated border border-subtle rounded-lg">{t('common.cancel')}</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!loading && clients.length === 0 && (
        <div className="glass-panel p-10 rounded-3xl text-center text-muted">
          You don't have any clients yet. Once an athlete books and you confirm, they'll appear here.
        </div>
      )}

      <motion.div variants={staggerContainer(0.08)} initial="hidden" animate="visible" className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 lg:gap-8 relative z-10">
        {clients.map((client) => {
          const name = client.profile?.displayName ?? client.email.split('@')[0];
          return (
            <TiltCard key={client.id} maxTilt={5}>
              <div className="glass-panel p-6 sm:p-8 rounded-[2.5rem] sm:rounded-[3rem] border border-subtle group hover:border-primary/40 transition-all flex flex-col gap-6 sm:gap-8">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 sm:gap-5">
                    <div className="size-14 sm:size-16 rounded-[1.2rem] sm:rounded-[1.5rem] border-2 border-primary/20 p-1 bg-surface relative">
                      <img src={client.profile?.avatarUrl || FALLBACK_AVATAR(client.id)} className="size-full rounded-[1rem] sm:rounded-[1.2rem] object-cover" alt={name} />
                      <div className="absolute -top-1 -right-1 size-3 sm:size-4 rounded-full border-4 border-surface bg-teal-400" />
                    </div>
                    <div>
                      <h3 className="text-lg sm:text-xl font-black leading-none mb-1.5">{name}</h3>
                      <p className="text-[8px] sm:text-[9px] font-black uppercase text-faint tracking-widest">
                        {client.profile?.fitnessLevel ?? 'Athlete'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black text-primary">{client.totalSessions}</p>
                    <p className="text-[8px] font-black uppercase text-slate-600 tracking-widest">Sessions</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                  <div className="bg-elevated p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-subtle">
                    <p className="text-[8px] sm:text-[9px] font-black uppercase text-faint mb-1">Last Session</p>
                    <p className="text-[10px] sm:text-xs font-black text-foreground">{timeAgo(client.lastSessionAt)}</p>
                  </div>
                  <div className="bg-elevated p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-subtle">
                    <p className="text-[8px] sm:text-[9px] font-black uppercase text-faint mb-1">Goal</p>
                    <p className="text-[10px] sm:text-xs font-black text-foreground truncate">{client.profile?.fitnessGoal ?? '—'}</p>
                  </div>
                </div>

                <Magnetic strength={0.2}>
                  <motion.button
                    variants={buttonPress}
                    whileHover="hover"
                    whileTap="tap"
                    onClick={() => setSelected(client)}
                    className="w-full bg-elevated border border-subtle text-foreground font-black py-3 sm:py-4 rounded-xl sm:rounded-2xl text-[9px] sm:text-[10px] uppercase tracking-widest hover:bg-elevated-hover transition-all"
                  >
                    View Athlete
                  </motion.button>
                </Magnetic>
              </div>
            </TiltCard>
          );
        })}
      </motion.div>

      <AnimatePresence>
        {selected && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelected(null)} className="fixed inset-0 bg-background/80 backdrop-blur-xl z-[200]" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 30 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 30 }} className="fixed inset-4 sm:inset-10 z-[210] glass-panel rounded-[2rem] sm:rounded-[4rem] border-subtle shadow-[0_50px_150px_rgba(0,0,0,0.8)] flex flex-col overflow-hidden">
              <div className="p-6 sm:p-10 border-b border-subtle flex items-center justify-between">
                <div className="flex items-center gap-4 sm:gap-6">
                  <img src={selected.profile?.avatarUrl || FALLBACK_AVATAR(selected.id)} className="size-14 sm:size-20 rounded-xl sm:rounded-[2rem] border-2 border-primary/40 object-cover" />
                  <div>
                    <h2 className="text-xl sm:text-4xl font-black tracking-tight">{selected.profile?.displayName ?? selected.email}</h2>
                    <p className="text-faint font-bold uppercase tracking-widest text-[8px] sm:text-xs mt-1 sm:mt-2">
                      {selected.profile?.fitnessLevel ?? 'Athlete'} · {selected.totalSessions} sessions
                    </p>
                  </div>
                </div>
                <button onClick={() => setSelected(null)} className="size-10 sm:size-14 bg-elevated rounded-xl sm:rounded-2xl flex items-center justify-center text-muted hover:text-foreground">
                  <span className="material-symbols-outlined text-2xl sm:text-3xl">close</span>
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-6 sm:p-12 custom-scrollbar grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="glass-panel p-6 rounded-3xl bg-elevated border-subtle space-y-4">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-primary">Profile Details</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-muted">Email</span><span className="font-bold">{selected.email}</span></div>
                    <div className="flex justify-between"><span className="text-muted">Goal</span><span className="font-bold">{selected.profile?.fitnessGoal ?? '—'}</span></div>
                    <div className="flex justify-between"><span className="text-muted">Weight</span><span className="font-bold">{selected.profile?.weight ?? '—'} kg</span></div>
                    <div className="flex justify-between"><span className="text-muted">Height</span><span className="font-bold">{selected.profile?.height ?? '—'} cm</span></div>
                    <div className="flex justify-between"><span className="text-muted">Last session</span><span className="font-bold">{timeAgo(selected.lastSessionAt)}</span></div>
                  </div>
                </div>
                <div className="glass-panel p-6 rounded-3xl bg-primary/10 border-primary/20 space-y-3">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-primary">Booking History</h4>
                  {bookings.filter((b) => b.athleteId === selected.id).map((b) => (
                    <div key={b.id} className="flex justify-between text-sm">
                      <span>{new Date(b.scheduledAt).toLocaleString()}</span>
                      <span className="font-black uppercase text-xs tracking-widest">{b.status}</span>
                    </div>
                  ))}
                  {bookings.filter((b) => b.athleteId === selected.id).length === 0 && (
                    <p className="text-muted text-sm">{t('clients.noBookings')}</p>
                  )}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};
