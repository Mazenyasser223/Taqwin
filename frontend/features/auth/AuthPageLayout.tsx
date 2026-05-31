import React from 'react';
import { useMotionPrefs } from '../../lib/motion';
import { AuthCardRevealProvider, useAuthCardReveal } from './authCardReveal';
import { AuthVideoBackground } from './AuthVideoBackground';

interface AuthPageLayoutProps {
  children: React.ReactNode;
  className?: string;
}

const AuthPageLayoutInner: React.FC<AuthPageLayoutProps> = ({ children, className = '' }) => {
  const { shouldSimplify } = useMotionPrefs();
  const { revealCard, leadSeconds } = useAuthCardReveal();

  return (
    <div
      className={`min-h-[100dvh] w-full flex flex-col items-center relative overflow-y-auto overflow-x-hidden custom-scrollbar p-4 sm:p-6 safe-top safe-bottom ${className}`.trim()}
    >
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none" aria-hidden>
        <AuthVideoBackground paused={shouldSimplify} onReveal={revealCard} leadSeconds={leadSeconds} />
        <div className="absolute inset-0 bg-background/50" />
        <div className="absolute inset-0 bg-gradient-to-b from-background/25 via-background/55 to-background/90" />
      </div>
      {/* LTR grid: left half = video/hero, right half = card centered in that column */}
      <div className="relative z-10 grid w-full min-h-0 flex-1 grid-cols-1 md:grid-cols-2 [direction:ltr]">
        <div className="hidden md:block" aria-hidden />
        <div className="flex w-full items-center justify-center px-4 py-6 sm:px-8 sm:py-8">
          {children}
        </div>
      </div>
    </div>
  );
};

/** Auth shell: intro video, then card slides in 1s before the clip ends. */
export const AuthPageLayout: React.FC<AuthPageLayoutProps> = (props) => (
  <AuthCardRevealProvider>
    <AuthPageLayoutInner {...props} />
  </AuthCardRevealProvider>
);
