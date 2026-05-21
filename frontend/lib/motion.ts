
import { useReducedMotion, Variants, TargetAndTransition, Transition } from 'framer-motion';
import { useConfigStore } from '../store/useConfigStore';

/**
 * Centralized motion hook that respects system preferences and app performance mode.
 */
export const useMotionPrefs = () => {
  const isReducedMotion = useReducedMotion();
  const { performanceMode } = useConfigStore();
  const shouldSimplify = isReducedMotion || performanceMode;
  
  return {
    shouldSimplify,
    isReducedMotion,
    performanceMode,
    duration: shouldSimplify ? 0.15 : 0.3,
    ease: [0.23, 1, 0.32, 1] as [number, number, number, number],
  };
};

// --- Fitness Metaphor Transitions ---

export const weightedTransition: Transition = {
  type: 'spring',
  stiffness: 100,
  damping: 20,
  mass: 1.5,
};

export const snapTransition: Transition = {
  type: 'spring',
  stiffness: 400,
  damping: 28,
  mass: 0.8,
};

export const breathTransition: Transition = {
  type: 'tween',
  duration: 1.2,
  ease: "easeInOut",
};

// --- Reveal System Variants ---

/**
 * MASK REVEAL: Text emerging from a hidden line
 */
export const maskRevealVariants: Variants = {
  hidden: { 
    clipPath: 'polygon(0 0, 100% 0, 100% 0, 0 0)',
    y: 50,
    opacity: 0 
  },
  visible: { 
    clipPath: 'polygon(0 0, 100% 0, 100% 100%, 0 100%)',
    y: 0,
    opacity: 1,
    transition: {
      duration: 0.8,
      ease: [0.16, 1, 0.3, 1]
    }
  }
};

/**
 * CONTENT REVEAL: Scale + Fade + Blur entry
 */
export const contentRevealVariants: Variants = {
  hidden: { 
    opacity: 0, 
    scale: 0.95, 
    filter: 'blur(10px)',
    y: 30 
  },
  visible: { 
    opacity: 1, 
    scale: 1, 
    filter: 'blur(0px)',
    y: 0,
    transition: {
      duration: 0.6,
      ease: "easeOut"
    }
  }
};

// --- Page & Item Variants ---

export const pageVariants: Variants = {
  initial: { opacity: 0, scale: 0.98, filter: 'blur(5px)' },
  animate: { opacity: 1, scale: 1, filter: 'blur(0px)' },
  exit: { opacity: 0, scale: 1.02, filter: 'blur(5px)' },
};

/** Fast page enter — no wait-mode blocking, minimal blur. */
export const swiftPageVariants: Variants = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
};

export const staggerContainer = (staggerChildren = 0.05, delayChildren = 0): Variants => ({
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren,
      delayChildren,
    },
  },
});

export const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: snapTransition 
  },
};

export const liftVariants: Variants = {
  hover: { 
    y: -6,
    scale: 1.01,
    transition: snapTransition
  },
  tap: { scale: 0.98 }
};

export const buttonPress: Variants = {
  hover: { scale: 1.05 },
  tap: { scale: 0.95 },
};

export const pulseTransition: TargetAndTransition = {
  scale: [1, 1.05, 1],
  opacity: [0.7, 1, 0.7],
  transition: {
    duration: 2.5,
    repeat: Infinity,
    ease: "easeInOut"
  }
};
