import React, { useEffect, useState } from 'react';
import communityService from '../../services/communityService';
import type { CommunityAuthor } from '../../types';
import { displayName, fallbackAvatar } from './communityUtils';
import { useI18n } from '../../lib/i18n/useI18n';
import { UserAvatar } from '../../components/ui/UserAvatar';

export type MentionSelection = {
  userIds: string[];
  gymIds: string[];
  labels: { type: 'user' | 'gym'; id: string; name: string }[];
};

function normalizeQuery(raw: string) {
  return raw.replace(/^@+/, '').trim();
}

function handleFromAuthor(u: CommunityAuthor) {
  const local = (u.email || 'user').split('@')[0];
  return local.replace(/[^a-zA-Z0-9_]/gi, '_').toLowerCase();
}

function nameKey(u: CommunityAuthor) {
  const n = u.profile?.displayName?.trim();
  return n ? n.replace(/\s+/g, '').toLowerCase() : '';
}

function pickBestUser(token: string, users: CommunityAuthor[]): CommunityAuthor | null {
  const t = token.toLowerCase();
  for (const u of users) {
    if (handleFromAuthor(u) === t) return u;
    if (nameKey(u) === t) return u;
    if (displayName(u).toLowerCase() === t) return u;
  }
  if (users.length === 1) return users[0];
  return null;
}

interface MentionPickerProps {
  value: MentionSelection;
  onChange: (next: MentionSelection) => void;
  queryRef?: React.MutableRefObject<string>;
}

export const MentionPicker: React.FC<MentionPickerProps> = ({ value, onChange, queryRef }) => {
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState<CommunityAuthor[]>([]);
  const [gyms, setGyms] = useState<{ id: string; name: string; imageUrl?: string | null; ownerId: string }[]>([]);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);

  const token = normalizeQuery(query);

  useEffect(() => {
    if (!open) return;
    setSearching(true);
    const timer = window.setTimeout(() => {
      communityService.searchMentions(token).then((res) => {
        setUsers(res.data?.users ?? []);
        setGyms(res.data?.gyms ?? []);
        setSearching(false);
      });
    }, token.length === 0 ? 0 : 200);
    return () => window.clearTimeout(timer);
  }, [token, open]);

  const addUser = (u: CommunityAuthor) => {
    if (value.userIds.includes(u.id)) return;
    onChange({
      userIds: [...value.userIds, u.id],
      gymIds: value.gymIds,
      labels: [...value.labels, { type: 'user', id: u.id, name: displayName(u) }],
    });
    setQuery('');
    setOpen(false);
  };

  const addGym = (g: { id: string; name: string }) => {
    if (value.gymIds.includes(g.id)) return;
    onChange({
      userIds: value.userIds,
      gymIds: [...value.gymIds, g.id],
      labels: [...value.labels, { type: 'gym', id: g.id, name: g.name }],
    });
    setQuery('');
    setOpen(false);
  };

  useEffect(() => {
    if (queryRef) queryRef.current = query;
  }, [query, queryRef]);

  const remove = (type: 'user' | 'gym', id: string) => {
    onChange({
      userIds: type === 'user' ? value.userIds.filter((x) => x !== id) : value.userIds,
      gymIds: type === 'gym' ? value.gymIds.filter((x) => x !== id) : value.gymIds,
      labels: value.labels.filter((l) => !(l.type === type && l.id === id)),
    });
  };

  const onKeyDown = async (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (token.length >= 1) {
        const best = pickBestUser(token, users);
        if (best) {
          addUser(best);
          return;
        }
        if (gyms.length === 1) {
          addGym(gyms[0]);
        }
      }
    }
  };

  const showDropdown = open;

  return (
    <div className="space-y-2">
      {value.labels.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {value.labels.map((m) => (
            <span
              key={`${m.type}-${m.id}`}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/15 text-primary text-xs font-bold"
            >
              @{m.name}
              <button type="button" onClick={() => remove(m.type, m.id)} className="hover:text-red-400">
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="relative">
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 200)}
          onKeyDown={onKeyDown}
          placeholder={t('community.mentionPlaceholder')}
          className="w-full text-xs bg-elevated border border-subtle rounded-lg px-3 py-2"
        />
        {showDropdown && (
          <div className="absolute z-20 mt-1 w-full max-h-56 overflow-y-auto rounded-xl border border-border bg-surface shadow-xl">
            {searching && <p className="px-3 py-2 text-xs text-muted">{t('community.loading')}</p>}
            {!searching && users.length === 0 && gyms.length === 0 && (
              <p className="px-3 py-2 text-xs text-muted">{t('community.mentionNoResults')}</p>
            )}
            {users.map((u) => (
              <button
                key={u.id}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => addUser(u)}
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-elevated text-left"
              >
                <UserAvatar
                  avatarUrl={u.profile?.avatarUrl}
                  displayName={displayName(u)}
                  className="size-8 rounded-full object-cover border border-subtle shrink-0"
                />
                <div className="min-w-0">
                  <span className="text-sm font-semibold truncate block">{displayName(u)}</span>
                  <span className="text-[10px] text-faint truncate block">{u.handle}</span>
                </div>
              </button>
            ))}
            {gyms.map((g) => (
              <button
                key={g.id}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => addGym(g)}
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-elevated text-left"
              >
                <span className="material-symbols-outlined text-primary">fitness_center</span>
                <span className="text-sm font-semibold truncate">{g.name}</span>
              </button>
            ))}
            {!searching && (users.length > 0 || gyms.length > 0) && (
              <p className="px-3 py-1.5 text-[10px] text-faint border-t border-subtle">
                {token.length === 0 ? t('community.mentionAllHint') : t('community.mentionPickHint')}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export async function finalizeMentions(
  selection: MentionSelection,
  pendingQuery: string,
): Promise<MentionSelection> {
  const token = normalizeQuery(pendingQuery);
  if (token.length < 1) return selection;
  const res = await communityService.searchMentions(token);
  const best = pickBestUser(token, res.data?.users ?? []);
  if (best && !selection.userIds.includes(best.id)) {
    return {
      userIds: [...selection.userIds, best.id],
      gymIds: selection.gymIds,
      labels: [...selection.labels, { type: 'user', id: best.id, name: displayName(best) }],
    };
  }
  const gymList = res.data?.gyms ?? [];
  if (gymList.length === 1 && !selection.gymIds.includes(gymList[0].id)) {
    return {
      userIds: selection.userIds,
      gymIds: [...selection.gymIds, gymList[0].id],
      labels: [...selection.labels, { type: 'gym', id: gymList[0].id, name: gymList[0].name }],
    };
  }
  return selection;
}
