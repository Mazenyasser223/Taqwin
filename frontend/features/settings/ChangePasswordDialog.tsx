import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import authService from '../../services/authService';
import { useI18n } from '../../lib/i18n/useI18n';

type Step = 'current' | 'new' | 'done';

interface ChangePasswordDialogProps {
  open: boolean;
  onClose: () => void;
  hasPassword?: boolean;
}

const inputClass =
  'w-full rounded-xl border border-subtle bg-elevated px-4 py-3 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40';

export const ChangePasswordDialog: React.FC<ChangePasswordDialogProps> = ({
  open,
  onClose,
  hasPassword = true,
}) => {
  const { t } = useI18n();
  const [step, setStep] = useState<Step>('current');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const reset = () => {
    setStep('current');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setError(null);
    setLoading(false);
  };

  useEffect(() => {
    if (!open) reset();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const handleClose = () => {
    if (loading) return;
    onClose();
  };

  const verifyCurrent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword) {
      setError(t('settings.passwordCurrentRequired'));
      return;
    }
    setLoading(true);
    setError(null);
    const res = await authService.verifyPassword(currentPassword);
    setLoading(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setStep('new');
  };

  const submitNew = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      setError(t('auth.minPassword'));
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(t('settings.passwordMismatch'));
      return;
    }
    setLoading(true);
    setError(null);
    const res = await authService.changePassword(currentPassword, newPassword);
    setLoading(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setStep('done');
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          key="change-password-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] flex items-center justify-center bg-background/80 p-6 backdrop-blur-sm"
          onClick={handleClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="glass-panel w-full max-w-md rounded-2xl border border-subtle p-6 sm:p-8"
            role="dialog"
            aria-modal="true"
            aria-labelledby="change-password-title"
          >
            {!hasPassword ? (
              <motion.div className="space-y-4 text-center">
                <span className="material-symbols-outlined text-4xl text-primary">lock</span>
                <h2 id="change-password-title" className="text-xl font-black text-foreground">
                  {t('settings.password')}
                </h2>
                <p className="text-sm text-muted">{t('settings.passwordOAuthOnly')}</p>
                <button
                  type="button"
                  onClick={handleClose}
                  className="w-full rounded-xl bg-primary py-3 text-sm font-bold text-white"
                >
                  {t('common.close')}
                </button>
              </motion.div>
            ) : step === 'done' ? (
              <motion.div className="space-y-4 text-center">
                <span className="material-symbols-outlined text-4xl text-primary">check_circle</span>
                <h2 id="change-password-title" className="text-xl font-black text-foreground">
                  {t('settings.passwordChanged')}
                </h2>
                <p className="text-sm text-muted">{t('settings.passwordChangedDesc')}</p>
                <button
                  type="button"
                  onClick={handleClose}
                  className="w-full rounded-xl bg-primary py-3 text-sm font-bold text-white"
                >
                  {t('common.close')}
                </button>
              </motion.div>
            ) : (
              <>
                <div className="mb-6">
                  <h2 id="change-password-title" className="text-xl font-black text-foreground">
                    {step === 'current'
                      ? t('settings.passwordCurrentTitle')
                      : t('settings.passwordNewTitle')}
                  </h2>
                  <p className="mt-1 text-sm text-muted">
                    {step === 'current'
                      ? t('settings.passwordCurrentDesc')
                      : t('settings.passwordNewDesc')}
                  </p>
                </div>

                {error && (
                  <motion.div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-500">
                    {error}
                  </motion.div>
                )}

                {step === 'current' ? (
                  <form onSubmit={verifyCurrent} className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-faint">
                        {t('settings.passwordCurrentLabel')}
                      </label>
                      <input
                        type="password"
                        autoComplete="current-password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        className={inputClass}
                        disabled={loading}
                      />
                    </div>
                    <div className="flex gap-3 pt-2">
                      <button
                        type="button"
                        onClick={handleClose}
                        disabled={loading}
                        className="flex-1 rounded-xl border border-subtle bg-elevated py-3 text-sm font-bold text-foreground"
                      >
                        {t('common.cancel')}
                      </button>
                      <button
                        type="submit"
                        disabled={loading}
                        className="flex-1 rounded-xl bg-primary py-3 text-sm font-bold text-white disabled:opacity-50"
                      >
                        {loading ? t('settings.passwordVerifying') : t('common.continue')}
                      </button>
                    </div>
                  </form>
                ) : (
                  <form onSubmit={submitNew} className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-faint">
                        {t('settings.passwordNewLabel')}
                      </label>
                      <input
                        type="password"
                        autoComplete="new-password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className={inputClass}
                        disabled={loading}
                      />
                      <p className="text-xs text-faint">{t('auth.minPassword')}</p>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-faint">
                        {t('settings.passwordConfirmLabel')}
                      </label>
                      <input
                        type="password"
                        autoComplete="new-password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className={inputClass}
                        disabled={loading}
                      />
                    </div>
                    <div className="flex gap-3 pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          setStep('current');
                          setNewPassword('');
                          setConfirmPassword('');
                          setError(null);
                        }}
                        disabled={loading}
                        className="flex-1 rounded-xl border border-subtle bg-elevated py-3 text-sm font-bold text-foreground"
                      >
                        {t('common.back')}
                      </button>
                      <button
                        type="submit"
                        disabled={loading}
                        className="flex-1 rounded-xl bg-primary py-3 text-sm font-bold text-white disabled:opacity-50"
                      >
                        {loading ? t('settings.passwordSaving') : t('settings.passwordSave')}
                      </button>
                    </div>
                  </form>
                )}
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
};
