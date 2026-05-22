
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { weightedTransition, staggerContainer, itemVariants } from '../../lib/motion';
import { useNotificationStore } from '../../store/useNotificationStore';
import { useI18n } from '../../lib/i18n/useI18n';
import { cn } from '../../lib/cn';
import { NotificationActorAvatar } from './NotificationActorAvatar';
import {
  navigateToNotification,
  parseGroupIdFromNotificationLink,
  resolveNotificationTarget,
} from '../../lib/notificationNavigation';
import communityService from '../../services/communityService';
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

function groupNameFromMessage(message: string) {
  const m = message.match(/"([^"]+)"/);
  return m?.[1] ?? null;
}

export const NotificationDrawer: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const { t, isRtl } = useI18n();
  const navigate = useNavigate();
  const { notifications, markAsRead, markAllAsRead, refresh, remove, isLoading } = useNotificationStore();
  const [actionId, setActionId] = useState<string | null>(null);
  const [resultMessages, setResultMessages] = useState<Record<string, string>>({});

  const goToNotification = (n: UiNotification, markRead = true) => {
    const target = resolveNotificationTarget(n);
    if (!target) return;
    if (markRead && !n.read) void markAsRead(n.id);
    navigateToNotification(navigate, target);
    onClose();
  };

  const setAcceptedMessage = (id: string, message: string) => {
    setResultMessages((prev) => ({ ...prev, [id]: message }));
  };

  const handleFollowAction = async (
    n: UiNotification,
    action: 'accept' | 'decline',
    e: React.MouseEvent,
  ) => {
    e.stopPropagation();
    if (!n.actorId || actionId) return;
    setActionId(n.id);
    const res =
      action === 'accept'
        ? await communityService.acceptFollowRequest(n.actorId)
        : await communityService.declineFollowRequest(n.actorId);
    setActionId(null);
    if (res.error) return;
    if (action === 'decline') {
      await remove(n.id);
      return;
    }
    const name = n.actorDisplayName || n.title;
    setAcceptedMessage(n.id, t('notifications.nowFollowing', { name }));
    await markAsRead(n.id);
    void refresh();
  };

  const handleGroupInviteAction = async (
    n: UiNotification,
    action: 'accept' | 'decline',
    e: React.MouseEvent,
  ) => {
    e.stopPropagation();
    const groupId = parseGroupIdFromNotificationLink(n.link);
    if (!groupId || actionId) return;
    setActionId(n.id);
    if (action === 'decline') {
      const res = await communityService.declineGroupInvite(groupId);
      setActionId(null);
      if (res.error) return;
      await remove(n.id);
      return;
    }
    const res = await communityService.acceptGroupInvite(groupId);
    setActionId(null);
    if (res.error) return;
    const groupName = res.data?.name || groupNameFromMessage(n.message) || t('community.tabGroups');
    setAcceptedMessage(n.id, t('notifications.joinedGroup', { name: groupName }));
    await markAsRead(n.id);
    void refresh();
  };

  const handleGroupJoinRequestAction = async (
    n: UiNotification,
    action: 'accept' | 'decline',
    e: React.MouseEvent,
  ) => {
    e.stopPropagation();
    const groupId = parseGroupIdFromNotificationLink(n.link);
    if (!groupId || !n.actorId || actionId) return;
    setActionId(n.id);
    if (action === 'decline') {
      const res = await communityService.declineGroupJoinRequest(groupId, n.actorId);
      setActionId(null);
      if (res.error) return;
      await remove(n.id);
      return;
    }
    const res = await communityService.approveGroupJoinRequest(groupId, n.actorId);
    setActionId(null);
    if (res.error) return;
    const memberName = n.actorDisplayName || n.title;
    const groupName = res.data?.groupName || groupNameFromMessage(n.message) || t('community.tabGroups');
    setAcceptedMessage(
      n.id,
      t('notifications.memberJoinedGroup', { member: memberName, group: groupName }),
    );
    await markAsRead(n.id);
    void refresh();
  };

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
              {notifications.map((n) => {
                const target = resolveNotificationTarget(n);
                const isFollowRequest = n.type === 'community.follow_request' && !!n.actorId;
                const isGroupInvite = n.type === 'community.group_invite' && !!parseGroupIdFromNotificationLink(n.link);
                const isGroupJoinRequest =
                  n.type === 'community.group_join_request' && !!parseGroupIdFromNotificationLink(n.link) && !!n.actorId;
                const hasInlineActions = isFollowRequest || isGroupInvite || isGroupJoinRequest;
                const resultMessage = resultMessages[n.id];
                const showActionButtons = hasInlineActions && !resultMessage;
                const busy = actionId === n.id;

                return (
                  <motion.div
                    key={n.id}
                    variants={itemVariants}
                    onClick={() => {
                      if (hasInlineActions) {
                        if (!n.read) void markAsRead(n.id);
                        return;
                      }
                      goToNotification(n);
                    }}
                    className={`p-6 rounded-[2rem] border transition-all group ${
                      showActionButtons ? '' : 'cursor-pointer'
                    } ${
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
                        <p className="text-sm text-muted font-medium leading-relaxed mt-0.5">
                          {resultMessage || n.message}
                        </p>
                      </div>
                    </div>

                    {showActionButtons && (
                      <div
                        className="mt-3 flex gap-2"
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          disabled={busy}
                          onClick={(e) => {
                            if (isGroupJoinRequest) handleGroupJoinRequestAction(n, 'accept', e);
                            else if (isGroupInvite) handleGroupInviteAction(n, 'accept', e);
                            else handleFollowAction(n, 'accept', e);
                          }}
                          className="flex-1 py-2 rounded-xl bg-primary text-white text-xs font-bold disabled:opacity-50"
                        >
                          {t('community.accept')}
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={(e) => {
                            if (isGroupJoinRequest) handleGroupJoinRequestAction(n, 'decline', e);
                            else if (isGroupInvite) handleGroupInviteAction(n, 'decline', e);
                            else handleFollowAction(n, 'decline', e);
                          }}
                          className="flex-1 py-2 rounded-xl border border-subtle text-xs font-bold text-muted hover:text-foreground disabled:opacity-50"
                        >
                          {t('community.decline')}
                        </button>
                      </div>
                    )}

                    <div className="mt-3 flex items-center justify-between gap-2">
                      {!n.read ? (
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
            </motion.div>

            <div className="pt-8 border-t border-subtle mt-auto">
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
