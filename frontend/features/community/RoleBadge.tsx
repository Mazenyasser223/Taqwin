import React from 'react';
import type { UserRole } from '../../types';
import { roleLabel } from './communityUtils';

interface RoleBadgeProps {
  role?: UserRole;
  className?: string;
}

const ROLE_ICON: Record<string, string> = {
  athlete: 'fitness_center',
  trainer: 'sports',
  gym: 'domain',
};

function roleIcon(role?: UserRole) {
  if (role === 'trainer') return ROLE_ICON.trainer;
  if (role === 'gym') return ROLE_ICON.gym;
  return ROLE_ICON.athlete;
}

export const RoleBadge: React.FC<RoleBadgeProps> = ({ role, className = '' }) => (
  <span
    className={`inline-flex items-center gap-0.5 sm:gap-1 px-1.5 sm:px-2.5 py-0.5 sm:py-1 rounded-full bg-primary/20 text-primary text-[10px] sm:text-xs font-extrabold uppercase tracking-[0.1em] sm:tracking-[0.14em] leading-none shrink-0 ring-1 ring-primary/25 max-w-[5.5rem] sm:max-w-none ${className}`}
  >
    <span
      className="material-symbols-outlined text-[12px] sm:text-sm leading-none shrink-0"
      style={{ fontVariationSettings: "'FILL' 1" }}
      aria-hidden
    >
      {roleIcon(role)}
    </span>
    <span className="relative top-px truncate">{roleLabel(role)}</span>
  </span>
);
