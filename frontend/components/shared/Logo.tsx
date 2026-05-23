import React from 'react';
import { motion } from 'framer-motion';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
}

export const Logo: React.FC<LogoProps> = ({ className = '', size = 'md', showText = false }) => {
  const sizeClasses = {
    sm: 'w-10 h-10',
    md: 'w-16 h-16',
    lg: 'w-32 h-32',
    xl: 'w-[min(100%,18rem)] sm:w-64 md:w-72 lg:w-80 h-auto aspect-square max-w-full',
  };

  const wordmarkStyle: React.CSSProperties =
    size === 'xl'
      ? { fontSize: 'clamp(4.25rem, 12vw, 6rem)' }
      : { fontSize: `${size === 'lg' ? 3.35 : size === 'sm' ? 1.375 : 2.2}rem` };
  const textGap =
    showText && (size === 'lg' || size === 'xl') ? 'gap-6 md:gap-8' : 'gap-3';

  return (
    <motion.div
      className={`flex items-center select-none ${textGap} ${className}`}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
    >
      <div className={`${sizeClasses[size]} relative flex items-center justify-center shrink-0`}>
        <img
          src="/logo.png"
          alt="Taqwin"
          className="w-full h-full object-contain drop-shadow-2xl"
          draggable={false}
        />
      </div>
      {showText && (
        <span className="font-black tracking-tighter text-foreground" style={wordmarkStyle}>
          Taqwin
        </span>
      )}
    </motion.div>
  );
};
