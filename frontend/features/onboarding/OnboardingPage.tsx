import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/useAuthStore';
import { isFlowCompleted } from './questionnaireCompletion';
import { AthleteOnboarding } from './AthleteOnboarding';
import { RoleOnboardingWizard } from './RoleOnboardingWizard';

export const OnboardingPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, refreshUser } = useAuthStore();
  const role = user?.role ?? 'athlete';

  useEffect(() => {
    void refreshUser();
  }, [refreshUser]);

  useEffect(() => {
    const onboardingData = user?.profile?.onboardingData as Record<string, unknown> | undefined;
    // Only skip wizard when the core flow is actually complete (not legacy `completedAt` alone).
    if (isFlowCompleted(onboardingData, 'core')) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, navigate]);

  if (role === 'athlete') {
    return <AthleteOnboarding />;
  }

  return <RoleOnboardingWizard />;
};
