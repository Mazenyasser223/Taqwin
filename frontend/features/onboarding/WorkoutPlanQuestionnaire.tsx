import React from 'react';
import { QuestionnaireWizard } from './QuestionnaireWizard';

export const WorkoutPlanQuestionnaire: React.FC = () => (
  <QuestionnaireWizard flow="workout" completeTo="/workouts" allowSkipAll />
);

