import { E2eSession, resetSettingsUser } from '../helpers/api-client';
import { openSettingsAsUser } from '../helpers/auth';
import { isolatedTest } from './isolated.fixture';

export const test = isolatedTest.extend<{ session: E2eSession }>({
  session: async ({ page, bootId }, use) => {
    const session = await resetSettingsUser();
    await openSettingsAsUser(page, session, bootId);
    await use(session);
  },
  // Ensure auth + settings navigation even when a test only destructures `{ page }`.
  _settingsBoot: [
    async ({ session }, use) => {
      void session;
      await use();
    },
    { auto: true },
  ],
});

export { expect } from '@playwright/test';
