export type OnboardingSection =
  | 'pre'
  | 'goals'
  | 'workout'
  | 'personal'
  | 'fitness'
  | 'lifestyle'
  | 'motivation'
  | 'finish';

export const SECTION_LABELS: Record<OnboardingSection, string> = {
  pre: 'Start',
  goals: 'Goals',
  workout: 'Workout',
  personal: 'You',
  fitness: 'Fitness',
  lifestyle: 'Lifestyle',
  motivation: 'Motivation',
  finish: 'Plan',
};

export const SECTION_ORDER: OnboardingSection[] = [
  'pre',
  'goals',
  'workout',
  'personal',
  'fitness',
  'lifestyle',
  'motivation',
  'finish',
];

export interface StepOption {
  value: string;
  label: string;
  description?: string;
  /** Resolved in UI from /public/assets/onboarding */
  imageUrl?: string;
  imageKey?: string;
}

export type OnboardingStep =
  | {
      id: string;
      section: OnboardingSection;
      type: 'single';
      title: string;
      subtitle?: string;
      options: StepOption[];
      autoAdvance?: boolean;
    }
  | {
      id: string;
      section: OnboardingSection;
      type: 'multi';
      title: string;
      subtitle?: string;
      options: StepOption[];
      maxSelect?: number;
    }
  | {
      id: string;
      section: OnboardingSection;
      type: 'likert';
      title: string;
      statement: string;
    }
  | {
      id: string;
      section: OnboardingSection;
      type: 'info';
      title: string;
      body: string;
      highlight?: string;
      cta?: string;
    }
  | {
      id: string;
      section: OnboardingSection;
      type: 'number';
      title: string;
      subtitle?: string;
      field: 'height' | 'weight' | 'targetWeight' | 'age';
      unit?: string;
      placeholder?: string;
      min?: number;
      max?: number;
      requireConsent?: boolean;
    }
  | {
      id: string;
      section: OnboardingSection;
      type: 'slider';
      title: string;
      field: 'bodyFat';
      levels: { value: string; label: string }[];
    }
  | {
      id: string;
      section: OnboardingSection;
      type: 'text';
      title: string;
      field: 'displayName';
      placeholder?: string;
      minLength?: number;
      maxLength?: number;
    }
  | {
      id: string;
      section: OnboardingSection;
      type: 'weightOptional';
      title: string;
      field: 'deadliftMax' | 'benchMax';
    }
  | {
      id: string;
      section: OnboardingSection;
      type: 'summary';
      title: string;
    }
  | {
      id: string;
      section: OnboardingSection;
      type: 'generating';
      title: string;
    }
  | {
      id: string;
      section: OnboardingSection;
      type: 'hero';
      title: string;
      subtitle?: string;
      body: string;
      cta?: string;
      heroImage?: string;
    };

export type OnboardingAnswers = Record<string, string | string[] | number | boolean>;
