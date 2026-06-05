import { create } from 'zustand';

export type ProfileFollowCounts = {
  followersCount: number;
  followingCount: number;
};

interface CommunityFollowCountsState {
  myCounts: ProfileFollowCounts | null;
  setMyCounts: (counts: ProfileFollowCounts) => void;
}

/** Keeps the signed-in user's follower/following totals in sync after follow actions elsewhere. */
export const useCommunityFollowCountsStore = create<CommunityFollowCountsState>((set) => ({
  myCounts: null,
  setMyCounts: (counts) => set({ myCounts: counts }),
}));
