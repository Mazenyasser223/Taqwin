
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { weightedTransition, staggerContainer, itemVariants } from '../../lib/motion';
import { useNotificationStore } from '../../store/useNotificationStore';
import { useI18n } from '../../lib/i18n/useI18n';
import { cn } from '../../lib/cn';
import { NotificationActorAvatar } from './NotificationActorAvatar';
import {
  navigateToNotification,
  parseGroupIdFromNotification,
  resolveNotificationTarget,
} from '../../lib/notificationNavigation';
import { executeNotificationAction } from '../../lib/notificationActionHandlers';
import notificationService from '../../services/notificationService';
import type { NotificationFilter } from '../../services/notificationService';
import type { UiNotification } from '../../store/useNotificationStore';

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

const FILTER_TABS: { id: NotificationFilter; labelKey: import('../../lib/i18n/translations').TranslationKey }[] = [
  { id: 'ALL', labelKey: 'notifications.filterAll' },
  { id: 'UNREAD', labelKey: 'notifications.filterUnread' },
  { id: 'SOCIAL', labelKey: 'notifications.filterSocial' },
  { id: 'WORKOUT', labelKey: 'notifications.filterWorkout' },
  { id: 'AI', labelKey: 'notifications.filterAi' },
  { id: 'SHOP', labelKey: 'notifications.filterOrders' },
  { id: 'SUPPORT', labelKey: 'notifications.filterSupport' },
];

function priorityBorder(priority?: string) {
  if (priority === 'URGENT') return 'border-red-500/40';
  if (priority === 'HIGH') return 'border-amber-500/30';
  return '';
}

function groupNameFromMessage(message: string) {
  const m = message.match(/"([^"]+)"/);
  return m?.[1] ?? null;
}

export const NotificationDrawer: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const { t, isRtl } = useI18n();
  const slideOffScreen = isRtl ? '-100%' : '100%';
  const navigate = useNavigate();
  const {
    notifications,
    markAsRead,
    markAllAsRead,
    markAsSeen,
    refresh,
    remove,
    isLoading,
    isLoadingMore,
    filter,
    setFilter,
    loadMore,
    hasMore,
  } = useNotificationStore();
  const [actionId, setActionId] = useState<string | null>(null);
  const [resultMessages, setResultMessages] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!isOpen) return;
    void markAsSeen();
  }, [isOpen, markAsSeen]);

  const goToNotification = (n: UiNotification, markRead = true) => {
    const target = resolveNotificationTarget(n);
    if (!target) return;
    if (markRead && !n.read) void markAsRead(n.id);
    void notificationService.trackEvent(n.id, 'clicked');
    navigateToNotification(navigate, target);
    onClose();
  };

  const setAcceptedMessage = (id: string, message: string) => {
    setResultMessages((prev) => ({ ...prev, [id]: message }));
  };

  const handleAction = async (n: UiNotification, action: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (actionId) return;
    setActionId(n.id);
    const result = await executeNotificationAction(n, action);
    setActionId(null);
    if (!result.ok) return;

    if (result.remove) {
      await remove(n.id);
      return;
    }

    if (result.message === 'accepted') {
      const name = n.actorDisplayName || n.title;
      setAcceptedMessage(n.id, t('notifications.nowFollowing', { name }));
    } else if (result.message === 'group_joined') {
      const groupName = result.groupName || groupNameFromMessage(n.message) || t('community.tabGroups');
      setAcceptedMessage(n.id, t('notifications.joinedGroup', { name: groupName }));
    } else if (result.message === 'member_joined') {
      const memberName = n.actorDisplayName || n.title;
      const groupName = result.groupName || groupNameFromMessage(n.message) || t('community.tabGroups');
      setAcceptedMessage(n.id, t('notifications.memberJoinedGroup', { member: memberName, group: groupName }));
    }

    await markAsRead(n.id);
    void refresh();
  };

  const resolveActions = (n: UiNotification) => {
    if (n.actions?.length) return n.actions;
    return [];
  };

  const hasInlineActions = (n: UiNotification) => resolveActions(n).length > 0;

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
            <div className="flex items-center justify-between mb-4 shrink-0">
              <div className="flex items-center gap-4">
                <span className="material-symbols-outlined text-primary font-black">notifications_active</span>
                <h2 className="text-2xl font-black tracking-tight text-foreground">{t('notifications.feedTitle')}</h2>
              </div>
              <button onClick={onClose} className="size-10 flex items-center justify-center rounded-xl hover:bg-elevated transition-colors">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="flex gap-2 overflow-x-auto pb-3 shrink-0 custom-scrollbar">
              {FILTER_TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilter(tab.id)}
                  className={cn(
                    'shrink-0 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider border transition-colors',
                    filter === tab.id
                      ? 'bg-primary text-white border-primary'
                      : 'bg-elevated border-subtle text-muted hover:text-foreground'
                  )}
                >
                  {t(tab.labelKey)}
                </button>
              ))}
            </div>

            <motion.div
              variants={staggerContainer(0.08)}
              initial="hidden"
              animate="visible"
              className="flex-1 min-h-0 overflow-y-auto custom-scrollbar space-y-4"
              onScroll={(e) => {
                const el = e.currentTarget;
                if (el.scrollTop + el.clientHeight >= el.scrollHeight - 80) void loadMore();
              }}
            >
              {isLoading && notifications.length === 0 && (
                <p className="text-center text-faint text-sm">{t('common.loading')}</p>
              )}
              {!isLoading && notifications.length === 0 && (
                <p className="text-center text-faint text-sm">{t('notifications.caughtUp')}</p>
              )}
              {notifications.map((n) => {
                const target = resolveNotificationTarget(n);
                const actions = resolveActions(n);
                const resultMessage = resultMessages[n.id];
                const showActionButtons = actions.length > 0 && !resultMessage;
                const busy = actionId === n.id;
                const icon = n.icon || 'notifications';
                const unread = !n.read;

                return (
                  <motion.div
                    key={n.id}
                    variants={itemVariants}
                    onClick={() => {
                      if (showActionButtons) {
                        if (unread) void markAsRead(n.id);
                        return;
                      }
                      goToNotification(n);
                    }}
                    className={cn(
                      'p-6 rounded-[2rem] border transition-all group',
                      showActionButtons ? '' : 'cursor-pointer',
                      unread ? 'bg-primary/10 border-primary/20 shadow-xl' : 'bg-elevated border-subtle opacity-60',
                      priorityBorder(n.priority)
                    )}
                  >
                    <div className="flex gap-3 items-start mb-2">
                      <NotificationActorAvatar
                        avatarUrl={n.actorAvatarUrl}
                        displayName={n.actorDisplayName || n.title}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start gap-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <h4 className="font-black text-sm text-foreground group-hover:text-primary transition-colors truncate">
                              {n.title}
                            </h4>
                            <span className="shrink-0 inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-primary/15 text-primary">
                              <span className="material-symbols-outlined text-[10px] leading-none">{icon}</span>
                              {n.category || 'SYSTEM'}
                            </span>
                            {(n.actorCount || 0) > 1 && (
                              <span className="text-[9px] font-bold text-faint shrink-0">×{n.actorCount}</span>
                            )}
                          </div>
                          <span className="text-[9px] font-bold text-faint shrink-0">{timeAgo(n.createdAt, t)}</span>
                        </div>
                        <p className="text-sm text-muted font-medium leading-relaxed mt-0.5">
                          {resultMessage || n.message}
                        </p>
                      </div>
                    </div>

                    {showActionButtons && (
                      <div className="mt-3 flex gap-2 flex-wrap" onClick={(e) => e.stopPropagation()}>
                        {actions.map((a) => (
                          <button
                            key={a.action}
                            type="button"
                            disabled={busy}
                            onClick={(e) => handleAction(n, a.action, e)}
                            className={cn(
                              'flex-1 min-w-[40%] py-2 rounded-xl text-xs font-bold disabled:opacity-50',
                              a.style === 'primary'
                                ? 'bg-primary text-white'
                                : 'border border-subtle text-muted hover:text-foreground'
                            )}
                          >
                            {a.labelKey ? t(a.labelKey as import('../../lib/i18n/translations').TranslationKey) : a.label}
                          </button>
                        ))}
                      </div>
                    )}

                    <div className="mt-3 flex items-center justify-between gap-2">
                      {unread ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            void markAsRead(n.id);
                          }}
                          className="text-[10px] font-bold uppercase tracking-wider text-primary hover:underline"
                        >
                          {t('notifications.markRead')}
                        </button>
                      ) : (
                        <span className="text-[10px] text-faint">{t('notifications.read')}</span>
                      )}
                      {target && !showActionButtons && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            goToNotification(n, false);
                          }}
                          className="text-[10px] font-bold text-primary hover:underline"
                        >
                          {t('notifications.view')}
                        </button>
                      )}
                    </div>
                  </motion.div>
                );
              })}
              {isLoadingMore && <p className="text-center text-faint text-xs py-2">{t('common.loading')}</p>}
              {!hasMore && notifications.length > 0 && (
                <p className="text-center text-faint text-[10px] py-2">{t('notifications.caughtUp')}</p>
              )}
            </motion.div>

            <div className="pt-8 border-t border-subtle mt-auto shrink-0">
              <button
                onClick={() => void markAllAsRead()}
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
