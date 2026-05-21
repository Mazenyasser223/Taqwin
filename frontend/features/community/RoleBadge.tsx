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
    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/20 text-primary text-[11px] sm:text-xs font-extrabold uppercase tracking-[0.14em] leading-none shrink-0 ring-1 ring-primary/25 ${className}`}
  >
    <span
      className="material-symbols-outlined text-[13px] sm:text-sm leading-none"
      style={{ fontVariationSettings: "'FILL' 1" }}
      aria-hidden
    >
      {roleIcon(role)}
    </span>
    <span className="relative top-px">{roleLabel(role)}</span>
  </span>
);
