import React, { useEffect } from 'react';
import { NavLink, Outlet, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useI18n } from '../../lib/i18n/useI18n';
import { useCommunityStoryViewerStore } from '../../store/useCommunityStoryViewerStore';
import { CommunityStoryViewerOverlay } from './CommunityStoryViewerOverlay';
import { feedPanel } from './communityFeedStyles';

const tabs = [
  { to: '/community', labelKey: 'community.tabFeed' as const, end: true },
  { to: '/community/profile', labelKey: 'community.tabProfile' as const },
  { to: '/community/browse', labelKey: 'community.tabBrowse' as const },
  { to: '/community/groups', labelKey: 'community.tabGroups' as const },
  { to: '/community/inbox', labelKey: 'community.tabInbox' as const },
  {
    to: '/community/settings',
    labelKey: 'community.tabSettings' as const,
    icon: 'settings' as const,
    iconOnly: true,
  },
];

export const CommunityHub: React.FC = () => {
  const { t } = useI18n();
  const [searchParams, setSearchParams] = useSearchParams();
  const openStoryUserId = searchParams.get('openStory');
  const openStoryForUserId = useCommunityStoryViewerStore((s) => s.openStoryForUserId);

  useEffect(() => {
    if (!openStoryUserId) return;
    void openStoryForUserId(openStoryUserId).then(() => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.delete('openStory');
          return next;
        },
        { replace: true },
      );
    });
  }, [openStoryUserId, openStoryForUserId, setSearchParams]);

  return (
    <motion.div className="max-w-2xl mx-auto space-y-6 pb-24">
      <div className={`${feedPanel} flex gap-1.5 p-1.5 overflow-x-auto no-scrollbar`}>
        {tabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) =>
              `shrink-0 flex items-center justify-center py-2.5 rounded-xl text-[10px] sm:text-xs font-bold transition-all whitespace-nowrap ${
                tab.iconOnly ? 'min-w-[2.75rem] px-2.5 flex-none' : 'flex-1 min-w-[3.75rem] px-2 text-center'
              } ${
                isActive
                  ? 'bg-primary text-white shadow-md shadow-primary/25'
                  : 'text-muted hover:text-foreground hover:bg-elevated/40'
              }`
            }
            aria-label={tab.iconOnly ? t(tab.labelKey) : undefined}
            title={tab.iconOnly ? t(tab.labelKey) : undefined}
          >
            {tab.iconOnly && tab.icon ? (
              <span className="material-symbols-outlined text-[1.35rem] leading-none">{tab.icon}</span>
            ) : (
              t(tab.labelKey)
            )}
          </NavLink>
        ))}
      </div>
      <CommunityStoryViewerOverlay />
      <Outlet />
    </motion.div>
  );
};
