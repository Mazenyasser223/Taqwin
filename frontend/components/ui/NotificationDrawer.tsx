
import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { weightedTransition, staggerContainer, itemVariants } from '../../lib/motion';
import { useNotificationStore } from '../../store/useNotificationStore';
import { useI18n } from '../../lib/i18n/useI18n';
import { cn } from '../../lib/cn';

function timeAgo(
  iso: string,
  t: (key: import('../../lib/i18n/translations').TranslationKey, params?: Record<string, string>) => string
) {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return t('notifications.justNow');
  if (min < 60) return t('notifications.minutesAgo', { min: String(min) });
  const hr = Math.floor(min / 60);
  if (hr < 24) return t('notifications.hoursAgo', { hr: String(hr) });
  const d = Math.floor(hr / 24);
  return t('notifications.daysAgo', { d: String(d) });
}

export const NotificationDrawer: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const { t, isRtl } = useI18n();
  const { notifications, markAsRead, markAllAsRead, refresh, isLoading } = useNotificationStore();
  const slideOffScreen = isRtl ? '-100%' : '100%';

  useEffect(() => {
    if (isOpen) refresh();
  }, [isOpen, refresh]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-background/60 backdrop-blur-md z-[110]"
          />
          <motion.div
            initial={{ x: slideOffScreen }}
            animate={{ x: 0 }}
            exit={{ x: slideOffScreen }}
            transition={weightedTransition}
            className={cn(
              'fixed top-0 h-[100dvh] max-h-[100dvh] w-full max-w-md glass-panel z-[120] p-4 sm:p-8 flex flex-col min-h-0 shadow-2xl safe-top safe-bottom',
              isRtl ? 'left-0 border-r border-subtle' : 'right-0 border-l border-subtle'
            )}
          >
            <div className="flex items-center justify-between mb-6 sm:mb-8 shrink-0">
              <div className="flex items-center gap-4">
                <span className="material-symbols-outlined text-primary font-black">notifications_active</span>
                <h2 className="text-2xl font-black tracking-tight text-foreground">{t('notifications.feedTitle')}</h2>
              </div>
              <button onClick={onClose} className="size-10 flex items-center justify-center rounded-xl hover:bg-elevated transition-colors">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <motion.div 
              variants={staggerContainer(0.08)}
              initial="hidden"
              animate="visible"
              className="flex-1 min-h-0 overflow-y-auto custom-scrollbar space-y-4"
            >
              {isLoading && notifications.length === 0 && (
                <p className="text-center text-faint text-sm">{t('common.loading')}</p>
              )}
              {!isLoading && notifications.length === 0 && (
                <p className="text-center text-faint text-sm">{t('notifications.caughtUp')}</p>
              )}
              {notifications.map((n) => (
                <motion.div
                  key={n.id}
                  variants={itemVariants}
                  onClick={() => markAsRead(n.id)}
                  className={`p-6 rounded-[2rem] border transition-all cursor-pointer group ${
                    n.read ? 'bg-elevated border-subtle opacity-60' : 'bg-primary/10 border-primary/20 shadow-xl'
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-black text-sm uppercase tracking-widest text-foreground group-hover:text-primary transition-colors">
                      {n.title}
                    </h4>
                    <span className="text-[9px] font-bold text-faint uppercase tracking-tighter">{timeAgo(n.createdAt, t)}</span>
                  </div>
                  <p className="text-sm text-muted font-medium leading-relaxed">{n.message}</p>
                  {!n.read && (
                    <div className="mt-4 flex justify-end">
                      <div className="size-2 bg-primary rounded-full animate-pulse" />
                    </div>
                  )}
                </motion.div>
              ))}
            </motion.div>

            <div className="pt-8 border-t border-subtle mt-auto">
              <button 
                onClick={markAllAsRead}
                className="w-full py-4 bg-elevated border border-subtle rounded-2xl text-[11px] font-black uppercase tracking-[0.3em] hover:bg-elevated-hover transition-all"
              >
                {t('notifications.clearAll')}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
