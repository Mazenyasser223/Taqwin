import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../../store/useAuthStore';
import { useI18n } from '../../lib/i18n/useI18n';
import communityService from '../../services/communityService';
import type { CommunityComment, CommunityPost } from '../../types';
import { displayName, fallbackAvatar, timeAgo, communityProfilePath } from './communityUtils';
import { EmojiComposer } from './EmojiComposer';
import { CommentReactionPicker } from './CommentReactionPicker';
import type { ReactionEmoji } from './reactions';

interface PostCommentsProps {
  post: CommunityPost;
  comments: CommunityComment[];
  highlightCommentId?: string | null;
  onCommentsChange: (comments: CommunityComment[]) => void;
  onCommentCountChange: (delta: number) => void;
}

export const PostComments: React.FC<PostCommentsProps> = ({
  post,
  comments,
  highlightCommentId = null,
  onCommentsChange,
  onCommentCountChange,
}) => {
  const { t } = useI18n();
  const { user } = useAuthStore();
  const isPostOwner = user?.id === post.authorId;

  const [commentDraft, setCommentDraft] = useState('');
  const [replyToId, setReplyToId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const highlightedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!highlightCommentId) return;
    const timer = window.setTimeout(() => {
      highlightedRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 400);
    return () => window.clearTimeout(timer);
  }, [highlightCommentId, comments.length]);

  const { roots, repliesByParent } = useMemo(() => {
    const roots: CommunityComment[] = [];
    const repliesByParent = new Map<string, CommunityComment[]>();
    for (const c of comments) {
      if (c.parentId) {
        const list = repliesByParent.get(c.parentId) ?? [];
        list.push(c);
        repliesByParent.set(c.parentId, list);
      } else {
        roots.push(c);
      }
    }
    return { roots, repliesByParent };
  }, [comments]);

  const updateCommentInList = (updated: CommunityComment) => {
    onCommentsChange(comments.map((c) => (c.id === updated.id ? updated : c)));
  };

  const removeCommentFromList = (commentId: string) => {
    const toRemove = new Set<string>([commentId]);
    for (const c of comments) {
      if (c.parentId === commentId) toRemove.add(c.id);
    }
    const removed = comments.filter((c) => toRemove.has(c.id));
    onCommentsChange(comments.filter((c) => !toRemove.has(c.id)));
    onCommentCountChange(-removed.length);
  };

  const submitComment = async () => {
    const draft = commentDraft.trim();
    if (!draft) return;
    const res = await communityService.addComment(post.id, {
      content: draft,
      parentId: replyToId ?? undefined,
    });
    if (res.data) {
      onCommentsChange([...comments, res.data]);
      onCommentCountChange(1);
      setCommentDraft('');
      setReplyToId(null);
    }
  };

  const saveEdit = async (commentId: string) => {
    const draft = editDraft.trim();
    if (!draft) return;
    const res = await communityService.updateComment(commentId, draft);
    if (res.data) {
      updateCommentInList(res.data);
      setEditingId(null);
      setEditDraft('');
    }
  };

  const deleteComment = async (commentId: string) => {
    if (!window.confirm(t('community.deleteCommentConfirm'))) return;
    const res = await communityService.deleteComment(commentId);
    if (res.data?.ok) removeCommentFromList(commentId);
  };

  const reactToComment = async (commentId: string, emoji: ReactionEmoji) => {
    const res = await communityService.reactComment(commentId, emoji);
    if (res.data) updateCommentInList(res.data);
  };

  const renderComment = (c: CommunityComment, isReply = false) => {
    const isMine = user?.id === c.authorId;
    const canDelete = isMine || isPostOwner;
    const isEditing = editingId === c.id;
    const childReplies = repliesByParent.get(c.id) ?? [];

    const highlighted = highlightCommentId === c.id;

    return (
      <div
        key={c.id}
        ref={highlighted ? highlightedRef : undefined}
        className={`${isReply ? 'ml-10 mt-2' : ''} ${highlighted ? 'rounded-xl ring-2 ring-primary/50 bg-primary/5 p-1 -m-1' : ''}`}
      >
        <div className="flex gap-2 group">
          <Link to={communityProfilePath(c.authorId)} className="shrink-0">
            <img
              src={c.author?.profile?.avatarUrl || fallbackAvatar(c.authorId)}
              alt=""
              className="size-8 rounded-full object-cover"
            />
          </Link>
          <div className="flex-1 min-w-0">
            {isEditing ? (
              <div className="space-y-2">
                <EmojiComposer
                  value={editDraft}
                  onChange={setEditDraft}
                  multiline
                  placeholder={t('community.editComment')}
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => saveEdit(c.id)}
                    className="px-3 py-1 bg-primary text-white text-xs font-bold rounded-lg"
                  >
                    {t('common.save')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingId(null);
                      setEditDraft('');
                    }}
                    className="px-3 py-1 text-xs text-muted"
                  >
                    {t('common.cancel')}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <p className="text-sm text-foreground/85 leading-relaxed break-words">
                  <Link
                    to={communityProfilePath(c.authorId)}
                    className="font-bold text-foreground mr-1 hover:text-primary"
                  >
                    {displayName(c.author)}
                  </Link>
                  {c.content}
                </p>
                <div className="flex flex-wrap items-center gap-3 mt-1">
                  <p className="text-[10px] text-faint">{timeAgo(c.updatedAt || c.createdAt)}</p>
                  <CommentReactionPicker comment={c} onReact={(emoji) => reactToComment(c.id, emoji)} />
                  {!post.commentsLocked && (
                    <button
                      type="button"
                      onClick={() => {
                        setReplyToId(c.id);
                        setCommentDraft(`@${displayName(c.author)} `);
                      }}
                      className="text-[10px] font-bold text-muted hover:text-primary"
                    >
                      {t('community.reply')}
                    </button>
                  )}
                  {isMine && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(c.id);
                        setEditDraft(c.content);
                      }}
                      className="text-[10px] font-bold text-muted hover:text-primary opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      {t('community.editComment')}
                    </button>
                  )}
                  {canDelete && (
                    <button
                      type="button"
                      onClick={() => deleteComment(c.id)}
                      className="text-[10px] font-bold text-muted hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      {t('community.deleteComment')}
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
        {childReplies.map((r) => renderComment(r, true))}
      </div>
    );
  };

  return (
    <div className="p-4 sm:p-5 space-y-3">
      {roots.length === 0 && <p className="text-faint text-xs">{t('community.noComments')}</p>}
      {roots.map((c) => renderComment(c))}

      {!post.commentsLocked ? (
        <div className="pt-2 space-y-2">
          {replyToId && (
            <div className="flex items-center justify-between text-xs text-muted">
              <span>{t('community.replyingToComment')}</span>
              <button type="button" onClick={() => { setReplyToId(null); setCommentDraft(''); }} className="text-primary font-bold">
                {t('common.cancel')}
              </button>
            </div>
          )}
          <div className="flex gap-2 items-end">
            <EmojiComposer
              value={commentDraft}
              onChange={setCommentDraft}
              onSubmit={submitComment}
              placeholder={t('community.commentPlaceholder')}
              className="flex-1"
            />
            <button
              type="button"
              onClick={submitComment}
              className="px-4 py-2.5 bg-primary text-white text-sm font-bold rounded-xl shrink-0 shadow-sm shadow-primary/20 hover:brightness-110 transition-all"
            >
              {t('community.post')}
            </button>
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted pt-2">{t('community.commentsLocked')}</p>
      )}
    </div>
  );
};
