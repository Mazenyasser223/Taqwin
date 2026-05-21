/**
 * Prefetch lazy route chunks before navigation (hover / focus / idle warmup).
 */

type RouteLoader = () => Promise<unknown>;

const ROUTE_LOADERS: Record<string, RouteLoader> = {
  '/workouts': () => import('../features/workouts/WorkoutLibrary'),
  '/nutrition': () => import('../features/nutrition/NutritionLibrary'),
  '/muscle-wiki': () => import('../features/muscle-wiki/MuscleWikiPage'),
  '/marketplace': () => import('../features/marketplace/Marketplace'),
  '/trainers': () => import('../features/trainers/TrainerList'),
  '/clients': () => import('../features/trainers/ClientList'),
  '/gyms': () => import('../features/gyms/GymList'),
  '/orders': () => import('../features/orders/OrderHistory'),
  '/owner/dashboard': () => import('../features/dashboard/GymOwnerDashboard'),
  '/owner/members': () => import('../features/gyms/MemberManagement'),
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
export function prefetchCommonRoutes(opts?: { includeGym?: boolean }): void {
  const paths = ['/nutrition', '/workouts', '/muscle-wiki', '/trainers', '/marketplace'];
  if (opts?.includeGym) {
    paths.push('/owner/dashboard', '/owner/members');
  }

  const run = () => {
    for (const p of paths) prefetchRoute(p);
    void import('../services/nutritionService').then((m) => {
      m.default.getCategories();
    });
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
