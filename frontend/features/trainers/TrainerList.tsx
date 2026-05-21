import React, { useEffect, useMemo, useState } from 'react';
import { useI18n } from '../../lib/i18n/useI18n';
import { motion, AnimatePresence } from 'framer-motion';
import { staggerContainer, itemVariants, buttonPress, weightedTransition } from '../../lib/motion';
import { TiltCard, Magnetic } from '../../components/shared/MotionWrappers';
import { TrainersVisual } from '../../3d/PageSpecificVisuals';
import bookingService from '../../services/bookingService';

interface TrainerCard {
  id: string;
  email: string;
  profile?: {
    displayName?: string;
    avatarUrl?: string;
    bio?: string;
    specialties?: string;
    yearsExperience?: number | null;
  } | null;
}

const FALLBACK_AVATAR = (id: string) => `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(id)}`;

export const TrainerList: React.FC = () => {
  const [trainers, setTrainers] = useState<TrainerCard[]>([]);
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<TrainerCard | null>(null);
  const [bookingDate, setBookingDate] = useState('');
  const [bookingNotes, setBookingNotes] = useState('');
  const [bookingSubmitting, setBookingSubmitting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    bookingService.getTrainers().then((res) => {
      if (!mounted) return;
      if (res.error) setError(res.error);
      else setTrainers((res.data ?? []) as TrainerCard[]);
      setLoading(false);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return trainers;
    return trainers.filter((t) => {
      const name = t.profile?.displayName ?? t.email;
      return name.toLowerCase().includes(q);
    });
  }, [trainers, search]);

  const submitBooking = async () => {
    if (!selected || !bookingDate) return;
    setBookingSubmitting(true);
    const res = await bookingService.createBooking({
      trainerId: selected.id,
      scheduledAt: new Date(bookingDate).toISOString(),
      notes: bookingNotes || undefined,
    });
    setBookingSubmitting(false);
    if (res.error) {
      setToast(res.error);
    } else {
      setToast('Booking request sent!');
      setSelected(null);
      setBookingDate('');
      setBookingNotes('');
    }
    setTimeout(() => setToast(null), 3000);
  };

  return (
    <div className="page-shell pb-2 relative overflow-x-hidden lg:overflow-visible">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 relative px-1">
        <motion.div initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={weightedTransition} className="relative z-10 max-w-2xl">
          <div className="flex items-center gap-3 text-primary mb-2">
            <span className="material-symbols-outlined font-black">person_search</span>
            <span className="text-[10px] font-black uppercase tracking-[0.3em]">Find an Expert</span>
          </div>
          <h1 className="text-5xl lg:text-6xl font-black tracking-tight text-foreground drop-shadow-2xl">
            Pro <span className="text-primary italic">Coaches</span>
          </h1>
          <p className="text-muted mt-4 font-medium leading-relaxed">
            Connect with verified human experts and book a session.
          </p>
        </motion.div>

        <div className="relative z-10 w-full md:w-80">
          <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-faint">search</span>
          <input
            type="text"
            placeholder="Search coaches..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-elevated border border-subtle rounded-2xl pl-12 pr-6 py-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all font-bold"
          />
        </div>

        <div className="hidden lg:block absolute -top-16 -right-16 w-80 h-80 pointer-events-none opacity-40">
          <TrainersVisual />
        </div>
      </div>

      {toast && <div className="p-3 rounded-xl bg-primary/10 border border-primary/30 text-primary text-sm">{toast}</div>}

      {loading && <div className="text-primary animate-pulse">{t('trainers.loading')}</div>}
      {error && <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">{error}</div>}
      {!loading && !error && filtered.length === 0 && (
        <div className="glass-panel p-10 rounded-3xl text-center text-muted">{t('trainers.empty')}</div>
      )}

      <motion.div variants={staggerContainer(0.08)} initial="hidden" animate="visible" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 relative z-10">
        <AnimatePresence mode="popLayout">
          {filtered.map((trainer) => {
            const name = trainer.profile?.displayName ?? trainer.email.split('@')[0];
            const tags = (trainer.profile?.specialties ?? '').split(/[,\n]/).map((t) => t.trim()).filter(Boolean).slice(0, 3);
            return (
              <motion.div layout key={trainer.id} variants={itemVariants}>
                <TiltCard maxTilt={5}>
                  <div onClick={() => setSelected(trainer)} className="glass-panel p-8 rounded-[3rem] border border-subtle group hover:border-primary/40 transition-all cursor-pointer">
                    <div className="flex items-center gap-6 mb-8">
                      <div className="size-20 rounded-[2rem] border-2 border-primary/20 p-1 bg-surface relative">
                        <img src={trainer.profile?.avatarUrl || FALLBACK_AVATAR(trainer.id)} className="size-full rounded-[1.8rem] object-cover" alt={name} />
                        <div className="absolute -bottom-1 -right-1 size-6 bg-teal-400 border-4 border-surface rounded-full" />
                      </div>
                      <div>
                        <h3 className="text-2xl font-black leading-none mb-2">{name}</h3>
                        <div className="flex items-center gap-2 text-faint font-black text-[10px] uppercase tracking-widest">
                          <span className="text-primary">{trainer.profile?.yearsExperience ?? 0}y experience</span>
                        </div>
                      </div>
                    </div>
                    <p className="text-muted font-medium mb-8 leading-relaxed line-clamp-3">"{trainer.profile?.bio || 'A verified Taqwin coach.'}"</p>
                    {tags.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-8">
                        {tags.map((tag) => (
                          <span key={tag} className="px-3 py-1 bg-primary/10 border border-primary/20 rounded-full text-[9px] font-black text-primary uppercase tracking-widest">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="pt-6 border-t border-subtle flex items-center justify-end">
                      <Magnetic strength={0.2}>
                        <motion.button variants={buttonPress} whileHover="hover" whileTap="tap" className="bg-primary text-white font-black px-6 py-3 rounded-xl shadow-lg shadow-primary/30">
                          Book Now
                        </motion.button>
                      </Magnetic>
                    </div>
                  </div>
                </TiltCard>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </motion.div>

      <AnimatePresence>
        {selected && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelected(null)} className="fixed inset-0 bg-background/60 backdrop-blur-sm z-[130]" />
            <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={weightedTransition} className="fixed right-0 top-0 h-full w-full max-w-xl glass-panel z-[140] p-10 flex flex-col shadow-2xl border-l border-subtle">
              <button onClick={() => setSelected(null)} className="absolute top-8 right-8 size-12 flex items-center justify-center rounded-2xl bg-elevated hover:bg-elevated-hover">
                <span className="material-symbols-outlined">close</span>
              </button>
              <div className="flex-1 overflow-y-auto custom-scrollbar pt-6 space-y-8">
                <div className="size-40 rounded-[3rem] overflow-hidden border-4 border-primary/20 p-2 bg-surface mx-auto">
                  <img src={selected.profile?.avatarUrl || FALLBACK_AVATAR(selected.id)} className="size-full object-cover rounded-[2.5rem]" alt={selected.profile?.displayName ?? selected.email} />
                </div>
                <div className="text-center">
                  <span className="text-primary font-black uppercase tracking-[0.4em] text-xs">Verified Expert</span>
                  <h2 className="text-4xl font-black tracking-tighter mt-2">{selected.profile?.displayName ?? selected.email}</h2>
                  <p className="text-muted mt-3 italic">"{selected.profile?.bio || 'A Taqwin coach.'}"</p>
                </div>

                <div className="space-y-3">
                  <h4 className="text-[10px] uppercase tracking-widest text-faint font-black">Pick a date & time</h4>
                  <input
                    type="datetime-local"
                    value={bookingDate}
                    onChange={(e) => setBookingDate(e.target.value)}
                    className="w-full bg-elevated border border-subtle rounded-xl px-4 py-3 font-bold focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                  <textarea
                    value={bookingNotes}
                    onChange={(e) => setBookingNotes(e.target.value)}
                    placeholder="Anything the coach should know? (optional)"
                    rows={3}
                    className="w-full bg-elevated border border-subtle rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>
              </div>
              <div className="pt-6">
                <Magnetic strength={0.3}>
                  <motion.button
                    variants={buttonPress}
                    whileHover="hover"
                    whileTap="tap"
                    onClick={submitBooking}
                    disabled={!bookingDate || bookingSubmitting}
                    className="w-full bg-primary text-white font-black py-5 rounded-[2rem] text-lg shadow-2xl flex items-center justify-center gap-4 disabled:opacity-50"
                  >
                    {bookingSubmitting ? 'Sending request…' : 'Request Booking'}
                    <span className="material-symbols-outlined font-black">bolt</span>
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
