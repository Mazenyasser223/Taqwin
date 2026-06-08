import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../../store/useAuthStore';
import { UserDashboard } from './UserDashboard';

/**
 * Default home after login: athletes (and legacy trainer accounts) see the athlete dashboard;
 * gym owners land on the owner command center.
 */
export const RoleDashboard: React.FC = () => {
  const role = useAuthStore((s) => s.user?.role);

  if (role === 'gym') {
    return <Navigate to="/owner/dashboard" replace />;
  }
  return <UserDashboard />;
};
