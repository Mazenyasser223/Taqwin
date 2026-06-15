
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
const ProductPage = lazy(() => import('./features/marketplace/ProductPage').then((m) => ({ default: m.ProductPage })));
const CartPage = lazy(() => import('./features/marketplace/CartPage').then((m) => ({ default: m.CartPage })));
const WishlistPage = lazy(() => import('./features/marketplace/WishlistPage').then((m) => ({ default: m.WishlistPage })));
const GymList = lazy(() => import('./features/gyms/GymList').then((m) => ({ default: m.GymList })));
const OrderHistory = lazy(() => import('./features/orders/OrderHistory').then((m) => ({ default: m.OrderHistory })));
const OrderDetailPage = lazy(() => import('./features/orders/OrderDetailPage').then((m) => ({ default: m.OrderDetailPage })));
const PaymentSuccess = lazy(() =>
  import('./features/payments/PaymentPages').then((m) => ({ default: m.PaymentSuccess }))
);
const PaymentFailed = lazy(() =>
  import('./features/payments/PaymentPages').then((m) => ({ default: m.PaymentFailed }))
);
const MuscleWikiPage = lazy(() => import('./features/muscle-wiki/MuscleWikiPage').then((m) => ({ default: m.MuscleWikiPage })));
const GymOwnerDashboard = lazy(() => import('./features/dashboard/GymOwnerDashboard').then((m) => ({ default: m.GymOwnerDashboard })));
const MemberManagement = lazy(() => import('./features/gyms/MemberManagement').then((m) => ({ default: m.MemberManagement })));
const AdminShopLayout = lazy(() => import('./features/admin/shop/AdminShopLayout').then((m) => ({ default: m.AdminShopLayout })));
const AdminShopDashboard = lazy(() => import('./features/admin/shop/AdminShopDashboard').then((m) => ({ default: m.AdminShopDashboard })));
const AdminProductsPage = lazy(() => import('./features/admin/shop/AdminProductsPage').then((m) => ({ default: m.AdminProductsPage })));
const AdminOrdersPage = lazy(() => import('./features/admin/shop/AdminOrdersPage').then((m) => ({ default: m.AdminOrdersPage })));
const AdminOrderDetailPage = lazy(() => import('./features/admin/shop/AdminOrderDetailPage').then((m) => ({ default: m.AdminOrderDetailPage })));
const AdminCategoriesPage = lazy(() => import('./features/admin/shop/AdminCategoriesPage').then((m) => ({ default: m.AdminCategoriesPage })));
const AdminAiCommercePage = lazy(() => import('./features/admin/shop/AdminAiCommercePage').then((m) => ({ default: m.AdminAiCommercePage })));
const AdminConversionFunnelPage = lazy(() => import('./features/admin/shop/AdminConversionFunnelPage').then((m) => ({ default: m.AdminConversionFunnelPage })));
const AdminDataQualityPage = lazy(() => import('./features/admin/shop/AdminDataQualityPage').then((m) => ({ default: m.AdminDataQualityPage })));
const AdminMarketingPage = lazy(() => import('./features/admin/shop/AdminMarketingPage').then((m) => ({ default: m.AdminMarketingPage })));

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

const ShopAdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, authHydrated, user } = useAuthStore();
  if (!authHydrated) return <AuthBootScreen />;
  if (!isAuthenticated) return <Navigate to="/" replace />;
  if (!user?.canManageShop) return <Navigate to="/dashboard" replace />;
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
        path="/marketplace/cart"
        element={
          <ProtectedRoute>
            <LazyRoute skeleton="default">
              <CartPage />
            </LazyRoute>
          </ProtectedRoute>
        }
      />

      <Route
        path="/marketplace/wishlist"
        element={
          <ProtectedRoute>
            <LazyRoute skeleton="grid">
              <WishlistPage />
            </LazyRoute>
          </ProtectedRoute>
        }
      />

      <Route
        path="/marketplace/product/:slug"
        element={
          <ProtectedRoute>
            <LazyRoute skeleton="default">
              <ProductPage />
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
        path="/orders/:id"
        element={
          <ProtectedRoute>
            <LazyRoute skeleton="default">
              <OrderDetailPage />
            </LazyRoute>
          </ProtectedRoute>
        }
      />

      <Route
        path="/payment/success"
        element={
          <ProtectedRoute>
            <LazyRoute skeleton="default">
              <PaymentSuccess />
            </LazyRoute>
          </ProtectedRoute>
        }
      />

      <Route
        path="/payment/failed"
        element={
          <ProtectedRoute>
            <LazyRoute skeleton="default">
              <PaymentFailed />
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
        path="/admin/shop"
        element={
          <ShopAdminRoute>
            <LazyRoute skeleton="dashboard">
              <AdminShopLayout />
            </LazyRoute>
          </ShopAdminRoute>
        }
      >
        <Route index element={<AdminShopDashboard />} />
        <Route path="ai-commerce" element={<AdminAiCommercePage />} />
        <Route path="conversion-funnel" element={<AdminConversionFunnelPage />} />
        <Route path="data-quality" element={<AdminDataQualityPage />} />
        <Route path="marketing" element={<AdminMarketingPage />} />
        <Route path="products" element={<AdminProductsPage />} />
        <Route path="orders/:id" element={<AdminOrderDetailPage />} />
        <Route path="orders" element={<AdminOrdersPage />} />
        <Route path="categories" element={<AdminCategoriesPage />} />
      </Route>

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
