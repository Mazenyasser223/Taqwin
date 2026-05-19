import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Logo } from '../../components/shared/Logo';
import { GoogleLogo } from '../../components/shared/GoogleLogo';
import { buttonPress, weightedTransition } from '../../lib/motion';
import { Magnetic } from '../../components/shared/MotionWrappers';
import { useAuthStore } from '../../store/useAuthStore';
import authService from '../../services/authService';
import { getPostAuthPath } from '../../lib/authRoutes';
import type { UserRole } from '../../types';
import { useI18n } from '../../lib/i18n/useI18n';
import { PASSWORD_RULES, getPasswordRuleStatus, isPasswordValid } from '../../lib/passwordPolicy';

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
  const [devResetCode, setDevResetCode] = useState<string | null>(null);
  const [resetCode, setResetCode] = useState('');
  const [tempToken, setTempToken] = useState<string | null>(null);
  const [totpCode, setTotpCode] = useState('');
  const [twoFactorError, setTwoFactorError] = useState<string | null>(null);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
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

  useEffect(() => {
    if (searchParams.get('reset') === '1') {
      setMode('reset');
    } else if (searchParams.get('forgot') === '1') {
      setMode('forgot');
    }
  }, [searchParams]);

  const openForgotPassword = () => {
    clearError();
    setForgotMessage(null);
    setDevResetCode(null);
    setResetCode('');
    setMode('forgot');
    setSearchParams({ forgot: '1' });
  };

  const backToSignIn = () => {
    setMode('signin');
    setForgotMessage(null);
    setResetMessage(null);
    setSearchParams({});
  };

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

  const passwordRuleStatus = useMemo(
    () => getPasswordRuleStatus(password),
    [password],
  );
  const resetPasswordRuleStatus = useMemo(
    () => getPasswordRuleStatus(resetPassword),
    [resetPassword],
  );

  const handleSignup = async (e?: React.FormEvent) => {
    e?.preventDefault();
    clearError();
    if (mode !== 'role') {
      if (!isPasswordValid(password)) {
        useAuthStore.setState({ error: t('auth.passwordWeak') });
        return;
      }
      setMode('role');
      return;
    }
    if (!isPasswordValid(password)) {
      useAuthStore.setState({ error: t('auth.passwordWeak') });
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
    setDevResetCode(null);
    const trimmed = email.trim();
    if (!trimmed) {
      setForgotMessage(t('auth.emailRequired'));
      return;
    }
    setForgotLoading(true);
    const response = await authService.forgotPassword(trimmed);
    setForgotLoading(false);
    if (response.error) {
      setForgotMessage(response.error);
      return;
    }
    const data = response.data as { message?: string; devResetCode?: string; sent?: boolean } | undefined;
    setForgotMessage(data?.message ?? t('auth.forgotSuccess'));
    const codeFromDev = data?.devResetCode ?? null;
    setDevResetCode(codeFromDev);
    if (codeFromDev) setResetCode(codeFromDev);
    setMode('reset');
    setSearchParams({ reset: '1' });
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    setResetMessage(null);
    const trimmedEmail = email.trim();
    const trimmedCode = resetCode.trim();
    if (!trimmedEmail || !trimmedCode) {
      setResetMessage(t('auth.resetCodeRequired'));
      return;
    }
    if (!isPasswordValid(resetPassword)) {
      setResetMessage(t('auth.passwordWeak'));
      return;
    }
    setResetLoading(true);
    const response = await authService.resetPassword(trimmedEmail, trimmedCode, resetPassword);
    setResetLoading(false);
    if (response.error) {
      setResetMessage(response.error);
    } else {
      setResetMessage(t('auth.resetSuccess'));
      setTimeout(() => {
        setResetPasswordValue('');
        setResetCode('');
        setDevResetCode(null);
        backToSignIn();
      }, 1500);
    }
  };

  if (mode === 'twofa') {
    return (
      <motion.div className="min-h-[100dvh] w-full flex flex-col items-center relative overflow-y-auto overflow-x-hidden bg-background p-4 sm:p-6 safe-top safe-bottom">
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
            <motion.button variants={buttonPress} whileTap="tap" type="submit" className="w-full min-h-11 bg-primary text-white font-black py-4 sm:py-5 rounded-2xl">
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
      <div className="min-h-[100dvh] w-full flex flex-col items-center relative overflow-y-auto overflow-x-hidden bg-background custom-scrollbar p-4 sm:p-6 safe-top safe-bottom">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-2xl relative z-10 my-auto">
          <div className="text-center mb-8">
            <Logo size="md" className="mb-4 mx-auto" />
            <h2 className="text-3xl font-black tracking-tight text-foreground">{t('auth.selectRole')}</h2>
            <p className="text-muted text-sm mt-2">{t('auth.selectRoleDesc')}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {roles.map((item) => (
              <motion.button
                key={item.role}
                type="button"
                aria-pressed={selectedRole === item.role}
                onClick={() => { setSelectedRole(item.role); setOauthRole(item.role); }}
                whileHover={{ scale: selectedRole === item.role ? 1 : 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={`relative glass-panel role-card--hoverable p-6 rounded-2xl text-start flex flex-col gap-4 transition-all duration-200 border-2 ${
                  selectedRole === item.role
                    ? 'role-card--selected !border-primary ring-2 ring-primary/40 shadow-lg shadow-primary/20'
                    : 'border-transparent hover:shadow-md hover:ring-1 hover:ring-primary/25'
                }`}
              >
                {selectedRole === item.role && (
                  <span className="absolute top-3 end-3 size-7 rounded-full bg-primary flex items-center justify-center shadow-md shadow-primary/30">
                    <span className="material-symbols-outlined text-white text-base">check</span>
                  </span>
                )}
                <div className={`size-12 ${item.color} rounded-xl flex items-center justify-center text-foreground shadow-sm`}>
                  <span className="material-symbols-outlined text-2xl">{item.icon}</span>
                </div>
                <div>
                  <h3 className="font-bold mb-1">{item.title}</h3>
                  <p className="text-xs text-muted">{item.desc}</p>
                </div>
              </motion.button>
            ))}
          </div>
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
      <div className="min-h-[100dvh] w-full flex flex-col items-center relative overflow-y-auto overflow-x-hidden bg-background custom-scrollbar p-4 sm:p-6 safe-top safe-bottom">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md glass-panel rounded-3xl p-10 relative z-10 my-auto">
          <div className="text-center mb-8">
            <Logo size="md" className="mb-4 mx-auto" />
            <h2 className="text-2xl font-black tracking-tight text-foreground">{t('auth.resetPassword')}</h2>
            <p className="text-muted text-sm mt-2">{t('auth.resetPasswordDesc')}</p>
          </div>
          <form onSubmit={handleForgotPassword} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-faint ms-2">{t('auth.email')}</label>
              <input type="email" placeholder="name@email.com" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full min-h-11 bg-input border border-input text-foreground rounded-2xl px-5 py-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all font-bold" />
            </div>
            {forgotMessage && (
              <div className={`p-4 rounded-xl text-sm border space-y-3 ${devResetCode ? 'bg-amber-500/10 border-amber-500/30 text-amber-200' : 'bg-primary/10 border-primary/20 text-primary'}`}>
                <p>{forgotMessage}</p>
                {devResetCode && (
                  <p className="mt-2 text-center font-black text-2xl tracking-[0.3em]">{devResetCode}</p>
                )}
              </div>
            )}
            <motion.button variants={buttonPress} whileHover="hover" whileTap="tap" type="submit" disabled={forgotLoading} className="w-full min-h-11 bg-primary text-white font-black py-4 sm:py-5 rounded-2xl shadow-2xl shadow-primary/30 text-lg disabled:opacity-50">
              {forgotLoading ? t('auth.sending') : t('auth.sendReset')}
            </motion.button>
            <div className="text-center">
              <button type="button" onClick={backToSignIn} className="text-sm text-primary hover:underline font-bold">{t('auth.backToSignIn')}</button>
            </div>
          </form>
        </motion.div>
      </div>
    );
  }

  // ─── Reset-password view ──────────────────────────────────────────────────
  if (mode === 'reset') {
    return (
      <div className="min-h-[100dvh] w-full flex flex-col items-center relative overflow-y-auto overflow-x-hidden bg-background custom-scrollbar p-4 sm:p-6 safe-top safe-bottom">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md glass-panel rounded-3xl p-10 relative z-10 my-auto">
          <div className="text-center mb-8">
            <Logo size="md" className="mb-4 mx-auto" />
            <h2 className="text-2xl font-black tracking-tight text-foreground">{t('auth.newPassword')}</h2>
            <p className="text-muted text-sm mt-2">{t('auth.resetCodeDesc')}</p>
          </div>
          <form onSubmit={handleResetPassword} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-faint ms-2">{t('auth.email')}</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full min-h-11 bg-input border border-input text-foreground rounded-2xl px-5 py-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all font-bold"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-faint ms-2">{t('auth.resetCode')}</label>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={resetCode}
                onChange={(e) => setResetCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                required
                placeholder="000000"
                className="w-full bg-input border border-input text-foreground rounded-2xl px-5 py-4 text-center text-lg tracking-[0.4em] font-black focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-faint ms-2">{t('auth.password')}</label>
              <input type="password" value={resetPassword} onChange={(e) => setResetPasswordValue(e.target.value)} minLength={8} required placeholder="••••••••" autoComplete="new-password" className="w-full min-h-11 bg-input border border-input text-foreground rounded-2xl px-5 py-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all font-bold" />
              <ul className="ms-2 mt-2 rounded-xl border border-subtle bg-elevated/50 p-3 space-y-1.5">
                {PASSWORD_RULES.map((rule) => {
                  const met = resetPasswordRuleStatus.find((r) => r.id === rule.id)?.met ?? false;
                  return (
                    <li key={rule.id} className={`flex items-center gap-2 text-xs ${met ? 'text-primary' : 'text-muted'}`}>
                      <span className="material-symbols-outlined text-base leading-none">
                        {met ? 'check_circle' : 'radio_button_unchecked'}
                      </span>
                      <span>{t(rule.i18nKey)}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
            {resetMessage && (
              <div className={`p-4 rounded-xl text-sm border ${resetMessage === t('auth.resetSuccess') ? 'bg-primary/10 border-primary/20 text-primary' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
                {resetMessage}
              </div>
            )}
            <motion.button variants={buttonPress} whileHover="hover" whileTap="tap" type="submit" disabled={resetLoading} className="w-full min-h-11 bg-primary text-white font-black py-4 sm:py-5 rounded-2xl shadow-2xl shadow-primary/30 text-lg disabled:opacity-50">
              {resetLoading ? t('auth.updating') : t('auth.updatePassword')}
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
    <div className="min-h-[100dvh] w-full flex flex-col items-center relative overflow-y-auto overflow-x-hidden bg-background custom-scrollbar p-4 sm:p-6 safe-top safe-bottom">
      <motion.div layout transition={weightedTransition} className="w-full max-w-md glass-panel rounded-2xl sm:rounded-[3rem] p-6 sm:p-10 relative z-10 border-subtle shadow-[0_50px_100px_rgba(0,0,0,0.15)] dark:shadow-[0_50px_100px_rgba(0,0,0,0.8)] my-auto">
        <div className="flex flex-col items-center mb-10">
          <Logo size="md" className="mb-4" />
          <h2 className="text-3xl font-black tracking-tight text-foreground">{isLogin ? t('auth.welcomeBack') : t('auth.join')}</h2>
          <p className="text-muted text-sm mt-2 font-medium text-center">
            {isLogin ? t('auth.signInSubtitle') : t('auth.signUpSubtitle')}
          </p>
        </div>
        <div className="flex bg-elevated p-1.5 rounded-2xl mb-8 border border-subtle">
          <button type="button" onClick={() => { setMode('signin'); clearError(); setSearchParams({}); }} className={`flex-1 py-3 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${isLogin ? 'bg-primary text-white shadow-lg' : 'text-muted hover:text-foreground'}`}>{t('auth.signIn')}</button>
          <button type="button" onClick={() => { setMode('signup'); clearError(); setSearchParams({}); }} className={`flex-1 py-3 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${!isLogin ? 'bg-primary text-white shadow-lg' : 'text-muted hover:text-foreground'}`}>{t('auth.signUp')}</button>
        </div>
        <form onSubmit={handleAuth} className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-faint ms-2">{t('auth.email')}</label>
            <input type="email" placeholder="name@email.com" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full min-h-11 bg-input border border-input text-foreground rounded-2xl px-5 py-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all font-bold" required />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-faint ms-2">{t('auth.password')}</label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full min-h-11 bg-input border border-input text-foreground rounded-2xl px-5 py-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all font-bold"
              required
              minLength={8}
              autoComplete={isLogin ? 'current-password' : 'new-password'}
            />
            {!isLogin && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="ms-2 mt-2 rounded-xl border border-subtle bg-elevated/50 p-3 space-y-2"
              >
                <p className="text-[10px] font-black uppercase tracking-widest text-faint">
                  {t('auth.passwordRulesTitle')}
                </p>
                <ul className="space-y-1.5">
                  {PASSWORD_RULES.map((rule) => {
                    const met = passwordRuleStatus.find((r) => r.id === rule.id)?.met ?? false;
                    return (
                      <li
                        key={rule.id}
                        className={`flex items-center gap-2 text-xs transition-colors ${met ? 'text-primary' : 'text-muted'}`}
                      >
                        <span className="material-symbols-outlined text-base leading-none">
                          {met ? 'check_circle' : 'radio_button_unchecked'}
                        </span>
                        <span>{t(rule.i18nKey)}</span>
                      </li>
                    );
                  })}
                </ul>
              </motion.div>
            )}
          </div>
          {error && (<motion.div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">{error}</motion.div>)}
          <Magnetic strength={0.2} className="w-full pt-4">
            <motion.button variants={buttonPress} whileHover="hover" whileTap="tap" type="submit" disabled={isLoading} className="w-full min-h-11 bg-primary text-white font-black py-4 sm:py-5 rounded-2xl shadow-2xl shadow-primary/30 text-lg border border-primary/20 disabled:opacity-50">
              {isLoading ? (isLogin ? t('auth.signingIn') : t('auth.creatingAccount')) : (isLogin ? t('auth.signIn') : t('auth.continue'))}
            </motion.button>
          </Magnetic>
        </form>
        {isLogin && (
          <motion.div className="flex justify-end mt-4">
            <button
              type="button"
              onClick={openForgotPassword}
              className="text-[10px] font-black uppercase text-primary tracking-widest hover:underline"
            >
              {t('auth.forgotPassword')}
            </button>
          </motion.div>
        )}
        <motion.div className="mt-8 pt-8 border-t border-subtle space-y-4">
          <a
            href={`${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/api/auth/google?role=${encodeURIComponent(oauthRole)}&flow=${isLogin ? 'login' : 'signup'}`}
            className="flex items-center justify-center gap-3 bg-elevated hover:bg-elevated-hover border border-subtle py-4 rounded-xl transition-all text-foreground"
          >
            <GoogleLogo className="size-5 shrink-0" />
            <span className="text-sm font-bold">
              {isLogin ? t('auth.googleSignIn') : t('auth.googleSignUp')}
            </span>
          </a>
        </motion.div>
      </motion.div>
    </div>
  );
};


