import React from 'react';
import type { CommunityPost } from '../../types';
import { useI18n } from '../../lib/i18n/useI18n';
import { getTopReactions, totalReactions } from './reactions';

interface PostReactionsSummaryProps {
  post: CommunityPost;
  commentCount: number;
  repostsCount: number;
  isPostOwner?: boolean;
  onCommentsClick?: () => void;
  onRepostsClick?: () => void;
}

export const PostReactionsSummary: React.FC<PostReactionsSummaryProps> = ({
  post,
  commentCount,
  repostsCount,
  isPostOwner = false,
  onCommentsClick,
  onRepostsClick,
}) => {
  const { t } = useI18n();
  const total = totalReactions(post);
  const top = getTopReactions(post, 3);
  const hasStats = total > 0 || commentCount > 0 || repostsCount > 0;

  if (!hasStats) return null;

  return (
    <div className="px-3 sm:px-4 py-2 flex items-center justify-between gap-3 text-xs text-muted border-t border-white/[0.06]">
      <div className="flex items-center min-w-0">
        {total > 0 && (
          <button
            type="button"
            className="flex items-center gap-1.5 hover:underline min-w-0"
            aria-label={`${total} reactions`}
          >
            <span className="inline-flex items-center shrink-0">
              {top.map((r, i) => (
                <span
                  key={r.id}
                  className="inline-flex items-center justify-center size-[18px] rounded-full text-[10px] leading-none border-2 border-surface shadow-sm"
                  style={{
                    backgroundColor: r.bg,
                    marginLeft: i > 0 ? -5 : 0,
                    zIndex: top.length - i,
                  }}
                  title={r.label}
                >
                  {r.symbol}
                </span>
              ))}
            </span>
            <span className="font-medium tabular-nums text-foreground/80 truncate">{total}</span>
          </button>
        )}
      </div>

      <div className="flex items-center gap-2 shrink-0 text-foreground/70">
        {commentCount > 0 && (
          <button
            type="button"
            onClick={onCommentsClick}
            className="hover:underline font-medium tabular-nums"
          >
            {t('community.commentsCount', { count: String(commentCount) })}
          </button>
        )}
        {commentCount > 0 && repostsCount > 0 && <span className="text-faint">·</span>}
        {repostsCount > 0 && (
          isPostOwner && onRepostsClick ? (
            <button
              type="button"
              onClick={onRepostsClick}
              className="hover:underline font-medium tabular-nums"
            >
              {t('community.repostsCount', { count: String(repostsCount) })}
            </button>
          ) : (
            <span className="font-medium tabular-nums">{t('community.repostsCount', { count: String(repostsCount) })}</span>
          )
        )}
      </div>
    </div>
  );
};
