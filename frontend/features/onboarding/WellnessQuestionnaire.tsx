import React from 'react';
import { QuestionnaireWizard } from './QuestionnaireWizard';

export const WellnessQuestionnaire: React.FC = () => (
  <QuestionnaireWizard flow="wellness" completeTo="/dashboard" />
);
