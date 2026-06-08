import { create } from 'zustand';
import type { StoryAuthorBundle } from '../types';
import communityService from '../services/communityService';

type StoriesState = {
  bundles: StoryAuthorBundle[];
  loadedAt: number;
  loading: boolean;
  /** userId -> has active story (from feed + per-user cache) */
  storyUserIds: Set<string>;
  setBundles: (bundles: StoryAuthorBundle[]) => void;
  refresh: () => Promise<StoryAuthorBundle[]>;
  hasStory: (userId: string) => boolean;
  ensureUserStory: (userId: string) => Promise<boolean>;
};

export const useCommunityStoriesStore = create<StoriesState>((set, get) => ({
  bundles: [],
  loadedAt: 0,
  loading: false,
  storyUserIds: new Set(),

  setBundles: (bundles) => {
    const storyUserIds = new Set(
      bundles.filter((b) => b.stories?.length).map((b) => b.author.id),
    );
    set({ bundles, storyUserIds, loadedAt: Date.now() });
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
