import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useI18n } from '../../lib/i18n/useI18n';
import communityService from '../../services/communityService';
import type { CommunityPostReposter } from '../../types';
import { CommunityAuthorAvatar } from './CommunityAuthorAvatar';
import { CommunityLoader } from './CommunityLoader';
import { displayName, communityProfilePath, timeAgo } from './communityUtils';

interface PostRepostersModalProps {
  postId: string;
  repostsCount: number;
  onClose: () => void;
}

export const PostRepostersModal: React.FC<PostRepostersModalProps> = ({
  postId,
  repostsCount,
  onClose,
}) => {
  const { t } = useI18n();
  const [reposters, setReposters] = useState<CommunityPostReposter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    communityService.getPostReposters(postId).then((res) => {
      if (res.error) setError(res.error);
      else setReposters(res.data ?? []);
      setLoading(false);
    });
  }, [postId]);

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
              <h3 className="text-xl font-black">{t('community.repostersTitle')}</h3>
              <p className="text-xs text-muted mt-1">
                {t('community.repostsCount', { count: String(repostsCount) })}
              </p>
            </div>
            <button type="button" onClick={onClose} className="p-2 text-muted hover:text-foreground">
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-1 custom-scrollbar">
            {loading && <CommunityLoader icon="repeat" className="py-12" />}
            {error && (
              <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">
                {error}
              </p>
            )}
            {!loading && !error && reposters.length === 0 && (
              <p className="text-sm text-muted text-center py-8">{t('community.noReposters')}</p>
            )}
            {reposters.map((r) => (
              <Link
                key={r.id}
                to={communityProfilePath(r.userId)}
                onClick={onClose}
                className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 transition-colors"
              >
                <CommunityAuthorAvatar
                  userId={r.userId}
                  avatarUrl={r.user?.profile?.communityAvatarUrl}
                  displayName={displayName(r.user)}
                  imageClassName="size-10 rounded-full object-cover"
                />
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-sm truncate">{displayName(r.user)}</p>
                  <p className="text-xs text-muted">{timeAgo(r.createdAt)}</p>
                </div>
                <span className="material-symbols-outlined text-muted text-lg">chevron_right</span>
              </Link>
            ))}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
