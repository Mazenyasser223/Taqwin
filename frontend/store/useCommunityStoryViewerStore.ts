import { create } from 'zustand';
import communityService from '../services/communityService';
import type { StoryAuthorBundle } from '../types';

export interface StoryViewerState {
  bundle: StoryAuthorBundle;
  index: number;
}

interface CommunityStoryViewerStore {
  viewer: StoryViewerState | null;
  anchorRect: DOMRect | null;
  openStory: (bundle: StoryAuthorBundle, index: number, anchor?: DOMRect | null) => void;
  openStoryForUserId: (userId: string, anchor?: DOMRect | null) => Promise<boolean>;
  close: () => void;
}

export const useCommunityStoryViewerStore = create<CommunityStoryViewerStore>((set) => ({
  viewer: null,
  anchorRect: null,
  openStory: (bundle, index, anchor = null) => {
    const story = bundle.stories[index];
    if (story) void communityService.viewStory(story.id);
    set({ viewer: { bundle, index }, anchorRect: anchor ?? null });
  },
  openStoryForUserId: async (userId, anchor = null) => {
    const feedRes = await communityService.getStoriesFeed();
    let bundle = (feedRes.data ?? []).find((b) => b.author.id === userId);
    if (!bundle?.stories?.length) {
      const userRes = await communityService.getUserStories(userId);
      bundle = userRes.data ?? undefined;
    }
    if (!bundle?.stories?.length) return false;
    const story = bundle.stories[0];
    if (story) void communityService.viewStory(story.id);
    set({ viewer: { bundle, index: 0 }, anchorRect: anchor ?? null });
    return true;
  },
  close: () => set({ viewer: null, anchorRect: null }),
}));
