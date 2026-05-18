
import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { weightedTransition, staggerContainer, itemVariants } from '../../lib/motion';
import { useNotificationStore } from '../../store/useNotificationStore';

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
  const { notifications, markAsRead, markAllAsRead, refresh, isLoading } = useNotificationStore();

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
            className="fixed right-0 top-0 h-full w-full max-w-md glass-panel z-[120] p-10 flex flex-col border-l border-white/10 shadow-2xl"
          >
            <div className="flex items-center justify-between mb-12">
              <div className="flex items-center gap-4">
                <span className="material-symbols-outlined text-primary font-black">notifications_active</span>
                <h2 className="text-2xl font-black tracking-tight">Ecosystem Feed</h2>
              </div>
              <button onClick={onClose} className="size-10 flex items-center justify-center rounded-xl hover:bg-white/5 transition-colors">
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
                <p className="text-center text-slate-500 text-sm">Loading…</p>
              )}
              {!isLoading && notifications.length === 0 && (
                <p className="text-center text-slate-500 text-sm">You're all caught up.</p>
              )}
              {notifications.map((n) => (
                <motion.div
                  key={n.id}
                  variants={itemVariants}
                  onClick={() => markAsRead(n.id)}
                  className={`p-6 rounded-[2rem] border transition-all cursor-pointer group ${
                    n.read ? 'bg-white/5 border-white/5 opacity-60' : 'bg-primary/10 border-primary/20 shadow-xl'
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-black text-sm uppercase tracking-widest text-white group-hover:text-primary transition-colors">
                      {n.title}
                    </h4>
                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter">{timeAgo(n.createdAt)}</span>
                  </div>
                  <p className="text-sm text-slate-300 font-medium leading-relaxed">{n.message}</p>
                  {!n.read && (
                    <div className="mt-4 flex justify-end">
                      <div className="size-2 bg-primary rounded-full animate-pulse" />
                    </div>
                  )}
                </motion.div>
              ))}
            </motion.div>

            <div className="pt-8 border-t border-white/5 mt-auto">
              <button 
                onClick={markAllAsRead}
                className="w-full py-4 bg-white/5 border border-white/10 rounded-2xl text-[11px] font-black uppercase tracking-[0.3em] hover:bg-white/10 transition-all"
              >
                Clear All Logs
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
