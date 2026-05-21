import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Logo } from '../../components/shared/Logo';
import { buttonPress } from '../../lib/motion';
import { useAuthStore } from '../../store/useAuthStore';
import authService from '../../services/authService';
import { setSignupPendingRole } from '../../lib/authStorage';
import { getPostAuthPath, userNeedsPassword } from '../../lib/authRoutes';
import { useI18n } from '../../lib/i18n/useI18n';
import { PASSWORD_RULES, getPasswordRuleStatus, isPasswordValid } from '../../lib/passwordPolicy';

export const SetPasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useI18n();
  const { user, refreshUser } = useAuthStore();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const passwordRuleStatus = useMemo(() => getPasswordRuleStatus(password), [password]);

  useEffect(() => {
    setSignupPendingRole(true);
  }, []);

  useEffect(() => {
    if (user && !userNeedsPassword(user)) {
      navigate(getPostAuthPath(user, 'signup'), { replace: true });
    }
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!isPasswordValid(password)) {
      setError(t('auth.passwordWeak'));
      return;
    }
    if (password !== confirmPassword) {
      setError(t('settings.passwordMismatch'));
      return;
    }

    setLoading(true);
    const res = await authService.setInitialPassword(password);
    setLoading(false);

    if (res.error) {
      setError(res.error);
      return;
    }

    if (res.data?.user) {
      useAuthStore.getState().setUser(res.data.user);
    }
    await refreshUser();
    const updated = useAuthStore.getState().user;
    navigate('/auth', { replace: true, state: { pickRole: true } });
  };

  return (
    <motion.div className="standalone-page safe-top safe-bottom flex flex-col items-center justify-center bg-background p-4 sm:p-6">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md glass-panel rounded-3xl p-10 border-subtle"
      >
        <div className="text-center mb-8">
          <Logo size="md" className="mx-auto mb-4" />
          <h1 className="text-2xl font-black text-foreground">{t('auth.setPasswordTitle')}</h1>
          <p className="text-sm text-muted mt-2">{t('auth.setPasswordDesc')}</p>
        </div>

        {user?.email && (
          <div className="mb-6 rounded-2xl border border-subtle bg-elevated/50 px-4 py-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-faint mb-1">
              {t('auth.emailVerified')}
            </p>
            <p className="text-sm font-bold text-foreground break-all">{user.email}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <motion.div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-faint ms-2">
              {t('auth.password')}
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              required
              className="w-full bg-input border border-input text-foreground rounded-2xl px-5 py-4 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
            <ul className="ms-2 rounded-xl border border-subtle bg-elevated/50 p-3 space-y-1.5">
              {PASSWORD_RULES.map((rule) => {
                const met = passwordRuleStatus.find((r) => r.id === rule.id)?.met ?? false;
                return (
                  <li
                    key={rule.id}
                    className={`flex items-center gap-2 text-xs ${met ? 'text-primary' : 'text-muted'}`}
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

          <motion.div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-faint ms-2">
              {t('settings.passwordConfirmLabel')}
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              required
              className="w-full bg-input border border-input text-foreground rounded-2xl px-5 py-4 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </motion.div>

          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
              {error}
            </div>
          )}

          <motion.button
            variants={buttonPress}
            whileTap="tap"
            type="submit"
            disabled={loading}
            className="w-full bg-primary text-white font-black py-5 rounded-2xl disabled:opacity-50"
          >
            {loading ? t('auth.savingPassword') : t('auth.setPasswordContinue')}
          </motion.button>
        </form>
      </motion.div>
    </motion.div>
  );
};
