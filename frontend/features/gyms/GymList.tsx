
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMotionPrefs, staggerContainer, itemVariants, buttonPress, weightedTransition } from '../../lib/motion';
import { TiltCard, Magnetic } from '../../components/shared/MotionWrappers';
import { GymsVisual } from '../../3d/PageSpecificVisuals';
import { useNotificationStore } from '../../store/useNotificationStore';

const gyms = [
  { id: '1', name: 'Downtown Gym', location: 'Center City', cap: 42, max: 100, status: 'Good', img: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?q=80&w=600', amenities: ['Free Weights', 'Pool', 'Auto Check-in'], bio: 'A friendly community gym with everything you need.' },
  { id: '2', name: 'Nexus Fitness', location: 'Tech Park', cap: 88, max: 120, status: 'Busy', img: 'https://images.unsplash.com/photo-1540497077202-7c8a3999166f?q=80&w=600', amenities: ['Cardio Zone', 'Sauna', 'Smart Lockers'], bio: 'Modern fitness center with high-tech equipment.' },
  { id: '3', name: 'West End HQ', location: 'West End', cap: 12, max: 50, status: 'Quiet', img: 'https://images.unsplash.com/photo-1571902943202-507ec2618e8f?q=80&w=600', amenities: ['Yoga Studio', 'Cafe'], bio: 'A small, quiet gym for focused workouts.' },
];

export const GymList: React.FC = () => {
  const { shouldSimplify } = useMotionPrefs();
  const [selectedGym, setSelectedGym] = useState<typeof gyms[0] | null>(null);
  const [checkInSuccess, setCheckInSuccess] = useState<string | null>(null);
  const { addNotification } = useNotificationStore();

  const handleCheckIn = (gym: typeof gyms[0]) => {
    setCheckInSuccess(gym.name);
    addNotification({
      title: 'Checked In!',
      message: `You are now checked into ${gym.name}. Enjoy your workout!`,
      type: 'update'
    });
    setTimeout(() => setCheckInSuccess(null), 3000);
  };

  return (
    <div className="space-y-12 pb-24 relative">
      <div className="flex justify-between items-end relative">
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={weightedTransition}
          className="relative z-10"
        >
          <div className="flex items-center gap-3 text-primary mb-2">
            <span className="material-symbols-outlined font-black">apartment</span>
            <span className="text-[10px] font-black uppercase tracking-[0.3em]">Partner Gyms</span>
          </div>
          <h1 className="text-5xl font-black tracking-tight text-white drop-shadow-2xl">
            Where to <span className="text-primary italic">Train</span>
          </h1>
          <p className="text-slate-400 mt-4 max-w-lg font-medium">
            Find and check into partner gyms. See how busy they are in real-time before you leave home.
          </p>
        </motion.div>
        
        <div className="absolute -top-16 -right-16 w-80 h-80 pointer-events-none opacity-40">
           <GymsVisual />
        </div>
      </div>

      <motion.div 
        variants={staggerContainer(0.08)}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10"
      >
        {gyms.map((gym) => (
          <TiltCard key={gym.id} maxTilt={4}>
            <div className="glass-panel rounded-[3rem] overflow-hidden group hover:border-primary/50 transition-all border border-white/5">
              <div className="h-56 relative overflow-hidden bg-black/40">
                <img src={gym.img} className="size-full object-cover opacity-60 group-hover:opacity-100 transition-all duration-700" alt={gym.name} />
                <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
                <div className="absolute top-6 left-6">
                  <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest backdrop-blur-xl border border-white/10 ${
                    gym.status === 'Good' ? 'bg-teal-500/20 text-teal-400' : gym.status === 'Busy' ? 'bg-accent/20 text-accent' : 'bg-blue-500/20 text-blue-400'
                  }`}>
                    {gym.status}
                  </span>
                </div>
              </div>

              <div className="p-10 space-y-8">
                <div>
                  <h3 className="text-3xl font-black mb-2 group-hover:text-primary transition-colors">{gym.name}</h3>
                  <p className="text-slate-500 font-bold flex items-center gap-2">
                    <span className="material-symbols-outlined text-sm">location_on</span>
                    {gym.location}
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-slate-500">
                    <span>Current Crowd</span>
                    <span>{gym.cap} / {gym.max} People</span>
                  </div>
                  <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${(gym.cap / gym.max) * 100}%` }}
                      transition={{ duration: 1.5, ease: "circOut" }}
                      className={`h-full rounded-full ${gym.status === 'Good' ? 'bg-teal-400' : 'bg-accent'}`}
                    />
                  </div>
                </div>

                <div className="flex gap-4">
                   <Magnetic strength={0.3} className="flex-1">
                    <motion.button 
                      variants={buttonPress}
                      whileHover="hover"
                      whileTap="tap"
                      onClick={() => handleCheckIn(gym)}
                      className="w-full bg-white text-background font-black py-5 rounded-2xl shadow-2xl hover:bg-primary hover:text-white transition-all"
                    >
                      Check In
                    </motion.button>
                  </Magnetic>
                  <Magnetic strength={0.5}>
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      className="size-14 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center text-slate-400 hover:text-white transition-all"
                      onClick={() => setSelectedGym(gym)}
                    >
                      <span className="material-symbols-outlined">info</span>
                    </motion.button>
                  </Magnetic>
                </div>
              </div>
            </div>
          </TiltCard>
        ))}
      </motion.div>

      {/* Success Overlay */}
      <AnimatePresence>
        {checkInSuccess && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="fixed inset-0 z-[200] flex items-center justify-center pointer-events-none"
          >
            <div className="bg-primary/90 backdrop-blur-3xl p-12 rounded-[4rem] text-center shadow-[0_50px_100px_rgba(21,139,141,0.5)] border border-primary/40">
               <motion.div 
                 initial={{ rotate: -90 }}
                 animate={{ rotate: 0 }}
                 className="size-24 bg-white rounded-full flex items-center justify-center text-primary mx-auto mb-8"
               >
                 <span className="material-symbols-outlined text-6xl font-black">verified</span>
               </motion.div>
               <h2 className="text-4xl font-black text-white mb-2 tracking-tighter">Check-In Done!</h2>
               <p className="text-white/80 font-bold uppercase tracking-widest text-sm">Welcome to {checkInSuccess}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Details Drawer */}
      <AnimatePresence>
        {selectedGym && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedGym(null)}
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
                onClick={() => setSelectedGym(null)}
                className="absolute top-10 right-10 size-12 flex items-center justify-center rounded-2xl bg-white/5 hover:bg-white/10"
              >
                <span className="material-symbols-outlined">close</span>
              </button>

              <div className="flex-1 overflow-y-auto no-scrollbar pt-10">
                <div className="aspect-video rounded-[2.5rem] overflow-hidden mb-10 border border-white/10">
                  <img src={selectedGym.img} className="size-full object-cover" alt={selectedGym.name} />
                </div>
                
                <div className="space-y-10">
                  <div>
                    <span className="text-primary font-black uppercase tracking-[0.4em] text-xs">Gym Details</span>
                    <h2 className="text-5xl font-black tracking-tighter mt-2">{selectedGym.name}</h2>
                    <p className="text-slate-500 font-bold mt-4 flex items-center gap-2">
                      <span className="material-symbols-outlined">location_on</span>
                      {selectedGym.location}
                    </p>
                  </div>

                  <div className="p-8 bg-white/5 rounded-[2.5rem] border border-white/5">
                    <h4 className="text-xs font-black uppercase tracking-widest text-primary mb-6">What's Inside</h4>
                    <div className="grid grid-cols-2 gap-4">
                       {selectedGym.amenities.map(a => (
                         <div key={a} className="flex items-center gap-3 p-3 bg-background/50 rounded-xl border border-white/5">
                            <span className="material-symbols-outlined text-primary text-sm">verified</span>
                            <span className="text-xs font-bold text-slate-300">{a}</span>
                         </div>
                       ))}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="text-xs font-black uppercase tracking-widest text-primary">About this Gym</h4>
                    <p className="text-lg text-slate-300 font-medium italic leading-relaxed">
                      "{selectedGym.bio}"
                    </p>
                  </div>
                </div>
              </div>

              <div className="pt-12">
                 <Magnetic strength={0.3}>
                   <motion.button
                     variants={buttonPress}
                     whileHover="hover"
                     whileTap="tap"
                     onClick={() => { handleCheckIn(selectedGym); setSelectedGym(null); }}
                     className="w-full bg-primary text-white font-black py-6 rounded-[2rem] text-xl shadow-2xl flex items-center justify-center gap-4"
                   >
                     Go to Gym
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
