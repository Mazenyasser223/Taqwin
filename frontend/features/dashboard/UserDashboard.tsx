import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { AreaChart, Area, XAxis, CartesianGrid, ResponsiveContainer } from 'recharts';
import {
  staggerContainer,
  buttonPress,
  maskRevealVariants,
  contentRevealVariants,
} from '../../lib/motion';
import { Magnetic, TiltCard } from '../../components/shared/MotionWrappers';
import { DashboardVisual } from '../../3d/PageSpecificVisuals';
import { Link } from 'react-router-dom';
import dashboardService, { type AthleteDashboard } from '../../services/dashboardService';

export const UserDashboard: React.FC = () => {
  const [data, setData] = useState<AthleteDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    dashboardService.athlete().then((res) => {
      if (!mounted) return;
      if (res.error) setError(res.error);
      else setData(res.data ?? null);
      setLoading(false);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const stats = [
    { label: 'Calories Burned', value: data?.totals.caloriesBurned ?? 0, unit: 'kcal', icon: 'local_fire_department', color: 'text-accent' },
    { label: 'Calories Eaten', value: data?.totals.caloriesEaten ?? 0, unit: 'kcal', icon: 'restaurant', color: 'text-primary' },
    { label: 'Total Minutes', value: data?.totals.minutes ?? 0, unit: 'min', icon: 'schedule', color: 'text-teal-400' },
    { label: 'Workouts', value: data?.totals.workouts ?? 0, unit: 'this week', icon: 'fitness_center', color: 'text-indigo-400' },
  ];

  const chart = data?.weekly ?? [];

  return (
    <div className="space-y-6 md:space-y-12 pb-20">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-8 relative px-2">
        <motion.div variants={staggerContainer(0.1)} initial="hidden" animate="visible" className="relative z-10 w-full">
          <motion.div variants={contentRevealVariants} className="flex items-center gap-3 text-primary mb-4">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
            </span>
            <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-[0.4em] text-primary/80">Live Health Tracking</span>
          </motion.div>
          <div className="overflow-hidden">
            <h1 className="text-5xl sm:text-7xl md:text-8xl lg:text-9xl font-black tracking-tighter leading-[0.85] mb-6 sm:mb-8">
              <motion.span variants={maskRevealVariants} className="block">Weekly</motion.span>
              <motion.span variants={maskRevealVariants} className="text-primary italic text-glow block">Progress</motion.span>
            </h1>
          </div>
          <motion.p variants={contentRevealVariants} className="text-slate-400 font-medium text-base sm:text-lg max-w-xl border-l-2 border-primary/20 pl-4 sm:pl-8 leading-relaxed">
            {data?.totals.workouts ? (
              <>You logged <span className="text-white font-black">{data.totals.workouts} workouts</span> this week. Keep it up!</>
            ) : (
              'Start logging workouts and meals to see your progress here.'
            )}
          </motion.p>
        </motion.div>
        <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.6 }} className="flex gap-4 relative z-10 w-full lg:w-auto">
          <Magnetic strength={0.3} className="w-full lg:w-auto">
            <Link to="/workouts" className="block w-full">
              <motion.button
                variants={buttonPress}
                whileHover="hover"
                whileTap="tap"
                className="w-full lg:w-auto bg-primary text-white font-black px-8 lg:px-12 py-5 lg:py-7 rounded-2xl lg:rounded-[2.5rem] flex items-center justify-center gap-4 lg:gap-5 shadow-2xl border border-primary/30 text-xl lg:text-2xl group overflow-hidden relative ring-pulse"
              >
                <span className="material-symbols-outlined font-black text-3xl lg:text-4xl animate-pulse">bolt</span>
                Start Workout
              </motion.button>
            </Link>
          </Magnetic>
        </motion.div>
        <div className="hidden lg:block absolute -top-32 -right-32 w-[500px] h-[500px] xl:w-[600px] xl:h-[600px] pointer-events-none opacity-80 z-0">
          <DashboardVisual />
        </div>
      </div>

      {loading && <div className="text-primary animate-pulse">Loading your stats…</div>}
      {error && <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">{error}</div>}

      <motion.div variants={staggerContainer(0.08, 0.4)} initial="hidden" animate="visible" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-8">
        {stats.map((stat) => (
          <TiltCard key={stat.label} maxTilt={6}>
            <motion.div variants={contentRevealVariants} className="glass-panel p-6 sm:p-8 lg:p-10 rounded-2xl sm:rounded-[3rem] lg:rounded-[4rem] space-y-6 lg:space-y-8 relative overflow-hidden group hover:border-primary/60 transition-all duration-500 cursor-pointer">
              <div className="flex items-center justify-between relative z-10">
                <motion.div whileHover={{ rotate: [0, -15, 15, 0], scale: 1.1 }} className={`size-12 lg:size-16 bg-white/5 rounded-2xl lg:rounded-3xl flex items-center justify-center ${stat.color} relative`}>
                  <span className="material-symbols-outlined text-2xl lg:text-4xl font-black">{stat.icon}</span>
                </motion.div>
              </div>
              <div className="relative z-10">
                <p className="text-slate-500 text-[9px] font-black uppercase tracking-[0.4em] mb-2 lg:mb-4 opacity-70">{stat.label}</p>
                <div className="flex items-baseline gap-2 lg:gap-3">
                  <span className="text-4xl sm:text-5xl lg:text-6xl font-black tabular-nums tracking-tighter">{stat.value.toLocaleString()}</span>
                  <span className="text-xs lg:text-sm text-slate-500 font-black uppercase tracking-widest">{stat.unit}</span>
                </div>
              </div>
            </motion.div>
          </TiltCard>
        ))}
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10">
        <motion.div variants={contentRevealVariants} initial="hidden" animate="visible" transition={{ delay: 0.5 }} className="lg:col-span-8 glass-panel p-6 sm:p-10 lg:p-12 rounded-[2rem] sm:rounded-[3rem] lg:rounded-[4.5rem] relative overflow-hidden group">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-10 sm:mb-12 relative z-10 gap-6">
            <div className="flex items-center gap-4 sm:gap-6">
              <div className="size-10 sm:size-14 bg-primary/10 rounded-xl sm:rounded-2xl flex items-center justify-center text-primary shrink-0">
                <span className="material-symbols-outlined text-2xl sm:text-4xl font-black">insights</span>
              </div>
              <div>
                <h3 className="text-2xl sm:text-4xl font-black">Energy Tracking</h3>
                <p className="text-slate-500 font-bold uppercase text-[9px] tracking-widest mt-1">Burned vs eaten · last 7 days</p>
              </div>
            </div>
          </div>
          <div className="h-[300px] sm:h-[400px] lg:h-[450px] w-full relative z-10">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chart}>
                <defs>
                  <linearGradient id="momentumGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#158b8d" stopOpacity={0.7} />
                    <stop offset="95%" stopColor="#158b8d" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="eatenGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f37021" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#f37021" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="12 12" stroke="#1b323d" vertical={false} opacity={0.1} />
                <XAxis dataKey="day" stroke="#475569" fontSize={12} tickLine={false} axisLine={false} dy={20} fontWeight="900" />
                <Area type="monotone" dataKey="caloriesBurned" stroke="#158b8d" fillOpacity={1} fill="url(#momentumGrad)" strokeWidth={4} />
                <Area type="monotone" dataKey="caloriesEaten" stroke="#f37021" fillOpacity={1} fill="url(#eatenGrad)" strokeWidth={4} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        <motion.div variants={contentRevealVariants} initial="hidden" animate="visible" transition={{ delay: 0.7 }} className="lg:col-span-4 glass-panel bg-primary/25 border-primary/40 p-8 sm:p-10 lg:p-12 rounded-[2rem] sm:rounded-[3rem] lg:rounded-[4.5rem] relative overflow-hidden flex flex-col justify-between group shadow-2xl">
          <div className="space-y-10 lg:space-y-14 relative z-10">
            <div className="flex items-center gap-4 lg:gap-6">
              <div className="size-14 lg:size-20 bg-primary rounded-2xl lg:rounded-[2rem] flex items-center justify-center text-white shadow-2xl shrink-0">
                <span className="material-symbols-outlined text-3xl lg:text-5xl font-black">psychology_alt</span>
              </div>
              <div>
                <h3 className="font-black text-[9px] sm:text-[10px] uppercase tracking-[0.4em] text-primary">Smart Coach</h3>
                <div className="flex items-center gap-2 mt-2">
                  <div className="size-2 bg-teal-400 rounded-full animate-pulse" />
                  <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Always Online</p>
                </div>
              </div>
            </div>
            <div className="space-y-6 lg:space-y-10">
              <p className="text-2xl sm:text-3xl lg:text-4xl font-black leading-[1.1] text-white tracking-tighter">
                {data?.profile.fitnessGoal ? (
                  <>Goal: <span className="text-primary italic">{data.profile.fitnessGoal}</span></>
                ) : (
                  <>Set your <span className="text-primary italic">goal</span> in your profile to personalize coaching.</>
                )}
              </p>
              <div className="space-y-4 sm:space-y-6">
                {[
                  data?.profile.weight ? `Weight: ${data.profile.weight} kg` : null,
                  data?.profile.fitnessLevel ? `Level: ${data.profile.fitnessLevel}` : null,
                  `Today's energy in: ${data?.totals.caloriesEaten ?? 0} kcal`,
                ]
                  .filter(Boolean)
                  .map((text) => (
                    <div key={text as string} className="flex gap-3 items-center">
                      <span className="material-symbols-outlined text-primary font-black text-lg sm:text-xl">verified</span>
                      <p className="text-slate-300 font-bold tracking-tight text-sm sm:text-base">{text}</p>
                    </div>
                  ))}
              </div>
            </div>
          </div>
          <div className="pt-10 lg:pt-12 relative z-10">
            <Link to="/ai-assistant">
              <Magnetic strength={0.4} className="w-full">
                <motion.button variants={buttonPress} whileHover="hover" whileTap="tap" className="w-full bg-white text-background font-black py-5 lg:py-7 rounded-2xl lg:rounded-[2.5rem] shadow-2xl text-lg lg:text-2xl hover:bg-slate-50 transition-all flex items-center justify-center gap-3 ring-pulse group">
                  Talk to Coach
                  <span className="material-symbols-outlined font-black group-hover:translate-x-2 transition-transform">arrow_forward_ios</span>
                </motion.button>
              </Magnetic>
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
};
