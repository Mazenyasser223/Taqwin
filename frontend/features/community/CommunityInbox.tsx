import React, { useCallback, useEffect, useRef, useState } from 'react';
import uploadService from '../../services/uploadService';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useI18n } from '../../lib/i18n/useI18n';
import communityService from '../../services/communityService';
import type { CommunityConversation, CommunityMessage, CommunityAuthor } from '../../types';
import { timeAgo, fallbackAvatar, displayName, isVideoMediaUrl, communityProfilePath } from './communityUtils';
import { RoleBadge } from './RoleBadge';
import { UploadProgressBar } from '../../components/ui/UploadProgressBar';
import { InboxEmojiPicker } from './InboxEmojiPicker';
import { MessageStatusIcon } from './MessageStatusIcon';
import { useInboxQueryParams } from './useInboxQueryParams';

const POLL_MESSAGES_MS = 2000;
const POLL_INBOX_MS = 4000;

function mergeMessages(prev: CommunityMessage[], incoming: CommunityMessage[]) {
  const byId = new Map(prev.map((m) => [m.id, m]));
  for (const m of incoming) byId.set(m.id, m);
  return Array.from(byId.values()).sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
}

function parseMessagesPayload(data: unknown): CommunityMessage[] {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (typeof data === 'object' && data !== null && 'messages' in data) {
    return (data as { messages: CommunityMessage[] }).messages ?? [];
  }
  return [];
}

export const CommunityInbox: React.FC = () => {
  const { t } = useI18n();
  const { conversationId: urlConversationId, folder: inboxFolder, setInboxParams } = useInboxQueryParams();

  const [primaryList, setPrimaryList] = useState<CommunityConversation[]>([]);
  const [requestsList, setRequestsList] = useState<CommunityConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<CommunityAuthor[]>([]);
  const [activeConversation, setActiveConversation] = useState<CommunityConversation | null>(null);
  const [messages, setMessages] = useState<CommunityMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messagesError, setMessagesError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [newQuery, setNewQuery] = useState('');
  const [recording, setRecording] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const [imageUploadPercent, setImageUploadPercent] = useState(0);
  const [pendingSend, setPendingSend] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesScrollRef = useRef<HTMLDivElement>(null);
  const lastMessageAtRef = useRef<string | null>(null);
  const activeIdRef = useRef<string | null>(null);
  const pollReadyRef = useRef(false);
  const chatLoadGenRef = useRef(0);
  const listsRef = useRef({ primary: [] as CommunityConversation[], requests: [] as CommunityConversation[] });

  const activeId = urlConversationId ?? activeConversation?.id ?? null;
  activeIdRef.current = activeId ?? null;

  const conversations = inboxFolder === 'requests' ? requestsList : primaryList;
  const requestCount = requestsList.length;
  const unreadTotal = [...primaryList, ...requestsList].reduce((s, c) => s + c.unreadCount, 0);

  const loadInbox = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    const [primaryRes, requestsRes] = await Promise.all([
      communityService.getConversations('primary'),
      communityService.getConversations('requests'),
    ]);
    const primary = primaryRes.data ?? [];
    const requests = requestsRes.data ?? [];
    setPrimaryList(primary);
    setRequestsList(requests);
    listsRef.current = { primary, requests };
    if (!opts?.silent) setLoading(false);

    const aid = activeIdRef.current;
    if (aid) {
      const found = [...primary, ...requests].find((c) => c.id === aid);
      if (found) setActiveConversation((prev) => (prev?.id === aid ? { ...prev, ...found } : found));
    }
    return { primary, requests };
  }, []);

  const fetchMessages = useCallback(
    async (id: string, opts?: { markRead?: boolean; showLoading?: boolean }) => {
      if (activeIdRef.current !== id) return [];

      if (opts?.showLoading) {
        setMessagesLoading(true);
        setMessagesError(null);
      }

      try {
        const res = await communityService.getMessages(id);
        if (activeIdRef.current !== id) return [];

        if (res.error) {
          setMessagesError(res.error);
          return [];
        }

        const incoming = parseMessagesPayload(res.data);
        setMessages(incoming);
        setMessagesError(null);
        const last = incoming[incoming.length - 1];
        lastMessageAtRef.current = last?.createdAt ?? null;
        pollReadyRef.current = true;

        if (opts?.markRead !== false) {
          void communityService.markConversationRead(id).then(() => {
            setPrimaryList((list) => list.map((c) => (c.id === id ? { ...c, unreadCount: 0 } : c)));
            setRequestsList((list) => list.map((c) => (c.id === id ? { ...c, unreadCount: 0 } : c)));
            setActiveConversation((c) => (c?.id === id ? { ...c, unreadCount: 0 } : c));
            void loadInbox({ silent: true });
          });
        }
        return incoming;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to load messages';
        setMessagesError(msg);
        return [];
      } finally {
        if (activeIdRef.current === id && opts?.showLoading) setMessagesLoading(false);
      }
    },
    [loadInbox],
  );

  const loadActiveChat = useCallback(
    async (id: string) => {
      const gen = ++chatLoadGenRef.current;
      pollReadyRef.current = false;
      lastMessageAtRef.current = null;
      activeIdRef.current = id;
      setMessages([]);
      setMessagesLoading(true);
      setMessagesError(null);

      try {
        const { primary, requests } = listsRef.current;
        let conv = [...primary, ...requests].find((c) => c.id === id);
        if (!conv) {
          const res = await communityService.getConversation(id);
          if (res.error) throw new Error(res.error);
          conv = res.data ?? undefined;
        }
        if (!conv) throw new Error(t('community.inboxEmpty'));

        if (chatLoadGenRef.current !== gen || activeIdRef.current !== id) return;
        setActiveConversation(conv);
        await fetchMessages(id, { markRead: true, showLoading: true });
      } catch (err) {
        if (chatLoadGenRef.current !== gen) return;
        const msg = err instanceof Error ? err.message : 'Failed to load conversation';
        setMessagesError(msg);
        setMessagesLoading(false);
        pollReadyRef.current = false;
      }
    },
    [fetchMessages, t],
  );

  const selectConversation = (c: CommunityConversation) => {
    setInboxParams({ c: c.id, folder: c.isMessageRequest ? 'requests' : null });
  };

  useEffect(() => {
    void loadInbox();
  }, [loadInbox]);

  useEffect(() => {
    const tickInbox = () => {
      if (document.visibilityState === 'visible') void loadInbox({ silent: true });
    };
    const iv = window.setInterval(tickInbox, POLL_INBOX_MS);
    document.addEventListener('visibilitychange', tickInbox);
    return () => {
      window.clearInterval(iv);
      document.removeEventListener('visibilitychange', tickInbox);
    };
  }, [loadInbox]);

  useEffect(() => {
    if (!urlConversationId) {
      chatLoadGenRef.current += 1;
      activeIdRef.current = null;
      pollReadyRef.current = false;
      setActiveConversation(null);
      setMessages([]);
      setMessagesLoading(false);
      setMessagesError(null);
      return;
    }
    void loadActiveChat(urlConversationId);
  }, [urlConversationId, loadActiveChat]);

  useEffect(() => {
    if (!activeId) return;
    const poll = () => {
      if (document.visibilityState !== 'visible' || !pollReadyRef.current) return;
      void fetchMessages(activeId, { markRead: true });
    };
    const iv = window.setInterval(poll, POLL_MESSAGES_MS);
    return () => window.clearInterval(iv);
  }, [activeId, fetchMessages]);

  const scrollToBottom = useCallback((smooth: boolean) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
  }, []);

  useEffect(() => {
    const el = messagesScrollRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    if (nearBottom) scrollToBottom(true);
  }, [messages.length, activeId, scrollToBottom]);

  const appendMessage = (msg: CommunityMessage) => {
    setMessages((m) => mergeMessages(m, [msg]));
    lastMessageAtRef.current = msg.createdAt;
    scrollToBottom(true);
    void loadInbox({ silent: true });
  };

  const sendMessage = async () => {
    if (!activeId || !draft.trim() || headerConversation?.canSendMessage === false || pendingSend) return;
    const text = draft.trim();
    setDraft('');
    setPendingSend(true);
    const res = await communityService.sendMessage(activeId, { content: text, messageType: 'text' });
    setPendingSend(false);
    if (res.data) {
      appendMessage(res.data);
      void fetchMessages(activeId, { markRead: false });
    } else {
      setDraft(text);
      alert(res.error);
    }
  };

  const acceptRequest = async (conversationId: string) => {
    const res = await communityService.acceptMessageRequest(conversationId);
    if (!res.data) return;
    setActiveConversation(res.data);
    await loadInbox({ silent: true });
    setInboxParams({ c: conversationId, folder: null });
  };

  const declineRequest = async (conversationId: string) => {
    const res = await communityService.declineMessageRequest(conversationId);
    if (res.error) return;
    setActiveConversation(null);
    setMessages([]);
    lastMessageAtRef.current = null;
    setInboxParams({ c: null, folder: inboxFolder === 'requests' ? 'requests' : null });
    await loadInbox({ silent: true });
  };

  const leaveConversation = () => {
    setInboxParams({ c: null, folder: null });
  };

  const switchFolder = (folder: 'primary' | 'requests') => {
    setInboxParams({ c: null, folder: folder === 'requests' ? 'requests' : null });
  };

  const startWithUser = async (userId: string) => {
    const res = await communityService.startConversation(userId);
    if (!res.data) return;
    setShowNew(false);
    setNewQuery('');
    await loadInbox({ silent: true });
    setInboxParams({ c: res.data.id });
  };

  useEffect(() => {
    if (!newQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const timer = window.setTimeout(() => {
      communityService.searchUsers(newQuery.trim()).then((res) => {
        setSearchResults(res.data ?? []);
      });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [newQuery]);

  const filtered = conversations.filter((c) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const name = displayName(c.otherUser).toLowerCase();
    const preview = c.lastMessage?.content?.toLowerCase() ?? '';
    return name.includes(q) || preview.includes(q);
  });

  const headerConversation =
    activeConversation ??
    [...primaryList, ...requestsList].find((c) => c.id === urlConversationId) ??
    null;

  const showChat = Boolean(urlConversationId);

  const chatPanel = showChat && (
    <div className="flex flex-col h-full min-h-[min(70vh,640px)] lg:min-h-0">
      <button
        type="button"
        onClick={leaveConversation}
        className="lg:hidden flex items-center gap-2 text-muted hover:text-foreground text-sm font-bold mb-3"
      >
        <span className="material-symbols-outlined">arrow_back</span>
        {t('community.backToInbox')}
      </button>
      <div className="flex items-center gap-3 pb-3 border-b border-border shrink-0">
        {headerConversation ? (
          <>
            <Link to={communityProfilePath(headerConversation.otherUser?.id)} className="shrink-0">
              <img
                src={
                  headerConversation.otherUser?.profile?.avatarUrl ||
                  fallbackAvatar(headerConversation.otherUser?.id ?? 'x')
                }
                alt=""
                className="size-12 rounded-full object-cover"
              />
            </Link>
            <div className="flex-1 min-w-0">
              <Link
                to={communityProfilePath(headerConversation.otherUser?.id)}
                className="font-bold hover:text-primary block truncate"
              >
                {displayName(headerConversation.otherUser)}
              </Link>
              {headerConversation.isMessageRequest && (
                <p className="text-xs text-amber-400 mt-1">{t('community.messageRequestHint')}</p>
              )}
            </div>
            {headerConversation.isMessageRequest && (
              <div className="flex gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => acceptRequest(headerConversation.id)}
                  className="px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-bold"
                >
                  {t('community.accept')}
                </button>
                <button
                  type="button"
                  onClick={() => declineRequest(headerConversation.id)}
                  className="px-3 py-1.5 rounded-lg border border-subtle text-xs font-bold text-muted"
                >
                  {t('community.decline')}
                </button>
              </div>
            )}
            <div className="flex items-center gap-2 shrink-0 ml-auto">
              {headerConversation.otherUser?.role && (
                <RoleBadge role={headerConversation.otherUser.role} />
              )}
              <button
                type="button"
                onClick={leaveConversation}
                aria-label={t('common.close')}
                className="p-2 rounded-xl text-muted hover:text-foreground hover:bg-elevated transition-colors"
              >
                <span className="material-symbols-outlined text-[22px]">close</span>
              </button>
            </div>
          </>
        ) : (
          <div className="flex items-center gap-2 flex-1">
            <div className="flex-1 h-12 rounded-xl bg-elevated animate-pulse" />
            <button
              type="button"
              onClick={leaveConversation}
              aria-label={t('common.close')}
              className="p-2 rounded-xl text-muted hover:text-foreground hover:bg-elevated transition-colors shrink-0"
            >
              <span className="material-symbols-outlined text-[22px]">close</span>
            </button>
          </div>
        )}
      </div>

      <div
        ref={messagesScrollRef}
        className="flex-1 min-h-[40vh] lg:min-h-0 overflow-y-auto space-y-3 py-3 pr-2 custom-scrollbar"
      >
        {messagesLoading && messages.length === 0 && !messagesError && (
          <p className="text-center text-sm text-muted animate-pulse py-8">{t('community.loadingMessages')}</p>
        )}
        {messagesError && messages.length === 0 && (
          <div className="text-center py-8 space-y-3">
            <p className="text-sm text-red-400">{messagesError}</p>
            <button
              type="button"
              onClick={() => urlConversationId && loadActiveChat(urlConversationId)}
              className="text-xs font-bold text-primary hover:underline"
            >
              {t('community.retry')}
            </button>
          </div>
        )}
        {!messagesLoading && !messagesError && messages.length === 0 && (
          <p className="text-center text-sm text-muted py-8">{t('community.noMessagesYet')}</p>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.isMine ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                m.isMine
                  ? 'bg-primary text-white rounded-br-md'
                  : 'bg-elevated border border-subtle rounded-bl-md'
              }`}
            >
              {m.messageType === 'image' && m.mediaUrl ? (
                <img src={m.mediaUrl} alt="" className="rounded-lg max-w-full mb-1" />
              ) : m.messageType === 'audio' && m.mediaUrl ? (
                <audio src={m.mediaUrl} controls className="max-w-full" />
              ) : m.messageType === 'story_reply' ? (
                <>
                  <p className="text-[10px] font-bold opacity-80 mb-1">{t('community.storyReplyInbox')}</p>
                  {m.mediaUrl && (
                    <div className="mb-2 w-12 h-16 rounded-md overflow-hidden border border-subtle/60 bg-black/30">
                      {isVideoMediaUrl(m.mediaUrl) ? (
                        <video
                          src={m.mediaUrl}
                          className="w-full h-full object-cover pointer-events-none"
                          muted
                          playsInline
                          preload="metadata"
                        />
                      ) : (
                        <img src={m.mediaUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
                      )}
                    </div>
                  )}
                  {m.content}
                </>
              ) : (
                m.content
              )}
              <div
                className={`flex items-center justify-end gap-1 mt-1 ${m.isMine ? 'text-white/70' : 'text-faint'}`}
              >
                <p className="text-[10px]">{timeAgo(m.createdAt)}</p>
                {m.isMine && <MessageStatusIcon status={m.status} />}
              </div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {headerConversation?.canSendMessage === false ? (
        <p className="text-sm text-muted text-center py-2 shrink-0">{t('community.acceptToReply')}</p>
      ) : (
        <div className="shrink-0 pt-2 border-t border-border/60">
          {imageUploading && <UploadProgressBar percent={imageUploadPercent} className="mb-2" />}
          <div className="flex gap-2 items-center">
            <InboxEmojiPicker disabled={pendingSend} onPick={(emoji) => setDraft((d) => d + emoji)} />
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={async (ev) => {
                const file = ev.target.files?.[0];
                if (!file || !activeId) return;
                setImageUploading(true);
                setImageUploadPercent(0);
                const { url } = await uploadService.uploadFile(file, 'messages', setImageUploadPercent);
                setImageUploading(false);
                setImageUploadPercent(0);
                if (url) {
                  const res = await communityService.sendMessage(activeId, {
                    messageType: 'image',
                    mediaUrl: url,
                    content: '',
                  });
                  if (res.data) appendMessage(res.data);
                }
                ev.target.value = '';
              }}
            />
            <button
              type="button"
              onClick={() => imageInputRef.current?.click()}
              className="p-2 text-muted hover:text-primary"
            >
              <span className="material-symbols-outlined">image</span>
            </button>
            <button
              type="button"
              onClick={async () => {
                if (!activeId) return;
                if (!recording) {
                  try {
                    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                    const mr = new MediaRecorder(stream);
                    const chunks: Blob[] = [];
                    mr.ondataavailable = (e) => chunks.push(e.data);
                    mr.onstop = async () => {
                      stream.getTracks().forEach((tr) => tr.stop());
                      const blob = new Blob(chunks, { type: 'audio/webm' });
                      const file = new File([blob], 'voice.webm', { type: 'audio/webm' });
                      const { url } = await uploadService.uploadFile(file, 'messages');
                      if (url) {
                        const res = await communityService.sendMessage(activeId, {
                          messageType: 'audio',
                          mediaUrl: url,
                          content: '',
                        });
                        if (res.data) appendMessage(res.data);
                      }
                    };
                    mr.start();
                    mediaRecorderRef.current = mr;
                    setRecording(true);
                  } catch {
                    alert(t('community.micDenied'));
                  }
                } else {
                  mediaRecorderRef.current?.stop();
                  setRecording(false);
                }
              }}
              className={`p-2 ${recording ? 'text-red-400' : 'text-muted hover:text-primary'}`}
            >
              <span className="material-symbols-outlined">{recording ? 'stop_circle' : 'mic'}</span>
            </button>
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
              placeholder={t('community.messagePlaceholder')}
              className="flex-1 bg-elevated border border-subtle rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            <button
              type="button"
              onClick={sendMessage}
              disabled={pendingSend || !draft.trim()}
              className="px-5 bg-primary text-white font-bold rounded-xl disabled:opacity-40"
            >
              <span className="material-symbols-outlined">send</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );

  const listPanel = (
    <div className={`space-y-5 ${showChat ? 'hidden lg:flex lg:flex-col' : 'flex flex-col'}`}>
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

      <div className="flex gap-2 p-1 rounded-xl bg-surface/60 border border-border">
        <button
          type="button"
          onClick={() => switchFolder('primary')}
          className={`flex-1 py-2 rounded-lg text-xs font-bold ${
            inboxFolder === 'primary' ? 'bg-primary text-white' : 'text-muted'
          }`}
        >
          {t('community.inboxPrimary')}
        </button>
        <button
          type="button"
          onClick={() => switchFolder('requests')}
          className={`flex-1 py-2 rounded-lg text-xs font-bold relative ${
            inboxFolder === 'requests' ? 'bg-primary text-white' : 'text-muted'
          }`}
        >
          {t('community.inboxRequests')}
          {requestCount > 0 && inboxFolder !== 'requests' && (
            <span className="absolute -top-1 -right-1 size-5 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center">
              {requestCount}
            </span>
          )}
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

      <div className="space-y-2 flex-1 overflow-y-auto custom-scrollbar">
        {filtered.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => selectConversation(c)}
            className={`w-full text-left rounded-2xl border p-4 flex gap-3 transition-colors ${
              activeId === c.id
                ? 'border-primary/50 bg-primary/10'
                : 'border-border bg-surface/60 hover:border-primary/40'
            }`}
          >
            <Link
              to={communityProfilePath(c.otherUser?.id)}
              onClick={(e) => e.stopPropagation()}
              className="relative shrink-0"
            >
              <img
                src={c.otherUser?.profile?.avatarUrl || fallbackAvatar(c.otherUser?.id ?? c.id)}
                alt=""
                className="size-14 rounded-full object-cover"
              />
            </Link>
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-start gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Link
                    to={communityProfilePath(c.otherUser?.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="font-bold truncate hover:text-primary"
                  >
                    {displayName(c.otherUser)}
                  </Link>
                  {c.isMessageRequest && (
                    <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400">
                      {t('community.request')}
                    </span>
                  )}
                </div>
                {c.lastMessage && (
                  <span className="text-xs text-faint shrink-0">{timeAgo(c.lastMessage.createdAt)}</span>
                )}
              </div>
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
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`${showChat ? 'lg:grid lg:grid-cols-[minmax(280px,340px)_1fr] lg:gap-6 lg:items-stretch' : ''}`}
    >
      {listPanel}
      {showChat ? (
        <motion.div
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          className="rounded-2xl border border-border bg-surface/60 p-4 flex flex-col min-h-[min(70vh,640px)] lg:min-h-[520px]"
        >
          {chatPanel}
        </motion.div>
      ) : null}

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
                      to={communityProfilePath(u.id)}
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
              <button
                type="button"
                onClick={() => setShowNew(false)}
                className="w-full py-3 rounded-xl border border-subtle font-bold"
              >
                {t('common.cancel')}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
