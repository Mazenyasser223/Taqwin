import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { staggerContainer } from '../../lib/motion';
import { TiltCard, Magnetic } from '../../components/shared/MotionWrappers';
import dashboardService, { type GymOwnerDashboard as DashType } from '../../services/dashboardService';

const PIE_COLORS = ['#158b8d', '#f37021', '#3b82f6', '#10b981'];

export const GymOwnerDashboard: React.FC = () => {
  const [data, setData] = useState<DashType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    dashboardService.gym().then((res) => {
      if (!mounted) return;
      if (res.error) setError(res.error);
      else setData(res.data ?? null);
      setLoading(false);
    });
    return () => {
      mounted = false;
    };
  }, []);

  if (loading) {
    return <div className="text-primary animate-pulse p-8">Loading gym dashboard…</div>;
  }
  if (error) {
    return <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">{error}</div>;
  }

  if (!data?.hasGym) {
    return (
      <div className="max-w-2xl mx-auto p-12 glass-panel rounded-3xl text-center space-y-6">
        <h2 className="text-3xl font-black">No gym set up yet</h2>
        <p className="text-slate-400">
          Create your gym in the profile section so members can find and check into it.
        </p>
        <Link to="/profile" className="inline-block bg-primary text-white font-bold px-6 py-3 rounded-xl">
          Set up gym
        </Link>
      </div>
    );
  }

  const stats = [
    { label: 'Total Members', value: data.totals?.members ?? 0, icon: 'groups', color: 'text-primary' },
    { label: 'Active', value: data.totals?.activeMembers ?? 0, icon: 'check_circle', color: 'text-green-400' },
    { label: 'Check-ins (7d)', value: data.totals?.weekCheckIns ?? 0, icon: 'login', color: 'text-blue-400' },
    { label: 'New This Month', value: data.totals?.newThisMonth ?? 0, icon: 'person_add', color: 'text-accent' },
  ];

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
        <div>
          <h1 className="text-4xl font-black tracking-tight">{data.gym?.name ?? 'Your Gym'}</h1>
          <p className="text-slate-400 mt-2">
            {data.gym?.location} · {data.totals?.utilization}% utilization
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link to="/profile" className="bg-white/10 hover:bg-white/15 border border-white/15 text-white font-bold px-6 py-3 rounded-xl flex items-center gap-2 transition-all">
            <span className="material-symbols-outlined">person</span>
            Business profile
          </Link>
          <Magnetic strength={0.2}>
            <Link to="/owner/members" className="bg-primary text-white font-bold px-6 py-3 rounded-xl flex items-center gap-2 shadow-lg">
              <span className="material-symbols-outlined">add_circle</span>
              Manage Members
            </Link>
          </Magnetic>
        </div>
      </div>

      <motion.div variants={staggerContainer(0.1)} initial="hidden" animate="visible" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <TiltCard key={stat.label}>
            <div className="glass-panel p-6 rounded-3xl border-white/5 space-y-4">
              <div className={`size-12 rounded-xl bg-white/5 flex items-center justify-center ${stat.color}`}>
                <span className="material-symbols-outlined font-black text-2xl">{stat.icon}</span>
              </div>
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase">{stat.label}</p>
                <p className="text-3xl font-black">{stat.value}</p>
              </div>
            </div>
          </TiltCard>
        ))}
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 glass-panel p-8 rounded-3xl border-white/5">
          <h3 className="text-xl font-bold mb-6">Check-ins · Last 6 Months</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.monthlySeries ?? []}>
                <defs>
                  <linearGradient id="colorCheckins" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#158b8d" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#158b8d" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                <XAxis dataKey="month" stroke="#ffffff40" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#ffffff40" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ backgroundColor: '#112129', border: 'none', borderRadius: '12px' }} itemStyle={{ color: '#fff' }} />
                <Area type="monotone" dataKey="checkIns" stroke="#158b8d" fill="url(#colorCheckins)" strokeWidth={3} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass-panel p-8 rounded-3xl border-white/5">
          <h3 className="text-xl font-bold mb-6">Membership Distribution</h3>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data.planDistribution ?? []} innerRadius={60} outerRadius={80} dataKey="value">
                  {(data.planDistribution ?? []).map((_, i) => (
                    <Cell key={`cell-${i}`} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 space-y-2">
            {(data.planDistribution ?? []).map((entry, i) => (
              <div key={entry.name} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="size-2 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                  <span className="text-slate-400">{entry.name}</span>
                </div>
                <span className="font-bold">{entry.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
