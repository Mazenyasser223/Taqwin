
export type UserRole = 'athlete' | 'trainer' | 'gym';

export interface User {
  id: string;
  email: string;
  role: UserRole;
  emailVerifiedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  profile?: {
    id: string;
    displayName?: string;
    avatarUrl?: string;
    dateOfBirth?: string;
    gender?: string;
    height?: number;
    weight?: number;
    fitnessGoal?: string;
    fitnessLevel?: string;
    medicalNotes?: string;
  };
  // Computed/display fields
  name?: string; // alias for profile.displayName
  avatar?: string; // alias for profile.avatarUrl
}

export interface Workout {
  id: string;
  title: string;
  category: string;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  duration: number;
  calories: number;
  image: string;
}

export interface NutritionItem {
  id: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  image: string;
}
