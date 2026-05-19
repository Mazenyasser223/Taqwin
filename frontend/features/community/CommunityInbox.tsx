import React, { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useI18n } from '../../lib/i18n/useI18n';
import communityService from '../../services/communityService';
import type { CommunityConversation, CommunityMessage, CommunityAuthor } from '../../types';
import { timeAgo, fallbackAvatar, displayName, roleLabel } from './communityUtils';

export const CommunityInbox: React.FC = () => {
  const { t } = useI18n();
  const [searchParams, setSearchParams] = useSearchParams();
  const [conversations, setConversations] = useState<CommunityConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<CommunityAuthor[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<CommunityMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [newQuery, setNewQuery] = useState('');

  const unreadTotal = conversations.reduce((s, c) => s + c.unreadCount, 0);

  const loadInbox = useCallback(() => {
    setLoading(true);
    communityService.getConversations().then((res) => {
      setConversations(res.data ?? []);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    loadInbox();
  }, [loadInbox]);

  const openConversation = useCallback(async (id: string) => {
    setActiveId(id);
    const res = await communityService.getMessages(id);
    setMessages(res.data ?? []);
    await communityService.markConversationRead(id);
    setConversations((cs) =>
      cs.map((c) => (c.id === id ? { ...c, unreadCount: 0 } : c))
    );
  }, []);

  useEffect(() => {
    const conversationId = searchParams.get('c');
    if (conversationId) {
      void openConversation(conversationId);
    }
  }, [searchParams, openConversation]);

  const sendMessage = async () => {
    if (!activeId || !draft.trim()) return;
    const res = await communityService.sendMessage(activeId, draft.trim());
    if (res.data) {
      setMessages((m) => [...m, res.data!]);
      setDraft('');
      loadInbox();
    }
  };

  const startWithUser = async (userId: string) => {
    const res = await communityService.startConversation(userId);
    if (res.data) {
      setShowNew(false);
      setNewQuery('');
      loadInbox();
      openConversation(res.data.id);
    }
  };

  useEffect(() => {
    if (!newQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const t = window.setTimeout(() => {
      communityService.searchUsers(newQuery.trim()).then((res) => {
        setSearchResults(res.data ?? []);
      });
    }, 300);
    return () => window.clearTimeout(t);
  }, [newQuery]);

  const filtered = conversations.filter((c) => {
    if (!search.trim()) return true;
    const name = displayName(c.otherUser).toLowerCase();
    const preview = c.lastMessage?.content?.toLowerCase() ?? '';
    return name.includes(search.toLowerCase()) || preview.includes(search.toLowerCase());
  });

  const active = conversations.find((c) => c.id === activeId);

  if (activeId && active) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
        <button
          type="button"
          onClick={() => {
            setActiveId(null);
            setSearchParams({});
          }}
          className="flex items-center gap-2 text-muted hover:text-foreground text-sm font-bold"
        >
          <span className="material-symbols-outlined">arrow_back</span>
          {t('community.backToInbox')}
        </button>
        <div className="flex items-center gap-3 pb-3 border-b border-border">
          <img
            src={active.otherUser?.profile?.avatarUrl || fallbackAvatar(active.otherUser?.id ?? 'x')}
            alt=""
            className="size-12 rounded-full object-cover"
          />
          <div>
            <p className="font-bold">{displayName(active.otherUser)}</p>
            {active.otherUser?.role && (
              <span className="text-[10px] font-black text-primary uppercase">{roleLabel(active.otherUser.role)}</span>
            )}
          </div>
        </div>
        <div className="h-[50vh] overflow-y-auto space-y-3 pr-2 custom-scrollbar">
          {messages.map((m) => (
            <div key={m.id} className={`flex ${m.isMine ? 'justify-end' : 'justify-start'}`}>
              <motion.div
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                  m.isMine ? 'bg-primary text-white rounded-br-md' : 'bg-elevated border border-subtle rounded-bl-md'
                }`}
              >
                {m.content}
                <p className={`text-[10px] mt-1 ${m.isMine ? 'text-white/70' : 'text-faint'}`}>{timeAgo(m.createdAt)}</p>
              </motion.div>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
            placeholder={t('community.messagePlaceholder')}
            className="flex-1 bg-elevated border border-subtle rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <button type="button" onClick={sendMessage} className="px-5 bg-primary text-white font-bold rounded-xl">
            <span className="material-symbols-outlined">send</span>
          </button>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black">{t('community.inboxTitle')}</h1>
          <p className="text-muted text-sm mt-1">
            {unreadTotal > 0
              ? t('community.inboxUnread').replace('{count}', String(unreadTotal))
              : t('community.inboxAllRead')}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowNew(true)}
          className="shrink-0 flex items-center gap-1 bg-primary text-white font-bold px-4 py-2.5 rounded-full text-sm"
        >
          <span className="material-symbols-outlined text-lg">add</span>
          {t('community.newMessage')}
        </button>
      </div>

      <div className="relative">
        <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-faint">search</span>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('community.inboxSearch')}
          className="w-full bg-elevated border border-subtle rounded-2xl pl-12 pr-4 py-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>

      {loading && <p className="text-primary animate-pulse text-sm">{t('community.loading')}</p>}
      {!loading && filtered.length === 0 && (
        <div className="rounded-2xl border border-border p-10 text-center text-muted text-sm">
          {t('community.inboxEmpty')}
        </div>
      )}

      <div className="space-y-2">
        {filtered.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => openConversation(c.id)}
            className="w-full text-left rounded-2xl border border-border bg-surface/60 p-4 flex gap-3 hover:border-primary/40 transition-colors"
          >
            <div className="relative shrink-0">
              <img
                src={c.otherUser?.profile?.avatarUrl || fallbackAvatar(c.otherUser?.id ?? c.id)}
                alt=""
                className="size-14 rounded-full object-cover"
              />
            </div>
            <div className="flex-1 min-w-0">
              <motion.div className="flex justify-between items-start gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-bold truncate">{displayName(c.otherUser)}</span>
                  {c.otherUser?.role === 'trainer' && (
                    <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-primary/20 text-primary">COACH</span>
                  )}
                </div>
                {c.lastMessage && (
                  <span className="text-xs text-faint shrink-0">{timeAgo(c.lastMessage.createdAt)}</span>
                )}
              </motion.div>
              <p className="text-sm text-muted truncate mt-1">
                {c.lastMessage?.isMine ? `${t('community.you')}: ` : ''}
                {c.lastMessage?.content ?? t('community.noMessagesYet')}
              </p>
            </div>
            {c.unreadCount > 0 && (
              <span className="shrink-0 size-6 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center">
                {c.unreadCount}
              </span>
            )}
          </button>
        ))}
      </div>

      <AnimatePresence>
        {showNew && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center p-4"
            onClick={() => setShowNew(false)}
          >
            <motion.div
              initial={{ y: 40 }}
              animate={{ y: 0 }}
              exit={{ y: 40 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-3xl bg-surface border border-border p-6 space-y-4"
            >
              <h3 className="text-xl font-black">{t('community.newMessage')}</h3>
              <input
                value={newQuery}
                onChange={(e) => setNewQuery(e.target.value)}
                placeholder={t('community.searchPeople')}
                className="w-full bg-elevated border border-subtle rounded-xl px-4 py-3 text-sm"
                autoFocus
              />
              <div className="max-h-60 overflow-y-auto space-y-2">
                {searchResults.map((u) => (
                  <div key={u.id} className="flex items-center gap-2 p-3 rounded-xl hover:bg-elevated">
                    <Link
                      to={`/community/profile/${u.id}`}
                      onClick={() => setShowNew(false)}
                      className="flex flex-1 items-center gap-3 min-w-0"
                    >
                      <img src={u.profile?.avatarUrl || fallbackAvatar(u.id)} alt="" className="size-10 rounded-full" />
                      <div className="min-w-0">
                        <p className="font-bold text-sm truncate">{displayName(u)}</p>
                        <p className="text-xs text-faint truncate">{u.handle}</p>
                      </div>
                    </Link>
                    <button
                      type="button"
                      onClick={() => startWithUser(u.id)}
                      className="shrink-0 px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-bold"
                    >
                      {t('community.message')}
                    </button>
                  </div>
                ))}
              </div>
              <button type="button" onClick={() => setShowNew(false)} className="w-full py-3 rounded-xl border border-subtle font-bold">
                {t('common.cancel')}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
