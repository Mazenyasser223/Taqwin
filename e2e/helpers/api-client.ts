import { APIRequestContext, request } from '@playwright/test';

const backendBase = process.env.E2E_BACKEND_URL || 'http://127.0.0.1:4001';
const e2eSecret = process.env.E2E_SECRET || 'e2e-dev-secret-change-me';

export type E2eSession = {
  userId: string;
  email: string;
  password: string;
  token: string;
  role: string;
};

export type E2eSettingsSnapshot = {
  settings: Record<string, unknown> | null;
  telegramLinked: boolean;
  twoFactorEnabled: boolean;
};

export type E2eNotificationRow = {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  readAt: string | null;
  createdAt: string;
};

let sharedCtx: APIRequestContext | null = null;

export async function getE2eApi(): Promise<APIRequestContext> {
  if (!sharedCtx) {
    sharedCtx = await request.newContext({
      extraHTTPHeaders: { 'x-e2e-secret': e2eSecret },
    });
  }
  return sharedCtx;
}

export async function resetSettingsUser(): Promise<E2eSession> {
  const api = await getE2eApi();
  const res = await api.post(`${backendBase}/api/internal/e2e/ensure-user`);
  if (!res.ok()) throw new Error(`ensure-user failed: ${await res.text()}`);
  const session = (await res.json()) as E2eSession;
  await warmupGamification(session.token);
  return session;
}

/** First gamification/me can take 10–20s (daily score compute). Warm cache before UI tests. */
export async function warmupGamification(token: string) {
  const api = await authApi(token);
  try {
    const res = await api.get(`${backendBase}/api/gamification/me`, { timeout: 120_000 });
    if (!res.ok()) {
      throw new Error(`gamification warmup failed: ${res.status()} ${await res.text()}`);
    }
  } finally {
    await api.dispose();
  }
}

export async function fetchSettings(userId: string): Promise<E2eSettingsSnapshot> {
  const api = await getE2eApi();
  const res = await api.get(`${backendBase}/api/internal/e2e/settings/${userId}`);
  if (!res.ok()) throw new Error(`fetchSettings failed: ${await res.text()}`);
  return res.json();
}

export async function mockTelegramLink(userId: string, chatId?: string) {
  const api = await getE2eApi();
  const res = await api.post(`${backendBase}/api/internal/e2e/mock-telegram-link`, {
    data: { userId, chatId: chatId ?? `e2e-telegram-${userId.slice(0, 8)}` },
  });
  if (!res.ok()) throw new Error(`mockTelegramLink failed: ${await res.text()}`);
  return res.json();
}

export async function emitTestNotification(
  userId: string,
  payload: { type: string; title: string; message: string; priority?: string },
) {
  const api = await getE2eApi();
  const res = await api.post(`${backendBase}/api/internal/e2e/emit-notification`, {
    data: { userId, link: '/dashboard', priority: 'NORMAL', ...payload },
  });
  if (!res.ok()) throw new Error(`emitTestNotification failed: ${await res.text()}`);
  return res.json();
}

export async function fetchNotifications(userId: string): Promise<E2eNotificationRow[]> {
  const api = await getE2eApi();
  const res = await api.get(`${backendBase}/api/internal/e2e/notifications/${userId}`);
  if (!res.ok()) throw new Error(`fetchNotifications failed: ${await res.text()}`);
  const body = await res.json();
  return body.notifications as E2eNotificationRow[];
}

export async function createDisposableUser(suffix?: number): Promise<E2eSession> {
  const api = await getE2eApi();
  const res = await api.post(`${backendBase}/api/internal/e2e/disposable-user`, {
    data: { suffix },
  });
  if (!res.ok()) throw new Error(`createDisposableUser failed: ${await res.text()}`);
  return res.json();
}

export async function deleteDisposableUser(userId: string) {
  const api = await getE2eApi();
  const res = await api.delete(`${backendBase}/api/internal/e2e/disposable-user/${userId}`);
  if (!res.ok()) throw new Error(`deleteDisposableUser failed: ${await res.text()}`);
}

export async function authApi(token: string): Promise<APIRequestContext> {
  return request.newContext({
    extraHTTPHeaders: { Authorization: `Bearer ${token}` },
  });
}

export async function setup2fa(token: string): Promise<{ secret: string }> {
  const api = await authApi(token);
  const res = await api.post(`${backendBase}/api/settings/account/2fa/setup`);
  if (!res.ok()) throw new Error(`setup2fa failed: ${await res.text()}`);
  const body = await res.json();
  await api.dispose();
  return body;
}

export async function enable2fa(token: string, totp: string) {
  const api = await authApi(token);
  const res = await api.post(`${backendBase}/api/settings/account/2fa/enable`, {
    data: { token: totp },
  });
  if (!res.ok()) throw new Error(`enable2fa failed: ${await res.text()}`);
  await api.dispose();
}

export async function disable2fa(token: string, totp: string, currentPassword: string) {
  const api = await authApi(token);
  const res = await api.post(`${backendBase}/api/settings/account/2fa/disable`, {
    data: { token: totp, currentPassword },
  });
  if (!res.ok()) throw new Error(`disable2fa failed: ${await res.text()}`);
  await api.dispose();
}
