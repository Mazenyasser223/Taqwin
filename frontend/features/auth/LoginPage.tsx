
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/useAuthStore';
import { UserRole } from '../../types';
import { motion } from 'framer-motion';
import { GymScene } from '../../3d/GymScene';
import { Logo } from '../../components/shared/Logo';

export const LoginPage: React.FC = () => {
  const { login } = useAuthStore();
  const navigate = useNavigate();

  const handleLogin = (role: UserRole) => {
    login(role);
    navigate('/dashboard');
  };

  const roles = [
    {
      role: UserRole.ATHLETE,
      title: 'I am an Athlete',
      desc: 'Track workouts, get AI coaching, and analyze progress.',
      icon: 'person_play',
      color: 'bg-primary'
    },
    {
      role: UserRole.TRAINER,
      title: 'I am a Trainer',
      desc: 'Manage clients, build plans, and scale your coaching business.',
      icon: 'fitness_center',
      color: 'bg-emerald-600'
    },
    {
      role: UserRole.GYM_OWNER,
      title: 'I am a Gym Owner',
      desc: 'Manage operations, staff, and enterprise-level analytics.',
      icon: 'apartment',
      color: 'bg-accent'
    }
  ];

  return (
    <div className="h-screen w-full bg-background flex flex-col items-center relative custom-scrollbar overflow-y-auto overflow-x-hidden p-6">
      {/* Immersive Background - Fixed */}
      <div className="fixed inset-0 z-0 opacity-50 pointer-events-none">
        <GymScene />
      </div>
      <div className="fixed inset-0 z-0 bg-gradient-to-b from-background/20 via-background/60 to-background pointer-events-none" />

      <div className="max-w-4xl w-full text-center space-y-12 relative z-10 py-20 my-auto">
        <div className="space-y-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mb-8 flex justify-center"
          >
             <Logo size="xl" />
          </motion.div>
          <h1 className="text-4xl font-black tracking-tight">Join the Ecosystem</h1>
          <p className="text-slate-300 max-w-md mx-auto font-medium">Choose your workspace to start training or managing your business.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {roles.map((item, i) => (
            <motion.button
              key={item.role}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              whileHover={{ y: -8, scale: 1.02 }}
              onClick={() => handleLogin(item.role)}
              className="glass-panel p-8 rounded-[2rem] text-left flex flex-col gap-6 hover:border-primary/50 transition-all group shadow-2xl backdrop-blur-2xl h-full"
            >
              <div className={`size-14 ${item.color} rounded-2xl flex items-center justify-center text-white shadow-xl`}>
                <span className="material-symbols-outlined text-3xl">{item.icon}</span>
              </div>
              <div>
                <h3 className="text-xl font-bold mb-2 group-hover:text-primary transition-colors">{item.title}</h3>
                <p className="text-sm text-slate-400 leading-relaxed font-medium">{item.desc}</p>
              </div>
              <div className="mt-auto pt-4 flex items-center gap-2 text-primary font-bold text-sm">
                 Select Role <span className="material-symbols-outlined text-sm">arrow_forward</span>
              </div>
            </motion.button>
          ))}
        </div>

        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="text-slate-500 text-sm font-bold"
        >
          New to Taqwin? <button className="text-primary font-bold hover:underline">Create an account</button>
        </motion.p>
      </div>
    </div>
  );
};
