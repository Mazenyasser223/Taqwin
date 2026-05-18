import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Logo } from '../../components/shared/Logo';
import { buttonPress, weightedTransition } from '../../lib/motion';
import { Magnetic } from '../../components/shared/MotionWrappers';
import { useAuthStore } from '../../store/useAuthStore';
import authService from '../../services/authService';
import { getPostAuthPath } from '../../lib/authRoutes';
import type { UserRole } from '../../types';
import { useI18n } from '../../lib/i18n/useI18n';

type Mode = 'signin' | 'signup' | 'role' | 'forgot' | 'reset' | 'twofa';

export const AuthPage: React.FC = () => {
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selectedRole, setSelectedRole] = useState<UserRole>('athlete');
  const [oauthRole, setOauthRole] = useState<UserRole>('athlete');
  const [resetPassword, setResetPasswordValue] = useState('');
  const [resetMessage, setResetMessage] = useState<string | null>(null);
  const [forgotMessage, setForgotMessage] = useState<string | null>(null);
  const [tempToken, setTempToken] = useState<string | null>(null);
  const [totpCode, setTotpCode] = useState('');
  const [twoFactorError, setTwoFactorError] = useState<string | null>(null);

  const navigate = useNavigate();
  const location = useLocation();
  const {
    login,
    register,
    refreshUser,
    isLoading,
    error,
    clearError,
    setUser,
  } = useAuthStore();
  const { t } = useI18n();

  // Detect ?reset=<token> from password-reset email link
  const resetToken = useMemo(() => {
    if (typeof window === 'undefined') return null;
    const search = window.location.hash.includes('?')
      ? window.location.hash.split('?')[1]
      : '';
    return new URLSearchParams(search).get('reset');
  }, [location]);

  useEffect(() => {
    if (resetToken) setMode('reset');
  }, [resetToken]);

  useEffect(() => {
    const state = location.state as { preferredRole?: UserRole } | null;
    const r = state?.preferredRole;
    if (r && (r === 'athlete' || r === 'trainer' || r === 'gym')) {
      setSelectedRole(r);
      setOauthRole(r);
    }
  }, [location.state]);

  // Legacy: older builds used mode "verify" after signup
  useEffect(() => {
    if ((mode as string) === 'verify') setMode('signin');
  }, [mode]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    const result = await login({ email, password });
    if (result.success && result.requiresTwoFactor && result.tempToken) {
      setTempToken(result.tempToken);
      setTotpCode('');
      setTwoFactorError(null);
      setMode('twofa');
      return;
    }
    if (result.success) {
      await refreshUser();
      const user = useAuthStore.getState().user;
      navigate(getPostAuthPath(user, 'login'));
    }
  };

  const handle2faVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setTwoFactorError(null);
    if (!tempToken) return;
    const res = await authService.verify2faLogin(tempToken, totpCode);
    if (res.error) {
      setTwoFactorError(res.error);
      return;
    }
    if (res.data?.user) {
      setUser(res.data.user);
    }
    const storedUser = JSON.parse(localStorage.getItem('taqwin_user') || '{}');
    const hasProfile = storedUser?.profile?.displayName;
    navigate(hasProfile ? '/dashboard' : '/onboarding');
  };

  const handleSignup = async (e?: React.FormEvent) => {
    e?.preventDefault();
    clearError();
    if (mode !== 'role') {
      setMode('role');
      return;
    }
    const result = await register({ email, password, role: selectedRole });
    if (result.success) {
      if (result.requiresVerification) {
        useAuthStore.setState({
          error: 'Email verification is required on this server. Check your inbox or contact support.',
        });
        return;
      }
      navigate('/onboarding');
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    setForgotMessage(null);
    const response = await authService.forgotPassword(email);
    if (response.error) {
      setForgotMessage(response.error);
    } else {
      setForgotMessage('If that email exists, a reset link is on its way.');
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    setResetMessage(null);
    if (!resetToken) return;
    const response = await authService.resetPassword(resetToken, resetPassword);
    if (response.error) {
      setResetMessage(response.error);
    } else {
      setResetMessage('Password updated. You can now sign in.');
      setTimeout(() => {
        window.location.hash = '/auth';
        setMode('signin');
        setResetPasswordValue('');
      }, 1500);
    }
  };

  if (mode === 'twofa') {
    return (
      <motion.div className="h-screen w-full flex flex-col items-center relative overflow-y-auto bg-background p-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md glass-panel rounded-3xl p-10 my-auto">
          <div className="text-center mb-8">
            <Logo size="md" className="mb-4 mx-auto" />
            <h2 className="text-2xl font-black text-foreground">{t('auth.twoFactorTitle')}</h2>
            <p className="text-muted text-sm mt-2">{t('auth.twoFactorDesc')}</p>
          </div>
          <form onSubmit={handle2faVerify} className="space-y-6">
            <input
              value={totpCode}
              onChange={(e) => setTotpCode(e.target.value)}
              placeholder={t('settings.authenticatorCode')}
              className="w-full bg-input border border-input text-foreground rounded-2xl px-5 py-4 text-center text-lg tracking-widest font-bold"
              required
            />
            {twoFactorError && (
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">{twoFactorError}</div>
            )}
            <motion.button variants={buttonPress} whileTap="tap" type="submit" className="w-full bg-primary text-white font-black py-5 rounded-2xl">
              {t('auth.verify')}
            </motion.button>
            <button type="button" onClick={() => setMode('signin')} className="w-full text-sm text-primary font-bold">
              {t('auth.backToSignIn')}
            </button>
          </form>
        </motion.div>
      </motion.div>
    );
  }

  // ─── Role select view ─────────────────────────────────────────────────────
  if (mode === 'role') {
    const roles = [
      { role: 'athlete' as UserRole, title: t('auth.roleAthlete'), desc: t('auth.roleAthleteDesc'), icon: 'person_play', color: 'bg-primary' },
      { role: 'trainer' as UserRole, title: t('auth.roleTrainer'), desc: t('auth.roleTrainerDesc'), icon: 'fitness_center', color: 'bg-emerald-600' },
      { role: 'gym' as UserRole, title: t('auth.roleGym'), desc: t('auth.roleGymDesc'), icon: 'apartment', color: 'bg-accent' },
    ];

    return (
      <div className="h-screen w-full flex flex-col items-center relative overflow-y-auto overflow-x-hidden bg-background custom-scrollbar p-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-2xl relative z-10 my-auto">
          <div className="text-center mb-8">
            <Logo size="md" className="mb-4 mx-auto" />
            <h2 className="text-3xl font-black tracking-tight text-foreground">{t('auth.selectRole')}</h2>
            <p className="text-muted text-sm mt-2">{t('auth.selectRoleDesc')}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {roles.map((item) => (
              <button
                key={item.role}
                onClick={() => { setSelectedRole(item.role); setOauthRole(item.role); }}
                className={`glass-panel p-6 rounded-2xl text-left flex flex-col gap-4 transition-all ${
                  selectedRole === item.role ? 'border-primary bg-primary/10' : 'border-subtle hover:border-primary/30'
                }`}
              >
                <div className={`size-12 ${item.color} rounded-xl flex items-center justify-center text-foreground`}>
                  <span className="material-symbols-outlined text-2xl">{item.icon}</span>
                </div>
                <div>
                  <h3 className="font-bold mb-1">{item.title}</h3>
                  <p className="text-xs text-muted">{item.desc}</p>
                </div>
              </button>
            ))}
          </div>
          <p className="text-center text-xs text-slate-500 mb-4">
            Selected:{' '}
            <span className="text-primary font-bold">
              {selectedRole === 'gym' ? 'Gym Owner' : selectedRole.charAt(0).toUpperCase() + selectedRole.slice(1)}
            </span>
          </p>
          {error && (
            <div className="mb-4 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">{error}</div>
          )}
          <div className="flex gap-4">
            <button onClick={() => setMode('signup')} className="flex-1 bg-input border border-input text-foreground font-bold py-4 rounded-xl hover:bg-elevated-hover transition-all">
              {t('auth.back')}
            </button>
            <motion.button variants={buttonPress} whileHover="hover" whileTap="tap" onClick={() => handleSignup()} disabled={isLoading} className="flex-1 bg-primary text-white font-bold py-4 rounded-xl shadow-lg disabled:opacity-50">
              {isLoading ? t('auth.creatingAccount') : t('auth.continue')}
            </motion.button>
          </div>
        </motion.div>
      </div>
    );
  }

  // ─── Forgot-password view ─────────────────────────────────────────────────
  if (mode === 'forgot') {
    return (
      <div className="h-screen w-full flex flex-col items-center relative overflow-y-auto overflow-x-hidden bg-background custom-scrollbar p-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md glass-panel rounded-3xl p-10 relative z-10 my-auto">
          <div className="text-center mb-8">
            <Logo size="md" className="mb-4 mx-auto" />
            <h2 className="text-2xl font-black tracking-tight text-foreground">{t('auth.resetPassword')}</h2>
            <p className="text-muted text-sm mt-2">{t('auth.resetPasswordDesc')}</p>
          </div>
          <form onSubmit={handleForgotPassword} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-faint ms-2">{t('auth.email')}</label>
              <input type="email" placeholder="name@email.com" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full bg-input border border-input text-foreground rounded-2xl px-5 py-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all font-bold" />
            </div>
            {forgotMessage && (<div className="p-4 bg-primary/10 border border-primary/20 rounded-xl text-primary text-sm">{forgotMessage}</div>)}
            <motion.button variants={buttonPress} whileHover="hover" whileTap="tap" type="submit" disabled={isLoading} className="w-full bg-primary text-white font-black py-5 rounded-2xl shadow-2xl shadow-primary/30 text-lg disabled:opacity-50">
              {isLoading ? t('auth.sending') : t('auth.sendReset')}
            </motion.button>
            <div className="text-center">
              <button type="button" onClick={() => { setMode('signin'); setForgotMessage(null); }} className="text-sm text-primary hover:underline font-bold">{t('auth.backToSignIn')}</button>
            </div>
          </form>
        </motion.div>
      </div>
    );
  }

  // ─── Reset-password view ──────────────────────────────────────────────────
  if (mode === 'reset') {
    return (
      <div className="h-screen w-full flex flex-col items-center relative overflow-y-auto overflow-x-hidden bg-background custom-scrollbar p-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md glass-panel rounded-3xl p-10 relative z-10 my-auto">
          <div className="text-center mb-8">
            <Logo size="md" className="mb-4 mx-auto" />
            <h2 className="text-2xl font-black tracking-tight text-foreground">{t('auth.newPassword')}</h2>
            <p className="text-muted text-sm mt-2">{t('auth.newPasswordDesc')}</p>
          </div>
          <form onSubmit={handleResetPassword} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-faint ms-2">{t('auth.password')}</label>
              <input type="password" value={resetPassword} onChange={(e) => setResetPasswordValue(e.target.value)} minLength={8} required placeholder="••••••••" className="w-full bg-input border border-input text-foreground rounded-2xl px-5 py-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all font-bold" />
            </div>
            {resetMessage && (
              <div className={`p-4 rounded-xl text-sm border ${resetMessage.includes('updated') ? 'bg-primary/10 border-primary/20 text-primary' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
                {resetMessage}
              </div>
            )}
            <motion.button variants={buttonPress} whileHover="hover" whileTap="tap" type="submit" disabled={isLoading} className="w-full bg-primary text-white font-black py-5 rounded-2xl shadow-2xl shadow-primary/30 text-lg disabled:opacity-50">
              {isLoading ? t('auth.updating') : t('auth.updatePassword')}
            </motion.button>
          </form>
        </motion.div>
      </div>
    );
  }

  // ─── Sign-in / Sign-up view ───────────────────────────────────────────────
  const isLogin = mode === 'signin';
  const handleAuth = isLogin ? handleLogin : handleSignup;

  return (
    <div className="h-screen w-full flex flex-col items-center relative overflow-y-auto overflow-x-hidden bg-background custom-scrollbar p-6">
      <motion.div layout transition={weightedTransition} className="w-full max-w-md glass-panel rounded-[3rem] p-10 relative z-10 border-subtle shadow-[0_50px_100px_rgba(0,0,0,0.15)] dark:shadow-[0_50px_100px_rgba(0,0,0,0.8)] my-auto">
        <div className="flex flex-col items-center mb-10">
          <Logo size="md" className="mb-4" />
          <h2 className="text-3xl font-black tracking-tight text-foreground">{isLogin ? t('auth.welcomeBack') : t('auth.join')}</h2>
          <p className="text-muted text-sm mt-2 font-medium text-center">
            {isLogin ? t('auth.signInSubtitle') : t('auth.signUpSubtitle')}
          </p>
        </div>
        <div className="flex bg-elevated p-1.5 rounded-2xl mb-8 border border-subtle">
          <button onClick={() => { setMode('signin'); clearError(); }} className={`flex-1 py-3 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${isLogin ? 'bg-primary text-white shadow-lg' : 'text-muted hover:text-foreground'}`}>{t('auth.signIn')}</button>
          <button onClick={() => { setMode('signup'); clearError(); }} className={`flex-1 py-3 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${!isLogin ? 'bg-primary text-white shadow-lg' : 'text-muted hover:text-foreground'}`}>{t('auth.signUp')}</button>
        </div>
        <form onSubmit={handleAuth} className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-faint ms-2">{t('auth.email')}</label>
            <input type="email" placeholder="name@email.com" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-input border border-input text-foreground rounded-2xl px-5 py-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all font-bold" required />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-faint ms-2">{t('auth.password')}</label>
            <input type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-input border border-input text-foreground rounded-2xl px-5 py-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all font-bold" required minLength={8} />
            {!isLogin && (<p className="text-xs text-muted ms-2">{t('auth.minPassword')}</p>)}
          </div>
          {isLogin && (
            <div className="flex justify-end">
              <button type="button" onClick={() => { setMode('forgot'); clearError(); setForgotMessage(null); }} className="text-[10px] font-black uppercase text-primary tracking-widest hover:underline">{t('auth.forgotPassword')}</button>
            </div>
          )}
          {error && (<div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">{error}</div>)}
          <Magnetic strength={0.2} className="w-full pt-4">
            <motion.button variants={buttonPress} whileHover="hover" whileTap="tap" type="submit" disabled={isLoading} className="w-full bg-primary text-white font-black py-5 rounded-2xl shadow-2xl shadow-primary/30 text-lg border border-primary/20 disabled:opacity-50">
              {isLoading ? (isLogin ? t('auth.signingIn') : t('auth.creatingAccount')) : (isLogin ? t('auth.signIn') : t('auth.continue'))}
            </motion.button>
          </Magnetic>
        </form>
        <div className="mt-8 pt-8 border-t border-subtle space-y-4">
          <a
            href={`${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/api/auth/google?role=${encodeURIComponent(oauthRole)}`}
            className="flex items-center justify-center gap-3 bg-elevated hover:bg-elevated-hover border border-subtle py-4 rounded-xl transition-all text-foreground"
          >
            <img src="https://www.google.com/favicon.ico" className="size-5 dark:grayscale dark:brightness-200" alt="Google" />
            <span className="text-sm font-bold">{t('auth.google')}</span>
          </a>
        </div>
      </motion.div>
    </div>
  );
};


