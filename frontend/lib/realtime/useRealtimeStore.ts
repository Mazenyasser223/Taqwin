import { create } from 'zustand';
import { getAuthToken } from '../authStorage';
import { getWsUrl } from './wsUrl';

export type RealtimeConnectionState = 'idle' | 'connecting' | 'open' | 'closed';

export type RealtimeEnvelope = {
  type: string;
  ts?: number;
  [key: string]: unknown;
};

type Handler = (envelope: RealtimeEnvelope) => void;

interface RealtimeState {
  connectionState: RealtimeConnectionState;
  lastError: string | null;
  connect: () => void;
  disconnect: () => void;
  send: (envelope: Record<string, unknown>) => boolean;
  subscribe: (type: string, handler: Handler) => () => void;
  subscribeAll: (handler: Handler) => () => void;
}

let socket: WebSocket | null = null;
let pingTimer: ReturnType<typeof setInterval> | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let intentionalClose = false;

const typeHandlers = new Map<string, Set<Handler>>();
const allHandlers = new Set<Handler>();

function dispatch(envelope: RealtimeEnvelope) {
  const type = envelope.type;
  if (type) {
    const set = typeHandlers.get(type);
    if (set) {
      for (const fn of set) fn(envelope);
    }
  }
  for (const fn of allHandlers) fn(envelope);
}

function clearTimers() {
  if (pingTimer) {
    clearInterval(pingTimer);
    pingTimer = null;
  }
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
}

function scheduleReconnect(connectFn: () => void) {
  if (intentionalClose || reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connectFn();
  }, 3000);
}

export const useRealtimeStore = create<RealtimeState>((set, get) => ({
  connectionState: 'idle',
  lastError: null,

  connect: () => {
    if (typeof window === 'undefined') return;
    if (socket?.readyState === WebSocket.OPEN || socket?.readyState === WebSocket.CONNECTING) return;

    const token = getAuthToken();
    if (!token) {
      set({ connectionState: 'idle', lastError: null });
      return;
    }

    intentionalClose = false;
    set({ connectionState: 'connecting', lastError: null });

    const url = getWsUrl();
    try {
      socket = new WebSocket(url);
    } catch (err) {
      set({
        connectionState: 'closed',
        lastError: err instanceof Error ? err.message : 'WebSocket failed',
      });
      scheduleReconnect(() => get().connect());
      return;
    }

    socket.onopen = () => {
      set({ connectionState: 'open', lastError: null });
      socket?.send(JSON.stringify({ type: 'auth', token }));
      pingTimer = setInterval(() => {
        if (socket?.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ type: 'ping' }));
        }
      }, 25000);
    };

    socket.onmessage = (ev) => {
      try {
        const envelope = JSON.parse(String(ev.data)) as RealtimeEnvelope;
        dispatch(envelope);
      } catch {
        /* ignore malformed */
      }
    };

    socket.onclose = () => {
      clearTimers();
      socket = null;
      set({ connectionState: 'closed' });
      if (!intentionalClose) scheduleReconnect(() => get().connect());
    };

    socket.onerror = () => {
      set({ lastError: 'WebSocket error' });
    };
  },

  disconnect: () => {
    intentionalClose = true;
    clearTimers();
    if (socket) {
      socket.close();
      socket = null;
    }
    set({ connectionState: 'idle', lastError: null });
  },

  send: (envelope) => {
    if (socket?.readyState !== WebSocket.OPEN) return false;
    socket.send(JSON.stringify(envelope));
    return true;
  },

  subscribe: (type, handler) => {
    let set = typeHandlers.get(type);
    if (!set) {
      set = new Set();
      typeHandlers.set(type, set);
    }
    set.add(handler);
    return () => {
      set?.delete(handler);
      if (set?.size === 0) typeHandlers.delete(type);
    };
  },

  subscribeAll: (handler) => {
    allHandlers.add(handler);
    return () => allHandlers.delete(handler);
  },
}));

export function isRealtimeOpen(): boolean {
  return useRealtimeStore.getState().connectionState === 'open';
}

/** Connect if needed and wait until WebSocket is open (coach chat is WS-only). */
export async function ensureRealtimeReady(timeoutMs = 8000): Promise<boolean> {
  const store = useRealtimeStore.getState();
  if (store.connectionState === 'open') return true;

  if (store.connectionState === 'idle' || store.connectionState === 'closed') {
    store.connect();
  }

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (useRealtimeStore.getState().connectionState === 'open') return true;
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  return useRealtimeStore.getState().connectionState === 'open';
}
