import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import type { CommunityConversation, CommunityAuthor } from '../../types';
import communityService from '../../services/communityService';
import uploadService from '../../services/uploadService';
import { displayName, fallbackAvatar, communityProfilePath } from './communityUtils';
import { resolveMediaUrl } from '../../lib/mediaUrl';
import { useAuthStore } from '../../store/useAuthStore';

interface GroupInfoPanelProps {
  conversation: CommunityConversation;
  onClose: () => void;
  onUpdated: (conv: CommunityConversation) => void;
  onLeave: () => void;
  /** Search users for adding */
  searchUsers: (q: string) => Promise<CommunityAuthor[]>;
}

export const GroupInfoPanel: React.FC<GroupInfoPanelProps> = ({
  conversation,
  onClose,
  onUpdated,
  onLeave,
  searchUsers,
}) => {
  const { user } = useAuthStore();
  const isAdmin = conversation.myRole === 'admin';

  const [detail, setDetail] = useState(conversation);
  const [membersLoading, setMembersLoading] = useState(
    Boolean(conversation.isGroup && !conversation.participants?.length),
  );
  const syncedParent = useRef(onUpdated);

  syncedParent.current = onUpdated;

  useEffect(() => {
    setDetail(conversation);
  }, [conversation]);

  useEffect(() => {
    if (!conversation.isGroup || conversation.participants?.length) {
      setMembersLoading(false);
      return;
    }
    let cancelled = false;
    setMembersLoading(true);
    void communityService.getConversation(conversation.id).then((res) => {
      if (cancelled) return;
      if (res.data) {
        setDetail(res.data);
        syncedParent.current(res.data);
      }
      setMembersLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [conversation.id, conversation.isGroup, conversation.participants?.length]);

  const memberCount = detail.participantsCount ?? detail.participants?.length ?? 0;
  const members = detail.participants ?? [];

  const [tab, setTab] = useState<'members' | 'settings'>('members');
  const [editName, setEditName] = useState(conversation.name ?? '');
  const [editBio, setEditBio] = useState(conversation.bio ?? '');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const [addQuery, setAddQuery] = useState('');
  const [addResults, setAddResults] = useState<CommunityAuthor[]>([]);
  const [addSearching, setAddSearching] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const canAdd =
    isAdmin ||
    (conversation.canAddMembers === 'all');

  // ─── Avatar upload ──────────────────────────────────────────────────────────
  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarUploading(true);
    const { url, error } = await uploadService.uploadFile(file, 'avatars');
    setAvatarUploading(false);
    e.target.value = '';
    if (!url) { setSaveError(error ?? 'Upload failed'); return; }
    const res = await communityService.updateGroupConversation(conversation.id, { avatarUrl: url });
    if (res.data) {
      setDetail(res.data);
      onUpdated(res.data);
    }
    else setSaveError(res.error ?? 'Failed to update');
  };

  // ─── Save info ──────────────────────────────────────────────────────────────
  const saveInfo = async () => {
    if (!isAdmin) return;
    setSaving(true);
    setSaveError(null);
    const res = await communityService.updateGroupConversation(conversation.id, {
      name: editName.trim() || (conversation.name ?? ''),
      bio: editBio.trim() || null,
    });
    setSaving(false);
    if (res.data) {
      setDetail(res.data);
      onUpdated(res.data);
    }
    else setSaveError(res.error ?? 'Failed to save');
  };

  // ─── Settings save ──────────────────────────────────────────────────────────
  const saveSetting = async (key: 'canAddMembers' | 'canSendMessages', value: 'all' | 'admins') => {
    const res = await communityService.updateGroupConversation(conversation.id, { [key]: value });
    if (res.data) {
      setDetail(res.data);
      onUpdated(res.data);
    }
  };

  // ─── Add member search ──────────────────────────────────────────────────────
  const handleAddSearch = async (q: string) => {
    setAddQuery(q);
    if (!q.trim()) { setAddResults([]); return; }
    setAddSearching(true);
    const results = await searchUsers(q.trim());
    setAddSearching(false);
    const memberIds = new Set(members.map((p) => p.id));
    setAddResults(results.filter((u) => !memberIds.has(u.id) && u.id !== user?.id));
  };

  const addMember = async (u: CommunityAuthor) => {
    setAddError(null);
    const res = await communityService.addGroupMembers(conversation.id, [u.id]);
    if (res.data) {
      setDetail(res.data);
      onUpdated(res.data);
      setAddQuery('');
      setAddResults([]);
    }
    else setAddError(res.error ?? 'Failed to add');
  };

  // ─── Remove / role actions ──────────────────────────────────────────────────
  const removeMember = async (userId: string) => {
    const res = await communityService.removeGroupConversationMember(conversation.id, userId);
    if (res.data?.ok) {
      const next = {
        ...detail,
        participants: members.filter((p) => p.id !== userId),
        participantsCount: Math.max(0, memberCount - 1),
      };
      setDetail(next);
      onUpdated(next);
    }
  };

  type Participant = Omit<CommunityAuthor, 'role'> & { role?: string };
  const toggleRole = async (p: Participant) => {
    const newRole = p.role === 'admin' ? 'member' : 'admin';
    const res = await communityService.setGroupMemberRole(conversation.id, p.id, newRole);
    if (res.data) {
      setDetail(res.data);
      onUpdated(res.data);
    }
  };

  const leaveGroup = async () => {
    if (!user) return;
    if (!window.confirm('Leave this group?')) return;
    await communityService.removeGroupConversationMember(conversation.id, user.id);
    onLeave();
  };

  const avatarSrc = resolveMediaUrl(detail.avatarUrl) || null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 40 }}
        animate={{ y: 0 }}
        exit={{ y: 40 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-3xl bg-surface border border-border flex flex-col max-h-[90vh] overflow-hidden"
      >
        {/* Header */}
        <div className="relative flex flex-col items-center pt-8 pb-4 px-6 border-b border-border bg-surface shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-xl text-muted hover:text-foreground hover:bg-elevated"
          >
            <span className="material-symbols-outlined text-[22px]">close</span>
          </button>

          {/* Avatar */}
          <div className="relative mb-3">
            <div className="size-20 rounded-full overflow-hidden bg-primary/20 flex items-center justify-center ring-4 ring-surface">
              {avatarSrc ? (
                <img src={avatarSrc} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="material-symbols-outlined text-primary text-4xl">group</span>
              )}
            </div>
            {isAdmin && (
              <>
                <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
                <button
                  type="button"
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={avatarUploading}
                  className="absolute bottom-0 right-0 size-7 rounded-full bg-primary text-white flex items-center justify-center shadow-lg disabled:opacity-60"
                >
                  {avatarUploading
                    ? <span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>
                    : <span className="material-symbols-outlined text-sm">edit</span>
                  }
                </button>
              </>
            )}
          </div>

          {/* Name */}
          {isAdmin ? (
            <input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="text-xl font-black text-center bg-transparent focus:outline-none focus:ring-2 focus:ring-primary/40 rounded-lg px-2 py-0.5 w-full max-w-xs"
              placeholder="Group name"
            />
          ) : (
            <h2 className="text-xl font-black text-center">{detail.name ?? 'Group'}</h2>
          )}

          <p className="text-xs text-muted mt-1">{memberCount} members</p>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border shrink-0">
          {(['members', 'settings'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`flex-1 py-3 text-xs font-bold capitalize transition-colors ${
                tab === t ? 'text-primary border-b-2 border-primary' : 'text-muted'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
          <AnimatePresence mode="wait">
            {tab === 'members' && (
              <motion.div key="members" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
                {/* Bio */}
                {isAdmin ? (
                  <textarea
                    value={editBio}
                    onChange={(e) => setEditBio(e.target.value)}
                    rows={2}
                    placeholder="Group bio (optional)…"
                    className="w-full bg-elevated border border-subtle rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                ) : detail.bio ? (
                  <p className="text-sm text-muted">{detail.bio}</p>
                ) : null}

                {isAdmin && (
                  <div className="flex gap-2">
                    {saveError && <p className="text-xs text-red-400 flex-1">{saveError}</p>}
                    <button
                      type="button"
                      onClick={saveInfo}
                      disabled={saving}
                      className="ml-auto px-4 py-2 rounded-xl bg-primary text-white text-xs font-bold disabled:opacity-40"
                    >
                      {saving ? 'Saving…' : 'Save'}
                    </button>
                  </div>
                )}

                {/* Add members */}
                {canAdd && (
                  <div className="space-y-1">
                    <input
                      value={addQuery}
                      onChange={(e) => void handleAddSearch(e.target.value)}
                      placeholder="Add people…"
                      className="w-full bg-elevated border border-subtle rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                    {addError && <p className="text-xs text-red-400">{addError}</p>}
                    {addSearching && <p className="text-xs text-muted animate-pulse">Searching…</p>}
                    {addResults.map((u) => (
                      <div key={u.id} className="flex items-center gap-2 p-2 rounded-xl hover:bg-elevated">
                        <img src={resolveMediaUrl(u.profile?.communityAvatarUrl) || fallbackAvatar(u.id)} alt="" className="size-8 rounded-full object-cover shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold truncate">{displayName(u)}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => addMember(u)}
                          className="shrink-0 px-3 py-1 rounded-lg bg-primary text-white text-xs font-bold"
                        >
                          Add
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Members list */}
                <div className="space-y-1">
                  {membersLoading && (
                    <p className="text-xs text-muted text-center py-4 animate-pulse">Loading members…</p>
                  )}
                  {!membersLoading && members.length === 0 && (
                    <p className="text-xs text-muted text-center py-4">No members found</p>
                  )}
                  {members.map((p: Omit<CommunityAuthor, 'role'> & { role?: string }) => {
                    const isSelf = p.id === user?.id;
                    return (
                      <div key={p.id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-elevated group">
                        <Link to={communityProfilePath(p.id)} onClick={onClose} className="shrink-0">
                          <img
                            src={resolveMediaUrl(p.profile?.communityAvatarUrl) || fallbackAvatar(p.id)}
                            alt=""
                            className="size-9 rounded-full object-cover"
                          />
                        </Link>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <Link to={communityProfilePath(p.id)} onClick={onClose} className="font-bold text-sm truncate hover:text-primary">
                              {isSelf ? 'You' : displayName(p as CommunityAuthor)}
                            </Link>
                            {p.role === 'admin' && (
                              <span className="shrink-0 text-[9px] font-black px-1.5 py-0.5 rounded bg-primary/20 text-primary">ADMIN</span>
                            )}
                          </div>
                        </div>
                        {isAdmin && !isSelf && (
                          <div className="hidden group-hover:flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => toggleRole(p)}
                              title={p.role === 'admin' ? 'Remove admin' : 'Make admin'}
                              className="p-1.5 rounded-lg text-muted hover:text-primary hover:bg-primary/10 text-xs"
                            >
                              <span className="material-symbols-outlined text-base">
                                {p.role === 'admin' ? 'shield_with_heart' : 'admin_panel_settings'}
                              </span>
                            </button>
                            <button
                              type="button"
                              onClick={() => removeMember(p.id)}
                              title="Remove from group"
                              className="p-1.5 rounded-lg text-muted hover:text-red-400 hover:bg-red-400/10"
                            >
                              <span className="material-symbols-outlined text-base">person_remove</span>
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {tab === 'settings' && (
              <motion.div key="settings" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
                {!isAdmin && (
                  <p className="text-xs text-muted text-center">Only admins can change settings.</p>
                )}

                <SettingRow
                  label="Who can add members"
                  description="Control who is allowed to add new people to this group"
                  value={detail.canAddMembers ?? 'admins'}
                  options={[{ value: 'admins', label: 'Admins only' }, { value: 'all', label: 'All members' }]}
                  disabled={!isAdmin}
                  onChange={(v) => saveSetting('canAddMembers', v as 'all' | 'admins')}
                />

                <SettingRow
                  label="Who can send messages"
                  description="Control who is allowed to send messages in this group"
                  value={detail.canSendMessages ?? 'all'}
                  options={[{ value: 'all', label: 'All members' }, { value: 'admins', label: 'Admins only' }]}
                  disabled={!isAdmin}
                  onChange={(v) => saveSetting('canSendMessages', v as 'all' | 'admins')}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Leave group */}
        <div className="p-4 border-t border-border shrink-0">
          <button
            type="button"
            onClick={leaveGroup}
            className="w-full py-2.5 rounded-xl border border-red-500/40 text-red-400 text-sm font-bold hover:bg-red-400/10 transition-colors"
          >
            Leave Group
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

interface SettingRowProps {
  label: string;
  description: string;
  value: string;
  options: { value: string; label: string }[];
  disabled: boolean;
  onChange: (v: string) => void;
}

const SettingRow: React.FC<SettingRowProps> = ({ label, description, value, options, disabled, onChange }) => (
  <div className="space-y-2">
    <div>
      <p className="text-sm font-bold">{label}</p>
      <p className="text-xs text-muted">{description}</p>
    </div>
    <div className="flex gap-2">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          disabled={disabled}
          onClick={() => onChange(o.value)}
          className={`flex-1 py-2 rounded-xl text-xs font-bold transition-colors disabled:opacity-50 ${
            value === o.value
              ? 'bg-primary text-white'
              : 'bg-elevated text-muted hover:text-foreground'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  </div>
);
