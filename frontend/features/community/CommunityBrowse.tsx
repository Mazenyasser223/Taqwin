import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useI18n } from '../../lib/i18n/useI18n';
import communityService from '../../services/communityService';
import type { CommunityAuthor } from '../../types';
import { displayName, fallbackAvatar, roleLabel } from './communityUtils';

export const CommunityBrowse: React.FC = () => {
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CommunityAuthor[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults([]);
      return;
    }
    setSearching(true);
    const timer = window.setTimeout(() => {
      communityService.searchUsers(q).then((res) => {
        setResults(res.data ?? []);
        setSearching(false);
      });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [query]);

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div>
        <h1 className="text-2xl font-black tracking-tight">{t('community.browseTitle')}</h1>
        <p className="text-muted text-sm mt-1">{t('community.browseSubtitle')}</p>
      </div>

      <div className="relative">
        <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-muted">search</span>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('community.searchPeople')}
          className="w-full pl-12 pr-4 py-3.5 rounded-2xl bg-elevated border border-subtle text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>

      {searching && <p className="text-primary text-sm animate-pulse">{t('community.loading')}</p>}

      {!searching && query.trim() && results.length === 0 && (
        <p className="text-center text-muted text-sm py-8">{t('community.browseNoResults')}</p>
      )}

      {!query.trim() && (
        <p className="text-center text-muted text-sm py-8">{t('community.browseHint')}</p>
      )}

      <div className="space-y-2">
        {results.map((u) => (
          <Link
            key={u.id}
            to={`/community/profile/${u.id}`}
            className="flex items-center gap-3 p-4 rounded-2xl border border-border bg-surface/60 hover:border-primary/40 transition-colors"
          >
            <img
              src={u.profile?.avatarUrl || fallbackAvatar(u.id)}
              alt=""
              className="size-14 rounded-full object-cover border border-subtle shrink-0"
            />
            <div className="flex-1 min-w-0">
              <p className="font-bold truncate">{displayName(u)}</p>
              <p className="text-xs text-faint truncate">{u.handle}</p>
              {u.isPrivate && (
                <span className="inline-flex items-center gap-1 mt-1 text-[10px] font-bold text-muted uppercase">
                  <span className="material-symbols-outlined text-sm">lock</span>
                  {t('community.privateAccount')}
                </span>
              )}
            </div>
            {u.role && (
              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-primary/15 text-primary uppercase shrink-0">
                {roleLabel(u.role)}
              </span>
            )}
            <span className="material-symbols-outlined text-muted shrink-0">chevron_right</span>
          </Link>
        ))}
      </div>
    </motion.div>
  );
};
