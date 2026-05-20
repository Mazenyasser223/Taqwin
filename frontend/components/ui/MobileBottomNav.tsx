import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useI18n } from '../../lib/i18n/useI18n';
import { useAuthStore } from '../../store/useAuthStore';
import type { TranslationKey } from '../../lib/i18n/translations';

interface TabItem {
  i18nKey: TranslationKey;
  path: string;
  icon: string;
}

const PRIMARY_TABS: TabItem[] = [
  { i18nKey: 'nav.home', path: '/dashboard', icon: 'dashboard' },
  { i18nKey: 'nav.workouts', path: '/workouts', icon: 'fitness_center' },
  { i18nKey: 'nav.nutrition', path: '/nutrition', icon: 'restaurant' },
  { i18nKey: 'nav.aiCoach', path: '/ai-assistant', icon: 'auto_awesome' },
  { i18nKey: 'nav.profile', path: '/profile', icon: 'person' },
];

const MORE_ITEMS: TabItem[] = [
  { i18nKey: 'nav.muscleWiki', path: '/muscle-wiki', icon: 'accessibility_new' },
  { i18nKey: 'nav.trainers', path: '/trainers', icon: 'person_search' },
  { i18nKey: 'nav.gyms', path: '/gyms', icon: 'apartment' },
  { i18nKey: 'nav.shop', path: '/marketplace', icon: 'shopping_cart' },
  { i18nKey: 'nav.community', path: '/community', icon: 'groups' },
  { i18nKey: 'nav.settings', path: '/settings', icon: 'settings' },
  { i18nKey: 'nav.support', path: '/support', icon: 'help' },
];

const GYM_MORE: TabItem[] = [
  { i18nKey: 'nav.gymDashboard', path: '/owner/dashboard', icon: 'admin_panel_settings' },
  { i18nKey: 'nav.members', path: '/owner/members', icon: 'badge' },
];

export const MobileBottomNav: React.FC = () => {
  const { t } = useI18n();
  const { user } = useAuthStore();
  const location = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);

  const moreItems = user?.role === 'gym' ? [...MORE_ITEMS, ...GYM_MORE] : MORE_ITEMS;
  const isMoreActive = moreItems.some((i) => i.path === location.pathname);

  return (
    <>
      <AnimatePresence>
        {moreOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[90] bg-background/70 backdrop-blur-sm lg:hidden"
            onClick={() => setMoreOpen(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {moreOpen && (
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 400, damping: 32 }}
            className="fixed inset-x-0 bottom-0 z-[95] lg:hidden glass-panel border-t border-subtle rounded-t-3xl safe-bottom pb-20 max-h-[70dvh] overflow-y-auto custom-scrollbar"
          >
            <motion.nav className="p-4 grid grid-cols-2 gap-2">
              {moreItems.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={() => setMoreOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-4 py-3 min-h-11 rounded-xl transition-all ${
                      isActive
                        ? 'bg-primary text-white shadow-lg'
                        : 'text-muted hover:bg-elevated-hover hover:text-foreground'
                    }`
                  }
                >
                  <span className="material-symbols-outlined text-xl shrink-0">{item.icon}</span>
                  <span className="font-medium text-sm">{t(item.i18nKey)}</span>
                </NavLink>
              ))}
            </motion.nav>
          </motion.div>
        )}
      </AnimatePresence>

      <nav
        className="fixed inset-x-0 bottom-0 z-[85] lg:hidden glass-panel border-t border-subtle safe-bottom"
        aria-label={t('nav.mobileNav')}
      >
        <motion.div className="flex items-stretch justify-around px-1 pt-1 pb-1">
          {PRIMARY_TABS.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex flex-1 flex-col items-center justify-center gap-0.5 py-2 min-h-11 min-w-0 rounded-xl transition-colors ${
                  isActive ? 'text-primary' : 'text-muted hover:text-foreground'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className="material-symbols-outlined text-2xl"
                    style={isActive ? { fontVariationSettings: "'FILL' 1" } : undefined}
                  >
                    {item.icon}
                  </span>
                  <span className="text-[9px] font-bold uppercase tracking-wide truncate max-w-full px-0.5">
                    {t(item.i18nKey)}
                  </span>
                </>
              )}
            </NavLink>
          ))}
          <button
            type="button"
            onClick={() => setMoreOpen((o) => !o)}
            className={`flex flex-1 flex-col items-center justify-center gap-0.5 py-2 min-h-11 min-w-0 rounded-xl transition-colors ${
              isMoreActive || moreOpen ? 'text-primary' : 'text-muted hover:text-foreground'
            }`}
            aria-expanded={moreOpen}
            aria-haspopup="true"
          >
            <span
              className="material-symbols-outlined text-2xl"
              style={isMoreActive || moreOpen ? { fontVariationSettings: "'FILL' 1" } : undefined}
            >
              more_horiz
            </span>
            <span className="text-[9px] font-bold uppercase tracking-wide">{t('nav.more')}</span>
          </button>
        </motion.div>
      </nav>
    </>
  );
};

/** Paths covered by bottom nav — used to highlight “more” and avoid duplicate nav state issues */
export function isMobileNavPath(path: string): boolean {
  const primary = PRIMARY_TABS.map((i) => i.path);
  const more = [...MORE_ITEMS, ...GYM_MORE].map((i) => i.path);
  return [...primary, ...more].includes(path);
}
