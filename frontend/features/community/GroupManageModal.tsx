import React, { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useI18n } from '../../lib/i18n/useI18n';
import communityService from '../../services/communityService';
import type { CommunityAuthor, CommunityGroup, CommunityGroupMember, GroupInvitePermission, GroupPostPermission } from '../../types';
import { UserAvatar } from '../../components/ui/UserAvatar';
import { displayName } from './communityUtils';

interface GroupManageModalProps {
  group: CommunityGroup;
  onClose: () => void;
  onUpdated: (group: CommunityGroup) => void;
  onDeleted: () => void;
}

export const GroupManageModal: React.FC<GroupManageModalProps> = ({
  group,
  onClose,
  onUpdated,
  onDeleted,
}) => {
  const { t } = useI18n();
  const [tab, setTab] = useState<'members' | 'settings'>('members');
  const [members, setMembers] = useState<CommunityGroupMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<CommunityAuthor[]>([]);
  const [name, setName] = useState(group.name);
  const [description, setDescription] = useState(group.description ?? '');
  const [postPermission, setPostPermission] = useState<GroupPostPermission>(group.postPermission ?? 'all_members');
  const [invitePermission, setInvitePermission] = useState<GroupInvitePermission>(
    group.invitePermission ?? 'admins_only',
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isOwner = group.myRole === 'owner';

  const loadMembers = useCallback(() => {
    setLoading(true);
    communityService.getGroupMembers(group.id).then((res) => {
      setMembers(res.data ?? []);
      setLoading(false);
    });
  }, [group.id]);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  useEffect(() => {
    if (!search.trim() || search.length < 2) {
      setSearchResults([]);
      return;
    }
    const tmr = window.setTimeout(() => {
      communityService.searchUsers(search.trim()).then((res) => {
        const ids = new Set(members.map((m) => m.userId));
        setSearchResults((res.data ?? []).filter((u) => !ids.has(u.id)));
      });
    }, 300);
    return () => window.clearTimeout(tmr);
  }, [search, members]);

  const addMember = async (userId: string) => {
    const res = await communityService.addGroupMember(group.id, userId);
    if (res.error) setError(res.error);
    else {
      setSearch('');
      setSearchResults([]);
      loadMembers();
      const g = await communityService.getGroup(group.id);
      if (g.data) onUpdated(g.data);
    }
  };

  const removeMember = async (userId: string) => {
    const res = await communityService.removeGroupMember(group.id, userId);
    if (res.error) setError(res.error);
    else {
      loadMembers();
      const g = await communityService.getGroup(group.id);
      if (g.data) onUpdated(g.data);
    }
  };

  const setRole = async (userId: string, role: 'admin' | 'member') => {
    const res = await communityService.updateGroupMemberRole(group.id, userId, role);
    if (res.error) setError(res.error);
    else loadMembers();
  };

  const saveSettings = async () => {
    setSaving(true);
    setError(null);
    const res = await communityService.updateGroup(group.id, {
      name: name.trim(),
      description: description.trim() || null,
      postPermission,
      invitePermission,
    });
    setSaving(false);
    if (res.error) setError(res.error);
    else if (res.data) onUpdated(res.data);
  };

  const deleteGroup = async () => {
    if (!window.confirm(t('community.deleteGroupConfirm'))) return;
    const res = await communityService.deleteGroup(group.id);
    if (res.error) setError(res.error);
    else onDeleted();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0.95 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg max-h-[85vh] rounded-3xl bg-surface border border-border flex flex-col overflow-hidden"
      >
        <div className="p-5 border-b border-subtle flex items-center justify-between shrink-0">
          <h3 className="text-xl font-black">{t('community.manageGroup')}</h3>
          <button type="button" onClick={onClose} className="text-muted hover:text-foreground p-1">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="flex border-b border-subtle shrink-0">
          {(['members', 'settings'] as const).map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`flex-1 py-3 text-sm font-bold ${
                tab === id ? 'text-primary border-b-2 border-primary' : 'text-muted'
              }`}
            >
              {id === 'members' ? t('community.members') : t('community.settings')}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar">
          {error && (
            <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">{error}</p>
          )}

          {tab === 'members' && (
            <>
              {(group.canInvite ?? group.canManage) && (
                <div className="space-y-2">
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder={t('community.addMemberSearch')}
                    className="w-full bg-elevated border border-subtle rounded-xl px-4 py-2.5 text-sm"
                  />
                  {searchResults.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => addMember(u.id)}
                      className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-elevated text-left"
                    >
                      <UserAvatar
                        avatarUrl={u.profile?.avatarUrl}
                        displayName={displayName(u)}
                        className="size-9 rounded-full object-cover border border-subtle shrink-0"
                      />
                      <span className="text-sm font-bold truncate">{displayName(u)}</span>
                      <span className="material-symbols-outlined text-primary ml-auto">person_add</span>
                    </button>
                  ))}
                </div>
              )}
              {loading && <p className="text-sm text-muted animate-pulse">{t('community.loading')}</p>}
              <div className="space-y-2">
                {members.map((m) => (
                  <div key={m.id} className="flex items-center gap-3 p-2 rounded-xl bg-elevated/50">
                    <UserAvatar
                      avatarUrl={m.user?.profile?.avatarUrl}
                      displayName={displayName(m.user)}
                      className="size-10 rounded-full object-cover border border-subtle shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold truncate">{displayName(m.user)}</p>
                      <p className="text-[10px] text-faint uppercase">{m.role}</p>
                    </div>
                    {isOwner && m.role !== 'owner' && (
                      <select
                        value={m.role === 'admin' ? 'admin' : 'member'}
                        onChange={(e) => setRole(m.userId, e.target.value as 'admin' | 'member')}
                        className="text-xs bg-surface border border-subtle rounded-lg px-2 py-1"
                      >
                        <option value="member">{t('community.roleMember')}</option>
                        <option value="admin">{t('community.roleAdmin')}</option>
                      </select>
                    )}
                    {group.canManage && m.role !== 'owner' && (
                      <button
                        type="button"
                        onClick={() => removeMember(m.userId)}
                        className="text-faint hover:text-red-400 p-1"
                        title={t('community.removeMember')}
                      >
                        <span className="material-symbols-outlined text-lg">person_remove</span>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}

          {tab === 'settings' && group.canManage && (
            <div className="space-y-4">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-elevated border border-subtle rounded-xl px-4 py-3 text-sm"
                placeholder={t('community.groupName')}
              />
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full bg-elevated border border-subtle rounded-xl px-4 py-3 text-sm resize-none"
                placeholder={t('community.groupDescription')}
              />
              <label className="block text-xs font-bold text-muted">{t('community.postPermission')}</label>
              <select
                value={postPermission}
                onChange={(e) => setPostPermission(e.target.value as GroupPostPermission)}
                className="w-full bg-elevated border border-subtle rounded-xl px-4 py-2.5 text-sm"
              >
                <option value="all_members">{t('community.postPermissionAll')}</option>
                <option value="admins_only">{t('community.postPermissionAdmins')}</option>
              </select>
              <label className="block text-xs font-bold text-muted">{t('community.invitePermission')}</label>
              <select
                value={invitePermission}
                onChange={(e) => setInvitePermission(e.target.value as GroupInvitePermission)}
                className="w-full bg-elevated border border-subtle rounded-xl px-4 py-2.5 text-sm"
              >
                <option value="admins_only">{t('community.invitePermissionAdmins')}</option>
                <option value="all_members">{t('community.invitePermissionAll')}</option>
              </select>
              <button
                type="button"
                onClick={saveSettings}
                disabled={saving || !name.trim()}
                className="w-full py-3 rounded-xl bg-primary text-white font-bold disabled:opacity-50"
              >
                {saving ? '…' : t('community.saveSettings')}
              </button>
              {isOwner && (
                <button
                  type="button"
                  onClick={deleteGroup}
                  className="w-full py-3 rounded-xl border border-red-500/40 text-red-400 font-bold hover:bg-red-500/10"
                >
                  {t('community.deleteGroup')}
                </button>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};
