
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  useMotionPrefs, 
  staggerContainer, 
  itemVariants, 
  buttonPress, 
  weightedTransition,
  liftVariants 
} from '../../lib/motion';
import { TiltCard, Magnetic } from '../../components/shared/MotionWrappers';
import { WorkoutsVisual } from '../../3d/PageSpecificVisuals';

const categories = ['All', 'Strength', 'Yoga', 'Cardio', 'Recovery'];

const workouts = [
  { id: '1', title: 'Strength Training 101', cat: 'Strength', diff: 'Intermediate', time: 45, kcal: 420, img: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?q=80&w=600', description: 'A great workout focused on building muscle and improving your power.' },
  { id: '2', title: 'Daily Flow', cat: 'Yoga', diff: 'Beginner', time: 30, kcal: 180, img: 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?q=80&w=600', description: 'Simple yoga moves to help you relax and stay flexible.' },
  { id: '3', title: 'Advanced Lifting', cat: 'Strength', diff: 'Advanced', time: 65, kcal: 520, img: 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?q=80&w=600', description: 'A tough workout for those looking to build maximum strength.' },
  { id: '4', title: 'High Energy Cardio', cat: 'Cardio', diff: 'Intermediate', time: 20, kcal: 350, img: 'https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5?q=80&w=600', description: 'Get your heart pumping and burn fat fast with this short workout.' },
  { id: '5', title: 'Rest & Recover', cat: 'Recovery', diff: 'Beginner', time: 15, kcal: 50, img: 'https://images.unsplash.com/photo-1544126592-807daf21565c?q=80&w=600', description: 'Easy stretching to help your muscles heal after a hard training session.' },
];

export const WorkoutLibrary: React.FC = () => {
  const { shouldSimplify } = useMotionPrefs();
  const [activeFilter, setActiveFilter] = useState('All');
  const [selectedWorkout, setSelectedWorkout] = useState<typeof workouts[0] | null>(null);

  const filteredWorkouts = workouts.filter(w => activeFilter === 'All' || w.cat === activeFilter);

  return (
    <div className="space-y-12 pb-24 relative min-h-screen">
      <div className="flex flex-col md:flex-row justify-between items-end gap-6 relative">
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={weightedTransition}
          className="relative z-10"
        >
          <div className="flex items-center gap-3 text-primary mb-2">
            <span className="material-symbols-outlined font-black">fitness_center</span>
            <span className="text-[10px] font-black uppercase tracking-[0.3em]">Workout Area</span>
          </div>
          <h1 className="text-5xl font-black tracking-tight text-white drop-shadow-2xl">
            Choose Your <span className="text-primary italic">Plan</span>
          </h1>
          <p className="text-slate-400 mt-4 max-w-lg font-medium">
            Find the perfect workout for today. All plans are chosen based on how you feel.
          </p>
        </motion.div>
        
        <div className="flex gap-4 relative z-10">
          <Magnetic strength={0.2}>
            <motion.button 
              variants={buttonPress}
              whileHover="hover"
              whileTap="tap"
              className="bg-primary text-white font-black px-10 py-5 rounded-[2rem] flex items-center gap-3 shadow-2xl shadow-primary/30 border border-primary/20"
            >
              <span className="material-symbols-outlined font-black">add_task</span>
              Custom Plan
            </motion.button>
          </Magnetic>
        </div>

        <div className="absolute -top-16 -right-16 w-80 h-80 pointer-events-none opacity-60">
           <WorkoutsVisual />
        </div>
      </div>

      <div className="flex flex-wrap gap-3 relative z-10">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveFilter(cat)}
            className={`relative px-8 py-3.5 rounded-2xl text-xs font-black uppercase tracking-widest transition-colors duration-300 ${
              activeFilter === cat ? 'text-white' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            {activeFilter === cat && (
              <motion.div
                layoutId="filter-pill"
                className="absolute inset-0 bg-white/10 border border-white/10 rounded-2xl -z-10"
                transition={weightedTransition}
              />
            )}
            {cat}
          </button>
        ))}
      </div>

      <motion.div 
        layout
        variants={staggerContainer(0.08)}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-8 relative z-10"
      >
        <AnimatePresence mode="popLayout">
          {filteredWorkouts.map((workout) => (
            <motion.div
              layout
              key={workout.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={weightedTransition}
            >
              <Magnetic strength={0.15}>
                <TiltCard maxTilt={5}>
                  <motion.div
                    variants={liftVariants}
                    whileHover="hover"
                    whileTap="tap"
                    onClick={() => setSelectedWorkout(workout)}
                    className="glass-panel rounded-[2.5rem] overflow-hidden group hover:border-primary/50 transition-all cursor-pointer flex flex-col h-full"
                  >
                    <div className="h-60 relative overflow-hidden bg-black/40">
                      <motion.img 
                        src={workout.img} 
                        className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-all duration-700" 
                        alt={workout.title} 
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-background/90 to-transparent" />
                      <div className="absolute top-6 left-6">
                        <span className="bg-primary/20 backdrop-blur-xl border border-primary/30 px-5 py-2 rounded-full text-[9px] font-black uppercase tracking-widest text-primary">
                          {workout.cat}
                        </span>
                      </div>
                    </div>
                    
                    <div className="p-8 flex flex-col flex-1 gap-6 relative">
                      <div>
                        <h3 className="text-2xl font-black group-hover:text-primary transition-colors leading-tight tracking-tight">
                          {workout.title}
                        </h3>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.2em] mt-3 flex items-center gap-2">
                          <span className="size-1.5 rounded-full bg-primary" />
                          {workout.diff} level
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-6 py-5 border-y border-white/5">
                        <div className="space-y-1">
                          <p className="text-lg font-black text-white">{workout.time}m</p>
                          <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest">Time</p>
                        </div>
                        <div className="space-y-1 pl-6 border-l border-white/5">
                          <p className="text-lg font-black text-white">{workout.kcal}</p>
                          <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest">Calories</p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between mt-auto group/btn">
                        <span className="text-xs font-black uppercase tracking-widest text-slate-400 group-hover/btn:text-primary transition-colors">See Details</span>
                        <div className="size-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center group-hover:bg-primary group-hover:text-white group-hover:scale-110 transition-all">
                          <span className="material-symbols-outlined font-black">trending_flat</span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                </TiltCard>
              </Magnetic>
            </motion.div>
          ))}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};
