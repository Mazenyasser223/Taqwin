
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
    xl: 'w-64 h-64',
  };

  const wordmarkStyle: React.CSSProperties =
    size === 'xl'
      ? { fontSize: 'clamp(4.25rem, 12vw, 6rem)' }
      : { fontSize: `${size === 'lg' ? 3.35 : size === 'sm' ? 1.375 : 2.2}rem` };
  const textGap =
    showText && (size === 'lg' || size === 'xl') ? 'gap-6 md:gap-8' : 'gap-3';

  return (
    <div className={`flex items-center ${textGap} ${className}`}>
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className={`${sizeClasses[size]} relative flex items-center justify-center`}
      >
        <svg 
          viewBox="0 0 400 400" 
          fill="none" 
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full drop-shadow-2xl"
        >
          <defs>
            <linearGradient id="taqwinTeal" x1="200" y1="50" x2="200" y2="350" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#158b8d" />
              <stop offset="100%" stopColor="#0a314d" />
            </linearGradient>
            <linearGradient id="taqwinOrange" x1="250" y1="200" x2="250" y2="380" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#f37021" />
              <stop offset="100%" stopColor="#fbaf40" />
            </linearGradient>
          </defs>

          {/* Background T Shape */}
          <path 
            d="M50 40 H350 V100 H240 V360 H160 V100 H50 Z" 
            fill="url(#taqwinTeal)"
          />

          {/* White Performance Swoosh/Arrow */}
          <path 
            d="M130 310 C180 300 250 220 310 100 L330 115 L340 85 L305 90 L320 105 C260 225 190 305 130 310 Z" 
            fill="white" 
            fillOpacity="0.9"
          />

          {/* Silhouette 1: Jumper (Left) */}
          <g fill="white">
            <circle cx="155" cy="205" r="8" />
            {/* Fix: strokeJoin renamed to strokeLinejoin to match React's SVG prop naming convention */}
            <path d="M155 215 L145 235 L125 210 M155 215 L175 225 L190 215 M155 215 L160 250 L140 275 M160 250 L195 240" stroke="white" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
          </g>

          {/* Silhouette 2: Lifter (Center) */}
          <g fill="white">
            <circle cx="230" cy="155" r="8" />
            <path d="M210 145 H250 M205 145 C200 145 200 145 200 145 M255 145 C260 145 260 145 260 145" stroke="white" strokeWidth="5" strokeLinecap="round"/>
            {/* Fix: strokeJoin renamed to strokeLinejoin to match React's SVG prop naming convention */}
            <path d="M210 145 L220 165 L230 165 L240 165 L250 145 M230 165 L230 200 L215 230 M230 200 L245 230" stroke="white" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
          </g>

          {/* Silhouette 3: Runner (Right - Teal Gradient) */}
          <g fill="#158b8d">
            <circle cx="330" cy="215" r="8" />
            {/* Fix: strokeJoin renamed to strokeLinejoin to match React's SVG prop naming convention */}
            <path d="M315 240 L330 225 L355 235 M330 225 L325 255 L285 295 M325 255 L350 310 L370 315" stroke="#158b8d" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
          </g>

          {/* Orange Data Bars */}
          <rect x="200" y="280" width="12" height="60" rx="4" fill="url(#taqwinOrange)" />
          <rect x="230" y="240" width="12" height="100" rx="4" fill="url(#taqwinOrange)" />
          <rect x="260" y="200" width="12" height="140" rx="4" fill="url(#taqwinOrange)" />
          <rect x="290" y="260" width="12" height="80" rx="4" fill="url(#taqwinOrange)" />

          {/* Outer Circuit Arc & Dot */}
          <path 
            d="M340 140 A120 120 0 0 1 310 330" 
            stroke="#f37021" 
            strokeWidth="4" 
            strokeDasharray="10 5" 
            strokeLinecap="round"
          />
          <path d="M350 280 L380 295" stroke="#f37021" strokeWidth="2" strokeLinecap="round" />
          <circle cx="390" cy="300" r="4" fill="#f37021" />
          <path d="M330 170 L360 165" stroke="#f37021" strokeWidth="1" opacity="0.5" />
          <circle cx="370" cy="165" r="3" fill="#f37021" opacity="0.5" />
        </svg>
      </motion.div>
      {showText && (
        <span 
          className="font-black tracking-tighter text-white" 
          style={wordmarkStyle}
        >
          Taqwin
        </span>
      )}
    </div>
  );
};
