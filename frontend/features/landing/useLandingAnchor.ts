import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

/** Scroll to a landing section id; navigates home first when needed (HashRouter-safe). */
export function useLandingAnchor() {
  const navigate = useNavigate();
  const location = useLocation();

  return useCallback(
    (anchorId: string) => {
      const scroll = () => {
        document.getElementById(anchorId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      };

      if (location.pathname === '/') {
        scroll();
        return;
      }

      navigate('/', { state: { scrollTo: anchorId } });
      window.setTimeout(scroll, 120);
    },
    [location.pathname, navigate],
  );
}
