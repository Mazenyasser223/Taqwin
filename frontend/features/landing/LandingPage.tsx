
import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { GymScene } from '../../3d/GymScene';
import { motion } from 'framer-motion';
import { useConfigStore } from '../../store/useConfigStore';
import { 
  buttonPress, 
  useMotionPrefs, 
  staggerContainer, 
  maskRevealVariants,
  contentRevealVariants,
  weightedTransition 
} from '../../lib/motion';
import { Logo } from '../../components/shared/Logo';
import { Magnetic, TiltCard } from '../../components/shared/MotionWrappers';

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const { performanceMode, setPerformanceMode } = useConfigStore();
  const { shouldSimplify } = useMotionPrefs();

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="h-screen overflow-y-auto bg-background relative flex flex-col custom-scrollbar scroll-smooth">
      <div className="fixed inset-0 z-0 overflow-hidden">
        <GymScene staticFallback={
          <div className="absolute inset-0 flex items-center justify-center bg-background">
            <Logo size="xl" />
          </div>
        } />
        <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-transparent to-background/80 pointer-events-none" />
      </div>

      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-8 py-8 max-w-7xl mx-auto w-full pointer-events-none">
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="pointer-events-auto"
        >
          <Link to="/" className="hover:opacity-80 transition-opacity">
            <Logo showText />
          </Link>
        </motion.div>
        
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center gap-4 md:gap-8 pointer-events-auto"
        >
          <div className="hidden lg:flex items-center gap-8 mr-8">
            <button onClick={() => scrollToSection('how-it-works')} className="text-xs font-black uppercase tracking-[0.3em] text-slate-400 hover:text-primary transition-colors">How it works</button>
            <Link to="/auth" className="text-xs font-black uppercase tracking-[0.3em] text-slate-400 hover:text-primary transition-colors">Sign In</Link>
          </div>
          
          <button 
            onClick={() => setPerformanceMode(!performanceMode)}
            className="hidden md:flex items-center gap-2 text-[10px] font-black text-slate-300 hover:text-white transition-colors glass px-4 py-2 rounded-xl uppercase tracking-widest border border-white/5"
          >
            <span className="material-symbols-outlined text-[18px]">
              {performanceMode ? 'speed' : 'diamond'}
            </span>
            {performanceMode ? 'Fast' : 'HQ'}
          </button>

          <motion.button 
            variants={buttonPress}
            whileHover="hover"
            whileTap="tap"
            onClick={() => navigate('/auth')}
            className="bg-primary hover:brightness-110 text-white text-xs font-black uppercase tracking-[0.2em] px-8 py-3.5 rounded-2xl shadow-2xl shadow-primary/40 transition-all border border-primary/20"
          >
            Get Started
          </motion.button>
        </motion.div>
      </nav>

      <div className="relative z-10 w-full flex flex-col items-center">
        {/* Hero Section */}
        <section className="min-h-screen flex flex-col items-center justify-center px-6 pt-20">
          <div className="max-w-4xl w-full text-center space-y-10">
            <motion.div 
              variants={staggerContainer(0.2, 0.4)}
              initial="hidden"
              animate="visible"
              className="space-y-6"
            >
              <motion.div variants={contentRevealVariants} className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass border border-primary/30 text-primary text-[10px] font-black uppercase tracking-[0.3em] shadow-xl">
                <span className="material-symbols-outlined text-sm animate-pulse">auto_awesome</span>
                The Future of Fitness
              </motion.div>
              
              <div className="overflow-hidden">
                <motion.h1 
                  variants={maskRevealVariants}
                  className="text-6xl md:text-8xl lg:text-9xl font-black leading-[0.85] tracking-tighter"
                >
                  Train with <br />
                  <span className="text-primary bg-clip-text text-transparent bg-gradient-to-r from-primary via-accent to-orange-400 italic">AI Power</span>
                </motion.h1>
              </div>

              <motion.p variants={contentRevealVariants} className="text-slate-300 text-lg md:text-xl max-w-2xl mx-auto leading-relaxed font-medium">
                Taqwin connects your body data with a smart AI coach to help you reach your goals faster.
              </motion.p>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.2 }}
              className="flex flex-wrap gap-6 justify-center"
            >
              <Magnetic strength={0.3}>
                <motion.button 
                  variants={buttonPress}
                  whileHover="hover"
                  whileTap="tap"
                  onClick={() => navigate('/auth')}
                  className="px-12 py-6 bg-primary text-white font-black rounded-[2rem] shadow-2xl shadow-primary/40 text-xl border border-primary/20"
                >
                  Join Today
                </motion.button>
              </Magnetic>
              <Magnetic strength={0.2}>
                <motion.button 
                  variants={buttonPress}
                  whileHover="hover"
                  whileTap="tap"
                  onClick={() => scrollToSection('how-it-works')}
                  className="px-12 py-6 glass border border-white/10 text-white font-black rounded-[2rem] hover:bg-white/5 transition-all text-xl"
                >
                  See How It Works
                </motion.button>
              </Magnetic>
            </motion.div>

            <motion.div 
              variants={staggerContainer(0.1, 1.4)}
              initial="hidden"
              animate="visible"
              className="pt-24 grid grid-cols-2 md:grid-cols-4 gap-8"
            >
               {[
                 { label: 'Happy Users', value: '10K+' },
                 { label: 'Workouts Logged', value: '250K+' },
                 { label: 'Partner Gyms', value: '500+' },
                 { label: 'Accuracy', value: '99%' },
               ].map((stat) => (
                 <motion.div 
                   key={stat.label}
                   variants={contentRevealVariants}
                   className="glass p-6 rounded-[2rem] border border-white/5"
                 >
                   <p className="text-3xl font-black text-white">{stat.value}</p>
                   <p className="text-[10px] text-primary uppercase font-black tracking-widest mt-2 opacity-70">{stat.label}</p>
                 </motion.div>
               ))}
            </motion.div>
          </div>
        </section>

        {/* How it Works Section */}
        <section id="how-it-works" className="py-40 px-6 w-full max-w-7xl mx-auto space-y-24 relative z-10">
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="text-center space-y-4 mb-20"
          >
             <motion.span variants={contentRevealVariants} className="text-primary font-black uppercase tracking-[0.5em] text-[10px]">Simple Steps</motion.span>
             <motion.h2 variants={maskRevealVariants} className="text-5xl md:text-7xl font-black tracking-tight">Your Path to <br/><span className="italic text-glow">Results</span></motion.h2>
          </motion.div>

          <motion.div 
            variants={staggerContainer(0.2)}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            className="grid grid-cols-1 md:grid-cols-3 gap-12"
          >
            {[
              { 
                step: '01', 
                title: 'Sync Your Data', 
                icon: 'hub', 
                text: 'Connect your watch or phone. We look at your activity, sleep, and heart rate to understand your body.',
                color: 'text-primary'
              },
              { 
                step: '02', 
                title: 'AI Coaching', 
                icon: 'auto_awesome', 
                text: 'Our AI builds a custom workout and meal plan just for you. It changes as you improve.',
                color: 'text-accent'
              },
              { 
                step: '03', 
                title: 'Hit the Gym', 
                icon: 'apartment', 
                text: 'Go to any partner gym and check in automatically. Track your sets and reps without lifting a finger.',
                color: 'text-blue-400'
              }
            ].map((feature, i) => (
              <motion.div 
                key={i}
                variants={contentRevealVariants}
                className="group relative"
              >
                <div className="absolute -top-10 -left-6 text-[120px] font-black text-white/5 select-none pointer-events-none group-hover:text-primary/10 transition-colors">
                  {feature.step}
                </div>
                <TiltCard maxTilt={5}>
                  <div className="glass-panel p-12 rounded-[3.5rem] border border-white/5 hover:border-primary/40 transition-all h-full flex flex-col">
                    <div className={`size-20 rounded-[2rem] bg-white/5 flex items-center justify-center ${feature.color} mb-10 group-hover:scale-110 transition-transform`}>
                      <span className="material-symbols-outlined text-5xl font-black">{feature.icon}</span>
                    </div>
                    <h3 className="text-3xl font-black mb-6">{feature.title}</h3>
                    <p className="text-slate-400 font-medium leading-relaxed text-lg">{feature.text}</p>
                  </div>
                </TiltCard>
              </motion.div>
            ))}
          </motion.div>
        </section>

        <section className="py-40 px-6 w-full max-w-5xl mx-auto text-center space-y-12">
            <motion.h2 
              initial="hidden"
              whileInView="visible"
              variants={maskRevealVariants}
              viewport={{ once: true }}
              className="text-4xl md:text-6xl font-black tracking-tight leading-none"
            >
              Ready to start your <br/> <span className="text-primary italic">transformation?</span>
            </motion.h2>
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              className="flex flex-wrap gap-6 justify-center"
            >
               <motion.button 
                 variants={buttonPress}
                 whileHover="hover"
                 whileTap="tap"
                 onClick={() => navigate('/auth')}
                 className="px-14 py-6 bg-white text-background font-black rounded-[2rem] shadow-2xl text-2xl hover:bg-primary hover:text-white transition-all"
               >
                 Sign Up Now
               </motion.button>
            </motion.div>
        </section>

        <footer className="w-full py-16 px-8 border-t border-white/5 bg-background/60 backdrop-blur-lg">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-12">
            <div className="flex flex-col items-center md:items-start gap-4">
              <div className="flex items-center gap-3">
                <Logo size="sm" />
                <span className="font-bold tracking-tight text-xl">Taqwin Fitness</span>
              </div>
              <p className="text-slate-500 text-sm max-w-xs text-center md:text-left">Making world-class fitness coaching available to everyone.</p>
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-12">
               <div className="space-y-4">
                 <h4 className="text-[10px] font-black uppercase tracking-widest text-primary">Links</h4>
                 <div className="flex flex-col gap-2 text-sm text-slate-400 font-bold">
                   <Link to="/auth" className="hover:text-white transition-colors">Sign In</Link>
                   <Link to="/auth" className="hover:text-white transition-colors">Sign Up</Link>
                   <button onClick={() => scrollToSection('how-it-works')} className="text-left hover:text-white transition-colors">How it Works</button>
                 </div>
               </div>
               <div className="space-y-4">
                 <h4 className="text-[10px] font-black uppercase tracking-widest text-primary">Company</h4>
                 <div className="flex flex-col gap-2 text-sm text-slate-400 font-bold">
                   <a href="#" className="hover:text-white transition-colors">About Us</a>
                   <a href="#" className="hover:text-white transition-colors">Contact</a>
                   <a href="#" className="hover:text-white transition-colors">Careers</a>
                 </div>
               </div>
               <div className="space-y-4 hidden sm:block">
                 <h4 className="text-[10px] font-black uppercase tracking-widest text-primary">Help</h4>
                 <div className="flex flex-col gap-2 text-sm text-slate-400 font-bold">
                   <a href="#" className="hover:text-white transition-colors">Privacy</a>
                   <a href="#" className="hover:text-white transition-colors">Security</a>
                   <a href="#" className="hover:text-white transition-colors">Terms</a>
                 </div>
               </div>
            </div>
          </div>
          <div className="max-w-7xl mx-auto pt-16 mt-16 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-6">
             <p className="text-slate-600 text-[10px] font-black uppercase tracking-widest">© 2024 Taqwin. All Rights Reserved.</p>
             <div className="flex gap-6">
                <a href="#" className="text-slate-500 hover:text-primary transition-colors">
                  <span className="material-symbols-outlined">public</span>
                </a>
                <a href="#" className="text-slate-500 hover:text-primary transition-colors">
                  <span className="material-symbols-outlined">alternate_email</span>
                </a>
             </div>
          </div>
        </footer>
      </div>
    </div>
  );
};
