import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../../store/useAuthStore';
import { isFlowCompleted, isQuestionnaireInProgress } from './questionnaireCompletion';
import { AthleteOnboarding } from './AthleteOnboarding';
import { RoleOnboardingWizard } from './RoleOnboardingWizard';

function isRestartFromProfile(searchParams: URLSearchParams): boolean {
  const v = searchParams.get('restart');
  return v === '1' || v === 'true';
}

function isGymRoleWizardComplete(data: Record<string, unknown> | undefined): boolean {
  if (!data || data.roleWizard !== 'gym') return false;
  if (data.completedAt) return true;
  return data.inProgress === false;
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
    if (role === 'gym') {
      if (isGymRoleWizardComplete(onboardingData)) {
        navigate('/profile', { replace: true });
      }
      return;
    }
    if (isFlowCompleted(onboardingData, 'core')) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, navigate, restartFromProfile, role]);

  if (role === 'athlete') {
    return <AthleteOnboarding />;
  }

  return <RoleOnboardingWizard />;
};
