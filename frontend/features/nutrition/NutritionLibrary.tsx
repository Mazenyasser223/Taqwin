
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform, animate } from 'framer-motion';
import { 
  useMotionPrefs, 
  staggerContainer, 
  itemVariants, 
  buttonPress, 
  weightedTransition,
  snapTransition,
  pulseTransition
} from '../../lib/motion';
import { TiltCard, Magnetic } from '../../components/shared/MotionWrappers';
import { NutritionVisual } from '../../3d/PageSpecificVisuals';

const Counter: React.FC<{ value: number; duration?: number; className?: string }> = ({ value, duration = 2, className = "" }) => {
  const count = useMotionValue(0);
  const rounded = useTransform(count, (latest) => Math.round(latest));
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    const controls = animate(count, value, { duration, ease: "easeOut" });
    const unsubscribe = rounded.on("change", (v) => setDisplayValue(v));
    return () => {
      controls.stop();
      unsubscribe();
    };
  }, [value, duration]);

  return <span className={className}>{displayValue}</span>;
};

const nutritionItems = [
  { id: '1', name: 'Elite Whey Isolate', kcal: 120, p: 25, c: 2, f: 1, cat: 'Supplement', img: 'https://images.unsplash.com/photo-1593094859027-e9623c44810a?q=80&w=400' },
  { id: '2', name: 'Grilled Chicken', kcal: 165, p: 31, c: 0, f: 4, cat: 'Protein', img: 'https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?q=80&w=400' },
  { id: '3', name: 'Organic Quinoa', kcal: 120, p: 4, c: 21, f: 2, cat: 'Carb', img: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?q=80&w=400' },
  { id: '4', name: 'Fresh Avocado', kcal: 240, p: 3, c: 12, f: 22, cat: 'Fat', img: 'https://images.unsplash.com/photo-1523049673857-eb18f1d7b578?q=80&w=400' },
  { id: '5', name: 'Asparagus', kcal: 20, p: 2, c: 4, f: 0, cat: 'Veggie', img: 'https://images.unsplash.com/photo-1515471209610-dae1c92d8ce1?q=80&w=400' },
];

export const NutritionLibrary: React.FC = () => {
  const { shouldSimplify } = useMotionPrefs();
  const [searchQuery, setSearchQuery] = useState('');
  
  const filteredItems = nutritionItems.filter(item => 
    item.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-12 pb-24">
      <div className="flex flex-col md:flex-row justify-between items-end gap-6 relative">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={weightedTransition}
          className="relative z-10"
        >
          <div className="flex items-center gap-3 text-accent mb-3">
            <span className="material-symbols-outlined font-black">restaurant</span>
            <span className="text-[10px] font-black uppercase tracking-[0.4em]">Daily Food Plan</span>
          </div>
          <h1 className="text-5xl font-black tracking-tight text-white leading-none">
            Healthy <span className="text-accent italic">Eating</span>
          </h1>
          <p className="text-slate-400 mt-5 max-w-lg font-medium leading-relaxed">
            Every meal helps you reach your goal. We track your calories and protein to keep you on track.
          </p>
        </motion.div>
        
        <div className="flex gap-4 relative z-10">
          <div className="relative group">
            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">search</span>
            <input 
              type="text"
              placeholder="Search for food..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-2xl pl-12 pr-6 py-4 text-sm w-72 focus:outline-none focus:ring-2 focus:ring-accent/40 transition-all font-bold placeholder:text-slate-600"
            />
          </div>
          <Magnetic strength={0.2}>
            <motion.button 
              variants={buttonPress}
              whileHover="hover"
              whileTap="tap"
              className="bg-accent text-white font-black px-10 py-4 rounded-2xl flex items-center gap-3 shadow-2xl shadow-accent/20 border border-accent/20"
            >
              <span className="material-symbols-outlined font-black">qr_code_scanner</span>
              Log Food
            </motion.button>
          </Magnetic>
        </div>

        <div className="absolute -top-16 right-0 w-80 h-80 pointer-events-none opacity-40">
           <NutritionVisual />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 relative z-10">
        <div className="lg:col-span-8 space-y-6">
          <div className="flex items-center justify-between px-4">
             <h3 className="text-xs font-black uppercase tracking-[0.3em] text-slate-500">Food List</h3>
          </div>

          <motion.div 
            layout
            variants={staggerContainer(0.05)}
            initial="hidden"
            animate="visible"
            className="space-y-4"
          >
            <AnimatePresence mode="popLayout">
              {filteredItems.map(item => (
                <motion.div 
                  layout
                  key={item.id} 
                  initial={{ opacity: 0, x: -20, scale: 0.98 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={snapTransition}
                  className="glass-panel p-6 rounded-[2.5rem] flex flex-col md:flex-row items-center gap-8 hover:border-accent/40 transition-all group cursor-pointer relative overflow-hidden"
                >
                  <div className="size-24 rounded-3xl overflow-hidden shadow-2xl border border-white/5 flex-shrink-0 group-hover:scale-105 transition-transform duration-500">
                    <img src={item.img} className="w-full h-full object-cover" alt={item.name} />
                  </div>

                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-accent/80 bg-accent/5 px-3 py-1 rounded-full border border-accent/10">
                        {item.cat}
                      </span>
                    </div>
                    <h4 className="text-2xl font-black group-hover:text-accent transition-colors tracking-tight">{item.name}</h4>
                  </div>

                  <div className="flex gap-4 items-center bg-white/5 p-4 rounded-3xl border border-white/5 group-hover:bg-white/10 transition-all">
                    {[
                      { label: 'Prot', val: item.p, color: 'text-primary' },
                      { label: 'Carb', val: item.c, color: 'text-blue-400' },
                      { label: 'Fat', val: item.f, color: 'text-accent' },
                    ].map((macro) => (
                      <div key={macro.label} className="text-center min-w-[75px] border-r last:border-0 border-white/5 pr-4 last:pr-0">
                        <p className={`text-xl font-black ${macro.color}`}>
                          <Counter value={macro.val} duration={1.5} />g
                        </p>
                        <p className="text-[9px] font-black uppercase tracking-tighter text-slate-500 mt-1">{macro.label}</p>
                      </div>
                    ))}
                    <div className="pl-6 text-center">
                       <p className="text-xl font-black text-white">
                         <Counter value={item.kcal} duration={2} />
                       </p>
                       <p className="text-[9px] font-black uppercase tracking-tighter text-slate-500 mt-1">CAL</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        </div>

        <div className="lg:col-span-4 space-y-8">
           <TiltCard maxTilt={3}>
              <motion.div 
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...weightedTransition, delay: 0.3 }}
                className="glass-panel p-12 rounded-[4rem] text-center space-y-10 relative overflow-hidden border-accent/20"
              >
                 <div className="relative size-60 mx-auto">
                    <div className="absolute inset-4 border-[14px] border-white/5 border-t-accent rounded-full flex items-center justify-center shadow-2xl">
                       <div className="relative z-10">
                          <motion.div 
                            animate={!shouldSimplify ? pulseTransition : {}}
                            className="text-5xl font-black tracking-tighter"
                          >
                            <Counter value={1820} duration={3} />
                          </motion.div>
                          <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.3em] mt-2">Calories Left</p>
                       </div>
                    </div>
                 </div>
                 
                 <div className="space-y-6 pt-4">
                   <h4 className="text-xs font-black uppercase tracking-[0.4em] text-accent">Coach Advice</h4>
                   <p className="text-lg font-bold text-slate-300 leading-relaxed italic">
                     "You finished your workout! Make sure to eat some <span className="text-white border-b border-accent/40">Protein</span> now to help your muscles."
                   </p>
                 </div>

                 <Magnetic strength={0.3}>
                   <motion.button 
                     variants={buttonPress}
                     whileHover="hover"
                     whileTap="tap"
                     className="w-full py-6 bg-white text-background font-black rounded-[2rem] shadow-2xl hover:bg-slate-100 transition-all text-xl"
                   >
                     View Daily Summary
                   </motion.button>
                 </Magnetic>
              </motion.div>
           </TiltCard>
        </div>
      </div>
    </div>
  );
};
