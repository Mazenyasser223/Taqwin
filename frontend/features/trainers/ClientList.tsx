
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMotionPrefs, staggerContainer, itemVariants, weightedTransition, buttonPress } from '../../lib/motion';
import { TiltCard, Magnetic } from '../../components/shared/MotionWrappers';
import { ClientsVisual } from '../../3d/PageSpecificVisuals';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts';

const clients = [
  { id: '1', name: 'Alex Johnson', level: 'Intermediate', momentum: '+12%', lastActive: '2m ago', avatar: 'https://i.pravatar.cc/150?u=alex', status: 'Training', bio: 'Focus on neural efficiency and explosive power output.' },
  { id: '2', name: 'Zoe Quantum', level: 'Advanced', momentum: '+5%', lastActive: '1h ago', avatar: 'https://i.pravatar.cc/150?u=zoe', status: 'Recovery', bio: 'Optimizing metabolic flexibility and lactate clearance.' },
  { id: '3', name: 'Rick Sanchez', level: 'Pro', momentum: '-2%', lastActive: '5h ago', avatar: 'https://i.pravatar.cc/150?u=rick', status: 'Idle', bio: 'Enterprise athlete focusing on multiversal strength protocols.' },
];

const telemetryData = [
  { time: '00:00', load: 40, fiber: 20 },
  { time: '05:00', load: 65, fiber: 45 },
  { time: '10:00', load: 85, fiber: 75 },
  { time: '15:00', load: 70, fiber: 90 },
  { time: '20:00', load: 92, fiber: 85 },
];

export const ClientList: React.FC = () => {
  const { shouldSimplify } = useMotionPrefs();
  const [selectedClient, setSelectedClient] = useState<typeof clients[0] | null>(null);

  return (
    <div className="space-y-8 md:space-y-12 pb-24 relative overflow-x-hidden lg:overflow-visible">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6 relative px-1">
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={weightedTransition}
          className="relative z-10 max-w-2xl"
        >
          <div className="flex items-center gap-3 text-primary mb-3">
            <span className="material-symbols-outlined font-black">person_search</span>
            <span className="text-[10px] font-black uppercase tracking-[0.3em]">Operational Area: Athlete Management</span>
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-white leading-tight">
            Client <span className="text-primary italic">Sync</span>
          </h1>
          <p className="text-slate-400 mt-4 font-medium text-sm sm:text-base leading-relaxed">
            Monitor real-time biomechanical output across your roster. AI flag system highlights athletes requiring immediate sequence adjustment.
          </p>
        </motion.div>
        
        {/* Responsive 3D Visual */}
        <div className="hidden sm:block absolute -top-16 -right-16 lg:right-0 w-64 h-64 lg:w-80 lg:h-80 pointer-events-none opacity-40 z-0">
           <ClientsVisual />
        </div>
      </div>

      <motion.div 
        variants={staggerContainer(0.08)}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 lg:gap-8 relative z-10"
      >
        {clients.map((client) => (
          <TiltCard key={client.id} maxTilt={5}>
            <div className="glass-panel p-6 sm:p-8 rounded-[2.5rem] sm:rounded-[3rem] border border-white/5 group hover:border-primary/40 transition-all flex flex-col gap-6 sm:gap-8">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 sm:gap-5">
                   <div className="size-14 sm:size-16 rounded-[1.2rem] sm:rounded-[1.5rem] border-2 border-primary/20 p-1 bg-surface relative">
                      <img src={client.avatar} className="size-full rounded-[1rem] sm:rounded-[1.2rem] object-cover" alt={client.name} />
                      <div className={`absolute -top-1 -right-1 size-3 sm:size-4 rounded-full border-4 border-surface ${
                        client.status === 'Training' ? 'bg-teal-400' : client.status === 'Recovery' ? 'bg-accent' : 'bg-slate-700'
                      }`} />
                   </div>
                   <div>
                     <h3 className="text-lg sm:text-xl font-black leading-none mb-1.5">{client.name}</h3>
                     <p className="text-[8px] sm:text-[9px] font-black uppercase text-slate-500 tracking-widest">{client.level} Athlete</p>
                   </div>
                </div>
                <div className="text-right">
                   <p className={`text-xs sm:text-sm font-black ${client.momentum.startsWith('+') ? 'text-teal-400' : 'text-accent'}`}>{client.momentum}</p>
                   <p className="text-[7px] sm:text-[8px] font-black uppercase text-slate-600 tracking-widest">Momentum</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                 <div className="bg-white/5 p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-white/5">
                    <p className="text-[8px] sm:text-[9px] font-black uppercase text-slate-500 mb-1">Last Update</p>
                    <p className="text-[10px] sm:text-xs font-black text-white">{client.lastActive}</p>
                 </div>
                 <div className="bg-white/5 p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-white/5">
                    <p className="text-[8px] sm:text-[9px] font-black uppercase text-slate-500 mb-1">Bio-Status</p>
                    <p className={`text-[10px] sm:text-xs font-black ${client.status === 'Training' ? 'text-teal-400' : 'text-slate-400'}`}>{client.status}</p>
                 </div>
              </div>

              <div className="space-y-3">
                 <div className="flex justify-between text-[8px] sm:text-[9px] font-black uppercase tracking-widest text-slate-500">
                    <span>Neural Integrity</span>
                    <span>88%</span>
                 </div>
                 <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: '88%' }}
                      className="h-full bg-primary"
                    />
                 </div>
              </div>

              <div className="flex gap-3 pt-4 border-t border-white/5">
                 <Magnetic strength={0.2} className="flex-1">
                   <motion.button 
                     variants={buttonPress}
                     whileHover="hover"
                     whileTap="tap"
                     onClick={() => setSelectedClient(client)}
                     className="w-full bg-white/5 border border-white/10 text-white font-black py-3 sm:py-4 rounded-xl sm:rounded-2xl text-[9px] sm:text-[10px] uppercase tracking-widest hover:bg-white/10 transition-all"
                   >
                     View Telemetry
                   </motion.button>
                 </Magnetic>
                 <Magnetic strength={0.4}>
                   <motion.button 
                     variants={buttonPress}
                     whileHover="hover"
                     whileTap="tap"
                     className="size-11 sm:size-12 bg-primary text-white rounded-xl sm:rounded-2xl flex items-center justify-center shadow-lg shadow-primary/30"
                   >
                     <span className="material-symbols-outlined font-black text-xl">chat</span>
                   </motion.button>
                 </Magnetic>
              </div>
            </div>
          </TiltCard>
        ))}
      </motion.div>

      {/* Telemetry Detail Overlay */}
      <AnimatePresence>
        {selectedClient && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedClient(null)}
              className="fixed inset-0 bg-background/80 backdrop-blur-xl z-[200]"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 30 }}
              className="fixed inset-4 sm:inset-10 z-[210] glass-panel rounded-[2rem] sm:rounded-[4rem] border-white/10 shadow-[0_50px_150px_rgba(0,0,0,0.8)] flex flex-col overflow-hidden"
            >
              <div className="p-6 sm:p-10 border-b border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-4 sm:gap-6">
                  <img src={selectedClient.avatar} className="size-14 sm:size-20 rounded-xl sm:rounded-[2rem] border-2 border-primary/40 object-cover" />
                  <div>
                    <h2 className="text-xl sm:text-4xl font-black tracking-tight">{selectedClient.name} <span className="text-primary italic hidden sm:inline">Live Feed</span></h2>
                    <p className="text-slate-500 font-bold uppercase tracking-widest text-[8px] sm:text-xs mt-1 sm:mt-2">{selectedClient.level} Status • Biometric Integrity 92%</p>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedClient(null)}
                  className="size-10 sm:size-14 bg-white/5 rounded-xl sm:rounded-2xl flex items-center justify-center text-slate-400 hover:text-white"
                >
                  <span className="material-symbols-outlined text-2xl sm:text-3xl">close</span>
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 sm:p-12 custom-scrollbar grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-12">
                <div className="lg:col-span-2 space-y-6 sm:space-y-10">
                   <div className="glass-panel p-6 sm:p-8 rounded-[2rem] sm:rounded-[3rem] bg-white/5 border-white/5 h-[250px] sm:h-[400px]">
                      <h4 className="text-[10px] font-black uppercase tracking-widest text-primary mb-6 sm:mb-8">Neural Load Analysis</h4>
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={telemetryData}>
                          <defs>
                            <linearGradient id="telemetryGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#158b8d" stopOpacity={0.8}/>
                              <stop offset="95%" stopColor="#158b8d" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <Tooltip contentStyle={{ backgroundColor: '#112129', border: 'none', borderRadius: '20px' }} />
                          <Area type="monotone" dataKey="load" stroke="#158b8d" fill="url(#telemetryGrad)" strokeWidth={4} />
                          <Area type="monotone" dataKey="fiber" stroke="#f37021" fill="transparent" strokeWidth={4} strokeDasharray="8 8" />
                        </AreaChart>
                      </ResponsiveContainer>
                   </div>
                   
                   <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
                      {[
                        { label: 'CNS Recruitment', val: '94%', color: 'text-primary' },
                        { label: 'Lactate Threshold', val: '8.4 mmol', color: 'text-accent' },
                        { label: 'Fiber Saturation', val: '62%', color: 'text-white' },
                      ].map(stat => (
                        <div key={stat.label} className="glass-panel p-4 sm:p-6 rounded-2xl sm:rounded-3xl border-white/5 text-center">
                           <p className={`text-2xl sm:text-3xl font-black ${stat.color}`}>{stat.val}</p>
                           <p className="text-[8px] sm:text-[9px] font-black uppercase text-slate-500 tracking-widest mt-1 sm:mt-2">{stat.label}</p>
                        </div>
                      ))}
                   </div>
                </div>

                <div className="space-y-6 sm:space-y-8">
                   <div className="glass-panel p-6 sm:p-8 rounded-[2rem] sm:rounded-[3rem] bg-primary/10 border-primary/20">
                      <h4 className="text-[10px] font-black uppercase tracking-widest text-primary mb-4 sm:mb-6">AI Protocol Insight</h4>
                      <p className="text-base sm:text-lg text-slate-200 font-medium leading-relaxed italic">
                        "{selectedClient.bio}"
                      </p>
                      <div className="mt-6 sm:mt-8 pt-6 sm:pt-8 border-t border-primary/20 space-y-3 sm:space-y-4">
                        <div className="flex items-center gap-3">
                           <span className="size-2 bg-teal-400 rounded-full animate-ping" />
                           <p className="text-[10px] font-black text-teal-400 uppercase tracking-widest">Efficiency Optimized</p>
                        </div>
                        <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">Current biomechanical shift suggests increasing eccentric duration to 4.0s for Alex.</p>
                      </div>
                   </div>

                   <Magnetic strength={0.2}>
                      <button className="w-full bg-white text-background font-black py-4 sm:py-6 rounded-xl sm:rounded-[2rem] text-lg sm:text-xl shadow-2xl hover:bg-primary hover:text-white transition-all">
                         Update Training Logic
                      </button>
                   </Magnetic>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};
