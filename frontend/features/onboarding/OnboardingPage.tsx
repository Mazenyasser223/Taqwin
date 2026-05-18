import React, { useEffect } from 'react';
import { useAuthStore } from '../../store/useAuthStore';
import { AthleteOnboarding } from './AthleteOnboarding';
import { RoleOnboardingWizard } from './RoleOnboardingWizard';

export const OnboardingPage: React.FC = () => {
  const { user, refreshUser } = useAuthStore();
  const role = user?.role ?? 'athlete';

  useEffect(() => {
    void refreshUser();
  }, [refreshUser]);

  if (role === 'athlete') {
    return <AthleteOnboarding />;
  }

  return <RoleOnboardingWizard />;
};
