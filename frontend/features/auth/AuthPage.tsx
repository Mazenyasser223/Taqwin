
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { GymScene } from '../../3d/GymScene';
import { Logo } from '../../components/shared/Logo';
import { buttonPress, weightedTransition } from '../../lib/motion';
import { Magnetic } from '../../components/shared/MotionWrappers';
import { useAuthStore } from '../../store/useAuthStore';
import type { UserRole } from '../../types';

export const AuthPage: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [showRoleSelect, setShowRoleSelect] = useState(false);
  const [showEmailVerification, setShowEmailVerification] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [selectedRole, setSelectedRole] = useState<UserRole>('athlete');
  
  const navigate = useNavigate();
  const { login, register, verifyEmail, resendVerification, isLoading, error, clearError } = useAuthStore();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    
    const result = await login({ email, password });
    
    if (result.success && result.requiresVerification) {
      setShowEmailVerification(true);
    } else if (result.success) {
      navigate('/dashboard');
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    
    if (!showRoleSelect) {
      // First step: show role selection
      setShowRoleSelect(true);
      return;
    }
    
    // Second step: register with role
    const result = await register({ email, password, role: selectedRole });
    
    if (result.success) {
      setShowEmailVerification(true);
    }
  };

  const handleVerifyEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    
    const result = await verifyEmail({ email, code: verificationCode });
    
    if (result.success) {
      navigate('/dashboard');
    }
  };

  const handleResendCode = async () => {
    clearError();
    await resendVerification(email);
  };

  const handleAuth = isLogin ? handleLogin : handleSignup;

  // Role selection view during signup
  if (showRoleSelect && !isLogin) {
    const roles = [
      {
        role: 'athlete' as UserRole,
        title: 'Athlete',
        desc: 'Track workouts & get AI coaching',
        icon: 'person_play',
        color: 'bg-primary'
      },
      {
        role: 'trainer' as UserRole,
        title: 'Trainer',
        desc: 'Manage clients & build plans',
        icon: 'fitness_center',
        color: 'bg-emerald-600'
      },
      {
        role: 'gym' as UserRole,
        title: 'Gym Owner',
        desc: 'Manage operations & staff',
        icon: 'apartment',
        color: 'bg-accent'
      }
    ];

    return (
      <div className="h-screen w-full flex flex-col items-center relative overflow-y-auto overflow-x-hidden bg-background custom-scrollbar p-6">
        <div className="fixed inset-0 z-0 opacity-40 pointer-events-none">
          <GymScene />
        </div>
        
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-2xl relative z-10 my-auto"
        >
          <div className="text-center mb-8">
            <Logo size="md" className="mb-4 mx-auto" />
            <h2 className="text-3xl font-black tracking-tight text-white">Select Your Role</h2>
            <p className="text-slate-500 text-sm mt-2">Choose how you'll use Taqwin</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {roles.map((item) => (
              <button
                key={item.role}
                onClick={() => setSelectedRole(item.role)}
                className={`glass-panel p-6 rounded-2xl text-left flex flex-col gap-4 transition-all ${
                  selectedRole === item.role ? 'border-primary bg-primary/10' : 'border-white/10 hover:border-white/20'
                }`}
              >
                <div className={`size-12 ${item.color} rounded-xl flex items-center justify-center text-white`}>
                  <span className="material-symbols-outlined text-2xl">{item.icon}</span>
                </div>
                <div>
                  <h3 className="font-bold mb-1">{item.title}</h3>
                  <p className="text-xs text-slate-400">{item.desc}</p>
                </div>
              </button>
            ))}
          </div>

          {error && (
            <div className="mb-4 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
              {error}
            </div>
          )}

          <div className="flex gap-4">
            <button
              onClick={() => setShowRoleSelect(false)}
              className="flex-1 bg-white/5 border border-white/10 text-white font-bold py-4 rounded-xl hover:bg-white/10 transition-all"
            >
              Back
            </button>
            <motion.button
              variants={buttonPress}
              whileHover="hover"
              whileTap="tap"
              onClick={handleSignup}
              disabled={isLoading}
              className="flex-1 bg-primary text-white font-bold py-4 rounded-xl shadow-lg disabled:opacity-50"
            >
              {isLoading ? 'Creating Account...' : 'Continue'}
            </motion.button>
          </div>
        </motion.div>
      </div>
    );
  }

  // Email verification view
  if (showEmailVerification) {
    return (
      <div className="h-screen w-full flex flex-col items-center relative overflow-y-auto overflow-x-hidden bg-background custom-scrollbar p-6">
        <div className="fixed inset-0 z-0 opacity-40 pointer-events-none">
          <GymScene />
        </div>
        
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md glass-panel rounded-3xl p-10 relative z-10 my-auto"
        >
          <div className="text-center mb-8">
            <div className="size-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="material-symbols-outlined text-3xl text-primary">mail</span>
            </div>
            <h2 className="text-2xl font-black tracking-tight text-white">Verify Your Email</h2>
            <p className="text-slate-500 text-sm mt-2">
              We sent a 6-digit code to <span className="text-white font-bold">{email}</span>
            </p>
          </div>

          <form onSubmit={handleVerifyEmail} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-2">Verification Code</label>
              <input 
                type="text" 
                placeholder="000000"
                maxLength={6}
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-center text-2xl font-bold tracking-widest focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all"
                required
              />
            </div>

            {error && (
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
                {error}
              </div>
            )}

            <motion.button 
              variants={buttonPress}
              whileHover="hover"
              whileTap="tap"
              type="submit"
              disabled={isLoading || verificationCode.length !== 6}
              className="w-full bg-primary text-white font-black py-5 rounded-2xl shadow-2xl shadow-primary/30 text-lg disabled:opacity-50"
            >
              {isLoading ? 'Verifying...' : 'Verify Email'}
            </motion.button>

            <div className="text-center">
              <button
                type="button"
                onClick={handleResendCode}
                disabled={isLoading}
                className="text-sm text-primary hover:underline font-bold disabled:opacity-50"
              >
                Resend Code
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    );
  }

  // Main login/signup form view
  return (
    <div className="h-screen w-full flex flex-col items-center relative overflow-y-auto overflow-x-hidden bg-background custom-scrollbar p-6">
      <div className="fixed inset-0 z-0 opacity-40 pointer-events-none">
        <GymScene />
      </div>
      
      <motion.div 
        layout
        transition={weightedTransition}
        className="w-full max-w-md glass-panel rounded-[3rem] p-10 relative z-10 border-white/10 shadow-[0_50px_100px_rgba(0,0,0,0.8)] my-auto"
      >
        <div className="flex flex-col items-center mb-10">
          <Logo size="md" className="mb-4" />
          <h2 className="text-3xl font-black tracking-tight text-white">
            {isLogin ? 'Welcome Back' : 'Join Taqwin'}
          </h2>
          <p className="text-slate-500 text-sm mt-2 font-medium text-center">
            {isLogin ? 'Sign in to see your progress' : 'Start your fitness journey today'}
          </p>
        </div>

        <div className="flex bg-white/5 p-1.5 rounded-2xl mb-8 border border-white/5">
          <button 
            onClick={() => {
              setIsLogin(true);
              clearError();
            }}
            className={`flex-1 py-3 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${isLogin ? 'bg-primary text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}
          >
            Sign In
          </button>
          <button 
            onClick={() => {
              setIsLogin(false);
              clearError();
            }}
            className={`flex-1 py-3 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${!isLogin ? 'bg-primary text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}
          >
            Sign Up
          </button>
        </div>

        <form onSubmit={handleAuth} className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-2">Email</label>
            <input 
              type="email" 
              placeholder="name@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all font-bold"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-2">Password</label>
            <input 
              type="password" 
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all font-bold"
              required
              minLength={8}
            />
            {!isLogin && (
              <p className="text-xs text-slate-500 ml-2">Minimum 8 characters</p>
            )}
          </div>

          {isLogin && (
            <div className="flex justify-end">
              <button type="button" className="text-[10px] font-black uppercase text-primary tracking-widest hover:underline">Forgot Password?</button>
            </div>
          )}

          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
              {error}
            </div>
          )}

          <Magnetic strength={0.2} className="w-full pt-4">
            <motion.button 
              variants={buttonPress}
              whileHover="hover"
              whileTap="tap"
              type="submit"
              disabled={isLoading}
              className="w-full bg-primary text-white font-black py-5 rounded-2xl shadow-2xl shadow-primary/30 text-lg border border-primary/20 disabled:opacity-50"
            >
              {isLoading ? (isLogin ? 'Signing In...' : 'Creating Account...') : (isLogin ? 'Sign In' : 'Continue')}
            </motion.button>
          </Magnetic>
        </form>

        <div className="mt-8 pt-8 border-t border-white/5 space-y-4">
          <p className="text-center text-[10px] font-black uppercase tracking-widest text-slate-600">Or continue with</p>
          <div className="grid grid-cols-2 gap-4">
            <a 
              href={`${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/api/auth/google`}
              className="flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 py-3 rounded-xl transition-all"
            >
              <img src="https://www.google.com/favicon.ico" className="size-4 grayscale brightness-200" alt="Google" />
              <span className="text-xs font-bold">Google</span>
            </a>
            <button 
              disabled
              className="flex items-center justify-center gap-2 bg-white/5 border border-white/10 py-3 rounded-xl opacity-50 cursor-not-allowed"
            >
              <span className="material-symbols-outlined text-sm">apple</span>
              <span className="text-xs font-bold">Apple</span>
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
