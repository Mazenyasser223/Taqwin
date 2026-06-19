import React from 'react';
import { motion } from 'framer-motion';
import { contentRevealVariants, maskRevealVariants, staggerContainer } from '../../lib/motion';
import {
  LANDING_BODY_NARROW,
  LANDING_EYEBROW,
  LANDING_H2,
  LANDING_SECTION_HEADER,
} from './landingUi';

type Props = {
  eyebrow: string;
  title: string;
  titleHighlight?: string;
  subtitle?: string;
  align?: 'center' | 'start';
  className?: string;
};

export function LandingSectionHeader({
  eyebrow,
  title,
  titleHighlight,
  subtitle,
  align = 'center',
  className = '',
}: Props) {
  const alignClass = align === 'center' ? LANDING_SECTION_HEADER : `${LANDING_SECTION_HEADER} text-start`;

  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-60px' }}
      variants={staggerContainer(0.1, 0.08)}
      className={`${alignClass} ${className}`}
    >
      <motion.span variants={contentRevealVariants} className={LANDING_EYEBROW}>
        {eyebrow}
      </motion.span>
      <motion.h2 variants={maskRevealVariants} className={LANDING_H2}>
        {title}
        {titleHighlight ? (
          <>
            {' '}
            <span className="italic text-primary">{titleHighlight}</span>
          </>
        ) : null}
      </motion.h2>
      {subtitle ? (
        <motion.p variants={contentRevealVariants} className={`${LANDING_BODY_NARROW} ${align === 'center' ? 'mx-auto' : ''}`}>
          {subtitle}
        </motion.p>
      ) : null}
    </motion.div>
  );
}
