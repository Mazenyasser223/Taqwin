import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/useAuthStore';
import communityService from '../../services/communityService';
import { sortInboxConversations } from '../../features/community/inboxSort';
import type { CommunityConversation, CommunityMessage } from '../../types';
import { displayName, timeAgo } from '../../features/community/communityUtils';
import { UserAvatar } from './UserAvatar';
import { resolveMediaUrl } from '../../lib/mediaUrl';
import { useBreakpoint } from '../../lib/hooks/useBreakpoint';

const POLL_MS = 15_000;

function totalUnread(convs: CommunityConversation[]) {
  return convs.reduce((n, c) => n + (c.unreadCount ?? 0), 0);
}
function convName(c: CommunityConversation) {
  return c.isGroup ? (c.name ?? 'Group') : displayName(c.otherUser);
}

export const FloatingInbox: React.FC = () => {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const { isSmUp, isLgUp } = useBreakpoint();

  const [open, setOpen] = useState(false);
  const [activeConv, setActiveConv] = useState<CommunityConversation | null>(null);
  const [conversations, setConversations] = useState<CommunityConversation[]>([]);
  const [messages, setMessages] = useState<CommunityMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastMsgAt = useRef<string | undefined>(undefined);

  const loadConversations = useCallback(async () => {
    if (!user) return;
    const res = await communityService.getConversations('primary');
    if (res.data) setConversations(res.data);
  }, [user]);

  const loadMessages = useCallback(async (conv: CommunityConversation, since?: string) => {
    const res = await communityService.getMessages(conv.id, since ? { since } : undefined);
    if (res.data) {
      const incoming = res.data.messages ?? [];
      if (incoming.length > 0) {
        setMessages((prev) => {
          const byId = new Map(prev.map((m) => [m.id, m]));
          incoming.forEach((m) => byId.set(m.id, m));
          return Array.from(byId.values()).sort(
            (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
          );
        });
        lastMsgAt.current = incoming[incoming.length - 1].createdAt;
      }
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    loadConversations();
    const id = setInterval(loadConversations, POLL_MS);
    return () => clearInterval(id);
  }, [open, loadConversations]);

  useEffect(() => {
    if (!activeConv) return;
    lastMsgAt.current = undefined;
    setMessages([]);
    loadMessages(activeConv);
    const id = setInterval(() => loadMessages(activeConv, lastMsgAt.current), POLL_MS);
    return () => clearInterval(id);
  }, [activeConv, loadMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Background polling for unread badge
  useEffect(() => {
    if (!user) return;
    loadConversations();
    const id = setInterval(loadConversations, 60_000);
    return () => clearInterval(id);
  }, [user, loadConversations]);

  const send = async () => {
    if (!activeConv || !draft.trim() || sending) return;
    setSending(true);
    const content = draft.trim();
    setDraft('');
    await communityService.sendMessage(activeConv.id, { content });
    setSending(false);
    await loadMessages(activeConv);
    await loadConversations();
  };

  const openConv = (c: CommunityConversation) => {
    setActiveConv(c);
    setMessages([]);
  };

  const openFullInbox = () => {
    navigate(`/community/inbox${activeConv ? `?c=${activeConv.id}` : ''}`);
    setOpen(false);
  };

  if (!user) return null;

  const filtered = sortInboxConversations(
    conversations.filter((c) => {
      if (!search.trim()) return true;
      return convName(c).toLowerCase().includes(search.toLowerCase());
    }),
  );

  const unread = totalUnread(conversations);

  // ─── Responsive positions ───────────────────────────────────────────────────
  // Desktop (lg+): button is inside the shared wrapper in Layout → no fixed pos
  // Mobile/tablet: self-position ABOVE the AI chat button (bottom-20 safe-bottom)
  //   AI button = bottom-20 (5rem) + safe + size-14 (3.5rem) + gap (0.5rem) = 9rem + safe
  const btnClass = isLgUp
    ? 'size-14 rounded-2xl bg-surface border border-border shadow-2xl flex items-center justify-center transition-all relative'
    : 'fixed end-4 z-[99] size-12 sm:size-14 rounded-2xl bg-surface border border-border shadow-2xl flex items-center justify-center transition-all';

  const btnStyle = isLgUp
    ? undefined
    : { bottom: 'calc(9rem + env(safe-area-inset-bottom, 0px))' };

  // Panel: mobile = full-width bottom sheet, sm–lg = right popup, lg+ = near shared wrapper
  const panelClass = isLgUp
    ? 'fixed z-[99] overflow-hidden flex flex-col bg-surface border border-border shadow-2xl rounded-2xl w-[360px] bottom-24 right-[4.5rem]'
    : isSmUp
      ? 'fixed z-[99] overflow-hidden flex flex-col bg-surface border border-border shadow-2xl rounded-2xl w-[340px] right-4 bottom-20'
      : 'fixed z-[99] overflow-hidden flex flex-col bg-surface border border-border shadow-2xl inset-x-0 bottom-0 rounded-t-3xl';

  const panelStyle = isLgUp || isSmUp
    ? { maxHeight: 'min(520px, calc(100dvh - 7rem))' }
    : { height: '68dvh' };

  return (
    <>
      {/* ── Panel ── */}
      <AnimatePresence>
        {open && (
          <>
            {/* Mobile backdrop */}
            {!isSmUp && (
              <motion.div
                key="backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[98] bg-black/40 backdrop-blur-sm"
                onClick={() => setOpen(false)}
              />
            )}

            <motion.div
              key="panel"
              initial={!isSmUp ? { opacity: 0, y: '100%' } : { opacity: 0, y: 12, scale: 0.97 }}
              animate={!isSmUp ? { opacity: 1, y: 0 } : { opacity: 1, y: 0, scale: 1 }}
              exit={!isSmUp ? { opacity: 0, y: '100%' } : { opacity: 0, y: 12, scale: 0.97 }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              className={panelClass}
              style={panelStyle}
            >
              {/* Drag handle (mobile only) */}
              {!isSmUp && (
                <div className="flex justify-center pt-3 pb-1 shrink-0">
                  <div className="w-10 h-1 rounded-full bg-border" />
                </div>
              )}

              {/* Header */}
              <div className="flex items-center gap-2 px-4 py-3 border-b border-border shrink-0 bg-elevated/50">
                {activeConv ? (
                  <>
                    <button type="button" onClick={() => setActiveConv(null)}
                      className="p-1 rounded-lg hover:bg-elevated transition-colors text-muted shrink-0">
                      <span className="material-symbols-outlined text-xl">arrow_back</span>
                    </button>

                    {activeConv.isGroup ? (
                      <div className="size-8 rounded-full bg-primary/20 flex items-center justify-center overflow-hidden shrink-0">
                        {activeConv.avatarUrl
                          ? <img src={resolveMediaUrl(activeConv.avatarUrl)} alt="" className="w-full h-full object-cover" />
                          : <span className="material-symbols-outlined text-primary text-base">group</span>}
                      </div>
                    ) : (
                      <UserAvatar
                        avatarUrl={activeConv.otherUser?.profile?.communityAvatarUrl}
                        displayName={activeConv.otherUser?.profile?.displayName ?? displayName(activeConv.otherUser)}
                        email={activeConv.otherUser?.email}
                        className="size-8 text-xs"
                        imgClassName="size-8 rounded-full object-cover shrink-0"
                        alt={displayName(activeConv.otherUser)}
                      />
                    )}

                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm truncate leading-tight">{convName(activeConv)}</p>
                      {activeConv.isGroup && (
                        <p className="text-[10px] text-muted">{activeConv.participantsCount ?? activeConv.participants?.length ?? 0} members</p>
                      )}
                    </div>

                    <button type="button" onClick={openFullInbox} title="Open full chat"
                      className="p-1.5 rounded-lg hover:bg-elevated transition-colors text-muted shrink-0">
                      <span className="material-symbols-outlined text-[18px]">open_in_full</span>
                    </button>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-primary text-xl">chat</span>
                    <span className="font-black text-base flex-1">Messaging</span>
                    <button type="button" onClick={openFullInbox} title="Open inbox"
                      className="p-1.5 rounded-lg hover:bg-elevated transition-colors text-muted">
                      <span className="material-symbols-outlined text-[18px]">open_in_new</span>
                    </button>
                    <button type="button" onClick={() => setOpen(false)}
                      className="p-1.5 rounded-lg hover:bg-elevated transition-colors text-muted">
                      <span className="material-symbols-outlined text-[18px]">remove</span>
                    </button>
                  </>
                )}
              </div>

              {activeConv ? (
                /* ── Chat view ── */
                <>
                  <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2 custom-scrollbar min-h-0">
                    {messages.length === 0 && (
                      <p className="text-center text-faint text-xs mt-8">Start of conversation</p>
                    )}
                    {messages.map((m) => {
                      if (m.messageType === 'system') {
                        return (
                          <div key={m.id} className="flex justify-center py-1">
                            <span className="text-[10px] text-muted bg-elevated/60 rounded-full px-3 py-0.5 font-medium">
                              {m.content}
                            </span>
                          </div>
                        );
                      }
                      const mine = m.senderId === user.id || m.isMine;
                      return (
                        <div key={m.id} className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
                          {!mine && activeConv.isGroup && m.sender && (
                            <p className="text-[9px] text-muted font-semibold mb-0.5 px-1">
                              {displayName(m.sender)}
                            </p>
                          )}
                          <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm break-words ${
                            mine
                              ? 'bg-primary text-white rounded-br-sm'
                              : 'bg-elevated border border-subtle rounded-bl-sm'
                          }`}>
                            {m.mediaUrl && (
                              <img src={resolveMediaUrl(m.mediaUrl)} alt=""
                                className="rounded-lg mb-1 max-h-28 w-auto object-cover" />
                            )}
                            {m.content}
                            <p className={`text-[9px] mt-0.5 ${mine ? 'text-white/60' : 'text-faint'} text-right`}>
                              {timeAgo(m.createdAt)}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Composer */}
                  <div className="shrink-0 border-t border-border px-3 py-2.5">
                    <div className="flex gap-2 items-center">
                      <input
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && void send()}
                        placeholder="Write a message…"
                        className="flex-1 min-w-0 bg-elevated border border-subtle rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                      />
                      <button type="button" onClick={() => void send()} disabled={!draft.trim() || sending}
                        className="shrink-0 size-10 bg-primary text-white rounded-xl flex items-center justify-center disabled:opacity-40 transition-opacity">
                        <span className="material-symbols-outlined text-lg">send</span>
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                /* ── Conversation list ── */
                <>
                  <div className="px-3 pt-3 pb-2 shrink-0">
                    <div className="relative">
                      <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-faint text-lg pointer-events-none">
                        search
                      </span>
                      <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search messages"
                        className="w-full bg-elevated border border-subtle rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                      />
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto custom-scrollbar min-h-0">
                    {filtered.length === 0 && (
                      <p className="text-center text-faint text-xs py-10">No conversations yet</p>
                    )}
                    {filtered.map((c) => (
                      <button key={c.id} type="button" onClick={() => openConv(c)}
                        className="w-full flex gap-3 items-center px-3 py-3 hover:bg-elevated/60 active:bg-elevated transition-colors text-left">
                        <div className="relative shrink-0">
                          {c.isGroup ? (
                            <div className="size-11 rounded-full bg-primary/20 flex items-center justify-center overflow-hidden">
                              {c.avatarUrl
                                ? <img src={resolveMediaUrl(c.avatarUrl)} alt="" className="w-full h-full object-cover" />
                                : <span className="material-symbols-outlined text-primary text-2xl">group</span>}
                            </div>
                          ) : (
                            <UserAvatar
                              avatarUrl={c.otherUser?.profile?.communityAvatarUrl}
                              displayName={c.otherUser?.profile?.displayName ?? displayName(c.otherUser)}
                              email={c.otherUser?.email}
                              className="size-11 text-sm"
                              imgClassName="size-11 rounded-full object-cover"
                              alt={displayName(c.otherUser)}
                            />
                          )}
                          {c.unreadCount > 0 && (
                            <span className="absolute -top-0.5 -right-0.5 min-w-[1rem] h-4 px-0.5 rounded-full bg-primary text-white text-[9px] font-bold flex items-center justify-center">
                              {c.unreadCount > 9 ? '9+' : c.unreadCount}
                            </span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-center gap-1">
                            <span className={`text-sm font-bold truncate ${c.unreadCount > 0 ? 'text-foreground' : 'text-muted'}`}>
                              {convName(c)}
                            </span>
                            {c.lastMessage && (
                              <span className="text-[10px] text-faint shrink-0">
                                {timeAgo(c.lastMessage.createdAt)}
                              </span>
                            )}
                          </div>
                          <p className={`text-xs truncate mt-0.5 ${c.unreadCount > 0 ? 'text-foreground font-medium' : 'text-faint'}`}>
                            {c.lastMessage?.isMine ? 'You: ' : ''}
                            {c.lastMessage?.content ?? 'No messages yet'}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Floating button ── */}
      <motion.button
        type="button"
        onClick={() => { setOpen((v) => !v); if (!open) setActiveConv(null); }}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.93 }}
        className={btnClass}
        style={btnStyle}
        aria-label="Messaging"
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={open ? 'close' : 'chat'}
            initial={{ rotate: -90, opacity: 0 }}
            animate={{ rotate: 0, opacity: 1 }}
            exit={{ rotate: 90, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="material-symbols-outlined text-2xl text-foreground"
          >
            {open ? 'close' : 'chat'}
          </motion.span>
        </AnimatePresence>

        {!open && unread > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-1 -right-1 min-w-[1.25rem] h-5 px-1 rounded-full bg-primary text-white text-[9px] font-bold flex items-center justify-center border-2 border-background"
          >
            {unread > 99 ? '99+' : unread}
          </motion.span>
        )}
      </motion.button>
    </>
  );
};
