import React, { Suspense } from 'react';
import { motion } from 'framer-motion';
import { PageSkeleton, type PageSkeletonVariant } from './PageSkeleton';
import { swiftPageVariants, useMotionPrefs } from '../../lib/motion';

type Props = {
  children: React.ReactNode;
  skeleton?: PageSkeletonVariant;
  animate?: boolean;
};

export const LazyRoute: React.FC<Props> = ({ children, skeleton = 'default', animate = true }) => {
  const { shouldSimplify, duration, ease } = useMotionPrefs();

  const content = (
    <Suspense fallback={<PageSkeleton variant={skeleton} />}>{children}</Suspense>
  );

  if (!animate || shouldSimplify) {
    return content;
  }

  return (
    <motion.div
      variants={swiftPageVariants}
      initial="initial"
      animate="animate"
      transition={{ duration: duration * 0.6, ease }}
    >
      {content}
    </motion.div>
  );
};
