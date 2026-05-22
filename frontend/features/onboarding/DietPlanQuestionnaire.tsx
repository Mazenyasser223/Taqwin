import React from 'react';
import { QuestionnaireWizard } from './QuestionnaireWizard';

export const DietPlanQuestionnaire: React.FC = () => (
  <QuestionnaireWizard flow="diet" completeTo="/nutrition" allowSkipAll />
);
