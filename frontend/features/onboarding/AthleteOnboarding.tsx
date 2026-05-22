import React from 'react';
import { QuestionnaireWizard } from './QuestionnaireWizard';

/** Core athlete profile questionnaire (17 steps). */
export const AthleteOnboarding: React.FC = () => (
  <QuestionnaireWizard flow="core" completeTo="/dashboard" allowSkipAll />
);
