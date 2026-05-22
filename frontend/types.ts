
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
  phone?: string | null;
  phoneVerifiedAt?: string | null;
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
  coverUrl?: string;
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
  webtebId?: number | null;
  name: string;
  category: FoodCategory | string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
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

export type FollowStatus = 'none' | 'pending' | 'accepted';

export interface CommunityAuthor {
  id: string;
  email: string;
  role: UserRole;
  handle?: string;
  profile?: { displayName?: string; avatarUrl?: string; coverUrl?: string; bio?: string };
  isPrivate?: boolean;
  followStatus?: FollowStatus;
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
  storyHideFromIds: string[];
}

export type CommunityMention =
  | { type: 'user'; id: string; user: CommunityAuthor }
  | { type: 'gym'; id: string; gym: { id: string; name: string; imageUrl?: string | null; ownerId?: string } };

export interface CommunityStoryItem {
  id: string;
  mediaUrl: string;
  mediaType: string;
  createdAt: string;
  expiresAt: string;
  seen: boolean;
  viewCount?: number;
  reactionCount?: number;
  replyCount?: number;
  myReaction?: string | null;
  isMine?: boolean;
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
  likesCount: number;
  repostsCount: number;
  commentsCount?: number;
  createdAt: string;
  updatedAt: string;
  likedByMe?: boolean;
  myReaction?: ReactionEmoji | null;
  reactions?: Partial<Record<ReactionEmoji, number>>;
  repostedByMe?: boolean;
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
  isMessageRequest?: boolean;
  canSendMessage?: boolean;
  otherUser: CommunityAuthor | null;
  lastMessage: {
    content: string;
    createdAt: string;
    senderId: string;
    isMine: boolean;
  } | null;
  unreadCount: number;
}

export type MessageType = 'text' | 'image' | 'audio' | 'emoji' | 'story_reply';

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
