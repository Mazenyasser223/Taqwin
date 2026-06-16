/**
 * Prefetch lazy route chunks before navigation (hover / focus / idle warmup).
 */

type RouteLoader = () => Promise<unknown>;

const ROUTE_LOADERS: Record<string, RouteLoader> = {
  '/community': () =>
    Promise.all([
      import('../features/community/CommunityHub'),
      import('./communityCache').then((m) => m.prefetchCommunityWarmup()),
    ]),
  '/community/browse': () =>
    Promise.all([
      import('../features/community/CommunityBrowse'),
      import('./communityCache').then((m) => m.prefetchCommunityBrowseDiscover()),
    ]),
  '/community/inbox': () =>
    Promise.all([
      import('../features/community/CommunityInbox'),
      import('./communityCache').then((m) => m.prefetchCommunityInbox()),
    ]),
  '/community/groups': () =>
    Promise.all([
      import('../features/community/CommunityGroups'),
      import('./communityCache').then((m) => m.prefetchCommunityGroups()),
    ]),
  '/community/profile': () =>
    Promise.all([
      import('../features/community/CommunityProfile'),
      import('./communityCache').then((m) => {
        void import('../services/communityService').then((s) => {
          void import('../store/useAuthStore').then(({ useAuthStore }) => {
            const uid = useAuthStore.getState().user?.id;
            if (uid) s.default.getUserProfile(uid);
          });
        });
      }),
    ]),
  '/workouts': () => import('../features/workouts/WorkoutLibrary'),
  '/nutrition': () => import('../features/nutrition/NutritionLibrary'),
  '/muscle-wiki': () => import('../features/muscle-wiki/MuscleWikiPage'),
  '/marketplace': () => import('../features/marketplace/Marketplace'),
  '/checkout': () => import('../features/checkout/CheckoutWizard'),
  '/gyms': () => import('../features/gyms/GymList'),
  '/orders': () => import('../features/orders/OrderHistory'),
  '/owner/dashboard': () => import('../features/dashboard/GymOwnerDashboard'),
  '/owner/members': () => import('../features/gyms/MemberManagement'),
  '/owner/reception': () => import('../features/gyms/GymReceptionPage'),
  '/owner/equipment': () => import('../features/gyms/GymEquipmentPage'),
};

const prefetched = new Set<string>();

function normalizePath(path: string): string {
  const base = path.split('?')[0].split('#')[0];
  if (!base || base === '/') return '/';
  return base.startsWith('/') ? base : `/${base}`;
}

/** Start loading a route chunk (no-op if already started). */
export function prefetchRoute(path: string): void {
  const key = normalizePath(path);
  const loader = ROUTE_LOADERS[key];
  if (!loader || prefetched.has(key)) return;
  prefetched.add(key);
  void loader().catch(() => {
    prefetched.delete(key);
  });
}

/** Attach to nav links: prefetch on hover / touch / focus. */
export function prefetchNavIntent(path: string): {
  onMouseEnter: () => void;
  onFocus: () => void;
  onTouchStart: () => void;
} {
  return {
    onMouseEnter: () => prefetchRoute(path),
    onFocus: () => prefetchRoute(path),
    onTouchStart: () => prefetchRoute(path),
  };
}

/** After login, prefetch high-traffic routes during idle time. */
export function prefetchCommonRoutes(opts?: { includeGym?: boolean; includeAthlete?: boolean }): void {
  const paths = ['/nutrition', '/workouts', '/muscle-wiki', '/marketplace', '/community'];
  if (opts?.includeGym) {
    paths.unshift('/owner/dashboard', '/owner/members', '/owner/reception', '/owner/equipment');
  }

  const run = () => {
    for (const p of paths) prefetchRoute(p);
    void import('../services/nutritionService').then((m) => {
      m.default.getCategories();
    });
    void import('./communityCache').then((m) => m.prefetchCommunityWarmup());
    if (opts?.includeAthlete) {
      void import('../services/dashboardService').then((m) => {
        m.default.prefetchAthleteHome();
      });
    }
  };

  if (typeof requestIdleCallback !== 'undefined') {
    requestIdleCallback(run, { timeout: 2500 });
  } else {
    window.setTimeout(run, 400);
  }
}

export function isLazyRoute(path: string): boolean {
  return Boolean(ROUTE_LOADERS[normalizePath(path)]);
}
