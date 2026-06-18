import { test as base } from '@playwright/test';
import { newBootId } from '../helpers/auth';

/** Fresh browser context per test — no leaked auth, lang, or sessionStorage markers. */
export const isolatedTest = base.extend<{ bootId: string }>({
  context: async ({ browser }, use) => {
    const context = await browser.newContext({ acceptDownloads: true });
    await use(context);
    await context.close();
  },
  page: async ({ context }, use) => {
    const page = await context.newPage();
    await use(page);
  },
  bootId: async ({}, use) => {
    await use(newBootId());
  },
});
