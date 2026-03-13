
import React, { useState, useEffect } from 'react';
import { NavLink, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/useAuthStore';
import { motion, AnimatePresence } from 'framer-motion';
import { UserRole } from '../../types';
import { Logo } from '../shared/Logo';
import { GymScene } from '../../3d/GymScene';
import { ChatWidget } from './ChatWidget';
import { NotificationDrawer } from './NotificationDrawer';
import { useNotificationStore } from '../../store/useNotificationStore';

interface NavItem {
  name: string;
  path: string;
  icon: string;
}

export const AppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, logout } = useAuthStore();
  const [isSidebarOpen, setSidebarOpen] = useState(window.innerWidth > 1024);
  const [isNotificationsOpen, setNotificationsOpen] = useState(false);
  const { unreadCount } = useNotificationStore();
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

  const navItems: NavItem[] = [
    { name: 'Home', path: '/dashboard', icon: 'dashboard' },
    { name: 'AI Coach', path: '/ai-assistant', icon: 'auto_awesome' },
    { name: 'Workouts', path: '/workouts', icon: 'fitness_center' },
    { name: 'Nutrition', path: '/nutrition', icon: 'restaurant' },
    { name: 'Find Trainers', path: '/trainers', icon: 'person_search' },
    { name: 'Gyms Near Me', path: '/gyms', icon: 'apartment' },
    { name: 'Shop', path: '/marketplace', icon: 'shopping_cart' },
    { name: 'Community', path: '/community', icon: 'groups' },
  ];

  if (user?.role === 'gym') {
    navItems.push(
      { name: 'Gym Dashboard', path: '/owner/dashboard', icon: 'admin_panel_settings' },
      { name: 'Members List', path: '/owner/members', icon: 'badge' }
    );
  }

  // Determine current page title
  const currentPath = location.pathname;
  const currentPage = navItems.find(item => item.path === currentPath) || 
                      (currentPath === '/login' ? { name: 'Role Selection' } : 
                      (currentPath === '/auth' ? { name: 'Authentication' } : { name: 'Ecosystem' }));
  
  const displayTitle = currentPage.name;

  useEffect(() => {
    document.title = `Taqwin | ${displayTitle}`;
  }, [displayTitle]);

  return (
    <div className="flex h-screen bg-background overflow-hidden relative">
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
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[100]"
          />
        )}
      </AnimatePresence>

      <motion.aside
        initial={false}
        animate={{ 
          width: isSidebarOpen ? 260 : (window.innerWidth > 1024 ? 80 : 0),
          x: (window.innerWidth <= 1024 && !isSidebarOpen) ? -260 : 0
        }}
        className="fixed lg:relative h-full z-[110] border-r border-white/5 glass-panel flex flex-col shadow-2xl overflow-hidden shrink-0"
      >
        <Link 
          to="/dashboard" 
          className="px-6 pt-14 pb-4 flex items-center gap-3 shrink-0 group cursor-pointer"
        >
          <Logo size="sm" className="group-hover:scale-110 transition-transform" />
          {isSidebarOpen && (
            <span className="font-bold text-xl tracking-tight group-hover:text-primary transition-colors">
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
                  isActive ? 'text-white bg-primary shadow-lg' : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`
              }
            >
              <span className="material-symbols-outlined text-2xl shrink-0">{item.icon}</span>
              {isSidebarOpen && <span className="font-medium text-sm whitespace-nowrap">{item.name}</span>}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-white/5">
          <button
            onClick={() => { logout(); navigate('/'); }}
            className="flex items-center gap-4 px-4 py-3 rounded-xl text-red-400 hover:bg-red-500/10 w-full transition-all group"
          >
            <span className="material-symbols-outlined text-2xl shrink-0">logout</span>
            {isSidebarOpen && <span className="font-bold text-sm">Logout</span>}
          </button>
        </div>
      </motion.aside>

      <div className="flex-1 flex flex-col min-w-0 h-full relative">
        <header className="h-20 shrink-0 border-b border-white/5 glass-panel flex items-center justify-between px-6 lg:px-8 z-30">
          <div className="flex items-center gap-6">
            <button 
              onClick={() => setSidebarOpen(!isSidebarOpen)}
              className="size-10 flex items-center justify-center bg-white/5 hover:bg-white/10 rounded-xl text-slate-300 transition-all border border-white/5"
            >
              <span className="material-symbols-outlined">{isSidebarOpen ? 'menu_open' : 'menu'}</span>
            </button>
            
            {/* Dynamic Page Title */}
            <AnimatePresence mode="wait">
              <motion.h2 
                key={displayTitle}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="text-lg font-black uppercase tracking-[0.2em] text-white/90 hidden sm:block"
              >
                {displayTitle}
              </motion.h2>
            </AnimatePresence>
          </div>

          <div className="flex items-center gap-3">
            {/* Startup Page Shortcut */}
            <Link 
              to="/"
              className="size-10 flex items-center justify-center bg-white/5 hover:bg-white/10 rounded-xl text-slate-300 border border-white/5 transition-all group"
              title="Startup Page"
            >
               <span className="material-symbols-outlined group-hover:text-accent transition-colors">rocket_launch</span>
            </Link>

            {/* Home Shortcut */}
            <Link 
              to="/dashboard"
              className="size-10 flex items-center justify-center bg-white/5 hover:bg-white/10 rounded-xl text-slate-300 border border-white/5 transition-all group"
              title="Go to Home"
            >
               <span className="material-symbols-outlined group-hover:text-primary transition-colors">home</span>
            </Link>

            <button 
              onClick={() => setNotificationsOpen(true)}
              className="relative size-10 flex items-center justify-center bg-white/5 hover:bg-white/10 rounded-xl text-slate-300 border border-white/5 transition-all"
            >
               <span className="material-symbols-outlined">notifications</span>
               {unreadCount() > 0 && (
                 <span className="absolute top-1 right-1 bg-accent text-white text-[9px] font-bold size-4 rounded-full flex items-center justify-center border-2 border-background">
                   {unreadCount()}
                 </span>
               )}
            </button>

            <div className="h-8 w-[1px] bg-white/10 mx-2" />

            <div className="flex items-center gap-3">
              <div className="text-right hidden md:block">
                <p className="text-sm font-bold leading-none">{user?.profile?.displayName || user?.email.split('@')[0]}</p>
                <p className="text-[10px] text-primary uppercase font-bold mt-1">{user?.role}</p>
              </div>
              <img 
                src={user?.profile?.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.email}`} 
                className="size-10 rounded-xl border border-primary/20 object-cover bg-surface" 
                alt="Profile" 
              />
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 custom-scrollbar">
          <div className="max-w-7xl mx-auto min-h-full">
            {children}
          </div>
        </main>
      </div>

      <ChatWidget />
      <NotificationDrawer isOpen={isNotificationsOpen} onClose={() => setNotificationsOpen(false)} />
    </div>
  );
};
