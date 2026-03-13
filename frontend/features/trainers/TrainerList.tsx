
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMotionPrefs, staggerContainer, itemVariants, buttonPress, snapTransition, weightedTransition } from '../../lib/motion';
import { TiltCard, Magnetic } from '../../components/shared/MotionWrappers';
import { TrainersVisual } from '../../3d/PageSpecificVisuals';

const trainers = [
  { id: '1', name: 'Dr. Elena Vance', bio: 'Expert in muscle growth and health with 12+ years of coaching.', exp: '12y', rating: 4.9, img: 'https://i.pravatar.cc/150?u=elena', tags: ['Strength', 'Science'], availability: 'Online', details: 'Focused on helping people build muscle safely and effectively.' },
  { id: '2', name: 'Marcus Aurelius', bio: 'High-performance coach focusing on strength and conditioning.', exp: '8y', rating: 4.8, img: 'https://i.pravatar.cc/150?u=marcus', tags: ['Strength', 'Conditioning'], availability: 'In Gym', details: 'Helps athletes reach their peak physical performance.' },
  { id: '3', name: 'Sasha Grey', bio: 'Recovery and mobility coach. Helping you stay flexible and pain-free.', exp: '6y', rating: 5.0, img: 'https://i.pravatar.cc/150?u=sasha', tags: ['Mobility', 'Recovery'], availability: 'Online', details: 'Expert in stretching and fixing tight muscles.' },
];

export const TrainerList: React.FC = () => {
  const { shouldSimplify } = useMotionPrefs();
  const [search, setSearch] = useState('');
  const [selectedTrainer, setSelectedTrainer] = useState<typeof trainers[0] | null>(null);

  const filteredTrainers = trainers.filter(t => t.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-12 pb-24 relative overflow-x-hidden lg:overflow-visible">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 relative px-1">
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={weightedTransition}
          className="relative z-10 max-w-2xl"
        >
          <div className="flex items-center gap-3 text-primary mb-2">
            <span className="material-symbols-outlined font-black">person_search</span>
            <span className="text-[10px] font-black uppercase tracking-[0.3em]">Find an Expert</span>
          </div>
          <h1 className="text-5xl lg:text-6xl font-black tracking-tight text-white drop-shadow-2xl">
            Pro <span className="text-primary italic">Coaches</span>
          </h1>
          <p className="text-slate-400 mt-4 font-medium leading-relaxed">
            Connect with real human experts who use your data to help you win.
          </p>
        </motion.div>
        
        <div className="relative z-10 w-full md:w-80">
          <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">search</span>
          <input 
            type="text"
            placeholder="Search coaches..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-6 py-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all font-bold"
          />
        </div>

        <div className="hidden sm:block absolute -top-16 -right-16 w-80 h-80 pointer-events-none opacity-40">
           <TrainersVisual />
        </div>
      </div>

      <motion.div 
        variants={staggerContainer(0.08)}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 relative z-10"
      >
        <AnimatePresence mode="popLayout">
          {filteredTrainers.map((trainer) => (
            <motion.div layout key={trainer.id} variants={itemVariants}>
              <TiltCard maxTilt={5}>
                <div 
                  onClick={() => setSelectedTrainer(trainer)}
                  className="glass-panel p-8 rounded-[3rem] border border-white/5 group hover:border-primary/40 transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-6 mb-8">
                    <div className="size-20 rounded-[2rem] border-2 border-primary/20 p-1 bg-surface relative">
                      <img src={trainer.img} className="size-full rounded-[1.8rem] object-cover" alt={trainer.name} />
                      <div className="absolute -bottom-1 -right-1 size-6 bg-teal-400 border-4 border-surface rounded-full" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-black leading-none mb-2">{trainer.name}</h3>
                      <div className="flex items-center gap-2 text-slate-500 font-black text-[10px] uppercase tracking-widest">
                        <span className="text-primary">{trainer.exp} Experience</span>
                        <span className="size-1 bg-slate-700 rounded-full" />
                        <div className="flex items-center text-accent">
                          <span className="material-symbols-outlined text-xs">star</span>
                          {trainer.rating}
                        </div>
                      </div>
                    </div>
                  </div>

                  <p className="text-slate-400 font-medium mb-8 leading-relaxed">"{trainer.bio}"</p>

                  <div className="flex flex-wrap gap-2 mb-8">
                    {trainer.tags.map(tag => (
                      <span key={tag} className="px-3 py-1 bg-primary/10 border border-primary/20 rounded-full text-[9px] font-black text-primary uppercase tracking-widest">
                        {tag}
                      </span>
                    ))}
                  </div>

                  <div className="pt-6 border-t border-white/5 flex items-center justify-between">
                    <div className="text-[10px] font-black uppercase text-slate-500 tracking-widest">
                      Status: <span className="text-white">{trainer.availability}</span>
                    </div>
                    <Magnetic strength={0.2}>
                      <motion.button 
                        variants={buttonPress}
                        whileHover="hover"
                        whileTap="tap"
                        className="bg-primary text-white font-black px-6 py-3 rounded-xl shadow-lg shadow-primary/30"
                      >
                        Book Now
                      </motion.button>
                    </Magnetic>
                  </div>
                </div>
              </TiltCard>
            </motion.div>
          ))}
        </AnimatePresence>
      </motion.div>

      {/* Trainer Detail Drawer */}
      <AnimatePresence>
        {selectedTrainer && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedTrainer(null)}
              className="fixed inset-0 bg-background/60 backdrop-blur-sm z-[130]"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={weightedTransition}
              className="fixed right-0 top-0 h-full w-full max-w-xl glass-panel z-[140] p-12 flex flex-col shadow-2xl border-l border-white/10"
            >
              <button 
                onClick={() => setSelectedTrainer(null)}
                className="absolute top-10 right-10 size-12 flex items-center justify-center rounded-2xl bg-white/5 hover:bg-white/10"
              >
                <span className="material-symbols-outlined">close</span>
              </button>

              <div className="flex-1 overflow-y-auto no-scrollbar pt-10">
                <div className="size-48 rounded-[3rem] overflow-hidden mb-10 border-4 border-primary/20 p-2 bg-surface mx-auto">
                  <img src={selectedTrainer.img} className="size-full object-cover rounded-[2.5rem]" alt={selectedTrainer.name} />
                </div>
                
                <div className="space-y-10">
                  <div className="text-center">
                    <span className="text-primary font-black uppercase tracking-[0.4em] text-xs">Verified Expert</span>
                    <h2 className="text-5xl font-black tracking-tighter mt-2">{selectedTrainer.name}</h2>
                    <div className="flex items-center justify-center gap-4 mt-6">
                       {selectedTrainer.tags.map(t => (
                         <span key={t} className="px-4 py-1.5 bg-white/5 border border-white/10 rounded-full text-[10px] font-black uppercase tracking-widest text-slate-300">
                           {t}
                         </span>
                       ))}
                    </div>
                  </div>

                  <div className="p-8 bg-white/5 rounded-[2.5rem] border border-white/5 space-y-6">
                    <h4 className="text-xs font-black uppercase tracking-widest text-primary">About Coach</h4>
                    <p className="text-lg text-slate-300 font-medium italic leading-relaxed">
                      "{selectedTrainer.details}"
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div className="glass p-6 rounded-3xl text-center">
                       <p className="text-3xl font-black text-white">{selectedTrainer.rating}</p>
                       <p className="text-[9px] font-black uppercase text-slate-500 mt-2">Coach Rating</p>
                    </div>
                    <div className="glass p-6 rounded-3xl text-center">
                       <p className="text-3xl font-black text-white">{selectedTrainer.exp}</p>
                       <p className="text-[9px] font-black uppercase text-slate-500 mt-2">Years Active</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-12">
                 <Magnetic strength={0.3}>
                   <motion.button
                     variants={buttonPress}
                     whileHover="hover"
                     whileTap="tap"
                     className="w-full bg-primary text-white font-black py-6 rounded-[2rem] text-xl shadow-2xl flex items-center justify-center gap-4"
                   >
                     Talk to Coach
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
