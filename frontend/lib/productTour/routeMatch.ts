/** True when pathname equals route or is a nested path under route. */
export function tourRouteMatches(pathname: string, route: string): boolean {
  if (route === '/dashboard') {
    return pathname === '/dashboard';
  }
  if (route === '/community') {
    return pathname === '/community' || pathname === '/community/';
  }
  if (route === '/dashboard/plans') {
    return pathname === '/dashboard/plans' || pathname.startsWith('/dashboard/plans/');
  }
  if (route === '/marketplace') {
    return pathname === '/marketplace' || pathname.startsWith('/marketplace/');
  }
  if (route === '/owner/dashboard') {
    return pathname === '/owner/dashboard' || pathname.startsWith('/owner/dashboard/');
  }
  if (route === '/owner/reception') {
    return pathname === '/owner/reception' || pathname.startsWith('/owner/reception/');
  }
  if (route === '/owner/equipment') {
    return pathname === '/owner/equipment' || pathname.startsWith('/owner/equipment/');
  }
  return pathname === route || pathname.startsWith(`${route}/`);
}
