import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useI18n } from '../../lib/i18n/useI18n';
import communityService from '../../services/communityService';
import type { CommunityPost } from '../../types';
import { MentionPicker, type MentionSelection } from './MentionPicker';
import { PostMediaEditor, mediaItemsFromPost, toMediaPayload, type DraftMediaItem } from './PostMediaEditor';
import { EmojiComposer } from './EmojiComposer';

function mentionsFromPost(post: CommunityPost): MentionSelection {
  const labels: MentionSelection['labels'] = [];
  const userIds: string[] = [];
  const gymIds: string[] = [];
  for (const m of post.mentions ?? []) {
    if (m.type === 'user' && m.user) {
      userIds.push(m.user.id);
      labels.push({ type: 'user', id: m.user.id, name: m.user.profile?.displayName || m.user.handle || m.user.id });
    }
    if (m.type === 'gym' && m.gym) {
      gymIds.push(m.gym.id);
      labels.push({ type: 'gym', id: m.gym.id, name: m.gym.name });
    }
  }
  return { userIds, gymIds, labels };
}

interface EditPostModalProps {
  post: CommunityPost;
  open: boolean;
  onClose: () => void;
  onSaved: (post: CommunityPost) => void;
}

export const EditPostModal: React.FC<EditPostModalProps> = ({ post, open, onClose, onSaved }) => {
  const { t } = useI18n();
  const [content, setContent] = useState(post.content);
  const [mentions, setMentions] = useState<MentionSelection>(() => mentionsFromPost(post));
  const [mediaItems, setMediaItems] = useState<DraftMediaItem[]>(() => mediaItemsFromPost(post));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setContent(post.content);
    setMentions(mentionsFromPost(post));
    setMediaItems(mediaItemsFromPost(post));
    setError(null);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open, post]);

  const canSave = content.trim().length > 0 || mediaItems.length > 0;

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    const res = await communityService.updatePost(post.id, {
      content: content.trim(),
      mentionUserIds: mentions.userIds,
      mentionGymIds: mentions.gymIds,
      mediaItems: toMediaPayload(mediaItems),
    });
    setSaving(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    if (res.data) {
      onSaved(res.data);
      onClose();
    }
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[300] bg-black/70 flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.96, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.96, opacity: 0 }}
            className="w-full max-w-lg max-h-[min(90vh,720px)] overflow-y-auto rounded-2xl border border-border bg-surface p-5 space-y-4 custom-scrollbar shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-black">{t('community.editPost')}</h2>
            <EmojiComposer
              value={content}
              onChange={setContent}
              multiline
              rows={4}
              placeholder={t('community.composerPlaceholderLong')}
              inputClassName="w-full rounded-xl border border-subtle bg-elevated px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 min-w-0"
              className="w-full"
            />
            <PostMediaEditor items={mediaItems} onChange={setMediaItems} onError={setError} />
            <MentionPicker value={mentions} onChange={setMentions} />
            {error && <p className="text-sm text-red-400">{error}</p>}
            <div className="flex gap-2 justify-end sticky bottom-0 bg-surface pt-2">
              <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-bold text-muted">
                {t('common.cancel')}
              </button>
              <button
                type="button"
                onClick={save}
                disabled={saving || !canSave}
                className="px-5 py-2 rounded-xl bg-primary text-white text-sm font-bold disabled:opacity-50"
              >
                {saving ? '…' : t('common.save')}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
};
