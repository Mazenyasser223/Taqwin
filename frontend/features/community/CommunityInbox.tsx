import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import uploadService from '../../services/uploadService';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useI18n } from '../../lib/i18n/useI18n';
import { useAuthStore } from '../../store/useAuthStore';
import communityService from '../../services/communityService';
import type { CommunityConversation, CommunityMessage, CommunityAuthor, MessageDeliveryStatus, StarredInboxMessage } from '../../types';
import {
  timeAgo,
  displayName,
  isVideoMediaUrl,
  communityProfilePath,
  pickVoiceRecorderMime,
} from './communityUtils';
import { UserAvatar } from '../../components/ui/UserAvatar';
import { RoleBadge } from './RoleBadge';
import { UploadProgressBar } from '../../components/ui/UploadProgressBar';
import { InboxEmojiPicker } from './InboxEmojiPicker';
import { MessageStatusIcon } from './MessageStatusIcon';
import { useInboxQueryParams, type InboxFolder } from './useInboxQueryParams';
import { CommunityRefreshButton } from './CommunityRefreshButton';
import { CommunityLoader } from './CommunityLoader';
import { VoiceMessagePlayer } from './VoiceMessagePlayer';
import { GroupInfoPanel } from './GroupInfoPanel';
import { communityPageClass, feedPanel, feedTabActive, feedTabIdle, feedTabStripScroll } from './communityFeedStyles';
import { useCommunityLivePoll, COMMUNITY_INBOX_POLL_MS, COMMUNITY_MESSAGES_POLL_MS, COMMUNITY_FEED_POLL_WS_MS } from './useCommunityLivePoll';
import { useRealtimeStore } from '../../lib/realtime/useRealtimeStore';
import {
  peekCommunityInbox,
  peekCommunityMessages,
  patchConversationAfterSend,
  appendMessageToCache,
  prefetchCommunityMessages,
  peekCommunityBrowseDiscover,
} from '../../lib/communityCache';
import { filterConversationsByPrefix, filterUsersByPrefix } from '../../lib/communitySearch';
import { resolveMediaUrl } from '../../lib/mediaUrl';
import { PresenceAvatarDot } from './PresenceIndicator';
import {
  bumpConversationInList,
  patchConversationInLists,
  sortInboxConversations,
} from './inboxSort';

const POLL_MESSAGES_MS = COMMUNITY_MESSAGES_POLL_MS;
const POLL_INBOX_MS = COMMUNITY_INBOX_POLL_MS;

const STATUS_RANK: Record<MessageDeliveryStatus, number> = { sent: 0, delivered: 1, read: 2 };

function pickBetterStatus(a?: MessageDeliveryStatus, b?: MessageDeliveryStatus): MessageDeliveryStatus | undefined {
  if (!a) return b;
  if (!b) return a;
  return STATUS_RANK[b] >= STATUS_RANK[a] ? b : a;
}

function mergeMessages(prev: CommunityMessage[], incoming: CommunityMessage[]) {
  const byId = new Map(prev.map((m) => [m.id, m]));
  for (const m of incoming) {
    const existing = byId.get(m.id);
    if (existing) {
      byId.set(m.id, {
        ...existing,
        ...m,
        status: pickBetterStatus(existing.status, m.status),
      });
    } else {
      byId.set(m.id, m);
    }
  }
  return Array.from(byId.values()).sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
}

function parseMessagesResponse(data: unknown): { messages: CommunityMessage[]; otherLastReadAt: string | null } {
  if (!data) return { messages: [], otherLastReadAt: null };
  if (Array.isArray(data)) return { messages: data, otherLastReadAt: null };
  if (typeof data === 'object' && data !== null && 'messages' in data) {
    const payload = data as { messages?: CommunityMessage[]; otherLastReadAt?: string | null };
    return { messages: payload.messages ?? [], otherLastReadAt: payload.otherLastReadAt ?? null };
  }
  return { messages: [], otherLastReadAt: null };
}

function applyReadReceipts(messages: CommunityMessage[], otherLastReadAt: string | null): CommunityMessage[] {
  if (!otherLastReadAt) return messages;
  const readAt = new Date(otherLastReadAt).getTime();
  return messages.map((m) => {
    if (!m.isMine || m.status === 'read') return m;
    if (new Date(m.createdAt).getTime() <= readAt) return { ...m, status: 'read' as const };
    return m;
  });
}

function buildOptimisticMessage(
  conversationId: string,
  user: { id: string; email?: string; role?: string; profile?: { displayName?: string; communityAvatarUrl?: string | null } },
  text: string,
): CommunityMessage {
  const now = new Date().toISOString();
  return {
    id: `opt-${Date.now()}`,
    conversationId,
    senderId: user.id,
    messageType: 'text',
    content: text,
    createdAt: now,
    isMine: true,
    status: 'sent',
    sender: {
      id: user.id,
      email: user.email,
      role: user.role,
      profile: user.profile,
    } as CommunityAuthor,
  };
}

/** Collapse duplicate 1:1 threads for the same person (keep the one with messages). */
function dedupeInboxByPerson(list: CommunityConversation[]): CommunityConversation[] {
  const groups: CommunityConversation[] = [];
  const dmByOther = new Map<string, CommunityConversation>();

  for (const c of list) {
    if (c.isGroup) {
      groups.push(c);
      continue;
    }
    const otherId = c.otherUser?.id;
    if (!otherId) continue;

    const existing = dmByOther.get(otherId);
    if (!existing) {
      dmByOther.set(otherId, c);
      continue;
    }

    const aHas = existing.lastMessage ? 1 : 0;
    const bHas = c.lastMessage ? 1 : 0;
    let keep = existing;
    let drop = c;
    if (bHas > aHas || (bHas === aHas && new Date(c.updatedAt) > new Date(existing.updatedAt))) {
      keep = c;
      drop = existing;
    }
    dmByOther.set(otherId, {
      ...keep,
      unreadCount: keep.unreadCount ?? 0,
      isStarred: Boolean(keep.isStarred || drop.isStarred),
      starredAt: keep.starredAt || drop.starredAt || null,
    });
  }

  return sortInboxConversations([...dmByOther.values(), ...groups]);
}

export const CommunityInbox: React.FC = () => {
  const { t } = useI18n();
  const { user } = useAuthStore();
  const { conversationId: urlConversationId, folder: inboxFolder, setInboxParams } = useInboxQueryParams();

  const [primaryList, setPrimaryList] = useState<CommunityConversation[]>(() => peekCommunityInbox('primary') ?? []);
  const [requestsList, setRequestsList] = useState<CommunityConversation[]>(() => peekCommunityInbox('requests') ?? []);
  const [starredMessagesList, setStarredMessagesList] = useState<StarredInboxMessage[]>([]);
  const [starredLoading, setStarredLoading] = useState(false);
  const [loading, setLoading] = useState(() => !peekCommunityInbox('primary') && !peekCommunityInbox('requests'));
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
  const [peopleDirectory, setPeopleDirectory] = useState<CommunityAuthor[]>(
    () => peekCommunityBrowseDiscover() ?? [],
  );
  const peopleSearchGen = useRef(0);

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
  const otherLastReadAtRef = useRef<string | null>(null);
  const markReadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollInFlightRef = useRef(false);
  const listsRef = useRef({
    primary: peekCommunityInbox('primary') ?? ([] as CommunityConversation[]),
    requests: peekCommunityInbox('requests') ?? ([] as CommunityConversation[]),
  });

  const wsOpen = useRealtimeStore((s) => s.connectionState === 'open');
  const subscribe = useRealtimeStore((s) => s.subscribe);
  const inboxPollMs = wsOpen ? COMMUNITY_FEED_POLL_WS_MS : POLL_INBOX_MS;
  const messagesPollMs = wsOpen ? COMMUNITY_FEED_POLL_WS_MS : POLL_MESSAGES_MS;

  const patchInboxAfterSend = useCallback((convId: string, msg: CommunityMessage) => {
    const lastMessage = {
      content: msg.content,
      createdAt: msg.createdAt,
      senderId: msg.senderId,
      isMine: msg.senderId === user?.id,
    };
    patchConversationAfterSend(convId, lastMessage);
    setPrimaryList((list) => bumpConversationInList(list, convId, lastMessage));
    setRequestsList((list) => bumpConversationInList(list, convId, lastMessage));
    listsRef.current = {
      primary: bumpConversationInList(listsRef.current.primary, convId, lastMessage),
      requests: bumpConversationInList(listsRef.current.requests, convId, lastMessage),
    };
  }, [user?.id]);

  const clearUnreadInLists = useCallback((conv: CommunityConversation) => {
    const patch = (list: CommunityConversation[]) =>
      list.map((row) => {
        if (row.id === conv.id) return { ...row, unreadCount: 0 };
        if (!conv.isGroup && !row.isGroup && row.otherUser?.id && row.otherUser.id === conv.otherUser?.id) {
          return { ...row, unreadCount: 0 };
        }
        return row;
      });
    setPrimaryList(patch);
    setRequestsList(patch);
    listsRef.current = {
      primary: patch(listsRef.current.primary),
      requests: patch(listsRef.current.requests),
    };
    setActiveConversation((c) =>
      c && (c.id === conv.id || (!conv.isGroup && c.otherUser?.id === conv.otherUser?.id))
        ? { ...c, unreadCount: 0 }
        : c,
    );
  }, []);

  const scheduleMarkRead = useCallback(
    (id: string, conv?: CommunityConversation | null) => {
      if (conv) clearUnreadInLists(conv);
      if (markReadTimerRef.current) clearTimeout(markReadTimerRef.current);
      markReadTimerRef.current = setTimeout(() => {
        void communityService.markConversationRead(id);
      }, 400);
    },
    [clearUnreadInLists],
  );

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
    const primary = dedupeInboxByPerson(primaryRes.data ?? []);
    const requests = dedupeInboxByPerson(requestsRes.data ?? []);
    const aid = activeIdRef.current;
    const activeConv =
      aid != null
        ? [...primary, ...requests].find((c) => c.id === aid)
        : null;
    const zeroUnreadIfActive = (list: CommunityConversation[]) => {
      if (!aid || !activeConv) return list;
      return list.map((row) => {
        if (row.id === aid) return { ...row, unreadCount: 0 };
        if (
          !activeConv.isGroup &&
          !row.isGroup &&
          row.otherUser?.id &&
          row.otherUser.id === activeConv.otherUser?.id
        ) {
          return { ...row, unreadCount: 0 };
        }
        return row;
      });
    };
    const primaryFinal = zeroUnreadIfActive(primary);
    const requestsFinal = zeroUnreadIfActive(requests);
    setPrimaryList(primaryFinal);
    setRequestsList(requestsFinal);
    listsRef.current = { primary: primaryFinal, requests: requestsFinal };
    void communityService.getStarredMessages().then((res) => {
      if (res.data) setStarredMessagesList(res.data);
    });
    if (!opts?.silent) setLoading(false);

    if (aid) {
      const found = [...primaryFinal, ...requestsFinal].find((c) => c.id === aid);
      if (found) {
        setActiveConversation((prev) => {
          if (prev?.id !== aid) return found;
          return {
            ...prev,
            ...found,
            participants: found.participants?.length ? found.participants : prev.participants,
            participantsCount: found.participantsCount ?? prev.participantsCount,
          };
        });
      }
    }
    return { primary: primaryFinal, requests: requestsFinal };
  }, []);

  const loadStarredMessages = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setStarredLoading(true);
    const res = await communityService.getStarredMessages();
    setStarredMessagesList(res.data ?? []);
    if (!opts?.silent) setStarredLoading(false);
  }, []);

  const conversationForId = useCallback((id: string): CommunityConversation | null => {
    return (
      listsRef.current.primary.find((c) => c.id === id) ??
      listsRef.current.requests.find((c) => c.id === id) ??
      null
    );
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
        const res = await communityService.getMessages(
          id,
          since ? { since } : { fresh: true },
        );
        if (activeIdRef.current !== id) return [];

        if (res.error) {
          if (!opts?.incremental) setMessagesError(res.error);
          return [];
        }

        const { messages: incoming, otherLastReadAt } = parseMessagesResponse(res.data);
        if (otherLastReadAt) otherLastReadAtRef.current = otherLastReadAt;

        const applyReceipts = (list: CommunityMessage[]) =>
          applyReadReceipts(list, otherLastReadAtRef.current);

        if (opts?.incremental && since) {
          setMessages((prev) => applyReceipts(mergeMessages(prev, incoming)));
          for (const m of incoming) {
            if (
              !lastMessageAtRef.current ||
              new Date(m.createdAt).getTime() > new Date(lastMessageAtRef.current).getTime()
            ) {
              lastMessageAtRef.current = m.createdAt;
            }
            if (m.senderId !== user?.id) patchInboxAfterSend(id, m);
          }
          const hasFromOther = incoming.some((m) => m.senderId !== user?.id);
          if (hasFromOther && opts?.markRead !== false) {
            scheduleMarkRead(id, conversationForId(id));
          }
          return incoming;
        }

        setMessages((prev) => {
          const pending = prev.filter((m) => m.id.startsWith('opt-'));
          return applyReceipts(mergeMessages(incoming, pending));
        });
        setMessagesError(null);
        const last = incoming[incoming.length - 1];
        lastMessageAtRef.current = last?.createdAt ?? null;
        pollReadyRef.current = true;

        if (opts?.markRead !== false) scheduleMarkRead(id, conversationForId(id));
        if (!opts?.incremental) {
          void fetchMessages(id, { markRead: true, incremental: true });
        }
        return incoming;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to load messages';
        if (!opts?.incremental) setMessagesError(msg);
        return [];
      } finally {
        if (activeIdRef.current === id && opts?.showLoading) setMessagesLoading(false);
      }
    },
    [scheduleMarkRead, patchInboxAfterSend, user?.id, conversationForId],
  );

  const loadActiveChat = useCallback(
    async (id: string) => {
      const gen = ++chatLoadGenRef.current;
      activeIdRef.current = id;
      setMessagesError(null);

      const cached = peekCommunityMessages(id);
      const hasCachedMessages = Boolean(cached?.messages?.length);
      if (hasCachedMessages) {
        setMessages(cached!.messages);
        const last = cached!.messages[cached!.messages.length - 1];
        lastMessageAtRef.current = last?.createdAt ?? null;
        pollReadyRef.current = true;
        setMessagesLoading(false);
      } else {
        pollReadyRef.current = false;
        lastMessageAtRef.current = null;
        setMessages([]);
        setMessagesLoading(true);
      }

      try {
        const { primary, requests } = listsRef.current;
        let conv = [...primary, ...requests].find((c) => c.id === id);
        if (!conv) {
          const res = await communityService.getConversation(id);
          if (res.error) throw new Error(res.error);
          conv = res.data ?? undefined;
        } else if (conv.isGroup) {
          const res = await communityService.getConversation(id);
          if (res.data) conv = res.data;
        }
        if (!conv) throw new Error(t('community.inboxEmpty'));

        // If this is an empty duplicate thread, open the canonical one with history.
        if (!conv.isGroup && conv.otherUser?.id && !conv.lastMessage) {
          const canonRes = await communityService.startConversation(conv.otherUser.id);
          if (canonRes.data?.id && canonRes.data.id !== conv.id && canonRes.data.lastMessage) {
            if (chatLoadGenRef.current !== gen || activeIdRef.current !== id) return;
            setInboxParams({ c: canonRes.data.id });
            return;
          }
        }

        if (chatLoadGenRef.current !== gen || activeIdRef.current !== id) return;
        setActiveConversation(conv);
        await fetchMessages(id, { markRead: true, showLoading: !hasCachedMessages });
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
      if (inboxFolder === 'starred') await loadStarredMessages({ silent: true });
      if (activeIdRef.current) await loadActiveChat(activeIdRef.current);
    } finally {
      setInboxRefreshing(false);
    }
  }, [loadInbox, loadActiveChat, loadStarredMessages, inboxFolder]);

  useEffect(() => {
    if (inboxFolder === 'starred') void loadStarredMessages();
  }, [inboxFolder, loadStarredMessages]);

  const openGroupInfo = useCallback(async () => {
    const id = activeIdRef.current;
    if (id) {
      const res = await communityService.getConversation(id);
      if (res.data) setActiveConversation(res.data);
    }
    setShowGroupInfo(true);
  }, []);

  useCommunityLivePoll(
    () => {
      communityService.revalidateConversations('primary', (data) => {
        const deduped = dedupeInboxByPerson(data);
        setPrimaryList(deduped);
        listsRef.current = { ...listsRef.current, primary: deduped };
      });
      communityService.revalidateConversations('requests', (data) => {
        const deduped = dedupeInboxByPerson(data);
        setRequestsList(deduped);
        listsRef.current = { ...listsRef.current, requests: deduped };
      });
    },
    inboxPollMs,
    true,
    false,
  );

  useEffect(() => {
    return subscribe('community.message.new', (env) => {
      const conversationId = env.conversationId as string | undefined;
      const message = env.message as CommunityMessage | undefined;
      if (!conversationId || !message?.id) return;

      appendMessageToCache(conversationId, message);
      const isActive = activeIdRef.current === conversationId;
      const lastMessage = {
        content: message.content,
        createdAt: message.createdAt,
        senderId: message.senderId,
        isMine: message.senderId === user?.id,
      };

      const bumpList = (list: CommunityConversation[]) => {
        const idx = list.findIndex((c) => c.id === conversationId);
        if (idx < 0) return list;
        const row = list[idx];
        const fromOther = message.senderId !== user?.id;
        const updated: CommunityConversation = {
          ...row,
          lastMessage,
          updatedAt: message.createdAt,
          unreadCount: isActive || !fromOther ? 0 : (row.unreadCount ?? 0) + 1,
        };
        return sortInboxConversations(list.filter((c) => c.id !== conversationId).concat(updated));
      };

      setPrimaryList(bumpList);
      setRequestsList(bumpList);
      listsRef.current = {
        primary: bumpList(listsRef.current.primary),
        requests: bumpList(listsRef.current.requests),
      };

      if (isActive) {
        setMessages((prev) => {
          const merged = mergeMessages(prev, [message]);
          return applyReadReceipts(merged, otherLastReadAtRef.current);
        });
        lastMessageAtRef.current = message.createdAt;
        if (message.senderId !== user?.id) {
          scheduleMarkRead(conversationId, conversationForId(conversationId));
        }
      }
    });
  }, [subscribe, user?.id, scheduleMarkRead, conversationForId]);

  useEffect(() => {
    return subscribe('community.inbox.read', (env) => {
      const conversationId = env.conversationId as string | undefined;
      const readAt = env.readAt as string | undefined;
      if (!conversationId || !readAt || activeIdRef.current !== conversationId) return;
      otherLastReadAtRef.current = readAt;
      setMessages((prev) => applyReadReceipts(prev, readAt));
    });
  }, [subscribe]);

  useEffect(() => {
    return subscribe('community.inbox.updated', (env) => {
      const conv = env.conversation as CommunityConversation | undefined;
      if (!conv?.id) return;
      const sync = (list: CommunityConversation[]) =>
        sortInboxConversations(list.map((c) => (c.id === conv.id ? { ...c, ...conv } : c)));
      setPrimaryList(sync);
      setRequestsList(sync);
      listsRef.current = {
        primary: sync(listsRef.current.primary),
        requests: sync(listsRef.current.requests),
      };
      if (activeIdRef.current === conv.id) {
        setActiveConversation((prev) => (prev ? { ...prev, ...conv } : conv));
      }
    });
  }, [subscribe]);

  const selectConversation = (c: CommunityConversation) => {
    clearUnreadInLists(c);
    scheduleMarkRead(c.id, c);
    setInboxParams({ c: c.id, folder: c.isMessageRequest ? 'requests' : null });
  };

  useEffect(() => {
    void loadInbox();
  }, [loadInbox]);

  useEffect(() => {
    void communityService.discoverUsers().then((res) => {
      if (res.data?.length) setPeopleDirectory(res.data);
    });
  }, []);

  const searchPeople = useCallback((query: string, onResults: (users: CommunityAuthor[]) => void) => {
    const trimmed = query.trim();
    if (!trimmed) {
      onResults([]);
      return;
    }
    onResults(filterUsersByPrefix(peopleDirectory, trimmed));
    const gen = ++peopleSearchGen.current;
    void communityService.searchUsers(trimmed).then((res) => {
      if (gen !== peopleSearchGen.current) return;
      if (res.data?.length) onResults(res.data);
    });
  }, [peopleDirectory]);

  useEffect(() => {
    searchPeople(newQuery, setSearchResults);
  }, [newQuery, searchPeople]);

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

  useCommunityLivePoll(
    () => {
      if (!activeId || !pollReadyRef.current || pollInFlightRef.current) return;
      pollInFlightRef.current = true;
      void fetchMessages(activeId, { markRead: true, incremental: true }).finally(() => {
        pollInFlightRef.current = false;
      });
    },
    messagesPollMs,
    Boolean(activeId),
    false,
  );

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
    appendMessageToCache(msg.conversationId, msg);
    patchInboxAfterSend(msg.conversationId, msg);
    scrollToBottom(true);
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
    if (!activeId || !draft.trim() || headerConversation?.canSendMessage === false || pendingSend || !user) return;
    const text = draft.trim();
    setDraft('');
    const optimistic = buildOptimisticMessage(activeId, user, text);
    setMessages((m) => mergeMessages(m, [optimistic]));
    patchInboxAfterSend(activeId, optimistic);
    scrollToBottom(true);

    setPendingSend(true);
    const res = await communityService.sendMessage(activeId, { content: text, messageType: 'text' });
    setPendingSend(false);
    if (res.data) {
      setMessages((m) =>
        applyReadReceipts(
          mergeMessages(
            m.filter((x) => x.id !== optimistic.id),
            [res.data!],
          ),
          otherLastReadAtRef.current,
        ),
      );
      lastMessageAtRef.current = res.data.createdAt;
      patchInboxAfterSend(activeId, res.data);
    } else {
      setMessages((m) => m.filter((x) => x.id !== optimistic.id));
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
    setInboxParams({ c: null, folder: inboxFolder === 'requests' ? 'requests' : inboxFolder === 'starred' ? 'starred' : null });
    await loadInbox({ silent: true, fresh: true });
  };

  const leaveConversation = () => {
    setInboxParams({
      c: null,
      folder: inboxFolder === 'requests' ? 'requests' : inboxFolder === 'starred' ? 'starred' : null,
    });
  };

  const switchFolder = (folder: InboxFolder) => {
    setInboxParams({ c: null, folder: folder === 'primary' ? null : folder });
  };

  const openStarredMessage = (row: StarredInboxMessage) => {
    setInboxParams({ c: row.conversation.id, folder: null });
  };

  const toggleMessageStar = useCallback(async (msg: CommunityMessage) => {
    const nextStarred = !msg.isStarred;
    const optimistic = {
      isStarred: nextStarred,
      starredAt: nextStarred ? new Date().toISOString() : null,
    };
    setMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, ...optimistic } : m)));
    setStarredMessagesList((prev) => {
      if (!nextStarred) return prev.filter((row) => row.message.id !== msg.id);
      const conv = activeConversation;
      if (!conv) return prev;
      if (prev.some((row) => row.message.id === msg.id)) {
        return prev.map((row) =>
          row.message.id === msg.id ? { ...row, message: { ...row.message, ...optimistic } } : row,
        );
      }
      return [
        {
          starredAt: optimistic.starredAt!,
          message: { ...msg, ...optimistic },
          conversation: {
            id: conv.id,
            isGroup: conv.isGroup,
            name: conv.name,
            otherUser: conv.otherUser,
          },
        },
        ...prev,
      ];
    });

    const res = nextStarred
      ? await communityService.starMessage(msg.id)
      : await communityService.unstarMessage(msg.id);

    if (res.error || !res.data) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === msg.id ? { ...m, isStarred: msg.isStarred, starredAt: msg.starredAt ?? null } : m,
        ),
      );
      if (inboxFolder === 'starred') void loadStarredMessages({ silent: true });
      return;
    }

    setMessages((prev) => prev.map((m) => (m.id === msg.id ? res.data! : m)));
    if (inboxFolder === 'starred') void loadStarredMessages({ silent: true });
  }, [activeConversation, inboxFolder, loadStarredMessages]);

  const startWithUser = async (userId: string) => {
    const res = await communityService.startConversation(userId);
    if (!res.data) return;
    setShowNew(false);
    setNewQuery('');
    await loadInbox({ silent: true, fresh: true });
    setInboxParams({ c: res.data.id });
  };

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
    searchPeople(groupQuery, setGroupSearchResults);
  }, [groupQuery, searchPeople]);

  const filtered = useMemo(
    () => filterConversationsByPrefix(conversations, search),
    [conversations, search],
  );

  const { starredChats, recentChats } = useMemo(() => {
    if (inboxFolder === 'requests') {
      return { starredChats: [] as CommunityConversation[], recentChats: filtered };
    }
    return {
      starredChats: filtered.filter((c) => c.isStarred),
      recentChats: filtered.filter((c) => !c.isStarred),
    };
  }, [filtered, inboxFolder]);

  const toggleStar = useCallback(async (conv: CommunityConversation, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const nextStarred = !conv.isStarred;
    const optimisticPatch = {
      isStarred: nextStarred,
      starredAt: nextStarred ? new Date().toISOString() : null,
    };
    const apply = (list: CommunityConversation[]) =>
      patchConversationInLists(list, conv.id, optimisticPatch);
    setPrimaryList(apply);
    setRequestsList(apply);
    listsRef.current = {
      primary: apply(listsRef.current.primary),
      requests: apply(listsRef.current.requests),
    };
    setActiveConversation((c) =>
      c?.id === conv.id ? { ...c, ...optimisticPatch } : c,
    );

    const res = nextStarred
      ? await communityService.starConversation(conv.id)
      : await communityService.unstarConversation(conv.id);

    if (res.error || !res.data) {
      const revert = { isStarred: conv.isStarred, starredAt: conv.starredAt ?? null };
      const rollback = (list: CommunityConversation[]) =>
        patchConversationInLists(list, conv.id, revert);
      setPrimaryList(rollback);
      setRequestsList(rollback);
      listsRef.current = {
        primary: rollback(listsRef.current.primary),
        requests: rollback(listsRef.current.requests),
      };
      setActiveConversation((c) => (c?.id === conv.id ? { ...c, ...revert } : c));
      return;
    }

    const sync = (list: CommunityConversation[]) =>
      patchConversationInLists(list, conv.id, {
        isStarred: res.data!.isStarred,
        starredAt: res.data!.starredAt ?? null,
      });
    setPrimaryList(sync);
    setRequestsList(sync);
    listsRef.current = {
      primary: sync(listsRef.current.primary),
      requests: sync(listsRef.current.requests),
    };
    setActiveConversation((c) =>
      c?.id === conv.id
        ? {
            ...c,
            isStarred: res.data!.isStarred,
            starredAt: res.data!.starredAt ?? null,
          }
        : c,
    );
  }, []);

  const headerConversation =
    activeConversation ??
    [...primaryList, ...requestsList].find((c) => c.id === urlConversationId) ??
    null;

  const showChat = Boolean(urlConversationId);

  const chatPanel = showChat && (
    <div className="flex flex-col h-full min-h-[min(70vh,640px)] lg:min-h-0 min-w-0 max-w-full overflow-hidden">
      <button
        type="button"
        onClick={leaveConversation}
        className="lg:hidden flex items-center gap-2 text-muted hover:text-foreground text-sm font-bold mb-3"
      >
        <span className="material-symbols-outlined">arrow_back</span>
        {t('community.backToInbox')}
      </button>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-2 pb-3 border-b border-border shrink-0 min-w-0">
        {headerConversation ? (
          <>
            {/* Avatar / group icon */}
            {headerConversation.isGroup ? (
              <button
                type="button"
                onClick={() => void openGroupInfo()}
                className="relative shrink-0 size-10 sm:size-12 rounded-full bg-primary/20 flex items-center justify-center overflow-hidden hover:ring-2 hover:ring-primary/40 transition"
              >
                {headerConversation.avatarUrl
                  ? <img src={resolveMediaUrl(headerConversation.avatarUrl)} alt="" className="w-full h-full object-cover" />
                  : <span className="material-symbols-outlined text-primary text-xl sm:text-2xl">group</span>
                }
              </button>
            ) : (
              <Link to={communityProfilePath(headerConversation.otherUser?.id)} className="relative shrink-0">
                <UserAvatar
                  avatarUrl={headerConversation.otherUser?.profile?.communityAvatarUrl}
                  displayName={headerConversation.otherUser?.profile?.displayName ?? displayName(headerConversation.otherUser)}
                  email={headerConversation.otherUser?.email}
                  className="size-10 sm:size-12 text-sm sm:text-base"
                  imgClassName="size-10 sm:size-12 rounded-full object-cover"
                  alt={displayName(headerConversation.otherUser)}
                />
                <PresenceAvatarDot isOnline={headerConversation.otherUser?.isOnline} />
              </Link>
            )}

            {/* Name / subtitle */}
            <div className="flex-1 min-w-0">
              {headerConversation.isGroup ? (
                <>
                  <button type="button" onClick={() => void openGroupInfo()} className="font-bold truncate hover:text-primary text-left w-full text-sm sm:text-base">
                    {headerConversation.name ?? 'Group'}
                  </button>
                  <p className="text-[11px] text-muted mt-0.5 cursor-pointer hover:text-primary truncate" onClick={() => void openGroupInfo()}>
                    {headerConversation.participantsCount ?? headerConversation.participants?.length ?? 0} members · tap to view
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

            {/* Accept / Decline (DM requests) — full width row on narrow screens */}
            {!headerConversation.isGroup && headerConversation.isMessageRequest && (
              <div className="flex gap-1.5 shrink-0 w-full sm:w-auto order-last sm:order-none basis-full sm:basis-auto justify-end sm:justify-start">
                <button type="button" onClick={() => acceptRequest(headerConversation.id)} className="px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg bg-primary text-white text-[11px] sm:text-xs font-bold">
                  {t('community.accept')}
                </button>
                <button type="button" onClick={() => declineRequest(headerConversation.id)} className="px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg border border-subtle text-[11px] sm:text-xs font-bold text-muted">
                  {t('community.decline')}
                </button>
              </div>
            )}

            {/* Role badge + star + close */}
            <div className="flex items-center gap-1 shrink-0 ms-auto sm:ms-0">
              {inboxFolder === 'primary' && headerConversation && (
                <button
                  type="button"
                  onClick={() => void toggleStar(headerConversation)}
                  className={`p-1.5 sm:p-2 rounded-xl transition-colors ${
                    headerConversation.isStarred
                      ? 'text-amber-400 bg-amber-400/10'
                      : 'text-muted hover:text-amber-400 hover:bg-elevated'
                  }`}
                  title={
                    headerConversation.isStarred
                      ? t('community.unstarChat')
                      : t('community.starChat')
                  }
                  aria-label={
                    headerConversation.isStarred
                      ? t('community.unstarChat')
                      : t('community.starChat')
                  }
                >
                  <span
                    className="material-symbols-outlined text-xl"
                    style={{ fontVariationSettings: headerConversation.isStarred ? "'FILL' 1" : '' }}
                  >
                    star
                  </span>
                </button>
              )}
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
          <div key={m.id} className={`group/msg flex flex-col ${m.isMine ? 'items-end' : 'items-start'}`}>
            {!m.isMine && headerConversation?.isGroup && m.sender && (
              <p className="text-[10px] text-muted font-semibold mb-0.5 px-1">
                {displayName(m.sender)}
              </p>
            )}
            <div className={`flex items-end gap-1.5 max-w-full ${m.isMine ? 'flex-row-reverse' : ''}`}>
              <button
                type="button"
                onClick={() => void toggleMessageStar(m)}
                className={`shrink-0 p-1 rounded-lg transition-all opacity-0 group-hover/msg:opacity-100 focus:opacity-100 ${
                  m.isStarred
                    ? 'text-amber-400 bg-amber-400/10 opacity-100'
                    : 'text-faint hover:text-amber-400 hover:bg-elevated'
                }`}
                title={m.isStarred ? t('community.unstarMessage') : t('community.starMessage')}
                aria-label={m.isStarred ? t('community.unstarMessage') : t('community.starMessage')}
              >
                <span
                  className="material-symbols-outlined text-[18px]"
                  style={{ fontVariationSettings: m.isStarred ? "'FILL' 1" : '' }}
                >
                  star
                </span>
              </button>
            <div
              className={`max-w-[min(92vw,20rem)] sm:max-w-[85%] rounded-2xl text-[13px] sm:text-sm ${
                m.messageType === 'audio'
                  ? 'px-2 sm:px-3 py-2'
                  : 'px-3 sm:px-4 py-2 sm:py-2.5'
              } ${
                m.isMine
                  ? `bg-primary text-white rounded-br-md ${m.isStarred ? 'ring-1 ring-amber-300/50' : ''}`
                  : `bg-elevated border border-subtle rounded-bl-md ${m.isStarred ? 'ring-1 ring-amber-400/30' : ''}`
              }`}
            >
              {m.messageType === 'image' && m.mediaUrl ? (
                <img src={resolveMediaUrl(m.mediaUrl)} alt="" className="rounded-lg max-w-full mb-1" />
              ) : m.messageType === 'audio' && m.mediaUrl ? (
                <VoiceMessagePlayer
                  src={resolveMediaUrl(m.mediaUrl)}
                  variant={m.isMine ? 'mine' : 'theirs'}
                />
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
                className={`flex items-center justify-end gap-1 ${
                  m.messageType === 'audio' ? 'mt-0.5' : 'mt-1'
                } ${m.isMine ? 'text-white/70' : 'text-faint'}`}
              >
                {m.messageType !== 'audio' && <p className="text-[10px]">{timeAgo(m.createdAt)}</p>}
                {m.isMine && <MessageStatusIcon status={m.status} />}
                {m.isStarred && (
                  <span
                    className={`material-symbols-outlined text-[12px] ${m.isMine ? 'text-amber-200' : 'text-amber-400'}`}
                    style={{ fontVariationSettings: "'FILL' 1" }}
                    aria-hidden
                  >
                    star
                  </span>
                )}
              </div>
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
            <div className="shrink-0 border-t border-border/60 py-2.5 sm:py-3 px-2 sm:px-4 flex items-center justify-center gap-2 text-muted bg-elevated/40 rounded-b-2xl">
              <span className="material-symbols-outlined text-[18px] sm:text-[20px]">lock</span>
              <p className="text-xs sm:text-sm font-medium text-center">Only admins can send messages</p>
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
          <div className="flex flex-col gap-2 min-w-0 sm:flex-row sm:items-center sm:gap-2">
            <div className="flex items-center shrink-0 gap-0">
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
            </div>
            <div className="flex items-center gap-1.5 min-w-0 w-full sm:flex-1">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                placeholder={t('community.messagePlaceholder')}
                className="flex-1 min-w-0 w-0 basis-0 bg-elevated border border-subtle rounded-xl px-3 sm:px-4 py-2.5 sm:py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              <button
                type="button"
                onClick={sendMessage}
                disabled={pendingSend || !draft.trim()}
                aria-label={t('community.message')}
                className="shrink-0 flex-none size-10 sm:size-auto sm:p-2.5 sm:px-5 flex items-center justify-center bg-primary text-white font-bold rounded-xl disabled:opacity-40"
              >
                <span className="material-symbols-outlined text-[22px]">send</span>
              </button>
            </div>
          </div>
        </div>
        );
      })()}
    </div>
  );

  const renderConversationRow = (c: CommunityConversation) => (
    <button
      key={c.id}
      type="button"
      onClick={() => selectConversation(c)}
      onMouseEnter={() => prefetchCommunityMessages(c.id)}
      onFocus={() => prefetchCommunityMessages(c.id)}
      className={`w-full text-left p-3 sm:p-4 flex gap-2.5 sm:gap-3 transition-all min-w-0 ${
        activeId === c.id
          ? `${feedPanel} ring-2 ring-primary/40`
          : `${feedPanel} hover:ring-1 hover:ring-primary/30`
      } ${c.isStarred ? 'ring-1 ring-amber-400/25' : ''}`}
    >
      {c.isGroup ? (
        <div className="relative shrink-0 size-12 sm:size-14 rounded-full bg-primary/20 flex items-center justify-center overflow-hidden">
          {c.avatarUrl
            ? <img src={resolveMediaUrl(c.avatarUrl)} alt="" className="w-full h-full object-cover" />
            : <span className="material-symbols-outlined text-primary text-2xl sm:text-3xl">group</span>
          }
        </div>
      ) : (
        <Link
          to={communityProfilePath(c.otherUser?.id)}
          onClick={(e) => e.stopPropagation()}
          className="relative shrink-0"
        >
          <UserAvatar
            avatarUrl={c.otherUser?.profile?.communityAvatarUrl}
            displayName={c.otherUser?.profile?.displayName ?? displayName(c.otherUser)}
            email={c.otherUser?.email}
            className="size-12 sm:size-14 text-base sm:text-lg"
            imgClassName="size-12 sm:size-14 rounded-full object-cover"
            alt={displayName(c.otherUser)}
          />
          <PresenceAvatarDot isOnline={c.otherUser?.isOnline} className="size-3.5" />
        </Link>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-start gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {c.isStarred && (
              <span
                className="material-symbols-outlined text-amber-400 text-base shrink-0"
                style={{ fontVariationSettings: "'FILL' 1" }}
                aria-hidden
              >
                star
              </span>
            )}
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
        <p className="text-xs sm:text-sm text-muted truncate mt-0.5 sm:mt-1">
          {c.lastMessage?.isMine ? `${t('community.you')}: ` : ''}
          {c.lastMessage?.content ?? t('community.noMessagesYet')}
        </p>
      </div>
      <div className="flex flex-col items-center gap-1.5 shrink-0">
        {inboxFolder === 'primary' && (
          <button
            type="button"
            onClick={(e) => void toggleStar(c, e)}
            className={`p-1 rounded-lg transition-colors ${
              c.isStarred ? 'text-amber-400 bg-amber-400/10' : 'text-faint hover:text-amber-400 hover:bg-elevated'
            }`}
            title={c.isStarred ? t('community.unstarChat') : t('community.starChat')}
            aria-label={c.isStarred ? t('community.unstarChat') : t('community.starChat')}
          >
            <span
              className="material-symbols-outlined text-[18px]"
              style={{ fontVariationSettings: c.isStarred ? "'FILL' 1" : '' }}
            >
              star
            </span>
          </button>
        )}
        {c.unreadCount > 0 && (
          <span className="size-6 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center">
            {c.unreadCount}
          </span>
        )}
      </div>
    </button>
  );

  const listPanel = (
    <div className={`${communityPageClass} w-full min-w-0 max-w-full overflow-x-hidden ${showChat ? 'hidden lg:flex lg:flex-col lg:min-w-0' : 'flex flex-col'}`}>
      <div className={`${feedPanel} p-3 sm:p-4 shrink-0 ${showChat ? 'space-y-2' : 'flex flex-wrap items-center justify-between gap-x-3 gap-y-2'}`}>
        {showChat ? (
          <>
            <div className="flex items-center justify-between gap-2 min-w-0">
              <h1 className="text-lg font-black truncate min-w-0">{t('community.inboxTitle')}</h1>
              <div className="flex items-center gap-1.5 shrink-0">
                <CommunityRefreshButton onRefresh={refreshInbox} refreshing={inboxRefreshing} disabled={loading} />
                <button
                  type="button"
                  onClick={() => setShowNew(true)}
                  aria-label={t('community.newMessage')}
                  title={t('community.newMessage')}
                  className="shrink-0 flex items-center justify-center size-9 bg-primary text-white rounded-full"
                >
                  <span className="material-symbols-outlined text-lg">edit</span>
                </button>
              </div>
            </div>
            <p className="text-muted text-xs truncate">
              {unreadTotal > 0
                ? t('community.inboxUnread').replace('{count}', String(unreadTotal))
                : t('community.inboxAllRead')}
            </p>
          </>
        ) : (
          <>
            <div className="min-w-0 flex-1 basis-full sm:basis-auto">
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-black truncate">{t('community.inboxTitle')}</h1>
              <p className="text-muted text-xs sm:text-sm mt-0.5 truncate">
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
          </>
        )}
      </div>

      <div className={feedTabStripScroll}>
        <button
          type="button"
          onClick={() => switchFolder('primary')}
          className={inboxFolder === 'primary' ? feedTabActive : feedTabIdle}
        >
          {t('community.inboxPrimary')}
        </button>
        <button
          type="button"
          onClick={() => switchFolder('requests')}
          className={`relative ${inboxFolder === 'requests' ? feedTabActive : feedTabIdle}`}
        >
          {t('community.inboxRequests')}
          {requestCount > 0 && inboxFolder !== 'requests' && (
            <span className="absolute -top-1 -right-1 size-4 sm:size-5 rounded-full bg-red-500 text-white text-[9px] sm:text-[10px] flex items-center justify-center">
              {requestCount}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => switchFolder('starred')}
          className={`relative ${inboxFolder === 'starred' ? feedTabActive : feedTabIdle}`}
        >
          {t('community.inboxStarredMessages')}
          {starredMessagesList.length > 0 && inboxFolder !== 'starred' && (
            <span className="absolute -top-1 -right-1 size-4 sm:size-5 rounded-full bg-amber-500 text-white text-[9px] sm:text-[10px] flex items-center justify-center">
              {starredMessagesList.length > 9 ? '9+' : starredMessagesList.length}
            </span>
          )}
        </button>
      </div>

      {inboxFolder !== 'starred' && (
      <div className={`relative ${feedPanel} p-2.5 sm:p-3 min-w-0`}>
        <span className="material-symbols-outlined absolute left-5 sm:left-7 top-1/2 -translate-y-1/2 text-faint text-[20px]">search</span>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('community.inboxSearch')}
          className="w-full min-w-0 bg-transparent rounded-xl pl-10 sm:pl-12 pr-3 sm:pr-4 py-2.5 sm:py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 ring-1 ring-inset ring-white/[0.06]"
        />
      </div>
      )}

      {(inboxFolder === 'starred' ? starredLoading : loading) && (
        <CommunityLoader icon="inbox" className="py-8" />
      )}
      {inboxFolder === 'starred' ? (
        <>
          {!starredLoading && starredMessagesList.length === 0 && (
            <div className={`${feedPanel} p-6 sm:p-10 text-center text-muted text-sm`}>
              {t('community.starredMessagesEmpty')}
            </div>
          )}
          <div className="space-y-2 flex-1 overflow-y-auto custom-scrollbar">
            {starredMessagesList.map((row) => (
              <button
                key={row.message.id}
                type="button"
                onClick={() => openStarredMessage(row)}
                className={`w-full text-left p-3 sm:p-4 flex gap-2.5 sm:gap-3 transition-all min-w-0 ${feedPanel} hover:ring-1 hover:ring-amber-400/30`}
              >
                <span
                  className="material-symbols-outlined text-amber-400 shrink-0 mt-1"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  star
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start gap-2">
                    <span className="font-bold truncate text-sm">
                      {row.conversation.isGroup
                        ? (row.conversation.name ?? 'Group')
                        : displayName(row.conversation.otherUser)}
                    </span>
                    <span className="text-xs text-faint shrink-0">{timeAgo(row.starredAt)}</span>
                  </div>
                  <p className="text-xs sm:text-sm text-muted truncate mt-0.5">
                    {row.message.messageType === 'audio'
                      ? t('community.voiceMessage')
                      : row.message.content}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </>
      ) : (
        <>
      {!loading && filtered.length === 0 && (
        <div className={`${feedPanel} p-6 sm:p-10 text-center text-muted text-sm`}>{t('community.inboxEmpty')}</div>
      )}

      <div className="space-y-2 flex-1 overflow-y-auto custom-scrollbar">
        {starredChats.length > 0 && (
          <div className="space-y-2">
            <p className="px-1 text-[11px] font-black uppercase tracking-wider text-amber-400/90">
              {t('community.inboxStarred')}
            </p>
            {starredChats.map(renderConversationRow)}
          </div>
        )}
        {recentChats.length > 0 && (
          <div className="space-y-2">
            {starredChats.length > 0 && (
              <p className="px-1 pt-1 text-[11px] font-black uppercase tracking-wider text-muted">
                {t('community.inboxRecent')}
              </p>
            )}
            {recentChats.map(renderConversationRow)}
          </div>
        )}
      </div>
        </>
      )}
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`w-full min-w-0 max-w-full overflow-x-hidden ${
        showChat ? 'lg:grid lg:grid-cols-[minmax(260px,340px)_1fr] lg:gap-6 lg:items-stretch' : 'max-w-2xl mx-auto'
      }`}
    >
      {listPanel}
      {showChat ? (
        <motion.div
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          className={`${feedPanel} p-3 sm:p-5 flex flex-col min-h-[min(70vh,640px)] lg:min-h-[520px] w-full min-w-0 max-w-full overflow-hidden`}
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
                    <UserAvatar
                      avatarUrl={u.profile?.communityAvatarUrl}
                      displayName={u.profile?.displayName ?? displayName(u)}
                      email={u.email}
                      className="size-10 text-sm"
                      imgClassName="size-10 rounded-full object-cover"
                      alt={displayName(u)}
                    />
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
                        <UserAvatar
                          avatarUrl={u.profile?.communityAvatarUrl}
                          displayName={u.profile?.displayName ?? displayName(u)}
                          email={u.email}
                          className="size-9 text-xs shrink-0"
                          imgClassName="size-9 rounded-full object-cover shrink-0"
                          alt={displayName(u)}
                        />
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
