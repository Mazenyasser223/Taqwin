export type ReactionEmoji = 'like' | 'love' | 'haha' | 'wow' | 'sad' | 'angry';

export const REACTIONS: { id: ReactionEmoji; label: string; symbol: string }[] = [
  { id: 'like', label: 'Like', symbol: '👍' },
  { id: 'love', label: 'Love', symbol: '❤️' },
  { id: 'haha', label: 'Haha', symbol: '😂' },
  { id: 'wow', label: 'Wow', symbol: '😮' },
  { id: 'sad', label: 'Sad', symbol: '😢' },
  { id: 'angry', label: 'Angry', symbol: '😠' },
];

export function reactionSymbol(id: ReactionEmoji | string | null | undefined) {
  return REACTIONS.find((r) => r.id === id)?.symbol ?? '👍';
}
