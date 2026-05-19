
import React, { Suspense, lazy, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from './store/useAuthStore';
import type { UserRole } from './types';
import { AppShell } from './components/ui/Layout';
import { LandingPage } from './features/landing/LandingPage';
import { AuthPage } from './features/auth/AuthPage';
import { OAuthCallback } from './features/auth/OAuthCallback';
import { OnboardingPage } from './features/onboarding/OnboardingPage';
import { RoleDashboard } from './features/dashboard/RoleDashboard';
import { ProfilePage } from './features/profile/ProfilePage';
import { ChatAssistant } from './features/ai-chat/ChatAssistant';
import { CommunityFeed } from './features/community/CommunityFeed';
import { SettingsPage } from './features/settings/SettingsPage';
import { SupportPage } from './features/support/SupportPage';
import { AnimatePresence, motion } from 'framer-motion';
import { pageVariants, useMotionPrefs } from './lib/motion';

// Lazy load other features
const WorkoutLibrary = lazy(() => import('./features/workouts/WorkoutLibrary').then(m => ({ default: m.WorkoutLibrary })));
const NutritionLibrary = lazy(() => import('./features/nutrition/NutritionLibrary').then(m => ({ default: m.NutritionLibrary })));
const Marketplace = lazy(() => import('./features/marketplace/Marketplace').then(m => ({ default: m.Marketplace })));
const TrainerList = lazy(() => import('./features/trainers/TrainerList').then(m => ({ default: m.TrainerList })));
const ClientList = lazy(() => import('./features/trainers/ClientList').then(m => ({ default: m.ClientList })));
const GymList = lazy(() => import('./features/gyms/GymList').then(m => ({ default: m.GymList })));
const OrderHistory = lazy(() => import('./features/orders/OrderHistory').then(m => ({ default: m.OrderHistory })));
const GymOwnerDashboard = lazy(() => import('./features/dashboard/GymOwnerDashboard').then(m => ({ default: m.GymOwnerDashboard })));
const MemberManagement = lazy(() => import('./features/gyms/MemberManagement').then(m => ({ default: m.MemberManagement })));

const AuthBootScreen: React.FC = () => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    className="min-h-screen flex items-center justify-center bg-background"
  >
    <span className="text-accent font-black text-sm uppercase tracking-widest animate-pulse">Loading…</span>
  </motion.div>
);

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, authHydrated } = useAuthStore();
  if (!authHydrated) return <AuthBootScreen />;
  if (!isAuthenticated) return <Navigate to="/" replace />;
  return <AppShell>{children}</AppShell>;
};

/** Auth-only gate without the AppShell chrome (used for onboarding). */
const AuthOnlyRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, authHydrated } = useAuthStore();
  if (!authHydrated) return <AuthBootScreen />;
  if (!isAuthenticated) return <Navigate to="/" replace />;
  return <>{children}</>;
};

/** Logged-in users only; role must be one of `allowed` (Phase 1 RBAC). */
const RoleRoute: React.FC<{ children: React.ReactNode; allowed: UserRole[] }> = ({ children, allowed }) => {
  const { isAuthenticated, authHydrated, user } = useAuthStore();
  if (!authHydrated) return <AuthBootScreen />;
  if (!isAuthenticated) return <Navigate to="/" replace />;
  if (!user?.role || !allowed.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }
  return <AppShell>{children}</AppShell>;
};

const AnimatedRoutes = () => {
  const location = useLocation();
  const { duration, ease } = useMotionPrefs();

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<LandingPage />} />
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/oauth/callback" element={<OAuthCallback />} />

        <Route path="/onboarding" element={
          <AuthOnlyRoute>
            <OnboardingPage />
          </AuthOnlyRoute>
        } />
        
        <Route path="/dashboard" element={
          <ProtectedRoute>
            <motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit" transition={{ duration, ease }}>
              <RoleDashboard />
            </motion.div>
          </ProtectedRoute>
        } />

        <Route path="/profile" element={
          <ProtectedRoute>
            <motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit" transition={{ duration, ease }}>
              <ProfilePage />
            </motion.div>
          </ProtectedRoute>
        } />
        
        <Route path="/ai-assistant" element={
          <ProtectedRoute>
            <motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit" transition={{ duration, ease }}>
              <ChatAssistant />
            </motion.div>
          </ProtectedRoute>
        } />

        <Route path="/workouts" element={
          <ProtectedRoute>
            <Suspense fallback={<div className="p-8 text-primary animate-pulse">Loading Workouts...</div>}>
              <motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit" transition={{ duration, ease }}>
                <WorkoutLibrary />
              </motion.div>
            </Suspense>
          </ProtectedRoute>
        } />

        <Route path="/nutrition" element={
          <ProtectedRoute>
            <Suspense fallback={<div className="p-8 text-primary animate-pulse">Loading Nutrition...</div>}>
              <motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit" transition={{ duration, ease }}>
                <NutritionLibrary />
              </motion.div>
            </Suspense>
          </ProtectedRoute>
        } />

        <Route path="/marketplace" element={
          <ProtectedRoute>
            <Suspense fallback={<div className="p-8 text-primary animate-pulse">Loading Marketplace...</div>}>
              <motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit" transition={{ duration, ease }}>
                <Marketplace />
              </motion.div>
            </Suspense>
          </ProtectedRoute>
        } />

        <Route path="/community" element={
          <ProtectedRoute>
            <motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit" transition={{ duration, ease }}>
              <CommunityFeed />
            </motion.div>
          </ProtectedRoute>
        } />

        <Route path="/settings" element={
          <ProtectedRoute>
            <motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit" transition={{ duration, ease }}>
              <SettingsPage />
            </motion.div>
          </ProtectedRoute>
        } />

        <Route path="/support" element={
          <ProtectedRoute>
            <motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit" transition={{ duration, ease }}>
              <SupportPage />
            </motion.div>
          </ProtectedRoute>
        } />

        <Route path="/trainers" element={
          <ProtectedRoute>
            <Suspense fallback={<div className="p-8 text-primary animate-pulse">Loading Trainers...</div>}>
              <motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit" transition={{ duration, ease }}>
                <TrainerList />
              </motion.div>
            </Suspense>
          </ProtectedRoute>
        } />

        <Route path="/clients" element={
          <RoleRoute allowed={['trainer']}>
            <Suspense fallback={<div className="p-8 text-primary animate-pulse">Syncing Clients...</div>}>
              <motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit" transition={{ duration, ease }}>
                <ClientList />
              </motion.div>
            </Suspense>
          </RoleRoute>
        } />

        <Route path="/gyms" element={
          <ProtectedRoute>
            <Suspense fallback={<div className="p-8 text-primary animate-pulse">Loading Gyms...</div>}>
              <motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit" transition={{ duration, ease }}>
                <GymList />
              </motion.div>
            </Suspense>
          </ProtectedRoute>
        } />

        <Route path="/orders" element={
          <ProtectedRoute>
            <Suspense fallback={<div className="p-8 text-primary animate-pulse">Loading History...</div>}>
              <motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit" transition={{ duration, ease }}>
                <OrderHistory />
              </motion.div>
            </Suspense>
          </ProtectedRoute>
        } />

        <Route path="/owner/dashboard" element={
          <RoleRoute allowed={['gym']}>
            <Suspense fallback={<div className="p-8 text-primary animate-pulse">Accessing Command Center...</div>}>
              <motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit" transition={{ duration, ease }}>
                <GymOwnerDashboard />
              </motion.div>
            </Suspense>
          </RoleRoute>
        } />

        <Route path="/owner/members" element={
          <RoleRoute allowed={['gym']}>
            <Suspense fallback={<div className="p-8 text-primary animate-pulse">Syncing Roster...</div>}>
              <motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit" transition={{ duration, ease }}>
                <MemberManagement />
              </motion.div>
            </Suspense>
          </RoleRoute>
        } />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AnimatePresence>
  );
};

const App: React.FC = () => {
  const { initAuth } = useAuthStore();

  useEffect(() => {
    // Initialize auth from localStorage on app start
    initAuth();
  }, [initAuth]);

  return (
    <Router>
      <AnimatedRoutes />
    </Router>
  );
};

export default App;
