import React from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { useAuthStore } from '../../store/useAuthStore';
import { CommunityProfile } from './CommunityProfile';

/** Legacy `/community/profile/:userId` — own profile stays on Profile tab; others go to Browse. */
export const CommunityProfileRedirect: React.FC = () => {
  const { userId } = useParams<{ userId: string }>();
  const myId = useAuthStore((s) => s.user?.id);

  if (!userId || userId === myId) {
    return <CommunityProfile />;
  }

  return <Navigate to={`/community/browse/${userId}`} replace />;
};
