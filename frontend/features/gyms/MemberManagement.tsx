import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { staggerContainer, itemVariants, weightedTransition } from '../../lib/motion';
import { TiltCard } from '../../components/shared/MotionWrappers';
import gymService from '../../services/gymService';
import apiClient from '../../services/api';
import type { Gym, GymMembership } from '../../types';

type StatusFilter = 'All' | 'Active' | 'Expired';

const FALLBACK_AVATAR = (id: string) => `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(id)}`;

interface MemberRow {
  id: string;
  joinedAt: string;
  expiresAt: string | null;
  isActive: boolean;
  user: {
    id: string;
    email: string;
    profile: { displayName?: string; avatarUrl?: string } | null;
  };
}

export const MemberManagement: React.FC = () => {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<StatusFilter>('All');
  const [myGym, setMyGym] = useState<Gym | null>(null);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showAdd, setShowAdd] = useState(false);
  const [addEmail, setAddEmail] = useState('');
  const [addExpiresAt, setAddExpiresAt] = useState('');
  const [addSubmitting, setAddSubmitting] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const reload = async (gymId: string) => {
    const res = await gymService.getMyGymMembers(gymId);
    if (res.error) setError(res.error);
    else setMembers((res.data ?? []) as unknown as MemberRow[]);
  };

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    apiClient.get<Gym[]>('/api/gyms').then(async (res) => {
      if (!mounted) return;
      const owned = (res.data ?? []).find((g) => (g as any).ownerId);
      if (!owned) {
        // fallback: load all and filter client side; the API doesn't expose mine endpoint yet
        setLoading(false);
        return;
      }
      // We need the gym we own. Use /api/gyms response since it includes ownerId.
      // Find one whose ownerId === current user — but we don't have user here.
      // Instead, call backend /api/dashboard/gym which returns my gym.
      const dashRes = await apiClient.get<{ hasGym: boolean; gym?: { id: string; name: string; location: string } }>('/api/dashboard/gym');
      if (!dashRes.data?.hasGym || !dashRes.data?.gym) {
        setLoading(false);
        return;
      }
      const gymRes = await gymService.getGym(dashRes.data.gym.id);
      if (gymRes.data) setMyGym(gymRes.data);
      if (gymRes.data) await reload(gymRes.data.id);
      setLoading(false);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const now = new Date();
    return members.filter((m) => {
      const name = m.user.profile?.displayName ?? m.user.email;
      const matchesSearch =
        !search ||
        name.toLowerCase().includes(search.toLowerCase()) ||
        m.user.email.toLowerCase().includes(search.toLowerCase());
      const isActive = m.isActive && (!m.expiresAt || new Date(m.expiresAt) > now);
      const matchesFilter = filter === 'All' || (filter === 'Active' ? isActive : !isActive);
      return matchesSearch && matchesFilter;
    });
  }, [members, search, filter]);

  const submitAdd = async () => {
    if (!myGym) return;
    setAddSubmitting(true);
    setAddError(null);
    const res = await apiClient.post(`/api/gyms/${myGym.id}/members`, {
      email: addEmail.trim().toLowerCase(),
      expiresAt: addExpiresAt ? new Date(addExpiresAt).toISOString() : undefined,
    });
    setAddSubmitting(false);
    if (res.error) {
      setAddError(res.error);
      return;
    }
    setShowAdd(false);
    setAddEmail('');
    setAddExpiresAt('');
    if (myGym) await reload(myGym.id);
  };

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h1 className="text-4xl font-black tracking-tight">Members List</h1>
          <p className="text-slate-400 mt-1">
            {myGym ? `Manage members of ${myGym.name}.` : 'Set up your gym to manage members.'}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
          <div className="flex p-1 bg-white/5 rounded-xl border border-white/10">
            {(['All', 'Active', 'Expired'] as StatusFilter[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${
                  filter === f ? 'bg-primary text-white shadow-lg' : 'text-slate-400 hover:text-white'
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          <div className="relative w-full md:w-64 lg:w-72">
            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">search</span>
            <input
              className="w-full bg-white/5 border border-white/10 rounded-xl pl-12 pr-6 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all font-bold"
              placeholder="Search by name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <button
            onClick={() => setShowAdd(true)}
            disabled={!myGym}
            className="bg-primary text-white px-5 py-3 rounded-xl font-bold flex items-center gap-2 disabled:opacity-40"
          >
            <span className="material-symbols-outlined text-base">person_add</span>
            Add Member
          </button>
        </div>
      </div>

      {loading && <div className="text-primary animate-pulse">Loading members…</div>}
      {error && <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">{error}</div>}

      <motion.div layout variants={staggerContainer(0.05)} initial="hidden" animate="visible" className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        <AnimatePresence mode="popLayout">
          {filtered.map((m) => {
            const name = m.user.profile?.displayName ?? m.user.email.split('@')[0];
            const active = m.isActive && (!m.expiresAt || new Date(m.expiresAt) > new Date());
            return (
              <motion.div layout key={m.id} variants={itemVariants} exit={{ opacity: 0, scale: 0.9 }} transition={weightedTransition}>
                <TiltCard maxTilt={3}>
                  <div className="glass-panel p-6 rounded-3xl border-white/5 hover:border-primary/30 transition-all group">
                    <div className="flex items-center gap-4 mb-6">
                      <img src={m.user.profile?.avatarUrl || FALLBACK_AVATAR(m.user.id)} className="size-14 rounded-xl object-cover" alt={name} />
                      <div>
                        <h3 className="text-lg font-bold leading-none">{name}</h3>
                        <p className="text-xs text-slate-500 mt-1">{m.user.email}</p>
                      </div>
                      <div className={`ml-auto px-3 py-1 rounded-full text-[10px] font-bold uppercase ${
                        active ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
                      }`}>
                        {active ? 'Active' : 'Expired'}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                        <p className="text-[10px] font-bold text-slate-500 uppercase">Joined</p>
                        <p className="text-sm font-bold">{new Date(m.joinedAt).toLocaleDateString()}</p>
                      </div>
                      <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                        <p className="text-[10px] font-bold text-slate-500 uppercase">Expires</p>
                        <p className="text-sm font-bold">{m.expiresAt ? new Date(m.expiresAt).toLocaleDateString() : '—'}</p>
                      </div>
                    </div>
                  </div>
                </TiltCard>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </motion.div>

      {!loading && filtered.length === 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-20 bg-white/5 rounded-3xl border border-dashed border-white/10">
          <p className="text-slate-500 font-bold">No members match your filters.</p>
        </motion.div>
      )}

      <AnimatePresence>
        {showAdd && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-6" onClick={() => setShowAdd(false)}>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} onClick={(e) => e.stopPropagation()} className="glass-panel w-full max-w-md rounded-3xl p-8 space-y-6">
              <h3 className="text-2xl font-black">Add Member</h3>
              <div className="space-y-2">
                <label className="text-[10px] uppercase font-black tracking-widest text-slate-500">Member email</label>
                <input
                  type="email"
                  value={addEmail}
                  onChange={(e) => setAddEmail(e.target.value)}
                  placeholder="member@example.com"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 font-bold focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] uppercase font-black tracking-widest text-slate-500">Expires (optional)</label>
                <input
                  type="date"
                  value={addExpiresAt}
                  onChange={(e) => setAddExpiresAt(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 font-bold focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
              {addError && <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{addError}</div>}
              <div className="flex gap-3">
                <button onClick={() => setShowAdd(false)} className="flex-1 bg-white/5 border border-white/10 py-3 rounded-xl font-bold">Cancel</button>
                <button onClick={submitAdd} disabled={addSubmitting || !addEmail} className="flex-1 bg-primary text-white font-bold py-3 rounded-xl disabled:opacity-50">
                  {addSubmitting ? 'Adding…' : 'Add Member'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
