import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/useAuthStore';
import { isCoreOnboardingComplete } from './questionnaireCompletion';
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
    const profile = user?.profile;
    const onboardingData = profile?.onboardingData as Record<string, unknown> | undefined;
    if (profile?.displayName && isCoreOnboardingComplete(onboardingData)) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, navigate]);

  if (role === 'athlete') {
    return <AthleteOnboarding />;
  }

  return <RoleOnboardingWizard />;
};
