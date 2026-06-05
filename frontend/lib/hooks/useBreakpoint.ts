import { useEffect, useState } from 'react';

/** Tailwind default breakpoints (min-width). */
export const BREAKPOINTS = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
} as const;

export type BreakpointKey = keyof typeof BREAKPOINTS;

function getMatches() {
  if (typeof window === 'undefined') {
    return { sm: false, md: false, lg: false, xl: false, '2xl': false };
  }
  return {
    sm: window.matchMedia(`(min-width: ${BREAKPOINTS.sm}px)`).matches,
    md: window.matchMedia(`(min-width: ${BREAKPOINTS.md}px)`).matches,
    lg: window.matchMedia(`(min-width: ${BREAKPOINTS.lg}px)`).matches,
    xl: window.matchMedia(`(min-width: ${BREAKPOINTS.xl}px)`).matches,
    '2xl': window.matchMedia(`(min-width: ${BREAKPOINTS['2xl']}px)`).matches,
  };
}

export function useBreakpoint() {
  const [matches, setMatches] = useState(getMatches);

  useEffect(() => {
    const queries = (Object.keys(BREAKPOINTS) as BreakpointKey[]).map((key) => ({
      key,
      mql: window.matchMedia(`(min-width: ${BREAKPOINTS[key]}px)`),
    }));

    const update = () => setMatches(getMatches());

    queries.forEach(({ mql }) => mql.addEventListener('change', update));
    update();

    return () => {
      queries.forEach(({ mql }) => mql.removeEventListener('change', update));
    };
  }, []);

  const current: BreakpointKey | 'base' = matches['2xl']
    ? '2xl'
    : matches.xl
      ? 'xl'
      : matches.lg
        ? 'lg'
        : matches.md
          ? 'md'
          : matches.sm
            ? 'sm'
            : 'base';

  return {
    ...matches,
    isSmUp: matches.sm,
    isMdUp: matches.md,
    isLgUp: matches.lg,
    isXlUp: matches.xl,
    is2xlUp: matches['2xl'],
    current,
  };
}
