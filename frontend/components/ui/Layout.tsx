
import React, { useState, useEffect } from 'react';
import { NavLink, Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/useAuthStore';
import { motion, AnimatePresence } from 'framer-motion';
import { Logo } from '../shared/Logo';
import { UserAvatar } from '../ui/UserAvatar';
import { GymScene } from '../../3d/GymScene';
import { ChatWidget } from './ChatWidget';
import { FloatingInbox } from './FloatingInbox';
import { NotificationDrawer } from './NotificationDrawer';
import { useNotificationStore } from '../../store/useNotificationStore';
import { useI18n } from '../../lib/i18n/useI18n';
import { useBreakpoint } from '../../lib/hooks/useBreakpoint';
import { useMotionPrefs } from '../../lib/motion';
import { prefetchCommonRoutes, prefetchNavIntent, prefetchRoute } from '../../lib/routePrefetch';
import type { TranslationKey } from '../../lib/i18n/translations';
import { usePresenceHeartbeat } from '../../features/community/usePresenceHeartbeat';
import { useRealtimeNotifications } from '../../lib/realtime/useRealtimeNotifications';
import { useRealtimeStore } from '../../lib/realtime/useRealtimeStore';
import { usePageChromeStore } from '../../store/usePageChromeStore';

interface NavItem {
  i18nKey: TranslationKey;
  path: string;
  icon: string;
}

export const AppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, logout, authHydrated, refreshUser } = useAuthStore();
  usePresenceHeartbeat();
  useRealtimeNotifications();
  const { t, isRtl } = useI18n();
  const { isLgUp } = useBreakpoint();
  const { shouldSimplify } = useMotionPrefs();
  const [isSidebarOpen, setSidebarOpen] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 1024 : true
  );
  const [isNotificationsOpen, setNotificationsOpen] = useState(false);
  const { unreadCount, refresh } = useNotificationStore();
  const connectionState = useRealtimeStore((s) => s.connectionState);
  const realtimeOpen = connectionState === 'open';
  const location = useLocation();

  useEffect(() => {
    if (!authHydrated || !user) return;
    if (user.canManageShop === undefined) {
      void refreshUser();
    }
  }, [authHydrated, user?.id, user?.canManageShop, refreshUser]);

  useEffect(() => {
    if (!isLgUp) setSidebarOpen(false);
    else setSidebarOpen(true);
  }, [isLgUp]);

  useEffect(() => {
    refresh();
    if (realtimeOpen) return;

    const onCommunity = location.pathname.includes('/community');
    const intervalMs = isNotificationsOpen
      ? 5_000
      : onCommunity
        ? 15_000
        : 60_000;
    const id = window.setInterval(() => {
      if (useRealtimeStore.getState().connectionState === 'open') return;
      refresh();
    }, intervalMs);
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refresh, location.pathname, isNotificationsOpen, realtimeOpen]);

  useEffect(() => {
    if (!user) return;
    if (user.role === 'gym') {
      for (const path of ['/owner/dashboard', '/owner/reception', '/owner/equipment', '/settings']) {
        prefetchRoute(path);
      }
    }
    prefetchCommonRoutes({
      includeGym: user.role === 'gym',
      includeAthlete: user.role === 'athlete',
    });
  }, [user?.id, user?.role]);

  const closeSidebarOnNavigate = () => {
    if (!isLgUp) setSidebarOpen(false);
  };

  const isFlowQuestionnaire = /^\/onboarding\/(workout|diet|wellness)(\/|$)/.test(location.pathname);
  const isCommunity = location.pathname.includes('/community');
  const isCommunityInboxPage = /^\/community\/inbox(\/|$)/.test(location.pathname);

  const athleteNavItems: NavItem[] = [
    { i18nKey: 'nav.home', path: '/dashboard', icon: 'dashboard' },
    { i18nKey: 'nav.myPlans', path: '/dashboard/plans', icon: 'assignment' },
    { i18nKey: 'nav.profile', path: '/profile', icon: 'person' },
    { i18nKey: 'nav.aiCoach', path: '/ai-assistant', icon: 'auto_awesome' },
    { i18nKey: 'nav.workouts', path: '/workouts', icon: 'fitness_center' },
    { i18nKey: 'nav.muscleWiki', path: '/muscle-wiki', icon: 'accessibility_new' },
    { i18nKey: 'nav.nutrition', path: '/nutrition', icon: 'restaurant' },
    { i18nKey: 'nav.gyms', path: '/gyms', icon: 'apartment' },
    { i18nKey: 'nav.shop', path: '/marketplace', icon: 'shopping_cart' },
    { i18nKey: 'nav.community', path: '/community', icon: 'groups' },
    { i18nKey: 'nav.settings', path: '/settings', icon: 'settings' },
    { i18nKey: 'nav.support', path: '/support', icon: 'help' },
  ];

  const gymNavItems: NavItem[] = [
    { i18nKey: 'nav.profile', path: '/profile', icon: 'person' },
    { i18nKey: 'nav.community', path: '/community', icon: 'groups' },
    { i18nKey: 'nav.settings', path: '/settings', icon: 'settings' },
    { i18nKey: 'nav.support', path: '/support', icon: 'help' },
    { i18nKey: 'nav.gymDashboard', path: '/owner/dashboard', icon: 'admin_panel_settings' },
    { i18nKey: 'nav.reception', path: '/owner/reception', icon: 'how_to_reg' },
    { i18nKey: 'nav.gymEquipments', path: '/owner/equipment', icon: 'exercise' },
  ];

  const navItems = user?.role === 'gym' ? gymNavItems : athleteNavItems;

  if (user?.canManageShop) {
    navItems.unshift({ i18nKey: 'nav.adminShop', path: '/admin/shop', icon: 'storefront' });
  }

  const currentPath = location.pathname;
  const currentPage = navItems.find(
    (item) =>
      item.path === currentPath ||
      (item.path === '/dashboard/plans' && currentPath.startsWith('/dashboard/plans')) ||
      (item.path === '/community' && currentPath.startsWith('/community')) ||
      (item.path === '/admin/shop' && currentPath.startsWith('/admin/shop'))
  );
  const chromeTitle = usePageChromeStore((s) => s.title);
  const chromeBack = usePageChromeStore((s) => s.back);
  const chromeAlert = usePageChromeStore((s) => s.alert);

  const displayTitle = currentPage
    ? t(currentPage.i18nKey)
    : currentPath === '/login'
      ? t('nav.roleSelection')
      : currentPath === '/auth'
        ? t('nav.auth')
        : t('nav.ecosystem');

  const headerTitle = chromeTitle ?? displayTitle;

  useEffect(() => {
    document.title = `Taqwin | ${headerTitle}`;
  }, [headerTitle]);

  useEffect(() => {
    return () => usePageChromeStore.getState().clear();
  }, [location.pathname]);

  const showImmersive3d = isLgUp && !shouldSimplify;
  const mobileDrawerOffset = isRtl ? '100%' : '-100%';

  const sidebarContent = (
    <>
      <Link
        to="/dashboard"
        onClick={closeSidebarOnNavigate}
        className="px-6 pt-14 pb-4 flex items-center gap-3 shrink-0 group cursor-pointer safe-top"
      >
        <Logo size="sm" className="group-hover:scale-110 transition-transform" />
        {(isLgUp ? isSidebarOpen : true) && (
          <span className="font-bold text-xl tracking-tight text-foreground group-hover:text-primary transition-colors select-none">
            Taqwin
          </span>
        )}
      </Link>

      <nav className="relative flex-1 px-3 space-y-1 overflow-y-auto overflow-x-hidden no-scrollbar pt-4">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/dashboard'}
            onClick={closeSidebarOnNavigate}            {...prefetchNavIntent(item.path)}
            className={({ isActive }) =>
              `flex items-center gap-4 px-4 py-3 min-h-11 rounded-xl transition-all group relative ${
                isActive
                  ? 'text-white bg-primary shadow-lg'
                  : 'text-muted hover:text-foreground hover:bg-elevated-hover'
              }`
            }
          >
            <span className="material-symbols-outlined text-2xl shrink-0">{item.icon}</span>
            {(isLgUp ? isSidebarOpen : true) && (
              <span className="font-medium text-base whitespace-nowrap">{t(item.i18nKey)}</span>
            )}
          </NavLink>
        ))}
      </nav>
      <motion.div className="p-4 border-t border-subtle">
        <button
          onClick={() => logout()}
          className="flex items-center gap-4 px-4 py-3 min-h-11 rounded-xl text-red-400 hover:bg-red-500/10 w-full transition-all group"
        >
          <span className="material-symbols-outlined text-2xl shrink-0">logout</span>
          {(isLgUp ? isSidebarOpen : true) && <span className="font-bold text-sm">{t('nav.logout')}</span>}
        </button>
      </motion.div>
    </>
  );

  return (
    <motion.div className="flex app-viewport w-full max-w-[100vw] bg-background relative">
      <div className="immersive-bg">
        {showImmersive3d ? <GymScene /> : null}
        <div className="absolute inset-0 bg-background/60 backdrop-blur-[1px] pointer-events-none" />
      </div>

      <AnimatePresence>
        {isSidebarOpen && !isLgUp && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 backdrop-blur-sm z-[100]"
            style={{ backgroundColor: 'var(--overlay)' }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {!isLgUp && isSidebarOpen && (
          <motion.aside
            key="mobile-sidebar"
            initial={{ x: mobileDrawerOffset }}
            animate={{ x: 0 }}
            exit={{ x: mobileDrawerOffset }}
            transition={{ type: 'spring', damping: 30, stiffness: 340 }}
            className="fixed top-0 bottom-0 start-0 z-[130] flex w-[min(260px,85vw)] flex-col overflow-hidden glass-panel border-e border-subtle shadow-2xl safe-top safe-bottom"
          >
            {sidebarContent}
          </motion.aside>
        )}
      </AnimatePresence>

      {isLgUp && (
        <motion.aside
          initial={false}
          animate={{ width: isSidebarOpen ? 260 : 80 }}
          className="relative z-[130] flex h-[100dvh] max-h-[100dvh] shrink-0 flex-col overflow-visible glass-panel border-e border-subtle shadow-2xl"
        >
          {sidebarContent}
        </motion.aside>
      )}

      <div className="flex-1 flex flex-col min-w-0 min-h-0 w-full max-w-full relative">
        {!isFlowQuestionnaire && (
        <header className="shrink-0 border-b border-subtle glass-panel z-30 safe-top">
          <div className="flex h-16 sm:h-20 items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2 sm:gap-4 min-w-0">
            <button
              onClick={() => setSidebarOpen(!isSidebarOpen)}
              className="size-10 flex items-center justify-center bg-elevated bg-elevated-hover rounded-xl text-muted transition-all border border-subtle shrink-0"
              aria-label={isSidebarOpen ? t('nav.closeMenu') : t('nav.openMenu')}
            >
              <span className="material-symbols-outlined">{isSidebarOpen ? 'menu_open' : 'menu'}</span>
            </button>

            {chromeBack ? (
              <Link
                to={chromeBack.to}
                className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-subtle bg-elevated px-2 py-1.5 text-xs font-semibold text-muted transition-colors hover:bg-elevated-hover hover:text-primary sm:gap-1.5 sm:px-3 sm:text-sm"
              >
                <span className="material-symbols-outlined text-lg">arrow_back</span>
                <span className="hidden sm:inline">{chromeBack.label}</span>
              </Link>
            ) : null}

            <AnimatePresence mode="wait">
              <motion.h2
                key={headerTitle}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="text-sm sm:text-lg font-black uppercase tracking-[0.15em] sm:tracking-[0.2em] text-foreground/90 truncate"
              >
                {headerTitle}
              </motion.h2>
            </AnimatePresence>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            <Link
              to="/"
              className="flex size-9 sm:size-10 items-center justify-center bg-elevated bg-elevated-hover rounded-xl text-muted border border-subtle transition-all group shrink-0"
              title={t('nav.startupPage')}
              aria-label={t('nav.startupPage')}
            >
              <span className="material-symbols-outlined text-[22px] sm:text-2xl group-hover:text-accent transition-colors">
                rocket_launch
              </span>
            </Link>

            {user?.role !== 'gym' && (
            <Link
              to="/dashboard"
              className="flex size-9 sm:size-10 items-center justify-center bg-elevated bg-elevated-hover rounded-xl text-muted border border-subtle transition-all group shrink-0"
              title={t('nav.home')}
              aria-label={t('nav.home')}
            >
              <span className="material-symbols-outlined text-[22px] sm:text-2xl group-hover:text-primary transition-colors">
                home
              </span>
            </Link>
            )}

            <button
              onClick={() => setNotificationsOpen(true)}
              className="relative flex size-9 sm:size-10 shrink-0 items-center justify-center bg-elevated bg-elevated-hover rounded-xl text-muted border border-subtle transition-all"
              aria-label={t('notifications.feedTitle')}
            >
              <span className="material-symbols-outlined text-[22px] sm:text-2xl">notifications</span>
              {unreadCount() > 0 && (
                <span className="absolute top-1 end-1 bg-accent text-white text-[9px] font-bold size-4 rounded-full flex items-center justify-center border-2 border-background">
                  {unreadCount()}
                </span>
              )}
            </button>

            <div className="hidden sm:block h-8 w-px bg-[var(--glass-border)] mx-1" />

            <Link to="/profile" className="flex items-center gap-3">
              <motion.div className="text-end hidden md:block">
                <p className="text-sm font-bold leading-none text-foreground">
                  {user?.profile?.displayName || user?.email.split('@')[0]}
                </p>
                <p className="text-[10px] text-primary uppercase font-bold mt-1">{user?.role}</p>
              </motion.div>
              <UserAvatar
                avatarUrl={user?.profile?.avatarUrl}
                displayName={user?.profile?.displayName}
                email={user?.email}
                className="size-9 sm:size-10 text-sm rounded-xl border border-primary/20"
                imgClassName="size-9 sm:size-10 shrink-0 rounded-xl border border-primary/20 object-cover bg-surface"
                alt={t('nav.profileAlt')}
              />
            </Link>
          </div>
          </div>

          {chromeAlert ? (
            <div
              className={`flex flex-col gap-2 border-t px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8 ${
                chromeAlert.tone === 'warning'
                  ? 'border-amber-500/30 bg-amber-500/10'
                  : 'border-primary/30 bg-primary/10'
              }`}
            >
              <div className="min-w-0">
                <p
                  className={`text-sm font-semibold ${
                    chromeAlert.tone === 'warning'
                      ? 'text-amber-800 dark:text-amber-300'
                      : 'text-primary'
                  }`}
                >
                  {chromeAlert.title}
                </p>
                {chromeAlert.subtitle ? (
                  <p className="mt-0.5 line-clamp-2 text-xs text-muted sm:line-clamp-1">
                    {chromeAlert.subtitle}
                  </p>
                ) : null}
                {chromeAlert.detail ? (
                  <p
                    className={`mt-0.5 text-xs ${
                      chromeAlert.tone === 'warning'
                        ? 'text-amber-700 dark:text-amber-400'
                        : 'text-primary/80'
                    }`}
                  >
                    {chromeAlert.detail}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={chromeAlert.onAction}
                className="shrink-0 self-start rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white sm:self-center sm:px-4 sm:py-2 sm:text-sm"
              >
                {chromeAlert.actionLabel}
              </button>
            </div>
          ) : null}
        </header>
        )}

        <main
          className={
            isFlowQuestionnaire
              ? 'flex flex-1 flex-col min-h-0 min-w-0 overflow-hidden p-0'
              : `app-scroll flex h-full min-h-0 w-full min-w-0 max-w-full flex-1 flex-col ${
                  isCommunity ? 'p-3 sm:p-6 lg:p-8' : 'p-4 sm:p-6 lg:p-8'
                } pb-[max(1rem,env(safe-area-inset-bottom,0px))] lg:pb-8 text-sm sm:text-lg custom-scrollbar overflow-x-hidden`
          }
        >
          <motion.div
            className={
              isFlowQuestionnaire
                ? 'flex flex-1 min-h-0 w-full max-w-none flex flex-col'
                : 'app-main-inner mx-auto w-full max-w-7xl'
            }
          >
            {children}
          </motion.div>
        </main>
      </div>

      {/* Desktop: shared bar — side by side. Mobile: each self-positions */}
      {!isFlowQuestionnaire && (
        <div className="hidden lg:flex fixed bottom-8 right-8 z-[100] items-end gap-3">
          <FloatingInbox />
          <ChatWidget />
        </div>
      )}
      {!isFlowQuestionnaire && !isCommunityInboxPage && (
        <div className="lg:hidden"><FloatingInbox /></div>
      )}
      {!isFlowQuestionnaire && !isCommunityInboxPage && (
        <div className="lg:hidden"><ChatWidget /></div>
      )}

      <NotificationDrawer isOpen={isNotificationsOpen} onClose={() => setNotificationsOpen(false)} />
    </motion.div>
  );
};
