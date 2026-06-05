import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useI18n } from '../../lib/i18n/useI18n';
import { useAuthStore } from '../../store/useAuthStore';
import accountSettingsService from '../../services/accountSettingsService';
import authService from '../../services/authService';

const inputClass =
  'w-full rounded-xl border border-subtle bg-elevated px-4 py-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40';

function DialogShell({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] flex items-center justify-center bg-background/80 p-6 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0.95 }}
            onClick={(e) => e.stopPropagation()}
            className="glass-panel w-full max-w-md rounded-2xl border border-subtle p-6 sm:p-8"
            role="dialog"
            aria-modal="true"
          >
            <h2 className="mb-4 text-xl font-black text-foreground">{title}</h2>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

export const EmailChangeDialog: React.FC<{
  open: boolean;
  onClose: () => void;
  hasPassword: boolean;
}> = ({ open, onClose, hasPassword }) => {
  const { t } = useI18n();
  const refreshUser = useAuthStore((s) => s.refreshUser);
  const [step, setStep] = useState<'form' | 'code'>('form');
  const [newEmail, setNewEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) {
      setStep('form');
      setNewEmail('');
      setPassword('');
      setCode('');
      setError(null);
    }
  }, [open]);

  if (!hasPassword) {
    return (
      <DialogShell open={open} onClose={onClose} title={t('settings.changeEmail')}>
        <p className="text-sm text-muted">{t('settings.changeEmailOAuth')}</p>
        <button type="button" onClick={onClose} className="mt-4 w-full rounded-xl bg-primary py-3 text-sm font-bold text-white">
          {t('common.close')}
        </button>
      </DialogShell>
    );
  }

  const request = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await accountSettingsService.requestEmailChange(newEmail.trim(), password);
    setLoading(false);
    if (res.error) {
      const devHint =
        res.devCode && import.meta.env.DEV
          ? `\n${t('settings.emailDevCode')}: ${res.devCode}`
          : '';
      setError(res.error + devHint);
      return;
    }
    setStep('code');
  };

  const confirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await accountSettingsService.confirmEmailChange(code.trim());
    setLoading(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    await refreshUser();
    onClose();
  };

  return (
    <DialogShell open={open} onClose={onClose} title={t('settings.changeEmail')}>
      {error && <p className="mb-3 text-sm text-red-500">{error}</p>}
      {step === 'form' ? (
        <form onSubmit={request} className="space-y-3">
          <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder={t('settings.newEmail')} className={inputClass} required />
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t('settings.passwordCurrentLabel')} className={inputClass} required />
          <button type="submit" disabled={loading} className="w-full rounded-xl bg-primary py-3 text-sm font-bold text-white disabled:opacity-50">
            {loading ? t('settings.sendingCode') : t('common.continue')}
          </button>
        </form>
      ) : (
        <form onSubmit={confirm} className="space-y-3">
          <p className="text-sm text-muted">{t('settings.emailCodeSent')}</p>
          <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="123456" className={inputClass} required />
          <button type="submit" disabled={loading} className="w-full rounded-xl bg-primary py-3 text-sm font-bold text-white disabled:opacity-50">
            {loading ? t('settings.verifying') : t('settings.confirmEmail')}
          </button>
        </form>
      )}
    </DialogShell>
  );
};

export const TwoFactorDialog: React.FC<{
  open: boolean;
  onClose: () => void;
}> = ({ open, onClose }) => {
  const { t } = useI18n();
  const [enabled, setEnabled] = useState(false);
  const [qr, setQr] = useState<string | null>(null);
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    void (async () => {
      const st = await accountSettingsService.get2faStatus();
      setEnabled(Boolean(st.data?.enabled));
      setQr(null);
      setToken('');
      setPassword('');
      setError(null);
    })();
  }, [open]);

  const startSetup = async () => {
    setLoading(true);
    setError(null);
    const res = await accountSettingsService.setup2fa();
    setLoading(false);
    if (res.error || !res.data) {
      setError(res.error || 'Setup failed');
      return;
    }
    setQr(res.data.qrCodeDataUrl);
  };

  const enable = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const res = await accountSettingsService.enable2fa(token);
    setLoading(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setEnabled(true);
    setQr(null);
    onClose();
  };

  const disable = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const res = await accountSettingsService.disable2fa(token, password);
    setLoading(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setEnabled(false);
    onClose();
  };

  return (
    <DialogShell open={open} onClose={onClose} title={t('settings.twoFactor')}>
      {error && <p className="mb-3 text-sm text-red-500">{error}</p>}
      {enabled ? (
        <form onSubmit={disable} className="space-y-3">
          <p className="text-sm text-muted">{t('settings.twoFactorEnabledDesc')}</p>
          <input value={token} onChange={(e) => setToken(e.target.value)} placeholder={t('settings.authenticatorCode')} className={inputClass} required />
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t('settings.passwordCurrentLabel')} className={inputClass} required />
          <button type="submit" disabled={loading} className="w-full rounded-xl border border-red-500/40 py-3 text-sm font-bold text-red-500">
            {t('settings.disable2fa')}
          </button>
        </form>
      ) : qr ? (
        <form onSubmit={enable} className="space-y-3">
          <img src={qr} alt="QR" className="mx-auto size-40 rounded-xl border border-subtle" />
          <input value={token} onChange={(e) => setToken(e.target.value)} placeholder={t('settings.authenticatorCode')} className={inputClass} required />
          <button type="submit" disabled={loading} className="w-full rounded-xl bg-primary py-3 text-sm font-bold text-white">
            {t('settings.enable2fa')}
          </button>
        </form>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted">{t('settings.twoFactorDesc')}</p>
          <button type="button" onClick={startSetup} disabled={loading} className="w-full rounded-xl bg-primary py-3 text-sm font-bold text-white">
            {loading ? t('settings.loading') : t('settings.setup2fa')}
          </button>
        </div>
      )}
    </DialogShell>
  );
};

export const PhoneDialog: React.FC<{
  open: boolean;
  onClose: () => void;
  currentPhone?: string | null;
}> = ({ open, onClose, currentPhone }) => {
  const { t } = useI18n();
  const refreshUser = useAuthStore((s) => s.refreshUser);
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) {
      setPhone('');
      setError(null);
      setSuccess(null);
      return;
    }
    if (currentPhone) {
      const local = currentPhone.replace(/^\+20/, '0');
      setPhone(local);
    }
  }, [open, currentPhone]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);
    const res = await accountSettingsService.updatePhone(phone.trim());
    setLoading(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setSuccess(t('settings.phoneSaved'));
    await refreshUser();
    setTimeout(() => onClose(), 800);
  };

  return (
    <DialogShell open={open} onClose={onClose} title={t('settings.phone')}>
      <p className="mb-3 text-sm text-muted">{t('settings.phoneDesc')}</p>
      {error && <p className="mb-3 text-sm text-red-500">{error}</p>}
      {success && <p className="mb-3 text-sm text-primary">{success}</p>}
      <form onSubmit={submit} className="space-y-3">
        <input
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder={t('settings.phonePlaceholder')}
          className={inputClass}
          required
        />
        <button type="submit" disabled={loading} className="w-full rounded-xl bg-primary py-3 text-sm font-bold text-white disabled:opacity-50">
          {loading ? t('settings.saving') : t('common.save')}
        </button>
      </form>
    </DialogShell>
  );
};

export const DeleteAccountDialog: React.FC<{
  open: boolean;
  onClose: () => void;
  hasPassword: boolean;
}> = ({ open, onClose, hasPassword }) => {
  const { t } = useI18n();
  const logout = useAuthStore((s) => s.logout);
  const [password, setPassword] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) {
      setPassword('');
      setConfirmText('');
      setError(null);
    }
  }, [open]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await accountSettingsService.deleteAccount(
      hasPassword ? { currentPassword: password } : { confirmDelete: 'DELETE' as const },
    );
    setLoading(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    logout();
    onClose();
  };

  return (
    <DialogShell open={open} onClose={onClose} title={t('settings.deleteAccount')}>
      <p className="mb-4 text-sm text-muted">{t('settings.deleteAccountDesc')}</p>
      {error && <p className="mb-3 text-sm text-red-500">{error}</p>}
      <form onSubmit={submit} className="space-y-3">
        {hasPassword ? (
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} required />
        ) : (
          <input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="DELETE" className={inputClass} required />
        )}
        <button
          type="submit"
          disabled={loading || (!hasPassword && confirmText !== 'DELETE')}
          className="w-full rounded-xl bg-red-600 py-3 text-sm font-bold text-white disabled:opacity-50"
        >
          {t('settings.deleteAccountConfirm')}
        </button>
      </form>
    </DialogShell>
  );
};
