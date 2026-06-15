
export type UserRole = 'athlete' | 'gym' | 'admin';
export type OrderStatus =
  | 'pending'
  | 'pending_payment'
  | 'confirmed'
  | 'processing'
  | 'packed'
  | 'shipped'
  | 'delivered'
  | 'cancelled';
export type PaymentMethod = 'cod' | 'card' | 'fawry' | 'wallet';
export type PaymentStatus = 'pending' | 'processing' | 'paid' | 'failed' | 'refunded';
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
  phone?: string | null;
  phoneVerifiedAt?: string | null;
  /** Shop admin panel — email allowlist on backend (SHOP_ADMIN_EMAILS) */
  canManageShop?: boolean;
  profile?: Profile;
  name?: string;   // alias for profile.displayName
  avatar?: string; // alias for profile.avatarUrl
}

export interface AthleteProfile {
  id: string;
  userId: string;
  displayName?: string;
  avatarUrl?: string;
  communityAvatarUrl?: string;
  coverUrl?: string;
  dateOfBirth?: string;
  gender?: string;
  height?: number;
  weight?: number;
  fitnessGoal?: string;
  fitnessLevel?: string;
  medicalNotes?: string;
  onboardingData?: Record<string, unknown> | null;
  /** Present on gym profiles; unused for athletes but allowed on unified Profile reads */
  bio?: string;
  businessName?: string;
  businessAddress?: string;
  businessPhone?: string;
  websiteUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface GymProfile {
  id: string;
  userId: string;
  displayName?: string;
  avatarUrl?: string;
  communityAvatarUrl?: string;
  coverUrl?: string;
  bio?: string;
  businessName?: string;
  businessAddress?: string;
  businessPhone?: string;
  websiteUrl?: string;
  /** Present on athlete profiles; unused for gyms but allowed on unified Profile reads */
  dateOfBirth?: string;
  gender?: string;
  height?: number;
  weight?: number;
  fitnessGoal?: string;
  fitnessLevel?: string;
  onboardingData?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

/** Unified profile shape returned by the API based on user role. */
export type Profile = AthleteProfile | GymProfile;

// ─── Gyms ─────────────────────────────────────────────────────────────────────

export interface Gym {
  id: string;
  ownerId: string;
  name: string;
  location: string;
  latitude?: number | null;
  longitude?: number | null;
  bio?: string;
  imageUrl?: string;
  galleryUrls?: string[];
  videoUrl?: string | null;
  workingHours?: WorkingHourSlot[];
  phone?: string;
  maxCapacity: number;
  amenities?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  currentOccupancy?: number; // computed/real-time, not stored
}

export interface GymPlanBenefits {
  freezeWeeks?: number;
  invitations?: number;
  privateCoachSessions?: number;
  spa?: number;
  jacuzzi?: number;
  sauna?: number;
}

export interface GymSubscriptionPlan {
  id: string;
  gymId: string;
  name: string;
  nameAr?: string | null;
  durationDays: number;
  price: number;
  currency: string;
  description?: string | null;
  benefits?: GymPlanBenefits | null;
  isActive: boolean;
  sortOrder: number;
  memberCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface GymMembership {
  id: string;
  gymId: string;
  userId: string;
  planId?: string | null;
  joinedAt: string;
  expiresAt?: string;
  isActive: boolean;
  paidAmount?: number | null;
  paymentMethod?: 'cash' | 'card' | 'transfer' | 'online' | null;
  paidAt?: string | null;
  plan?: Pick<GymSubscriptionPlan, 'id' | 'name' | 'nameAr' | 'price' | 'durationDays' | 'currency' | 'benefits'> | null;
  gym?: Gym;
  user?: ReceptionMemberUser & { profile?: (ReceptionMemberUser['profile'] & { onboardingData?: unknown }) | null };
  address?: string | null;
}

export interface GymCheckIn {
  id: string;
  gymId: string;
  userId: string;
  checkedInAt: string;
  checkedOutAt?: string | null;
  registeredById?: string | null;
  gym?: Gym;
}

export interface GymEquipment {
  id: string;
  gymId: string;
  name: string;
  nameAr?: string | null;
  imageUrl?: string | null;
  lastMaintenanceAt?: string | null;
  nextMaintenanceAt?: string | null;
  lastCleanedAt?: string | null;
  maintenanceIntervalDays: number;
  needsMaintenance: boolean;
  needsCleaning: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export type GymStaffRole = 'trainer' | 'receptionist' | 'cleaner' | 'other';
export type GymStaffPayoutType = 'salary' | 'bonus';
export type GymStaffPayoutStatus = 'pending' | 'paid' | 'failed';
export type GymStaffPayoutProvider = 'mock' | 'paymob' | 'manual' | 'cash';

export interface WorkingHourSlot {
  day: number;
  start: string;
  end: string;
}

export interface GymStaffLastPayout {
  id: string;
  type: GymStaffPayoutType;
  totalAmount: number;
  status: GymStaffPayoutStatus;
  paidAt?: string | null;
  createdAt: string;
}

export interface GymStaff {
  id: string;
  gymId: string;
  fullName: string;
  email?: string | null;
  phone?: string | null;
  role: GymStaffRole;
  baseSalary: number;
  workingHours: WorkingHourSlot[];
  workingHoursSummary?: string | null;
  isActive: boolean;
  hiredAt?: string | null;
  notes?: string | null;
  lastPayout?: GymStaffLastPayout | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface GymStaffPayout {
  id: string;
  gymId: string;
  staffId: string;
  type: GymStaffPayoutType;
  baseAmount: number;
  bonusAmount: number;
  totalAmount: number;
  periodMonth?: number | null;
  periodYear?: number | null;
  status: GymStaffPayoutStatus;
  provider: GymStaffPayoutProvider;
  externalId?: string | null;
  paidAt?: string | null;
  notes?: string | null;
  createdAt: string;
}

export interface GymStaffPayResult {
  payout: GymStaffPayout;
  requiresConfirm?: boolean;
  checkoutUrl?: string;
}

export interface GymClassStaff {
  id: string;
  fullName: string;
  role: GymStaffRole;
  email?: string | null;
}

export interface GymClass {
  id: string;
  gymId: string;
  name: string;
  nameAr?: string | null;
  description?: string | null;
  price: number;
  currency: string;
  staffId: string;
  sessionDate: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  imageUrl?: string | null;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
  staff?: GymClassStaff | null;
}

export type GymClassBookingStatus = 'booked' | 'cancelled' | 'attended' | 'no_show';

export interface GymClassBooking {
  id: string;
  gymId: string;
  classId: string;
  userId: string;
  sessionDate: string;
  paidAmount: number;
  paymentMethod: 'cash' | 'card' | 'transfer' | 'online';
  status: GymClassBookingStatus;
  notes?: string | null;
  createdAt?: string;
  user?: {
    id: string;
    email: string;
    profile?: { displayName?: string | null; avatarUrl?: string | null; gender?: string | null } | null;
  } | null;
  class?: Pick<GymClass, 'id' | 'name' | 'nameAr' | 'dayOfWeek' | 'startTime' | 'endTime' | 'price' | 'sessionDate'> | null;
}

export type ReceptionGender = 'male' | 'female' | 'unknown';
export type MembershipStatus = 'active' | 'expired' | 'inactive';

export interface ReceptionPresentCounts {
  total: number;
  male: number;
  female: number;
  unknown: number;
}

export interface ReceptionMemberUser {
  id: string;
  email: string;
  phone?: string | null;
  profile?: Pick<Profile, 'displayName' | 'avatarUrl' | 'gender'> | null;
}

export interface ReceptionPresentMember {
  visitId: string;
  userId: string;
  checkedInAt: string;
  gender: ReceptionGender;
  user: ReceptionMemberUser;
}

export interface ReceptionMemberDetail {
  membershipId: string;
  userId: string;
  planId?: string | null;
  plan?: Pick<GymSubscriptionPlan, 'id' | 'name' | 'nameAr' | 'price' | 'durationDays' | 'currency' | 'benefits'> | null;
  paidAmount?: number | null;
  paymentMethod?: 'cash' | 'card' | 'transfer' | 'online' | null;
  paidAt?: string | null;
  joinedAt: string;
  expiresAt?: string | null;
  isActive: boolean;
  membershipStatus: MembershipStatus;
  daysRemaining: number | null;
  isPresent: boolean;
  checkedInAt?: string | null;
  visitId?: string | null;
  gender: ReceptionGender;
  address?: string | null;
  user: ReceptionMemberUser;
}

export interface ReceptionMemberVisit {
  visitId: string;
  checkedInAt: string;
  checkedOutAt?: string | null;
  isOpen: boolean;
  durationMinutes: number;
}

export interface ReceptionMemberVisitStats {
  totalVisits: number;
  totalMinutes: number;
}

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

// ─── Exercises (MuscleWiki catalog) ───────────────────────────────────────────

export interface ExerciseVideo {
  url?: string;
  type?: string;
  angle?: string;
  gender?: string;
  filename?: string;
}

export interface Exercise {
  id: string;
  musclewikiId: number;
  slug?: string | null;
  name: string;
  nameAr?: string | null;
  displayName?: string | null;
  category: string;
  difficulty?: string | null;
  force?: string | null;
  mechanic?: string | null;
  grips?: unknown;
  primaryMuscles: string[];
  secondaryMuscles?: string[];
  steps: string[];
  videos: ExerciseVideo[];
  thumbnailUrl?: string | null;
  videoUrl?: string | null;
  longDescription?: string | null;
  source: string;
}

export interface ExerciseListResponse {
  items: Exercise[];
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
}

export interface ExerciseLog {
  id: string;
  userId: string;
  exerciseId: string;
  loggedAt: string;
  notes?: string | null;
  sets?: number;
  reps?: number;
  exercise?: Exercise | null;
}

// ─── Nutrition ────────────────────────────────────────────────────────────────

export type FoodCategory = 'Protein' | 'Carb' | 'Fat' | 'Veggie' | 'Supplement';

export interface FoodItem {
  id: string;
  fdcId?: number | null;
  webtebId?: number | null;
  userId?: string | null;
  name: string;
  displayName?: string;
  category: FoodCategory | string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  saturatedFat?: number | null;
  transFat?: number | null;
  cholesterol?: number | null;
  sodium?: number | null;
  potassium?: number | null;
  dietaryFiber?: number | null;
  sugars?: number | null;
  vitaminA?: number | null;
  vitaminC?: number | null;
  calcium?: number | null;
  iron?: number | null;
  imageUrl?: string;
  isPublic: boolean;
}

/** Browse category (WebTeb catalog). */
export interface FdcCategory {
  id: string;
  query: string;
  icon: string;
  nameAr?: string;
  foodCount?: number;
}

/** Nutrition search hit from WebTeb database. */
export interface FdcFoodPreview {
  source?: 'webteb';
  webtebId?: number;
  name: string;
  nameEn?: string;
  dataType: string | null;
  brandOwner?: string | null;
  categoryId?: string | null;
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
  hasMore?: boolean;
  filtersApplied?: boolean;
  source?: 'webteb';
  emptyDatabase?: boolean;
}

export interface FdcNutrientRow {
  id: number | null;
  name: string;
  amount: number;
  unit: string;
  display: string;
}

export interface WebtebServingUnit {
  label: string;
  weightText?: string | null;
  weightGrams: number | null;
  weightId?: string | null;
}

export interface FdcFoodDetails {
  source?: 'webteb';
  webtebId?: number;
  name: string;
  nameEn?: string;
  dataType: string | null;
  foodCategory: string | null;
  foodCategoryEn?: string | null;
  servingLabel: string | null;
  servingUnits?: WebtebServingUnit[];
  macros: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
  calorieBreakdown: {
    total: number;
    fromCarbs: number;
    fromProtein: number;
    fromFat: number;
    computedTotal: number;
  };
  vitamins: FdcNutrientRow[];
  minerals: FdcNutrientRow[];
  nutrients: FdcNutrientRow[];
}

export interface FdcNutrientRow {
  id: number | null;
  name: string;
  amount: number;
  unit: string;
}

export interface FdcCalorieBreakdown {
  total: number;
  fromCarbs: number;
  fromFat: number;
  fromProtein: number;
  pctCarbs: number;
  pctFat: number;
  pctProtein: number;
}

/** Full nutrition facts from GET /api/nutrition/fdc/food/:fdcId */
export interface FdcFoodDetails {
  fdcId: number;
  name: string;
  dataType: string | null;
  foodCategory: string | null;
  servingSize: number | null;
  servingSizeUnit: string | null;
  per100g: boolean;
  macros: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
  calories: FdcCalorieBreakdown;
  general: FdcNutrientRow[];
  vitamins: FdcNutrientRow[];
  minerals: FdcNutrientRow[];
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
export interface FoodLog {
  id: string;
  userId: string;
  foodItemId: string;
  mealSlotId?: string | null;
  loggedAt: string;
  grams: number;
  foodItem?: FoodItem;
}

// ─── Marketplace ──────────────────────────────────────────────────────────────

export interface ShopCategory {
  id: string;
  slug: string;
  nameEn: string;
  nameAr?: string | null;
  icon?: string | null;
  parentId?: string | null;
  sortOrder?: number;
  productCount?: number;
  previewImageUrl?: string | null;
  children?: ShopCategoryChild[];
}

export interface ShopCategoryChild {
  id: string;
  slug: string;
  nameEn: string;
  nameAr?: string | null;
  parentId?: string | null;
  sortOrder?: number;
  productCount?: number;
  previewImageUrl?: string | null;
  children?: ShopCategoryChild[];
}

export interface ProductListResponse {
  items: Product[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

export interface Product {
  id: string;
  slug?: string | null;
  name: string;
  nameAr?: string | null;
  brand: string;
  categoryId?: string | null;
  category?: Pick<ShopCategory, 'id' | 'slug' | 'nameEn' | 'nameAr' | 'icon' | 'parentId'> | null;
  price: number;
  compareAtPrice?: number | null;
  currency?: string;
  discountPercent?: number | null;
  priceMin?: number | null;
  priceMax?: number | null;
  hasVariants?: boolean;
  imageUrl?: string;
  description?: string;
  descriptionAr?: string | null;
  stock: number;
  isOnSale?: boolean;
  isFeatured?: boolean;
  isActive: boolean;
  sortOrder?: number;
  avgRating?: number | null;
  reviewCount?: number | null;
  wishlistCount?: number | null;
  salesCount?: number | null;
}

export interface CheckoutConfig {
  stripeEnabled: boolean;
  stripeTestMode: boolean;
  mockPaymentsEnabled: boolean;
  autoRefundEnabled: boolean;
}

export interface StripeCheckoutSession {
  url: string;
  sessionId: string;
}

export interface CheckoutPreview {
  subtotal: number;
  shippingFee: number;
  total: number;
  currency: string;
  estimatedDays: string;
  freeShippingApplied: boolean;
  freeShippingMin: number;
}

export interface ShippingAddress {
  governorate: string;
  city: string;
  address: string;
  phone: string;
}

export interface Payment {
  id: string;
  orderId: string;
  provider: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  externalId?: string | null;
  paidAt?: string | null;
  createdAt: string;
}

export interface Order {
  id: string;
  userId: string;
  status: OrderStatus;
  paymentStatus?: PaymentStatus;
  paymentProvider?: string | null;
  paymentReference?: string | null;
  paidAt?: string | null;
  carrier?: string | null;
  shippedAt?: string | null;
  deliveredAt?: string | null;
  subtotal: number;
  shippingFee: number;
  total: number;
  currency?: string;
  paymentMethod?: PaymentMethod | null;
  shippingGovernorate?: string | null;
  shippingCity?: string | null;
  shippingAddress?: string | null;
  shippingPhone?: string | null;
  trackingNumber?: string | null;
  needsPayment?: boolean;
  autoRefunded?: boolean;
  createdAt: string;
  updatedAt: string;
  items?: OrderItem[];
  payments?: Payment[];
}

export interface OrderItem {
  id: string;
  orderId: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  product?: Product;
}

// ─── Community ────────────────────────────────────────────────────────────────

export type FollowStatus = 'none' | 'pending' | 'accepted';

export interface CommunityAuthor {
  id: string;
  email: string;
  role: UserRole;
  handle?: string;
  profile?: { displayName?: string; avatarUrl?: string; communityAvatarUrl?: string; coverUrl?: string; bio?: string };
  isPrivate?: boolean;
  followStatus?: FollowStatus;
  /** They follow the logged-in user (accepted). */
  followsViewer?: boolean;
  /** Active within the last few minutes (server-derived from lastSeenAt). */
  isOnline?: boolean;
  lastSeenAt?: string | null;
}

export interface CommunityFollowRequest {
  id: string;
  follower: CommunityAuthor;
  createdAt: string;
}

export interface CommunityUserProfile {
  user: CommunityAuthor;
  followersCount: number;
  followingCount: number;
  isFollowing: boolean;
  followStatus: FollowStatus;
  isPrivate: boolean;
  canViewPosts: boolean;
  isMe: boolean;
  isMutualFollow?: boolean;
  blockedByMe?: boolean;
  ringing?: boolean;
  posts: CommunityPost[];
  mentionedPosts?: CommunityPost[];
  gym: { id: string; name: string; location: string; imageUrl?: string | null } | null;
  incomingFollowRequests?: CommunityFollowRequest[];
}

export type ReactionEmoji = 'like' | 'love' | 'haha' | 'wow' | 'sad' | 'angry';

export type PrivacyAudience = 'everyone' | 'followers' | 'following' | 'mutual' | 'nobody' | 'only_me';

export interface CommunityPrivacySettings {
  repostsAudience: PrivacyAudience;
  savedPostsAudience: PrivacyAudience;
  storyAudience: PrivacyAudience;
  mentionsAudience: PrivacyAudience;
  sharesAudience: PrivacyAudience;
  presenceAudience: PrivacyAudience;
  storyHideFromIds: string[];
}

export type CommunityMention =
  | { type: 'user'; id: string; user: CommunityAuthor }
  | { type: 'gym'; id: string; gym: { id: string; name: string; imageUrl?: string | null; ownerId?: string } };

export interface StoryReshareAttribution {
  storyId: string;
  author?: CommunityAuthor;
}

export interface CommunityStoryItem {
  id: string;
  mediaUrl: string;
  mediaType: string;
  caption?: string | null;
  createdAt: string;
  expiresAt: string;
  seen: boolean;
  viewCount?: number;
  reactionCount?: number;
  replyCount?: number;
  myReaction?: string | null;
  isMine?: boolean;
  mentions?: CommunityMention[];
  resharedFrom?: StoryReshareAttribution | null;
  canReshare?: boolean;
}

export interface StoryAuthorBundle {
  author: CommunityAuthor;
  stories: CommunityStoryItem[];
  hasUnseen: boolean;
}

export interface StoryViewer {
  id: string;
  viewedAt: string;
  reactionEmoji?: ReactionEmoji | string | null;
  loved?: boolean;
  user: CommunityAuthor;
}

export interface StoryReply {
  id: string;
  content: string;
  createdAt: string;
  user: CommunityAuthor;
}

export interface PostMediaItem {
  id?: string;
  url: string;
  mediaType: 'image' | 'video';
}

export interface CommunityPollOption {
  id: string;
  label: string;
  votesCount: number;
  percent: number;
}

export interface CommunityPoll {
  id: string;
  postId: string;
  endsAt?: string | null;
  ended?: boolean;
  totalVotes: number;
  myOptionId?: string | null;
  options: CommunityPollOption[];
}

export interface CommunityPost {
  id: string;
  authorId: string;
  groupId?: string | null;
  content: string;
  imageUrl?: string | null;
  videoUrl?: string | null;
  mediaItems?: PostMediaItem[];
  mediaType?: 'image' | 'video' | 'mixed' | null;
  commentsLocked?: boolean;
  repostsLocked?: boolean;
  visibility?: PrivacyAudience;
  mentions?: CommunityMention[];
  canShare?: boolean;
  taggedUsers?: CommunityAuthor[];
  savedByMe?: boolean;
  authorRinging?: boolean;
  likesCount: number;
  repostsCount: number;
  commentsCount?: number;
  createdAt: string;
  updatedAt: string;
  likedByMe?: boolean;
  myReaction?: ReactionEmoji | null;
  reactions?: Partial<Record<ReactionEmoji, number>>;
  repostedByMe?: boolean;
  poll?: CommunityPoll | null;
  isProfilePinned?: boolean;
  profilePinnedAt?: string | null;
  isGroupFeatured?: boolean;
  groupPinnedAt?: string | null;
  locationName?: string | null;
  author?: CommunityAuthor;
  group?: { id: string; name: string; imageUrl?: string | null };
  _count?: { comments?: number; likes?: number; reposts?: number };
  comments?: CommunityComment[];
}

export interface CommunityComment {
  id: string;
  postId: string;
  authorId: string;
  parentId?: string | null;
  content: string;
  createdAt: string;
  updatedAt?: string;
  author?: CommunityAuthor;
  reactions?: Partial<Record<ReactionEmoji, number>>;
  myReaction?: ReactionEmoji | null;
  likesCount?: number;
  repliesCount?: number;
  replyTo?: { id: string; author?: CommunityAuthor } | null;
  /** Optimistic comment — replaced when API responds. */
  pending?: boolean;
}

export interface CommunityPostReposter {
  id: string;
  userId: string;
  createdAt: string;
  user: CommunityAuthor;
}

export type GroupPostPermission = 'all_members' | 'admins_only';
export type GroupInvitePermission = 'admins_only' | 'all_members';
export type GroupPostsVisibility = 'public' | 'members_only';
export type GroupMembersVisibility = 'all_members' | 'admins_only';
export type GroupJoinPolicy = 'open' | 'approval';
export type GroupMemberRole = 'owner' | 'admin' | 'member';

export interface CommunityGroup {
  id: string;
  name: string;
  description?: string | null;
  imageUrl?: string | null;
  ownerId: string;
  owner?: CommunityAuthor;
  membersCount: number;
  postsCount: number;
  joined: boolean;
  invitePending?: boolean;
  joinPending?: boolean;
  myRole?: GroupMemberRole | null;
  canManage?: boolean;
  canPost?: boolean;
  canInvite?: boolean;
  canViewPosts?: boolean;
  canViewMembers?: boolean;
  postPermission?: GroupPostPermission;
  invitePermission?: GroupInvitePermission;
  joinPolicy?: GroupJoinPolicy;
  postsVisibility?: GroupPostsVisibility;
  membersVisibility?: GroupMembersVisibility;
  createdAt: string;
}

export interface GroupJoinRequestMember extends CommunityGroupMember {
  user?: CommunityAuthor;
}

export interface CommunityGroupMember {
  id: string;
  userId: string;
  role: GroupMemberRole;
  joinedAt: string;
  user?: CommunityAuthor;
}

export type ConversationStatus = 'active' | 'pending';

export interface CommunityConversation {
  id: string;
  updatedAt: string;
  status?: ConversationStatus;
  isGroup?: boolean;
  name?: string | null;
  avatarUrl?: string | null;
  bio?: string | null;
  canAddMembers?: 'all' | 'admins';
  canSendMessages?: 'all' | 'admins';
  myRole?: 'admin' | 'member';
  isMessageRequest?: boolean;
  canSendMessage?: boolean;
  otherUser: CommunityAuthor | null;
  participants?: (Omit<CommunityAuthor, 'role'> & { role?: string })[] | null;
  /** Present on group chats when the full participant list is omitted from list responses. */
  participantsCount?: number;
  lastMessage: {
    content: string;
    createdAt: string;
    senderId: string;
    isMine: boolean;
  } | null;
  unreadCount: number;
  isStarred?: boolean;
  starredAt?: string | null;
}

export type MessageType = 'text' | 'image' | 'audio' | 'emoji' | 'story_reply' | 'system';

export type MessageDeliveryStatus = 'sent' | 'delivered' | 'read';

export interface CommunityMessage {
  id: string;
  conversationId: string;
  senderId: string;
  messageType?: MessageType;
  content: string;
  mediaUrl?: string | null;
  createdAt: string;
  deliveredAt?: string | null;
  isMine: boolean;
  status?: MessageDeliveryStatus;
  sender?: CommunityAuthor;
  isStarred?: boolean;
  starredAt?: string | null;
}

export interface StarredInboxMessage {
  starredAt: string;
  message: CommunityMessage;
  conversation: {
    id: string;
    isGroup?: boolean;
    name?: string | null;
    otherUser?: CommunityAuthor | null;
  };
}

export interface InboxMessagesResponse {
  messages: CommunityMessage[];
  otherLastReadAt: string | null;
}

// ─── Notifications ────────────────────────────────────────────────────────────

export interface Notification {
  id: string;
  userId: string;
  actorId?: string | null;
  actorDisplayName?: string | null;
  actorAvatarUrl?: string | null;
  type: string;
  title: string;
  message: string;
  link?: string | null;
  read: boolean;
  createdAt: string;
}
