
export type UserRole = 'athlete' | 'trainer' | 'gym';
export type OrderStatus = 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';
export type BookingStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled';

// ─── User & Profile ───────────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  role: UserRole;
  emailVerifiedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  hasPassword?: boolean;
  twoFactorEnabled?: boolean;
  hasPendingEmailChange?: boolean;
  profile?: Profile;
  name?: string;   // alias for profile.displayName
  avatar?: string; // alias for profile.avatarUrl
}

export interface Profile {
  id: string;
  userId: string;
  displayName?: string;
  avatarUrl?: string;
  dateOfBirth?: string;
  gender?: string;
  height?: number;
  weight?: number;
  fitnessGoal?: string;
  fitnessLevel?: string;
  medicalNotes?: string;
  bio?: string;
  specialties?: string;
  yearsExperience?: number | null;
  businessName?: string;
  businessAddress?: string;
  businessPhone?: string;
  websiteUrl?: string;
  onboardingData?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Gyms ─────────────────────────────────────────────────────────────────────

export interface Gym {
  id: string;
  ownerId: string;
  name: string;
  location: string;
  bio?: string;
  imageUrl?: string;
  phone?: string;
  maxCapacity: number;
  amenities?: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  currentOccupancy?: number; // computed/real-time, not stored
}

export interface GymMembership {
  id: string;
  gymId: string;
  userId: string;
  joinedAt: string;
  expiresAt?: string;
  isActive: boolean;
  gym?: Gym;
}

export interface GymCheckIn {
  id: string;
  gymId: string;
  userId: string;
  checkedInAt: string;
  gym?: Gym;
}

// ─── Workouts ─────────────────────────────────────────────────────────────────

export type WorkoutCategory = 'Strength' | 'Yoga' | 'Cardio' | 'Recovery';
export type WorkoutDifficulty = 'Beginner' | 'Intermediate' | 'Advanced';

export interface Workout {
  id: string;
  createdById?: string;
  title: string;
  category: WorkoutCategory | string;
  difficulty: WorkoutDifficulty | string;
  durationMin: number;
  calories: number;
  imageUrl?: string;
  description?: string;
  isPublic: boolean;
  createdAt: string;
}

export interface WorkoutLog {
  id: string;
  userId: string;
  workoutId: string;
  loggedAt: string;
  durationMin?: number;
  notes?: string;
  workout?: Workout;
}

// ─── Nutrition ────────────────────────────────────────────────────────────────

export type FoodCategory = 'Protein' | 'Carb' | 'Fat' | 'Veggie' | 'Supplement';

export interface FoodItem {
  id: string;
  fdcId?: number | null;
  name: string;
  category: FoodCategory | string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  imageUrl?: string;
  isPublic: boolean;
}

/** USDA browse category (from GET /api/nutrition/fdc/categories). */
export interface FdcCategory {
  id: string;
  query: string;
  icon: string;
}

/** USDA FDC search hit (may not be imported yet). */
export interface FdcFoodPreview {
  fdcId: number;
  name: string;
  nameEn?: string;
  dataType: string | null;
  brandOwner?: string | null;
  foodCategory?: string | null;
  foodCategoryEn?: string | null;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  id?: string | null;
  cached?: boolean;
}

export interface FdcSearchResult {
  foods: FdcFoodPreview[];
  totalHits: number;
  currentPage: number;
  pageSize: number;
  categoryId?: string | null;
  nextUsdaPage?: number;
  hasMore?: boolean;
  filtersApplied?: boolean;
}

export type FoodSort =
  | 'name'
  | 'protein'
  | 'proteinAsc'
  | 'calories'
  | 'caloriesDesc'
  | 'carbs'
  | 'carbsDesc'
  | 'fat'
  | 'fatDesc'
  | 'proteinDensity';
export type FdcDataType = 'Foundation' | 'SR Legacy' | 'Branded' | 'Survey (FNDDS)';

export interface FoodLog {
  id: string;
  userId: string;
  foodItemId: string;
  loggedAt: string;
  grams: number;
  foodItem?: FoodItem;
}

// ─── Marketplace ──────────────────────────────────────────────────────────────

export interface Product {
  id: string;
  name: string;
  brand: string;
  price: number;
  imageUrl?: string;
  description?: string;
  stock: number;
  isActive: boolean;
}

export interface Order {
  id: string;
  userId: string;
  status: OrderStatus;
  total: number;
  createdAt: string;
  updatedAt: string;
  items?: OrderItem[];
}

export interface OrderItem {
  id: string;
  orderId: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  product?: Product;
}

// ─── Trainer Bookings ─────────────────────────────────────────────────────────

export interface TrainerBooking {
  id: string;
  athleteId: string;
  trainerId: string;
  scheduledAt: string;
  status: BookingStatus;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  athlete?: User;
  trainer?: User;
}

// ─── Community ────────────────────────────────────────────────────────────────

export interface CommunityPost {
  id: string;
  authorId: string;
  content: string;
  imageUrl?: string;
  likesCount: number;
  createdAt: string;
  updatedAt: string;
  author?: User;
  comments?: CommunityComment[];
}

export interface CommunityComment {
  id: string;
  postId: string;
  authorId: string;
  content: string;
  createdAt: string;
  author?: User;
}

// ─── Notifications ────────────────────────────────────────────────────────────

export interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  link?: string | null;
  read: boolean;
  createdAt: string;
}
