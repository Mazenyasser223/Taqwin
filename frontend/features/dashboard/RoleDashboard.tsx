import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../../store/useAuthStore';
import { UserDashboard } from './UserDashboard';
import { TrainerDashboard } from './TrainerDashboard';

/**
 * Default home after login: athletes see the main dashboard;
 * trainers get a workspace hub; gym owners land on the owner command center.
 */
export const RoleDashboard: React.FC = () => {
  const role = useAuthStore((s) => s.user?.role);

  if (role === 'gym') {
    return <Navigate to="/owner/dashboard" replace />;
  }
  if (role === 'trainer') {
    return <TrainerDashboard />;
  }
  return <UserDashboard />;
};
