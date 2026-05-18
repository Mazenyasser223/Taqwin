
import React, { useState, useEffect } from 'react';
import { NavLink, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/useAuthStore';
import { motion, AnimatePresence } from 'framer-motion';
import { Logo } from '../shared/Logo';
import { GymScene } from '../../3d/GymScene';
import { ChatWidget } from './ChatWidget';
import { NotificationDrawer } from './NotificationDrawer';
import { useNotificationStore } from '../../store/useNotificationStore';
import { useI18n } from '../../lib/i18n/useI18n';
import type { TranslationKey } from '../../lib/i18n/translations';

interface NavItem {
  i18nKey: TranslationKey;
  path: string;
  icon: string;
}

export const AppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, logout } = useAuthStore();
  const { t } = useI18n();
  const [isSidebarOpen, setSidebarOpen] = useState(window.innerWidth > 1024);
  const [isNotificationsOpen, setNotificationsOpen] = useState(false);
  const { unreadCount, refresh } = useNotificationStore();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth <= 1024) setSidebarOpen(false);
      else setSidebarOpen(true);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    refresh();
    const id = window.setInterval(refresh, 60_000);
    return () => window.clearInterval(id);
  }, [refresh]);

  const navItems: NavItem[] = [
    { i18nKey: 'nav.home', path: '/dashboard', icon: 'dashboard' },
    { i18nKey: 'nav.profile', path: '/profile', icon: 'person' },
    { i18nKey: 'nav.aiCoach', path: '/ai-assistant', icon: 'auto_awesome' },
    { i18nKey: 'nav.workouts', path: '/workouts', icon: 'fitness_center' },
    { i18nKey: 'nav.nutrition', path: '/nutrition', icon: 'restaurant' },
    { i18nKey: 'nav.trainers', path: '/trainers', icon: 'person_search' },
    { i18nKey: 'nav.gyms', path: '/gyms', icon: 'apartment' },
    { i18nKey: 'nav.shop', path: '/marketplace', icon: 'shopping_cart' },
    { i18nKey: 'nav.community', path: '/community', icon: 'groups' },
    { i18nKey: 'nav.settings', path: '/settings', icon: 'settings' },
    { i18nKey: 'nav.support', path: '/support', icon: 'help' },
  ];

  if (user?.role === 'gym') {
    navItems.push(
      { i18nKey: 'nav.gymDashboard', path: '/owner/dashboard', icon: 'admin_panel_settings' },
      { i18nKey: 'nav.members', path: '/owner/members', icon: 'badge' }
    );
  }

  const currentPath = location.pathname;
  const currentPage = navItems.find((item) => item.path === currentPath);
  const displayTitle = currentPage
    ? t(currentPage.i18nKey)
    : currentPath === '/login'
      ? t('nav.roleSelection')
      : currentPath === '/auth'
        ? t('nav.auth')
        : t('nav.ecosystem');

  useEffect(() => {
    document.title = `Taqwin | ${displayTitle}`;
  }, [displayTitle]);

  return (
    <motion.div className="flex h-screen bg-background overflow-hidden relative">
      <div className="immersive-bg">
        <GymScene />
        <div className="absolute inset-0 bg-background/60 backdrop-blur-[1px] pointer-events-none" />
      </div>

      <AnimatePresence>
        {isSidebarOpen && window.innerWidth <= 1024 && (
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

      <motion.aside
        initial={false}
        animate={{
          width: isSidebarOpen ? 260 : window.innerWidth > 1024 ? 80 : 0,
          x: window.innerWidth <= 1024 && !isSidebarOpen ? -260 : 0,
        }}
        className="fixed lg:relative h-full z-[110] border-r border-subtle glass-panel flex flex-col shadow-2xl overflow-hidden shrink-0"
      >
        <Link
          to="/dashboard"
          className="px-6 pt-14 pb-4 flex items-center gap-3 shrink-0 group cursor-pointer"
        >
          <Logo size="sm" className="group-hover:scale-110 transition-transform" />
          {isSidebarOpen && (
            <span className="font-bold text-xl tracking-tight text-foreground group-hover:text-primary transition-colors">
              Taqwin
            </span>
          )}
        </Link>

        <nav className="flex-1 px-3 space-y-1 overflow-y-auto no-scrollbar pt-4">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-4 px-4 py-3 rounded-xl transition-all group relative ${
                  isActive
                    ? 'text-white bg-primary shadow-lg'
                    : 'text-muted hover:text-foreground hover:bg-elevated-hover'
                }`
              }
            >
              <span className="material-symbols-outlined text-2xl shrink-0">{item.icon}</span>
              {isSidebarOpen && (
                <span className="font-medium text-sm whitespace-nowrap">{t(item.i18nKey)}</span>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-subtle">
          <button
            onClick={() => {
              logout();
              navigate('/');
            }}
            className="flex items-center gap-4 px-4 py-3 rounded-xl text-red-400 hover:bg-red-500/10 w-full transition-all group"
          >
            <span className="material-symbols-outlined text-2xl shrink-0">logout</span>
            {isSidebarOpen && <span className="font-bold text-sm">{t('nav.logout')}</span>}
          </button>
        </div>
      </motion.aside>

      <div className="flex-1 flex flex-col min-w-0 h-full relative">
        <header className="h-20 shrink-0 border-b border-subtle glass-panel flex items-center justify-between px-6 lg:px-8 z-30">
          <div className="flex items-center gap-6">
            <button
              onClick={() => setSidebarOpen(!isSidebarOpen)}
              className="size-10 flex items-center justify-center bg-elevated bg-elevated-hover rounded-xl text-muted transition-all border border-subtle"
            >
              <span className="material-symbols-outlined">{isSidebarOpen ? 'menu_open' : 'menu'}</span>
            </button>

            <AnimatePresence mode="wait">
              <motion.h2
                key={displayTitle}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="text-lg font-black uppercase tracking-[0.2em] text-foreground/90 hidden sm:block"
              >
                {displayTitle}
              </motion.h2>
            </AnimatePresence>
          </div>

          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="size-10 flex items-center justify-center bg-elevated bg-elevated-hover rounded-xl text-muted border border-subtle transition-all group"
              title="Startup Page"
            >
              <span className="material-symbols-outlined group-hover:text-accent transition-colors">
                rocket_launch
              </span>
            </Link>

            <Link
              to="/dashboard"
              className="size-10 flex items-center justify-center bg-elevated bg-elevated-hover rounded-xl text-muted border border-subtle transition-all group"
              title={t('nav.home')}
            >
              <span className="material-symbols-outlined group-hover:text-primary transition-colors">home</span>
            </Link>

            <button
              onClick={() => setNotificationsOpen(true)}
              className="relative size-10 flex items-center justify-center bg-elevated bg-elevated-hover rounded-xl text-muted border border-subtle transition-all"
            >
              <span className="material-symbols-outlined">notifications</span>
              {unreadCount() > 0 && (
                <span className="absolute top-1 end-1 bg-accent text-white text-[9px] font-bold size-4 rounded-full flex items-center justify-center border-2 border-background">
                  {unreadCount()}
                </span>
              )}
            </button>

            <div className="h-8 w-px bg-[var(--glass-border)] mx-2" />

            <div className="flex items-center gap-3">
              <div className="text-end hidden md:block">
                <p className="text-sm font-bold leading-none text-foreground">
                  {user?.profile?.displayName || user?.email.split('@')[0]}
                </p>
                <p className="text-[10px] text-primary uppercase font-bold mt-1">{user?.role}</p>
              </div>
              <img
                src={
                  user?.profile?.avatarUrl ||
                  `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.email}`
                }
                className="size-10 rounded-xl border border-primary/20 object-cover bg-surface"
                alt="Profile"
              />
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 custom-scrollbar">
          <div className="max-w-7xl mx-auto min-h-full">{children}</div>
        </main>
      </div>

      <ChatWidget />
      <NotificationDrawer isOpen={isNotificationsOpen} onClose={() => setNotificationsOpen(false)} />
    </motion.div>
  );
};
