
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { weightedTransition, staggerContainer, itemVariants } from '../../lib/motion';
import { useNotificationStore } from '../../store/useNotificationStore';
import { useI18n } from '../../lib/i18n/useI18n';
import { NotificationActorAvatar } from './NotificationActorAvatar';

function timeAgo(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.floor(hr / 24);
  return `${d}d ago`;
}

export const NotificationDrawer: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { notifications, markAsRead, markAllAsRead, refresh, isLoading } = useNotificationStore();

  const openNotification = (id: string, link?: string | null) => {
    markAsRead(id);
    if (link) {
      const path = link.includes('?') ? link : link;
      navigate(path);
      onClose();
    }
  };

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
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={weightedTransition}
            className="fixed right-0 top-0 h-full w-full max-w-md glass-panel z-[120] p-10 flex flex-col border-l border-subtle shadow-2xl"
          >
            <div className="flex items-center justify-between mb-12">
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
              className="flex-1 overflow-y-auto no-scrollbar space-y-4"
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
                  onClick={() => openNotification(n.id, n.link)}
                  className={`p-6 rounded-[2rem] border transition-all cursor-pointer group ${
                    n.read ? 'bg-elevated border-subtle opacity-60' : 'bg-primary/10 border-primary/20 shadow-xl'
                  }`}
                >
                  <div className="flex gap-3 items-start mb-2">
                    <NotificationActorAvatar
                      avatarUrl={n.actorAvatarUrl}
                      displayName={n.actorDisplayName || n.title}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start gap-2">
                        <h4 className="font-black text-sm text-foreground group-hover:text-primary transition-colors truncate">
                          {n.actorDisplayName || n.title}
                        </h4>
                        <span className="text-[9px] font-bold text-faint shrink-0">{timeAgo(n.createdAt)}</span>
                      </div>
                      <p className="text-sm text-muted font-medium leading-relaxed mt-0.5">{n.message}</p>
                    </div>
                  </div>
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
