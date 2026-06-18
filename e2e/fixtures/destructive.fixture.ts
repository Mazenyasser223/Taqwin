import { createDisposableUser, deleteDisposableUser, E2eSession } from '../helpers/api-client';
import { openSettingsAsUser } from '../helpers/auth';
import { isolatedTest } from './isolated.fixture';

/** One disposable user per test — safe for password / logout / delete flows. */
export const test = isolatedTest.extend<{ session: E2eSession }>({
  session: async ({ page, bootId }, use) => {
    const session = await createDisposableUser(Date.now());
    try {
      await openSettingsAsUser(page, session, bootId);
      await use(session);
    } finally {
      await deleteDisposableUser(session.userId).catch(() => undefined);
    }
  },
  _destructiveBoot: [
    async ({ session }, use) => {
      void session;
      await use();
    },
    { auto: true },
  ],
});

export { expect } from '@playwright/test';
