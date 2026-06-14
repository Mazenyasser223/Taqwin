import React from 'react';
import { QuestionnaireWizard } from './QuestionnaireWizard';

/** Core athlete profile questionnaire (19 steps). */
export const AthleteOnboarding: React.FC = () => (
  <QuestionnaireWizard flow="core" completeTo="/dashboard" allowSkipAll />
);
