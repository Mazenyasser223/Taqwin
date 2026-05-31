import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { motion, type HTMLMotionProps } from 'framer-motion';
import { authCardSlideReducedVariants, authCardSlideVariants, useMotionPrefs } from '../../lib/motion';

const CARD_REVEAL_LEAD_SEC = 1;

type AuthCardRevealContextValue = {
  revealed: boolean;
  revealCard: () => void;
  leadSeconds: number;
};

const AuthCardRevealContext = createContext<AuthCardRevealContextValue | null>(null);

export function useAuthCardReveal() {
  const ctx = useContext(AuthCardRevealContext);
  if (!ctx) {
    throw new Error('useAuthCardReveal must be used within AuthPageLayout');
  }
  return ctx;
}

export function useAuthCardMotion(): Pick<HTMLMotionProps<'div'>, 'variants' | 'initial' | 'animate'> {
  const { revealed } = useAuthCardReveal();
  const { shouldSimplify } = useMotionPrefs();
  const variants = shouldSimplify ? authCardSlideReducedVariants : authCardSlideVariants;
  return {
    variants,
    initial: 'hidden',
    animate: revealed ? 'visible' : 'hidden',
  };
}

interface AuthCardRevealProviderProps {
  children: React.ReactNode;
}

export const AuthCardRevealProvider: React.FC<AuthCardRevealProviderProps> = ({ children }) => {
  const { shouldSimplify } = useMotionPrefs();
  const [revealed, setRevealed] = useState(shouldSimplify);

  const revealCard = useCallback(() => {
    setRevealed(true);
  }, []);

  useEffect(() => {
    if (shouldSimplify) setRevealed(true);
  }, [shouldSimplify]);

  const value = useMemo(
    () => ({ revealed, revealCard, leadSeconds: CARD_REVEAL_LEAD_SEC }),
    [revealed, revealCard]
  );

  return <AuthCardRevealContext.Provider value={value}>{children}</AuthCardRevealContext.Provider>;
};

export const AuthRevealCard: React.FC<HTMLMotionProps<'div'>> = ({ children, ...rest }) => {
  const motionProps = useAuthCardMotion();
  return (
    <motion.div {...motionProps} {...rest}>
      {children}
    </motion.div>
  );
};
