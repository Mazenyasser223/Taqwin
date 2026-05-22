/** Progress-bar groups for the athlete onboarding wizard */
export type OnboardingSection =
  | 'welcome'   // Intro & hook
  | 'profile'   // Demographics & body composition
  | 'goals'     // Objectives & desired outcomes
  | 'fitness'   // Experience, injuries & strength baseline
  | 'training'  // Where, when & how they train
  | 'health'    // Sleep, nutrition & daily habits
  | 'mindset'   // Motivation & confidence
  | 'plan';     // Plan generation & wrap-up

export const SECTION_LABELS: Record<OnboardingSection, string> = {
  welcome: 'Welcome',
  profile: 'About you',
  goals: 'Goals',
  fitness: 'Fitness level',
  training: 'Training',
  health: 'Health & habits',
  mindset: 'Your why',
  plan: 'Your plan',
};

export const SECTION_ORDER: OnboardingSection[] = [
  'welcome',
  'profile',
  'goals',
  'fitness',
  'training',
  'health',
  'mindset',
  'plan',
];

export interface StepOption {
  value: string;
  label: string;
  description?: string;
  /** Resolved in UI from /public/assets/onboarding */
  imageUrl?: string;
  imageKey?: string;
  /** Photo cards: taller frame, contain fit, less aggressive crop */
  imageVariant?: 'photo' | 'illustration';
}

/** Shared coach / UI copy on a step */
export interface StepCopy {
  /** Coach bubble before the input (chat phase) */
  chatMessage?: string;
  /** Optional image inside the coach bubble (e.g. welcome meme) */
  chatImageUrl?: string;
  /** Short encouragement shown above the control */
  encouragement?: string;
  presentation?: 'card' | 'chat';
}

export type OnboardingStep =
  | ({
      id: string;
      section: OnboardingSection;
      type: 'single';
      title: string;
      subtitle?: string;
      options: StepOption[];
      autoAdvance?: boolean;
      /** Side-by-side option cards (e.g. gender) */
      optionsLayout?: 'column' | 'row';
      /** Force visual grid cards with images */
      visualOptions?: boolean;
    } & StepCopy)
  | ({
      id: string;
      section: OnboardingSection;
      type: 'multi';
      title: string;
      subtitle?: string;
      options: StepOption[];
      maxSelect?: number;
      visualOptions?: boolean;
    } & StepCopy)
  | ({
      id: string;
      section: OnboardingSection;
      type: 'likert';
      title: string;
      statement: string;
    } & StepCopy)
  | ({
      id: string;
      section: OnboardingSection;
      type: 'info';
      title: string;
      body: string;
      highlight?: string;
      cta?: string;
      variant?: 'default' | 'testimonials';
    } & StepCopy)
  | ({
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
    } & StepCopy)
  | ({
      id: string;
      section: OnboardingSection;
      type: 'slider';
      title: string;
      field: 'bodyFat';
      levels: { value: string; label: string; imageUrl?: string }[];
    } & StepCopy)
  | ({
      id: string;
      section: OnboardingSection;
      type: 'text';
      title: string;
      field:
        | 'displayName'
        | 'address'
        | 'city'
        | 'street'
        | 'apartment'
        | 'phone'
        | 'goal12Week'
        | 'exercisesAvoid'
        | 'exercisesLove'
        | 'foodsExcluded'
        | 'medicalHistory'
        | 'medications'
        | 'supplementsBudget'
        | 'gymLink';
      placeholder?: string;
      minLength?: number;
      maxLength?: number;
      /** HTML input type (e.g. tel for phone) */
      inputType?: 'text' | 'tel';
    } & StepCopy)
  | ({
      id: string;
      section: OnboardingSection;
      type: 'weightOptional';
      title: string;
      field: 'deadliftMax' | 'benchMax';
    } & StepCopy)
  | ({
      id: string;
      section: OnboardingSection;
      type: 'summary';
      title: string;
    } & StepCopy)
  | ({
      id: string;
      section: OnboardingSection;
      type: 'generating';
      title: string;
    } & StepCopy)
  | ({
      id: string;
      section: OnboardingSection;
      type: 'hero';
      title: string;
      subtitle?: string;
      body: string;
      cta?: string;
      heroImage?: string;
    } & StepCopy)
  | ({
      id: string;
      section: OnboardingSection;
      type: 'measurements';
      title: string;
      subtitle?: string;
    } & StepCopy)
  | ({
      id: string;
      section: OnboardingSection;
      type: 'inbody';
      title: string;
      subtitle?: string;
      requireComplete?: boolean;
    } & StepCopy)
  | ({
      id: string;
      section: OnboardingSection;
      type: 'photos';
      title: string;
      subtitle?: string;
      requireComplete?: boolean;
    } & StepCopy);

export interface ChatHistoryItem {
  id: string;
  role: 'coach' | 'user';
  text: string;
  imageUrl?: string;
}

export type OnboardingAnswers = Record<string, string | string[] | number | boolean>;
