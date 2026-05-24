import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../../store/useAuthStore';
import { isFlowCompleted } from './questionnaireCompletion';
import { AthleteOnboarding } from './AthleteOnboarding';
import { RoleOnboardingWizard } from './RoleOnboardingWizard';

function isRestartFromProfile(searchParams: URLSearchParams): boolean {
  const v = searchParams.get('restart');
  return v === '1' || v === 'true';
}

export const OnboardingPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const restartFromProfile = isRestartFromProfile(searchParams);
  const { user, refreshUser } = useAuthStore();
  const role = user?.role ?? 'athlete';

  useEffect(() => {
    void refreshUser();
  }, [refreshUser]);

  useEffect(() => {
    if (restartFromProfile) return;
    const onboardingData = user?.profile?.onboardingData as Record<string, unknown> | undefined;
    if (isFlowCompleted(onboardingData, 'core')) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, navigate, restartFromProfile]);

  if (role === 'athlete') {
    return <AthleteOnboarding />;
  }

  return <RoleOnboardingWizard />;
};
