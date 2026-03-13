
import React from 'react';
import { motion, Variants } from 'framer-motion';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { 
  useMotionPrefs, 
  staggerContainer, 
  buttonPress, 
  maskRevealVariants,
  contentRevealVariants,
  weightedTransition
} from '../../lib/motion';
import { Magnetic, TiltCard } from '../../components/shared/MotionWrappers';
import { DashboardVisual } from '../../3d/PageSpecificVisuals';

const data = [
  { name: 'Mon', kcal: 2100, prot: 160 },
  { name: 'Tue', kcal: 1800, prot: 140 },
  { name: 'Wed', kcal: 2400, prot: 185 },
  { name: 'Thu', kcal: 2200, prot: 170 },
  { name: 'Fri', kcal: 2000, prot: 155 },
  { name: 'Sat', kcal: 2600, prot: 190 },
  { name: 'Sun', kcal: 1900, prot: 150 },
];

export const UserDashboard: React.FC = () => {
  const { shouldSimplify } = useMotionPrefs();

  return (
    <div className="space-y-6 md:space-y-12 pb-20">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-8 relative px-2">
        <motion.div
          variants={staggerContainer(0.1)}
          initial="hidden"
          animate="visible"
          className="relative z-10 w-full"
        >
          <motion.div 
            variants={contentRevealVariants}
            className="flex items-center gap-3 text-primary mb-4"
          >
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
            </span>
            <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-[0.4em] text-primary/80">
              Live Health Tracking
            </span>
          </motion.div>
          
          <div className="overflow-hidden">
            <h1 className="text-5xl sm:text-7xl md:text-8xl lg:text-9xl font-black tracking-tighter leading-[0.85] mb-6 sm:mb-8">
              <motion.span 
                variants={maskRevealVariants}
                className="block"
              >
                Weekly
              </motion.span>
              <motion.span 
                variants={maskRevealVariants}
                className="text-primary italic text-glow block"
              >
                Progress
              </motion.span>
            </h1>
          </div>
          
          <motion.p 
            variants={contentRevealVariants}
            className="text-slate-400 font-medium text-base sm:text-lg max-w-xl border-l-2 border-primary/20 pl-4 sm:pl-8 leading-relaxed"
          >
            You're doing great! You are <span className="text-white font-black">12% more active</span> than last week. Keep it up!
          </motion.p>
        </motion.div>
        
        <motion.div 
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.8 }}
          className="flex gap-4 relative z-10 w-full lg:w-auto"
        >
          <Magnetic strength={0.3} className="w-full lg:w-auto">
            <motion.button 
              variants={buttonPress}
              whileHover="hover"
              whileTap="tap"
              className="w-full lg:w-auto bg-primary text-white font-black px-8 lg:px-12 py-5 lg:py-7 rounded-2xl lg:rounded-[2.5rem] flex items-center justify-center gap-4 lg:gap-5 shadow-2xl border border-primary/30 text-xl lg:text-2xl group overflow-hidden relative ring-pulse"
            >
              <motion.div 
                className="absolute inset-0 bg-white/10 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000 skew-x-12"
              />
              <span className="material-symbols-outlined font-black text-3xl lg:text-4xl animate-pulse">bolt</span>
              Start Workout
            </motion.button>
          </Magnetic>
        </motion.div>

        <div className="hidden lg:block absolute -top-32 -right-32 w-[500px] h-[500px] xl:w-[600px] xl:h-[600px] pointer-events-none opacity-80 z-0">
           <DashboardVisual />
        </div>
      </div>

      <motion.div 
        variants={staggerContainer(0.08, 0.6)}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-8"
      >
        {[
          { label: 'Calories Burned', value: '2,420', unit: 'kcal', trend: '+12%', icon: 'local_fire_department', color: 'text-accent' },
          { label: 'Energy Level', value: '92', unit: 'pts', trend: '-2%', icon: 'psychology', color: 'text-primary' },
          { label: 'Weight Lifted', value: '4.2', unit: 'tons', trend: '+5%', icon: 'fitness_center', color: 'text-teal-400' },
          { label: 'Recovery Status', value: '88', unit: '%', trend: '+8%', icon: 'electric_bolt', color: 'text-indigo-400' },
        ].map((stat) => (
          <TiltCard key={stat.label} maxTilt={6}>
            <motion.div 
              variants={contentRevealVariants}
              tabIndex={0}
              className="glass-panel p-6 sm:p-8 lg:p-10 rounded-2xl sm:rounded-[3rem] lg:rounded-[4rem] space-y-6 lg:space-y-8 relative overflow-hidden group hover:border-primary/60 transition-all duration-500 cursor-pointer ring-pulse"
            >
              <div className="flex items-center justify-between relative z-10">
                <motion.div 
                  whileHover={{ rotate: [0, -15, 15, 0], scale: 1.1 }}
                  className={`size-12 lg:size-16 bg-white/5 rounded-2xl lg:rounded-3xl flex items-center justify-center ${stat.color} relative`}
                >
                  <span className="material-symbols-outlined text-2xl lg:text-4xl font-black">{stat.icon}</span>
                </motion.div>
                <span className={`text-[9px] font-black px-4 lg:px-5 py-1.5 lg:py-2 rounded-full bg-white/5 uppercase tracking-widest ${stat.trend.startsWith('+') ? 'text-teal-400 border border-teal-400/20' : 'text-accent border border-accent/20'}`}>
                  {stat.trend}
                </span>
              </div>
              
              <div className="relative z-10">
                <p className="text-slate-500 text-[9px] font-black uppercase tracking-[0.4em] mb-2 lg:mb-4 opacity-70">
                  {stat.label}
                </p>
                <div className="flex items-baseline gap-2 lg:gap-3">
                  <span className="text-4xl sm:text-5xl lg:text-6xl font-black tabular-nums tracking-tighter">
                    {stat.value}
                  </span>
                  <span className="text-xs lg:text-sm text-slate-500 font-black uppercase tracking-widest">{stat.unit}</span>
                </div>
              </div>
            </motion.div>
          </TiltCard>
        ))}
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10">
        <motion.div 
          variants={contentRevealVariants}
          initial="hidden"
          animate="visible"
          transition={{ delay: 1.2 }}
          className="lg:col-span-8 glass-panel p-6 sm:p-10 lg:p-12 rounded-[2rem] sm:rounded-[3rem] lg:rounded-[4.5rem] relative overflow-hidden group"
        >
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-10 sm:mb-20 relative z-10 gap-6">
            <div className="flex items-center gap-4 sm:gap-6">
              <motion.div 
                animate={{ 
                  rotateY: [0, 180, 360],
                  scale: [1, 1.2, 1] 
                }}
                transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
                className="size-10 sm:size-14 bg-primary/10 rounded-xl sm:rounded-2xl flex items-center justify-center text-primary shrink-0"
              >
                <span className="material-symbols-outlined text-2xl sm:text-4xl font-black">insights</span>
              </motion.div>
              <div>
                <h3 className="text-2xl sm:text-4xl font-black">Energy Tracking</h3>
                <p className="text-slate-500 font-bold uppercase text-[9px] tracking-widest mt-1">Daily calorie burn</p>
              </div>
            </div>
            
            <div className="flex p-1.5 bg-white/5 rounded-2xl sm:rounded-3xl border border-white/10 backdrop-blur-xl w-full sm:w-auto">
               {['Day', 'Week', 'Month'].map(t => (
                 <button 
                   key={t} 
                   className={`flex-1 sm:flex-none px-6 sm:px-8 py-2.5 sm:py-3 text-[10px] sm:text-[11px] font-black rounded-xl sm:rounded-2xl transition-all ${t === 'Week' ? 'bg-primary text-white shadow-xl' : 'text-slate-500 hover:text-white'}`}
                 >
                   {t[0]}
                 </button>
               ))}
            </div>
          </div>
          
          <div className="h-[300px] sm:h-[400px] lg:h-[450px] w-full relative z-10">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data}>
                <defs>
                  <linearGradient id="momentumGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#158b8d" stopOpacity={0.7}/>
                    <stop offset="95%" stopColor="#158b8d" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="12 12" stroke="#1b323d" vertical={false} opacity={0.1} />
                <XAxis 
                  dataKey="name" 
                  stroke="#475569" 
                  fontSize={12} 
                  tickLine={false} 
                  axisLine={false} 
                  dy={20} 
                  fontWeight="900" 
                />
                <Area 
                  type="monotone" 
                  dataKey="kcal" 
                  stroke="#158b8d" 
                  fillOpacity={1} 
                  fill="url(#momentumGrad)" 
                  strokeWidth={6}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        <motion.div 
          variants={contentRevealVariants}
          initial="hidden"
          animate="visible"
          transition={{ delay: 1.4 }}
          className="lg:col-span-4 glass-panel bg-primary/25 border-primary/40 p-8 sm:p-10 lg:p-12 rounded-[2rem] sm:rounded-[3rem] lg:rounded-[4.5rem] relative overflow-hidden flex flex-col justify-between group shadow-2xl"
        >
          <div className="space-y-10 lg:space-y-16 relative z-10">
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
              <p className="text-3xl sm:text-4xl lg:text-5xl font-black leading-[1.1] text-white tracking-tighter">
                "You look <span className="text-primary italic">Ready</span>. Ready for a great session."
              </p>
              <div className="space-y-4 sm:space-y-6">
                {[
                  "Energy up: +6.4%",
                  "Sleep: Great",
                  "Today's Goal: Strength"
                ].map((text, i) => (
                  <div key={text} className="flex gap-3 items-center">
                     <span className="material-symbols-outlined text-primary font-black text-lg sm:text-xl">verified</span>
                     <p className="text-slate-300 font-bold tracking-tight text-sm sm:text-base">
                       {text}
                     </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
          
          <div className="pt-10 lg:pt-16 relative z-10">
            <Magnetic strength={0.4} className="w-full">
              <motion.button 
                variants={buttonPress}
                whileHover="hover"
                whileTap="tap"
                className="w-full bg-white text-background font-black py-5 lg:py-7 rounded-2xl lg:rounded-[2.5rem] shadow-2xl text-lg lg:text-2xl hover:bg-slate-50 transition-all flex items-center justify-center gap-3 ring-pulse group"
              >
                See Today's Plan
                <span className="material-symbols-outlined font-black group-hover:translate-x-2 transition-transform">arrow_forward_ios</span>
              </motion.button>
            </Magnetic>
          </div>
        </motion.div>
      </div>
    </div>
  );
};
