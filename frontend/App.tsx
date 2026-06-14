
import React, { Suspense, lazy, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from './store/useAuthStore';
import type { UserRole } from './types';
import { AppShell } from './components/ui/Layout';
import { LandingPage } from './features/landing/LandingPage';
import { AuthPage } from './features/auth/AuthPage';
import { OAuthCallback } from './features/auth/OAuthCallback';
import { SetPasswordPage } from './features/auth/SetPasswordPage';
import { userNeedsPassword } from './lib/authRoutes';
import { OnboardingPage } from './features/onboarding/OnboardingPage';
import { WorkoutPlanQuestionnaire } from './features/onboarding/WorkoutPlanQuestionnaire';
import { DietPlanQuestionnaire } from './features/onboarding/DietPlanQuestionnaire';
import { WellnessQuestionnaire } from './features/onboarding/WellnessQuestionnaire';
import { RoleDashboard } from './features/dashboard/RoleDashboard';
import { ProfilePage } from './features/profile/ProfilePage';
import { ChatAssistant } from './features/ai-chat/ChatAssistant';
import { CommunityHub } from './features/community/CommunityHub';
import { CommunityFeed } from './features/community/CommunityFeed';
import { CommunityBrowse } from './features/community/CommunityBrowse';
import { CommunityInbox } from './features/community/CommunityInbox';
import { CommunityGroups } from './features/community/CommunityGroups';
import { CommunityProfile } from './features/community/CommunityProfile';
import { CommunityProfileRedirect } from './features/community/CommunityProfileRedirect';
import { SettingsPage } from './features/settings/SettingsPage';
import { CommunitySettings } from './features/community/CommunitySettings';
import { SupportPage } from './features/support/SupportPage';
import { motion } from 'framer-motion';
import { swiftPageVariants, useMotionPrefs } from './lib/motion';
import { LazyRoute } from './components/ui/LazyRoute';
import { PageSkeleton } from './components/ui/PageSkeleton';
import RealtimeProvider from './lib/realtime/RealtimeProvider';

const WorkoutLibrary = lazy(() => import('./features/workouts/WorkoutLibrary').then((m) => ({ default: m.WorkoutLibrary })));
const NutritionLibrary = lazy(() => import('./features/nutrition/NutritionLibrary').then((m) => ({ default: m.NutritionLibrary })));
const Marketplace = lazy(() => import('./features/marketplace/Marketplace').then((m) => ({ default: m.Marketplace })));
const GymList = lazy(() => import('./features/gyms/GymList').then((m) => ({ default: m.GymList })));
const OrderHistory = lazy(() => import('./features/orders/OrderHistory').then((m) => ({ default: m.OrderHistory })));
const CheckoutWizard = lazy(() => import('./features/checkout/CheckoutWizard').then((m) => ({ default: m.CheckoutWizard })));
const MockPaymentPage = lazy(() => import('./features/checkout/MockPaymentPage').then((m) => ({ default: m.MockPaymentPage })));
const CheckoutSuccessPage = lazy(() => import('./features/checkout/CheckoutSuccessPage').then((m) => ({ default: m.CheckoutSuccessPage })));
const MuscleWikiPage = lazy(() => import('./features/muscle-wiki/MuscleWikiPage').then((m) => ({ default: m.MuscleWikiPage })));
const GymOwnerDashboard = lazy(() => import('./features/dashboard/GymOwnerDashboard').then((m) => ({ default: m.GymOwnerDashboard })));
const MemberManagement = lazy(() => import('./features/gyms/MemberManagement').then((m) => ({ default: m.MemberManagement })));
const GymEquipmentPage = lazy(() => import('./features/gyms/GymEquipmentPage').then((m) => ({ default: m.GymEquipmentPage })));
const GymReceptionPage = lazy(() => import('./features/gyms/GymReceptionPage').then((m) => ({ default: m.GymReceptionPage })));

const AuthBootScreen: React.FC = () => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    className="standalone-page flex items-center justify-center bg-background"
  >
    <PageSkeleton variant="default" className="max-w-sm w-full" />
  </motion.div>
);

const SwiftPage: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { shouldSimplify, duration, ease } = useMotionPrefs();
  if (shouldSimplify) return <>{children}</>;
  return (
    <motion.div
      variants={swiftPageVariants}
      initial="initial"
      animate="animate"
      transition={{ duration: duration * 0.5, ease }}
      className="flex min-h-0 w-full max-w-full flex-1 flex-col"
    >
      {children}
    </motion.div>
  );
};

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, authHydrated, user } = useAuthStore();
  if (!authHydrated) return <AuthBootScreen />;
  if (!isAuthenticated) return <Navigate to="/" replace />;
  if (userNeedsPassword(user)) return <Navigate to="/auth/set-password" replace />;
  return <AppShell>{children}</AppShell>;
};

const AuthOnlyRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, authHydrated } = useAuthStore();
  if (!authHydrated) return <AuthBootScreen />;
  if (!isAuthenticated) return <Navigate to="/" replace />;
  return <>{children}</>;
};

const RequirePasswordRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, authHydrated, user } = useAuthStore();
  if (!authHydrated) return <AuthBootScreen />;
  if (!isAuthenticated) return <Navigate to="/" replace />;
  if (userNeedsPassword(user)) return <Navigate to="/auth/set-password" replace />;
  return <>{children}</>;
};

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
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/auth" element={<AuthPage />} />
      <Route path="/oauth/callback" element={<OAuthCallback />} />
      <Route
        path="/auth/set-password"
        element={
          <AuthOnlyRoute>
            <SetPasswordPage />
          </AuthOnlyRoute>
        }
      />

      <Route
        path="/onboarding"
        element={
          <RequirePasswordRoute>
            <OnboardingPage />
          </RequirePasswordRoute>
        }
      />
      <Route
        path="/onboarding/workout"
        element={
          <ProtectedRoute>
            <WorkoutPlanQuestionnaire />
          </ProtectedRoute>
        }
      />
      <Route
        path="/onboarding/diet"
        element={
          <ProtectedRoute>
            <DietPlanQuestionnaire />
          </ProtectedRoute>
        }
      />
      <Route
        path="/onboarding/wellness"
        element={
          <ProtectedRoute>
            <WellnessQuestionnaire />
          </ProtectedRoute>
        }
      />

      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <SwiftPage>
              <RoleDashboard />
            </SwiftPage>
          </ProtectedRoute>
        }
      />

      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <SwiftPage>
              <ProfilePage />
            </SwiftPage>
          </ProtectedRoute>
        }
      />

      <Route
        path="/ai-assistant"
        element={
          <ProtectedRoute>
            <SwiftPage>
              <ChatAssistant />
            </SwiftPage>
          </ProtectedRoute>
        }
      />

      <Route
        path="/workouts"
        element={
          <ProtectedRoute>
            <LazyRoute skeleton="list">
              <WorkoutLibrary />
            </LazyRoute>
          </ProtectedRoute>
        }
      />

      <Route
        path="/muscle-wiki"
        element={
          <ProtectedRoute>
            <LazyRoute skeleton="default">
              <MuscleWikiPage />
            </LazyRoute>
          </ProtectedRoute>
        }
      />

      <Route
        path="/nutrition"
        element={
          <ProtectedRoute>
            <LazyRoute skeleton="grid">
              <NutritionLibrary />
            </LazyRoute>
          </ProtectedRoute>
        }
      />

      <Route
        path="/marketplace"
        element={
          <ProtectedRoute>
            <LazyRoute skeleton="grid">
              <Marketplace />
            </LazyRoute>
          </ProtectedRoute>
        }
      />

      <Route
        path="/checkout"
        element={
          <ProtectedRoute>
            <LazyRoute skeleton="default">
              <CheckoutWizard />
            </LazyRoute>
          </ProtectedRoute>
        }
      />

      <Route
        path="/checkout/pay/:orderId"
        element={
          <ProtectedRoute>
            <LazyRoute skeleton="default">
              <MockPaymentPage />
            </LazyRoute>
          </ProtectedRoute>
        }
      />

      <Route
        path="/checkout/success"
        element={
          <ProtectedRoute>
            <LazyRoute skeleton="default">
              <CheckoutSuccessPage />
            </LazyRoute>
          </ProtectedRoute>
        }
      />

      <Route
        path="/community"
        element={
          <ProtectedRoute>
            <SwiftPage>
              <CommunityHub />
            </SwiftPage>
          </ProtectedRoute>
        }>
          <Route index element={<CommunityFeed />} />
          <Route path="profile" element={<CommunityProfile />} />
          <Route path="profile/:userId" element={<CommunityProfileRedirect />} />
          <Route path="browse" element={<CommunityBrowse />} />
          <Route path="browse/:userId" element={<CommunityProfile />} />
          <Route path="inbox" element={<CommunityInbox />} />
          <Route path="groups" element={<CommunityGroups />} />
          <Route path="settings" element={<CommunitySettings />} />
        </Route>

      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <SwiftPage>
              <SettingsPage />
            </SwiftPage>
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings/community-privacy"
        element={<Navigate to="/community/settings" replace />}
      />

      <Route
        path="/support"
        element={
          <ProtectedRoute>
            <SwiftPage>
              <SupportPage />
            </SwiftPage>
          </ProtectedRoute>
        }
      />

      <Route
        path="/trainers"
        element={<Navigate to="/dashboard" replace />}
      />

      <Route
        path="/clients"
        element={<Navigate to="/dashboard" replace />}
      />

      <Route
        path="/gyms"
        element={
          <ProtectedRoute>
            <LazyRoute skeleton="list">
              <GymList />
            </LazyRoute>
          </ProtectedRoute>
        }
      />

      <Route
        path="/orders"
        element={
          <ProtectedRoute>
            <LazyRoute skeleton="list">
              <OrderHistory />
            </LazyRoute>
          </ProtectedRoute>
        }
      />

      <Route
        path="/owner/dashboard"
        element={
          <RoleRoute allowed={['gym']}>
            <LazyRoute skeleton="dashboard">
              <GymOwnerDashboard />
            </LazyRoute>
          </RoleRoute>
        }
      />

      <Route
        path="/owner/members"
        element={
          <RoleRoute allowed={['gym']}>
            <LazyRoute skeleton="list">
              <MemberManagement />
            </LazyRoute>
          </RoleRoute>
        }
      />

      <Route
        path="/owner/reception"
        element={
          <RoleRoute allowed={['gym']}>
            <LazyRoute skeleton="list">
              <GymReceptionPage />
            </LazyRoute>
          </RoleRoute>
        }
      />

      <Route
        path="/owner/equipment"
        element={
          <RoleRoute allowed={['gym']}>
            <LazyRoute skeleton="list">
              <GymEquipmentPage />
            </LazyRoute>
          </RoleRoute>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

const App: React.FC = () => {
  const { initAuth } = useAuthStore();

  useEffect(() => {
    initAuth();
  }, [initAuth]);

  return (
    <Router>
      <RealtimeProvider>
        <AnimatedRoutes />
      </RealtimeProvider>
    </Router>
  );
};

export default App;
