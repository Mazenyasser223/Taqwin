import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useI18n } from '../../lib/i18n/useI18n';
import communityService from '../../services/communityService';
import type { CommunityGroup, CommunityGroupMember } from '../../types';
import { UserAvatar } from '../../components/ui/UserAvatar';
import { displayName, communityProfilePath } from './communityUtils';

interface GroupMembersModalProps {
  group: CommunityGroup;
  onClose: () => void;
}

export const GroupMembersModal: React.FC<GroupMembersModalProps> = ({ group, onClose }) => {
  const { t } = useI18n();
  const [members, setMembers] = useState<CommunityGroupMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const canView =
    group.canViewMembers || group.myRole === 'owner' || group.myRole === 'admin';

  const load = useCallback(() => {
    if (!canView) {
      setLoading(false);
      setError(
        group.joined
          ? t('community.membersAdminsOnly')
          : t('community.joinToViewMembers'),
      );
      return;
    }
    setLoading(true);
    setError(null);
    communityService.getGroupMembers(group.id).then((res) => {
      if (res.error) setError(res.error);
      else setMembers(res.data ?? []);
      setLoading(false);
    });
  }, [group.id, canView, group.joined, t]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95 }}
          animate={{ scale: 1 }}
          exit={{ scale: 0.95 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-md max-h-[80vh] rounded-3xl bg-surface border border-border flex flex-col overflow-hidden"
        >
          <div className="p-5 border-b border-subtle flex items-center justify-between shrink-0">
            <div>
              <h3 className="text-xl font-black">{t('community.membersListTitle')}</h3>
              <p className="text-xs text-muted mt-1">
                {!loading && !error
                  ? `${members.length} ${t('community.members')}`
                  : `${group.membersCount} ${t('community.members')}`}
              </p>
            </div>
            <button type="button" onClick={onClose} className="p-2 text-muted hover:text-foreground">
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
            {error && (
              <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">
                {error}
              </p>
            )}
            {loading && <p className="text-sm text-muted animate-pulse">{t('community.loading')}</p>}
            {!loading &&
              !error &&
              members.map((m) => (
                <Link
                  key={m.id}
                  to={communityProfilePath(m.userId)}
                  onClick={onClose}
                  className="flex items-center gap-3 p-3 rounded-xl border border-border hover:border-primary/40"
                >
                  <UserAvatar
                    avatarUrl={m.user?.profile?.avatarUrl}
                    displayName={displayName(m.user)}
                    className="size-11 rounded-full object-cover border border-subtle shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-sm truncate">{displayName(m.user)}</p>
                    <p className="text-[10px] text-faint uppercase">{m.role}</p>
                  </div>
                  <span className="material-symbols-outlined text-muted">chevron_right</span>
                </Link>
              ))}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
