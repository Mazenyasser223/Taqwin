import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { staggerContainer, buttonPress, weightedTransition } from '../../lib/motion';
import { TiltCard, Magnetic } from '../../components/shared/MotionWrappers';
import { GymsVisual } from '../../3d/PageSpecificVisuals';
import gymService from '../../services/gymService';
import { useNotificationStore } from '../../store/useNotificationStore';
import type { Gym, GymMembership } from '../../types';

const FALLBACK_IMG =
  'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?q=80&w=600';

export const GymList: React.FC = () => {
  const [gyms, setGyms] = useState<Gym[]>([]);
  const [memberships, setMemberships] = useState<GymMembership[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedGym, setSelectedGym] = useState<Gym | null>(null);
  const [checkInSuccess, setCheckInSuccess] = useState<string | null>(null);
  const [checkInError, setCheckInError] = useState<string | null>(null);
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
    addLocal({ type: 'gym.checkin.self', title: 'Checked In!', message: `Welcome to ${gym.name}.`, link: '/gyms' });
    setTimeout(() => setCheckInSuccess(null), 3000);
  };

  return (
    <div className="space-y-12 pb-24 relative">
      <div className="flex justify-between items-end relative">
        <motion.div initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={weightedTransition} className="relative z-10">
          <div className="flex items-center gap-3 text-primary mb-2">
            <span className="material-symbols-outlined font-black">apartment</span>
            <span className="text-[10px] font-black uppercase tracking-[0.3em]">Partner Gyms</span>
          </div>
          <h1 className="text-5xl font-black tracking-tight text-white drop-shadow-2xl">
            Where to <span className="text-primary italic">Train</span>
          </h1>
          <p className="text-slate-400 mt-4 max-w-lg font-medium">
            Find partner gyms and check in with one tap. Your active memberships are recognized automatically.
          </p>
        </motion.div>
        <div className="absolute -top-16 -right-16 w-80 h-80 pointer-events-none opacity-40">
          <GymsVisual />
        </div>
      </div>

      {checkInError && (
        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{checkInError}</div>
      )}
      {loading && <div className="text-primary animate-pulse">Loading gyms…</div>}
      {error && <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">{error}</div>}
      {!loading && gyms.length === 0 && (
        <div className="glass-panel p-10 rounded-3xl text-center text-slate-400">No partner gyms yet. Check back soon.</div>
      )}

      <motion.div variants={staggerContainer(0.08)} initial="hidden" animate="visible" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
        {gyms.map((gym) => {
          const amenities = (gym.amenities as unknown as string ?? '').toString().split(/[,\n]/).map((s) => s.trim()).filter(Boolean);
          const memberCount = (gym as any)._count?.memberships ?? 0;
          const utilization = gym.maxCapacity ? (memberCount / gym.maxCapacity) * 100 : 0;
          const status = utilization > 75 ? 'Busy' : utilization > 30 ? 'Active' : 'Quiet';
          const member = isMember(gym.id);
          return (
            <TiltCard key={gym.id} maxTilt={4}>
              <div className="glass-panel rounded-[3rem] overflow-hidden group hover:border-primary/50 transition-all border border-white/5">
                <div className="h-56 relative overflow-hidden bg-black/40">
                  <img src={gym.imageUrl || FALLBACK_IMG} className="size-full object-cover opacity-60 group-hover:opacity-100 transition-all duration-700" alt={gym.name} />
                  <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
                  <div className="absolute top-6 left-6">
                    <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest backdrop-blur-xl border border-white/10 ${
                      status === 'Active' ? 'bg-teal-500/20 text-teal-400' : status === 'Busy' ? 'bg-accent/20 text-accent' : 'bg-blue-500/20 text-blue-400'
                    }`}>{status}</span>
                  </div>
                </div>
                <div className="p-10 space-y-6">
                  <div>
                    <h3 className="text-3xl font-black mb-2 group-hover:text-primary transition-colors">{gym.name}</h3>
                    <p className="text-slate-500 font-bold flex items-center gap-2 text-sm">
                      <span className="material-symbols-outlined text-sm">location_on</span>
                      {gym.location}
                    </p>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-slate-500">
                      <span>Members</span>
                      <span>{memberCount} / {gym.maxCapacity}</span>
                    </div>
                    <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
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
                        onClick={() => handleCheckIn(gym)}
                        disabled={!member}
                        title={member ? 'Check in' : 'Become a member to check in'}
                        className="w-full bg-white text-background font-black py-4 rounded-2xl shadow-2xl hover:bg-primary hover:text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {member ? 'Check In' : 'Members Only'}
                      </motion.button>
                    </Magnetic>
                    <button onClick={() => setSelectedGym(gym)} className="size-12 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center text-slate-400 hover:text-white">
                      <span className="material-symbols-outlined">info</span>
                    </button>
                  </div>
                  {amenities.length > 0 && (
                    <div className="pt-4 border-t border-white/5 flex flex-wrap gap-2">
                      {amenities.slice(0, 4).map((a) => (
                        <span key={a} className="text-[9px] font-black uppercase tracking-widest bg-white/5 border border-white/10 px-3 py-1 rounded-full text-slate-300">{a}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </TiltCard>
          );
        })}
      </motion.div>

      <AnimatePresence>
        {checkInSuccess && (
          <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} className="fixed inset-0 z-[200] flex items-center justify-center pointer-events-none">
            <div className="bg-primary/90 backdrop-blur-3xl p-12 rounded-[4rem] text-center shadow-[0_50px_100px_rgba(21,139,141,0.5)] border border-primary/40">
              <motion.div initial={{ rotate: -90 }} animate={{ rotate: 0 }} className="size-24 bg-white rounded-full flex items-center justify-center text-primary mx-auto mb-8">
                <span className="material-symbols-outlined text-6xl font-black">verified</span>
              </motion.div>
              <h2 className="text-4xl font-black text-white mb-2 tracking-tighter">Check-In Done!</h2>
              <p className="text-white/80 font-bold uppercase tracking-widest text-sm">Welcome to {checkInSuccess}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedGym && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelectedGym(null)} className="fixed inset-0 bg-background/60 backdrop-blur-sm z-[130]" />
            <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={weightedTransition} className="fixed right-0 top-0 h-full w-full max-w-xl glass-panel z-[140] p-12 flex flex-col shadow-2xl border-l border-white/10">
              <button onClick={() => setSelectedGym(null)} className="absolute top-10 right-10 size-12 flex items-center justify-center rounded-2xl bg-white/5 hover:bg-white/10">
                <span className="material-symbols-outlined">close</span>
              </button>
              <div className="flex-1 overflow-y-auto custom-scrollbar pt-10">
                <div className="aspect-video rounded-[2.5rem] overflow-hidden mb-10 border border-white/10">
                  <img src={selectedGym.imageUrl || FALLBACK_IMG} className="size-full object-cover" alt={selectedGym.name} />
                </div>
                <div className="space-y-8">
                  <div>
                    <span className="text-primary font-black uppercase tracking-[0.4em] text-xs">Gym Details</span>
                    <h2 className="text-5xl font-black tracking-tighter mt-2">{selectedGym.name}</h2>
                    <p className="text-slate-500 font-bold mt-4 flex items-center gap-2">
                      <span className="material-symbols-outlined">location_on</span>
                      {selectedGym.location}
                    </p>
                    {selectedGym.phone && <p className="text-slate-400 mt-2 text-sm">{selectedGym.phone}</p>}
                  </div>
                  {selectedGym.bio && (
                    <div className="space-y-3">
                      <h4 className="text-xs font-black uppercase tracking-widest text-primary">About</h4>
                      <p className="text-slate-300 italic leading-relaxed">"{selectedGym.bio}"</p>
                    </div>
                  )}
                  {selectedGym.amenities && (
                    <div className="space-y-3">
                      <h4 className="text-xs font-black uppercase tracking-widest text-primary">Amenities</h4>
                      <div className="grid grid-cols-2 gap-3">
                        {(selectedGym.amenities as unknown as string).toString().split(/[,\n]/).map((a) => a.trim()).filter(Boolean).map((a) => (
                          <div key={a} className="flex items-center gap-3 p-3 bg-background/50 rounded-xl border border-white/5">
                            <span className="material-symbols-outlined text-primary text-sm">verified</span>
                            <span className="text-xs font-bold text-slate-300">{a}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="pt-10">
                <Magnetic strength={0.3}>
                  <motion.button
                    variants={buttonPress}
                    whileHover="hover"
                    whileTap="tap"
                    onClick={() => { handleCheckIn(selectedGym); setSelectedGym(null); }}
                    disabled={!isMember(selectedGym.id)}
                    className="w-full bg-primary text-white font-black py-5 rounded-[2rem] text-lg shadow-2xl flex items-center justify-center gap-4 disabled:opacity-40"
                  >
                    {isMember(selectedGym.id) ? 'Check In Now' : 'Members Only'}
                    <span className="material-symbols-outlined font-black">arrow_forward</span>
                  </motion.button>
                </Magnetic>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};
