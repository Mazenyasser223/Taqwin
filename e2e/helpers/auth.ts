import { expect, type Page } from '@playwright/test';
import type { E2eSession } from './api-client';

/** Client keys cleared once per test boot (before React reads them). */
export const CLIENT_PREF_KEYS = ['taqwin_lang', 'taqwin_theme', 'taqwin_timezone'] as const;

/**
 * Inject auth + clean prefs via addInitScript — runs before any page JS on first navigation per bootId.
 * Never call page.evaluate for login after the app has loaded.
 */
export async function bootstrapPageAuth(
  page: Page,
  session: E2eSession,
  bootId: string,
  language: 'en' | 'ar' = 'en',
) {
  await page.addInitScript(
    ({ token, user, bootId: id, lang, keysToClear }) => {
      const marker = `taqwin_e2e_boot:${id}`;
      if (sessionStorage.getItem(marker)) return;
      sessionStorage.setItem(marker, '1');

      for (const key of keysToClear) localStorage.removeItem(key);
      localStorage.removeItem('taqwin_token');
      localStorage.removeItem('taqwin_user');

      localStorage.setItem('taqwin_remember_me', '1');
      localStorage.setItem('taqwin_lang', lang);
      localStorage.setItem('taqwin_token', token);
      localStorage.setItem(
        'taqwin_user',
        JSON.stringify({
          id: user.id,
          email: user.email,
          role: user.role,
          hasPassword: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }),
      );
      localStorage.setItem(`taqwin_tour_done:${user.id}:app-onboarding-v6`, '1');
    },
    {
      bootId,
      lang: language,
      keysToClear: [...CLIENT_PREF_KEYS],
      token: session.token,
      user: { id: session.userId, email: session.email, role: session.role },
    },
  );
}

export async function gotoSettings(page: Page) {
  await page.goto('/#/settings', { waitUntil: 'domcontentloaded' });
  await page.getByTestId('settings-page').waitFor({ state: 'visible', timeout: 45_000 });
}

/** Wait until settings + auth APIs finish so conditional sections render. */
export async function waitForSettingsHydrated(page: Page) {
  await page.getByTestId('settings-language').waitFor({ state: 'visible', timeout: 15_000 });
  await page.getByTestId('settings-export').scrollIntoViewIfNeeded();
}

export async function waitForGamificationSection(page: Page) {
  await expect(page.getByTestId('compete-league-opt-in')).toBeVisible({ timeout: 45_000 });
  await page.getByTestId('compete-league-opt-in').scrollIntoViewIfNeeded();
}

export async function scrollToTestId(page: Page, testId: string) {
  const el = page.getByTestId(testId);
  await el.scrollIntoViewIfNeeded();
  await expect(el).toBeVisible();
}

export async function openSettingsAsUser(page: Page, session: E2eSession, bootId: string) {
  await bootstrapPageAuth(page, session, bootId, 'en');
  await gotoSettings(page);
  await page.getByTestId('settings-language').waitFor({ state: 'visible', timeout: 15_000 });
}

export async function waitForSavingDone(page: Page) {
  const saving = page.getByText(/Saving|جاري الحفظ/);
  if (await saving.isVisible().catch(() => false)) {
    await saving.waitFor({ state: 'hidden', timeout: 15_000 });
  }
  await page.waitForTimeout(300);
}

export async function reloadSettings(page: Page) {
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByTestId('settings-page').waitFor({ state: 'visible', timeout: 45_000 });
  await page.getByTestId('settings-language').waitFor({ state: 'visible', timeout: 15_000 });
}

export async function setClientLanguage(page: Page, language: 'en' | 'ar') {
  await page.evaluate((lang) => localStorage.setItem('taqwin_lang', lang), language);
}

export function newBootId(prefix = 'boot') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
