import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/** Call on LandingPage mount to honor footer deep-links from other routes. */
export function useLandingScrollOnMount() {
  const location = useLocation();

  useEffect(() => {
    const target = (location.state as { scrollTo?: string } | null)?.scrollTo;
    if (!target) return;
    const timer = window.setTimeout(() => {
      document.getElementById(target)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 150);
    return () => window.clearTimeout(timer);
  }, [location.state]);
}
