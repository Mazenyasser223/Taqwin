import React, { useCallback, useEffect, useRef, useState } from 'react';
import uploadService from '../../services/uploadService';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useI18n } from '../../lib/i18n/useI18n';
import { useAuthStore } from '../../store/useAuthStore';
import communityService from '../../services/communityService';
import type { CommunityConversation, CommunityMessage, CommunityAuthor } from '../../types';
import {
  timeAgo,
  fallbackAvatar,
  displayName,
  isVideoMediaUrl,
  communityProfilePath,
  pickVoiceRecorderMime,
} from './communityUtils';
import { RoleBadge } from './RoleBadge';
import { UploadProgressBar } from '../../components/ui/UploadProgressBar';
import { InboxEmojiPicker } from './InboxEmojiPicker';
import { MessageStatusIcon } from './MessageStatusIcon';
import { useInboxQueryParams } from './useInboxQueryParams';
import { CommunityRefreshButton } from './CommunityRefreshButton';
import { CommunityLoader } from './CommunityLoader';
import { GroupInfoPanel } from './GroupInfoPanel';
import { communityPageClass, feedPanel, feedTabActive, feedTabIdle, feedTabStrip } from './communityFeedStyles';
import { useCommunityLivePoll, COMMUNITY_INBOX_POLL_MS, COMMUNITY_MESSAGES_POLL_MS } from './useCommunityLivePoll';
import { resolveMediaUrl } from '../../lib/mediaUrl';
import { PresenceAvatarDot } from './PresenceIndicator';

const POLL_MESSAGES_MS = COMMUNITY_MESSAGES_POLL_MS;
const POLL_INBOX_MS = COMMUNITY_INBOX_POLL_MS;

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
  const { user } = useAuthStore();
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
  const [showGroupInfo, setShowGroupInfo] = useState(false);
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupQuery, setGroupQuery] = useState('');
  const [groupSearchResults, setGroupSearchResults] = useState<CommunityAuthor[]>([]);
  const [groupMembers, setGroupMembers] = useState<CommunityAuthor[]>([]);
  const [groupCreating, setGroupCreating] = useState(false);
  const [groupCreateError, setGroupCreateError] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [voiceUploading, setVoiceUploading] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const [imageUploadPercent, setImageUploadPercent] = useState(0);
  const [pendingSend, setPendingSend] = useState(false);
  const [inboxRefreshing, setInboxRefreshing] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordStreamRef = useRef<MediaStream | null>(null);
  const recordChunksRef = useRef<Blob[]>([]);
  const recordingConvIdRef = useRef<string | null>(null);
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

  const loadInbox = useCallback(async (opts?: { silent?: boolean; fresh?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    const fetchConv = (folder: 'primary' | 'requests') =>
      opts?.fresh ? communityService.refreshConversations(folder) : communityService.getConversations(folder);
    const [primaryRes, requestsRes] = await Promise.all([fetchConv('primary'), fetchConv('requests')]);
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
    async (id: string, opts?: { markRead?: boolean; showLoading?: boolean; incremental?: boolean }) => {
      if (activeIdRef.current !== id) return [];

      if (opts?.showLoading) {
        setMessagesLoading(true);
        setMessagesError(null);
      }

      try {
        const since = opts?.incremental ? lastMessageAtRef.current ?? undefined : undefined;
        const res = await communityService.getMessages(id, since ? { since } : undefined);
        if (activeIdRef.current !== id) return [];

        if (res.error) {
          setMessagesError(res.error);
          return [];
        }

        const incoming = parseMessagesPayload(res.data);
        if (opts?.incremental && since) {
          if (incoming.length > 0) {
            setMessages((prev) => mergeMessages(prev, incoming));
            const last = incoming[incoming.length - 1];
            if (last) lastMessageAtRef.current = last.createdAt;
            const hasFromOther = incoming.some((m) => m.senderId !== user?.id);
            if (hasFromOther && opts?.markRead !== false) {
              void communityService.markConversationRead(id).then(() => {
                setPrimaryList((list) => list.map((c) => (c.id === id ? { ...c, unreadCount: 0 } : c)));
                setRequestsList((list) => list.map((c) => (c.id === id ? { ...c, unreadCount: 0 } : c)));
                setActiveConversation((c) => (c?.id === id ? { ...c, unreadCount: 0 } : c));
                void loadInbox({ silent: true, fresh: true });
              });
            }
          }
          return incoming;
        }

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
            void loadInbox({ silent: true, fresh: true });
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
    [loadInbox, user?.id],
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

  const refreshInbox = useCallback(async () => {
    setInboxRefreshing(true);
    try {
      await loadInbox({ fresh: true });
      if (activeIdRef.current) await loadActiveChat(activeIdRef.current);
    } finally {
      setInboxRefreshing(false);
    }
  }, [loadInbox, loadActiveChat]);

  useCommunityLivePoll(() => void loadInbox({ silent: true, fresh: true }), POLL_INBOX_MS);

  const selectConversation = (c: CommunityConversation) => {
    setInboxParams({ c: c.id, folder: c.isMessageRequest ? 'requests' : null });
  };

  useEffect(() => {
    void loadInbox();
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
      void fetchMessages(activeId, { markRead: true, incremental: true });
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
    void loadInbox({ silent: true, fresh: true });
  };

  const stopRecordStream = () => {
    recordStreamRef.current?.getTracks().forEach((tr) => tr.stop());
    recordStreamRef.current = null;
  };

  const stopVoiceRecording = useCallback(() => {
    const mr = mediaRecorderRef.current;
    if (mr && mr.state !== 'inactive') mr.stop();
    mediaRecorderRef.current = null;
    setRecording(false);
  }, []);

  const toggleVoiceRecord = useCallback(async () => {
    if (!activeId || voiceUploading || pendingSend) return;

    if (recording) {
      stopVoiceRecording();
      return;
    }

    if (typeof MediaRecorder === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      alert(t('community.micDenied'));
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recordStreamRef.current = stream;
      recordChunksRef.current = [];
      recordingConvIdRef.current = activeId;

      const { mime, ext } = pickVoiceRecorderMime();
      const mr = new MediaRecorder(stream, MediaRecorder.isTypeSupported(mime) ? { mimeType: mime } : undefined);
      mediaRecorderRef.current = mr;

      mr.ondataavailable = (e) => {
        if (e.data.size > 0) recordChunksRef.current.push(e.data);
      };

      mr.onerror = () => {
        stopRecordStream();
        setRecording(false);
        alert(t('community.voiceUploadFailed'));
      };

      mr.onstop = async () => {
        stopRecordStream();
        const convId = recordingConvIdRef.current;
        recordingConvIdRef.current = null;
        const chunks = [...recordChunksRef.current];
        recordChunksRef.current = [];

        if (!convId || chunks.length === 0) {
          alert(t('community.voiceTooShort'));
          return;
        }

        const blobType = (mr.mimeType || mime).split(';')[0];
        const blob = new Blob(chunks, { type: blobType });
        if (blob.size < 200) {
          alert(t('community.voiceTooShort'));
          return;
        }

        const file = new File([blob], `voice.${ext}`, { type: blobType });
        setVoiceUploading(true);
        const { url, error } = await uploadService.uploadFile(file, 'messages');
        if (!url) {
          setVoiceUploading(false);
          alert(error || t('community.voiceUploadFailed'));
          return;
        }
        const res = await communityService.sendMessage(convId, {
          messageType: 'audio',
          mediaUrl: url,
          content: '',
        });
        setVoiceUploading(false);
        if (res.data) appendMessage(res.data);
        else alert(res.error || t('community.voiceUploadFailed'));
      };

      mr.start(250);
      setRecording(true);
    } catch {
      stopRecordStream();
      setRecording(false);
      alert(t('community.micDenied'));
    }
  }, [activeId, recording, voiceUploading, pendingSend, stopVoiceRecording, t]);

  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current?.state !== 'inactive') {
        try {
          mediaRecorderRef.current?.stop();
        } catch {
          /* ignore */
        }
      }
      stopRecordStream();
    };
  }, []);

  useEffect(() => {
    if (!urlConversationId && recording) stopVoiceRecording();
  }, [urlConversationId, recording, stopVoiceRecording]);

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
      setMessagesError(res.error ?? 'Failed to send');
    }
  };

  const acceptRequest = async (conversationId: string) => {
    const res = await communityService.acceptMessageRequest(conversationId);
    if (!res.data) return;
    setActiveConversation(res.data);
    await loadInbox({ silent: true, fresh: true });
    setInboxParams({ c: conversationId, folder: null });
  };

  const declineRequest = async (conversationId: string) => {
    const res = await communityService.declineMessageRequest(conversationId);
    if (res.error) return;
    setActiveConversation(null);
    setMessages([]);
    lastMessageAtRef.current = null;
    setInboxParams({ c: null, folder: inboxFolder === 'requests' ? 'requests' : null });
    await loadInbox({ silent: true, fresh: true });
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
    await loadInbox({ silent: true, fresh: true });
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

  const openNewGroup = () => {
    setGroupName('');
    setGroupQuery('');
    setGroupMembers([]);
    setGroupSearchResults([]);
    setGroupCreateError(null);
    setShowNew(false);
    setShowNewGroup(true);
  };

  const toggleGroupMember = (u: CommunityAuthor) => {
    setGroupMembers((prev) =>
      prev.find((m) => m.id === u.id) ? prev.filter((m) => m.id !== u.id) : [...prev, u],
    );
  };

  const createGroupConversation = async () => {
    if (!groupName.trim() || groupMembers.length === 0 || groupCreating) return;
    setGroupCreating(true);
    setGroupCreateError(null);
    const res = await communityService.startGroupConversation(
      groupName.trim(),
      groupMembers.map((m) => m.id),
    );
    setGroupCreating(false);
    if (res.error) {
      setGroupCreateError(res.error);
      return;
    }
    setShowNewGroup(false);
    await loadInbox({ silent: true, fresh: true });
    if (res.data) setInboxParams({ c: res.data.id });
  };

  useEffect(() => {
    if (!groupQuery.trim()) {
      setGroupSearchResults([]);
      return;
    }
    const timer = window.setTimeout(() => {
      communityService.searchUsers(groupQuery.trim()).then((res) => {
        setGroupSearchResults(res.data ?? []);
      });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [groupQuery]);

  const filtered = conversations.filter((c) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const convName = c.isGroup ? (c.name ?? '').toLowerCase() : displayName(c.otherUser).toLowerCase();
    const preview = c.lastMessage?.content?.toLowerCase() ?? '';
    return convName.includes(q) || preview.includes(q);
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
      <div className="flex items-center gap-2 pb-3 border-b border-border shrink-0">
        {headerConversation ? (
          <>
            {/* Avatar / group icon */}
            {headerConversation.isGroup ? (
              <button
                type="button"
                onClick={() => setShowGroupInfo(true)}
                className="relative shrink-0 size-10 sm:size-12 rounded-full bg-primary/20 flex items-center justify-center overflow-hidden hover:ring-2 hover:ring-primary/40 transition"
              >
                {headerConversation.avatarUrl
                  ? <img src={resolveMediaUrl(headerConversation.avatarUrl)} alt="" className="w-full h-full object-cover" />
                  : <span className="material-symbols-outlined text-primary text-xl sm:text-2xl">group</span>
                }
              </button>
            ) : (
              <Link to={communityProfilePath(headerConversation.otherUser?.id)} className="relative shrink-0">
                <img
                  src={resolveMediaUrl(headerConversation.otherUser?.profile?.avatarUrl) || fallbackAvatar(headerConversation.otherUser?.id ?? 'x')}
                  alt=""
                  className="size-10 sm:size-12 rounded-full object-cover"
                />
                <PresenceAvatarDot isOnline={headerConversation.otherUser?.isOnline} />
              </Link>
            )}

            {/* Name / subtitle */}
            <div className="flex-1 min-w-0">
              {headerConversation.isGroup ? (
                <>
                  <button type="button" onClick={() => setShowGroupInfo(true)} className="font-bold truncate hover:text-primary text-left w-full text-sm sm:text-base">
                    {headerConversation.name ?? 'Group'}
                  </button>
                  <p className="text-[11px] text-muted mt-0.5 cursor-pointer hover:text-primary truncate" onClick={() => setShowGroupInfo(true)}>
                    {headerConversation.participants?.length ?? 0} members · tap to view
                  </p>
                </>
              ) : (
                <>
                  <Link to={communityProfilePath(headerConversation.otherUser?.id)} className="font-bold hover:text-primary block truncate text-sm sm:text-base">
                    {displayName(headerConversation.otherUser)}
                  </Link>
                  {headerConversation.isMessageRequest && (
                    <p className="text-[11px] text-amber-400 mt-0.5">{t('community.messageRequestHint')}</p>
                  )}
                </>
              )}
            </div>

            {/* Accept / Decline (DM requests) */}
            {!headerConversation.isGroup && headerConversation.isMessageRequest && (
              <div className="flex gap-1 shrink-0">
                <button type="button" onClick={() => acceptRequest(headerConversation.id)} className="px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg bg-primary text-white text-xs font-bold">
                  {t('community.accept')}
                </button>
                <button type="button" onClick={() => declineRequest(headerConversation.id)} className="px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg border border-subtle text-xs font-bold text-muted">
                  {t('community.decline')}
                </button>
              </div>
            )}

            {/* Role badge + close */}
            <div className="flex items-center gap-1 shrink-0">
              {!headerConversation.isGroup && headerConversation.otherUser?.role && (
                <span className="hidden sm:block"><RoleBadge role={headerConversation.otherUser.role} /></span>
              )}
              <button type="button" onClick={leaveConversation} aria-label={t('common.close')} className="p-1.5 sm:p-2 rounded-xl text-muted hover:text-foreground hover:bg-elevated transition-colors">
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>
          </>
        ) : (
          <div className="flex items-center gap-2 flex-1">
            <div className="flex-1 h-10 rounded-xl bg-elevated animate-pulse" />
            <button type="button" onClick={leaveConversation} aria-label={t('common.close')} className="p-1.5 rounded-xl text-muted hover:text-foreground hover:bg-elevated transition-colors shrink-0">
              <span className="material-symbols-outlined text-xl">close</span>
            </button>
          </div>
        )}
      </div>

      <div
        ref={messagesScrollRef}
        className="flex-1 min-h-[30vh] lg:min-h-0 overflow-y-auto space-y-3 py-3 pr-1 sm:pr-2 custom-scrollbar"
      >
        {messagesLoading && messages.length === 0 && !messagesError && (
          <CommunityLoader icon="chat_bubble" className="py-12" />
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
        {messages.map((m) => {
          if (m.messageType === 'system') {
            return (
              <div key={m.id} className="flex justify-center py-1">
                <span className="text-[11px] text-muted bg-elevated/60 rounded-full px-3 py-1 font-medium">
                  {m.content}
                </span>
              </div>
            );
          }
          return (
          <div key={m.id} className={`flex flex-col ${m.isMine ? 'items-end' : 'items-start'}`}>
            {!m.isMine && headerConversation?.isGroup && m.sender && (
              <p className="text-[10px] text-muted font-semibold mb-0.5 px-1">
                {displayName(m.sender)}
              </p>
            )}
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                m.isMine
                  ? 'bg-primary text-white rounded-br-md'
                  : 'bg-elevated border border-subtle rounded-bl-md'
              }`}
            >
              {m.messageType === 'image' && m.mediaUrl ? (
                <img src={resolveMediaUrl(m.mediaUrl)} alt="" className="rounded-lg max-w-full mb-1" />
              ) : m.messageType === 'audio' && m.mediaUrl ? (
                <audio src={resolveMediaUrl(m.mediaUrl)} controls className="max-w-full" />
              ) : m.messageType === 'story_reply' ? (
                <>
                  <p className="text-[10px] font-bold opacity-80 mb-1">{t('community.storyReplyInbox')}</p>
                  {m.mediaUrl && (
                    <div className="mb-2 w-12 h-16 rounded-md overflow-hidden border border-subtle/60 bg-black/30">
                      {isVideoMediaUrl(m.mediaUrl) ? (
                        <video
                          src={resolveMediaUrl(m.mediaUrl)}
                          className="w-full h-full object-cover pointer-events-none"
                          muted
                          playsInline
                          preload="metadata"
                        />
                      ) : (
                        <img src={resolveMediaUrl(m.mediaUrl)} alt="" className="w-full h-full object-cover" loading="lazy" />
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
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {(() => {
        const conv = activeConversation ?? headerConversation;
        const isGroupLocked = conv?.isGroup && conv?.canSendMessages === 'admins' && conv?.myRole !== 'admin';
        if (isGroupLocked) {
          return (
            <div className="shrink-0 border-t border-border/60 py-3 px-4 flex items-center justify-center gap-2 text-muted bg-elevated/40 rounded-b-2xl">
              <span className="material-symbols-outlined text-[20px]">lock</span>
              <p className="text-sm font-medium">Only admins can send messages</p>
            </div>
          );
        }
        if (headerConversation?.canSendMessage === false) {
          return <p className="text-sm text-muted text-center py-2 shrink-0">{t('community.acceptToReply')}</p>;
        }
        return (
        <div className="shrink-0 pt-2 border-t border-border/60">
          {voiceUploading && (
            <div className="flex items-center gap-2 mb-2">
              <span className="material-symbols-outlined text-base text-primary animate-pulse">mic</span>
              <span className="text-xs text-primary font-semibold">{t('community.sendingVoice')}</span>
            </div>
          )}
          {imageUploading && <UploadProgressBar percent={imageUploadPercent} className="mb-2" />}
          <div className="flex gap-1.5 sm:gap-2 items-center">
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
              className="p-1.5 sm:p-2 shrink-0 text-muted hover:text-primary"
            >
              <span className="material-symbols-outlined text-[22px]">image</span>
            </button>
            <button
              type="button"
              onClick={() => void toggleVoiceRecord()}
              disabled={voiceUploading || pendingSend || !activeId}
              aria-label={recording ? t('community.stopRecording') : t('community.recordVoice')}
              className={`p-1.5 sm:p-2 shrink-0 disabled:opacity-40 ${recording ? 'text-red-400 animate-pulse' : 'text-muted hover:text-primary'}`}
            >
              <span className="material-symbols-outlined text-[22px]">{recording ? 'stop_circle' : 'mic'}</span>
            </button>
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
              placeholder={t('community.messagePlaceholder')}
              className="flex-1 min-w-0 bg-elevated border border-subtle rounded-xl px-3 sm:px-4 py-2.5 sm:py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            <button
              type="button"
              onClick={sendMessage}
              disabled={pendingSend || !draft.trim()}
              className="shrink-0 p-2.5 sm:px-5 bg-primary text-white font-bold rounded-xl disabled:opacity-40"
            >
              <span className="material-symbols-outlined text-[22px]">send</span>
            </button>
          </div>
        </div>
        );
      })()}
    </div>
  );

  const listPanel = (
    <div className={`${communityPageClass} ${showChat ? 'hidden lg:flex lg:flex-col' : 'flex flex-col'}`}>
      <div className={`${feedPanel} p-4 sm:p-5 flex items-center justify-between gap-3`}>
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-black">{t('community.inboxTitle')}</h1>
          <p className="text-muted text-sm mt-0.5 truncate">
            {unreadTotal > 0
              ? t('community.inboxUnread').replace('{count}', String(unreadTotal))
              : t('community.inboxAllRead')}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <CommunityRefreshButton onRefresh={refreshInbox} refreshing={inboxRefreshing} disabled={loading} />
          <button
            type="button"
            onClick={() => setShowNew(true)}
            className="shrink-0 flex items-center gap-1 bg-primary text-white font-bold px-3 sm:px-4 py-2 sm:py-2.5 rounded-full text-xs sm:text-sm"
          >
            <span className="material-symbols-outlined text-lg">edit</span>
            <span className="hidden sm:inline">{t('community.newMessage')}</span>
          </button>
        </div>
      </div>

      <div className={feedTabStrip}>
        <button
          type="button"
          onClick={() => switchFolder('primary')}
          className={`flex-1 min-w-0 ${inboxFolder === 'primary' ? feedTabActive : feedTabIdle}`}
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

      <div className={`relative ${feedPanel} p-3`}>
        <span className="material-symbols-outlined absolute left-7 top-1/2 -translate-y-1/2 text-faint">search</span>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('community.inboxSearch')}
          className="w-full bg-transparent rounded-xl pl-12 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 ring-1 ring-inset ring-white/[0.06]"
        />
      </div>

      {loading && <CommunityLoader icon="inbox" className="py-8" />}
      {!loading && filtered.length === 0 && (
        <div className={`${feedPanel} p-6 sm:p-10 text-center text-muted text-sm`}>{t('community.inboxEmpty')}</div>
      )}

      <div className="space-y-2 flex-1 overflow-y-auto custom-scrollbar">
        {filtered.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => selectConversation(c)}
            className={`w-full text-left p-4 flex gap-3 transition-all ${
              activeId === c.id
                ? `${feedPanel} ring-2 ring-primary/40`
                : `${feedPanel} hover:ring-1 hover:ring-primary/30`
            }`}
          >
            {c.isGroup ? (
              <div className="relative shrink-0 size-14 rounded-full bg-primary/20 flex items-center justify-center overflow-hidden">
                {c.avatarUrl
                  ? <img src={resolveMediaUrl(c.avatarUrl)} alt="" className="w-full h-full object-cover" />
                  : <span className="material-symbols-outlined text-primary text-3xl">group</span>
                }
              </div>
            ) : (
              <Link
                to={communityProfilePath(c.otherUser?.id)}
                onClick={(e) => e.stopPropagation()}
                className="relative shrink-0"
              >
                <img
                  src={
                    resolveMediaUrl(c.otherUser?.profile?.avatarUrl) ||
                    fallbackAvatar(c.otherUser?.id ?? c.id)
                  }
                  alt=""
                  className="size-14 rounded-full object-cover"
                />
                <PresenceAvatarDot isOnline={c.otherUser?.isOnline} className="size-3.5" />
              </Link>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-start gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-bold truncate">
                    {c.isGroup ? (c.name ?? 'Group') : displayName(c.otherUser)}
                  </span>
                  {c.isGroup && (
                    <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-primary/20 text-primary shrink-0">
                      GROUP
                    </span>
                  )}
                  {c.isMessageRequest && !c.isGroup && (
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
      className={showChat ? 'lg:grid lg:grid-cols-[minmax(280px,340px)_1fr] lg:gap-6 lg:items-stretch' : 'max-w-2xl mx-auto'}
    >
      {listPanel}
      {showChat ? (
        <motion.div
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          className={`${feedPanel} p-4 sm:p-5 flex flex-col min-h-[min(70vh,640px)] lg:min-h-[520px]`}
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
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-black">{t('community.newMessage')}</h3>
                <button
                  type="button"
                  onClick={openNewGroup}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-bold hover:bg-primary/20 transition-colors"
                >
                  <span className="material-symbols-outlined text-base">group_add</span>
                  New Group
                </button>
              </div>
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
        {showNewGroup && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center p-4"
            onClick={() => setShowNewGroup(false)}
          >
            <motion.div
              initial={{ y: 40 }}
              animate={{ y: 0 }}
              exit={{ y: 40 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-3xl bg-surface border border-border p-6 space-y-4"
            >
              <h3 className="text-xl font-black flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">group_add</span>
                New Group
              </h3>

              {groupCreateError && (
                <p className="text-xs text-red-400 bg-red-400/10 rounded-xl px-3 py-2">{groupCreateError}</p>
              )}

              <input
                value={groupName}
                onChange={(e) => { setGroupName(e.target.value); setGroupCreateError(null); }}
                placeholder="Group name…"
                className="w-full bg-elevated border border-subtle rounded-xl px-4 py-3 text-sm"
                autoFocus
                disabled={groupCreating}
              />

              {groupMembers.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {groupMembers.map((m) => (
                    <span
                      key={m.id}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/15 text-primary text-xs font-bold"
                    >
                      {displayName(m)}
                      <button type="button" onClick={() => toggleGroupMember(m)} className="hover:text-red-400">
                        <span className="material-symbols-outlined text-sm">close</span>
                      </button>
                    </span>
                  ))}
                </div>
              )}

              <input
                value={groupQuery}
                onChange={(e) => setGroupQuery(e.target.value)}
                placeholder="Search people to add…"
                className="w-full bg-elevated border border-subtle rounded-xl px-4 py-3 text-sm"
                disabled={groupCreating}
              />

              <div className="max-h-48 overflow-y-auto space-y-1">
                {groupSearchResults
                  .filter((u) => u.id !== user?.id)
                  .map((u) => {
                    const selected = groupMembers.some((m) => m.id === u.id);
                    return (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => toggleGroupMember(u)}
                        className={`w-full flex items-center gap-3 p-2.5 rounded-xl transition-colors ${
                          selected ? 'bg-primary/15' : 'hover:bg-elevated'
                        }`}
                      >
                        <img src={resolveMediaUrl(u.profile?.avatarUrl) || fallbackAvatar(u.id)} alt="" className="size-9 rounded-full object-cover shrink-0" />
                        <div className="flex-1 min-w-0 text-left">
                          <p className="font-bold text-sm truncate">{displayName(u)}</p>
                          <p className="text-xs text-faint truncate">{u.handle}</p>
                        </div>
                        {selected && <span className="material-symbols-outlined text-primary text-lg shrink-0">check_circle</span>}
                      </button>
                    );
                  })}
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowNewGroup(false)}
                  disabled={groupCreating}
                  className="flex-1 py-3 rounded-xl border border-subtle font-bold disabled:opacity-40"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="button"
                  onClick={createGroupConversation}
                  disabled={groupCreating || !groupName.trim() || groupMembers.length === 0}
                  className="flex-1 py-3 rounded-xl bg-primary text-white font-bold disabled:opacity-40"
                >
                  {groupCreating ? 'Creating…' : 'Create Group'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showGroupInfo && headerConversation?.isGroup && (
          <GroupInfoPanel
            conversation={activeConversation ?? headerConversation}
            onClose={() => setShowGroupInfo(false)}
            onUpdated={(conv) => {
              setActiveConversation(conv);
              setPrimaryList((list) => list.map((c) => (c.id === conv.id ? conv : c)));
            }}
            onLeave={() => {
              setShowGroupInfo(false);
              leaveConversation();
              void loadInbox({ silent: true, fresh: true });
            }}
            searchUsers={async (q) => {
              const res = await communityService.searchUsers(q);
              return res.data ?? [];
            }}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
};
