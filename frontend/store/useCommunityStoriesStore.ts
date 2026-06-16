import { create } from 'zustand';
import type { StoryAuthorBundle } from '../types';
import communityService from '../services/communityService';
import { markAuthorStoriesSeen, sortStoryBundles } from '../features/community/storyBundles';
import { setGetCache } from '../lib/apiGetCache';
import { communityStoriesKey } from '../lib/communityCache';

type StoriesState = {
  bundles: StoryAuthorBundle[];
  loadedAt: number;
  loading: boolean;
  /** userId -> has active story (from feed + per-user cache) */
  storyUserIds: Set<string>;
  setBundles: (bundles: StoryAuthorBundle[], selfUserId?: string | null) => void;
  markAuthorStoriesSeen: (authorId: string, throughIndex: number, selfUserId?: string | null) => void;
  refresh: () => Promise<StoryAuthorBundle[]>;
  hasStory: (userId: string) => boolean;
  ensureUserStory: (userId: string) => Promise<boolean>;
};

export const useCommunityStoriesStore = create<StoriesState>((set, get) => ({
  bundles: [],
  loadedAt: 0,
  loading: false,
  storyUserIds: new Set(),

  setBundles: (bundles, selfUserId) => {
    const sorted = sortStoryBundles(bundles, selfUserId);
    const storyUserIds = new Set(
      sorted.filter((b) => b.stories?.length).map((b) => b.author.id),
    );
    set({ bundles: sorted, storyUserIds, loadedAt: Date.now() });
    setGetCache(communityStoriesKey(), sorted);
  },

  markAuthorStoriesSeen: (authorId, throughIndex, selfUserId) => {
    const sorted = markAuthorStoriesSeen(get().bundles, authorId, throughIndex, selfUserId);
    get().setBundles(sorted, selfUserId);
  },

  refresh: async () => {
    set({ loading: true });
    try {
      const res = await communityService.refreshStoriesFeed();
      const bundles = res.data ?? [];
      get().setBundles(bundles);
      return bundles;
    } finally {
      set({ loading: false });
    }
  },

  hasStory: (userId) => get().storyUserIds.has(userId),

  ensureUserStory: async (userId) => {
    if (get().storyUserIds.has(userId)) return true;
    const res = await communityService.getUserStories(userId);
    const has = Boolean(res.data?.stories?.length);
    if (has) {
      set((s) => {
        const storyUserIds = new Set(s.storyUserIds);
        storyUserIds.add(userId);
        return { storyUserIds };
      });
    }
    return has;
  },
}));
