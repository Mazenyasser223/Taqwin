import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import communityService from '../services/communityService';
import type { StoryAuthorBundle } from '../types';

export interface StoryViewerState {
  bundle: StoryAuthorBundle;
  index: number;
  /** Bumps on each slide change so media layers always remount. */
  playToken: number;
}

interface CommunityStoryViewerStore {
  viewer: StoryViewerState | null;
  anchorRect: DOMRect | null;
  openStory: (bundle: StoryAuthorBundle, index: number, anchor?: DOMRect | null) => void;
  goToStoryIndex: (index: number) => void;
  openStoryForUserId: (userId: string, anchor?: DOMRect | null) => Promise<boolean>;
  close: () => void;
}

function cloneBundle(bundle: StoryAuthorBundle): StoryAuthorBundle {
  return {
    ...bundle,
    author: { ...bundle.author },
    stories: bundle.stories.map((s) => ({ ...s })),
  };
}

function patchBundleSeenThrough(bundle: StoryAuthorBundle, throughIndex: number): StoryAuthorBundle {
  const stories = bundle.stories.map((s, i) => (i <= throughIndex ? { ...s, seen: true } : s));
  return {
    ...bundle,
    stories,
    hasUnseen: stories.some((s) => !s.seen),
  };
}

function firstUnseenIndex(bundle: StoryAuthorBundle): number {
  const idx = bundle.stories.findIndex((s) => !s.seen);
  return idx >= 0 ? idx : 0;
}

export const useCommunityStoryViewerStore = create<CommunityStoryViewerStore>((set, get) => ({
  viewer: null,
  anchorRect: null,
  openStory: (bundle, index, anchor = null) => {
    const isolated = cloneBundle(bundle);
    const start = index >= 0 ? index : firstUnseenIndex(isolated);
    const safeIndex = Math.min(Math.max(start, 0), isolated.stories.length - 1);
    const story = isolated.stories[safeIndex];
    if (story) void communityService.viewStory(story.id);
    const patched = patchBundleSeenThrough(isolated, safeIndex);
    set({
      viewer: { bundle: patched, index: safeIndex, playToken: 0 },
      anchorRect: anchor ?? null,
    });
  },
  goToStoryIndex: (index) => {
    const current = get().viewer;
    if (!current) return;
    if (index < 0 || index >= current.bundle.stories.length) return;
    const story = current.bundle.stories[index];
    if (story) void communityService.viewStory(story.id);
    const patched = patchBundleSeenThrough(current.bundle, index);
    set({
      viewer: {
        bundle: patched,
        index,
        playToken: current.playToken + 1,
      },
      anchorRect: get().anchorRect,
    });
  },
  openStoryForUserId: async (userId, anchor = null) => {
    const feedRes = await communityService.getStoriesFeed();
    let bundle = (feedRes.data ?? []).find((b) => b.author.id === userId);
    if (!bundle?.stories?.length) {
      const userRes = await communityService.getUserStories(userId);
      bundle = userRes.data ?? undefined;
    }
    if (!bundle?.stories?.length) return false;
    get().openStory(bundle, firstUnseenIndex(bundle), anchor);
    return true;
  },
  close: () => set({ viewer: null, anchorRect: null }),
}));

export function useStoryViewerSlice() {
  return useCommunityStoryViewerStore(
    useShallow((s) => {
      const v = s.viewer;
      const storyIndex = v?.index ?? -1;
      const currentStory =
        v && storyIndex >= 0 ? v.bundle.stories[storyIndex] ?? null : null;
      return {
        viewer: v,
        storyIndex,
        playToken: v?.playToken ?? 0,
        currentStory,
        anchorRect: s.anchorRect,
      };
    }),
  );
}
