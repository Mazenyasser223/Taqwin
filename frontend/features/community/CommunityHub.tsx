import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useI18n } from '../../lib/i18n/useI18n';

const tabs = [
  { to: '/community', labelKey: 'community.tabFeed' as const, end: true },
  { to: '/community/profile', labelKey: 'community.tabProfile' as const },
  { to: '/community/groups', labelKey: 'community.tabGroups' as const },
  { to: '/community/inbox', labelKey: 'community.tabInbox' as const },
];

export const CommunityHub: React.FC = () => {
  const { t } = useI18n();

  return (
    <motion.div className="max-w-2xl mx-auto space-y-6 pb-24">
      <div className="flex gap-2 p-1 rounded-2xl bg-surface/60 border border-border">
        {tabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) =>
              `shrink-0 flex-1 min-w-[4.5rem] text-center py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                isActive ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-muted hover:text-foreground'
              }`
            }
          >
            {t(tab.labelKey)}
          </NavLink>
        ))}
      </div>
      <Outlet />
    </motion.div>
  );
};
