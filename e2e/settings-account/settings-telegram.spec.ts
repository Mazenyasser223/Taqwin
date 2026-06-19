import { test, expect } from '../fixtures/settings.fixture';
import {
  emitTestNotification,
  fetchNotifications,
  fetchSettings,
  mockTelegramLink,
} from '../helpers/api-client';
import { reloadSettings, waitForSavingDone } from '../helpers/auth';

test.describe('Settings E2E — Telegram', () => {
  test('enable/disable, link/unlink, collapse, preview, test notification', async ({ page, session }) => {
    await mockTelegramLink(session.userId);
    await reloadSettings(page);

    await expect(page.getByTestId('telegram-unlink')).toBeVisible();
    const enabledToggle = page.getByTestId('telegram-enabled');
    await expect(enabledToggle).toHaveAttribute('aria-checked', 'true');

    await enabledToggle.click();
    await waitForSavingDone(page);
    await expect(enabledToggle).toHaveAttribute('aria-checked', 'false');

    let snapshot = await fetchSettings(session.userId);
    expect(snapshot.settings?.telegramEnabled).toBe(false);

    await enabledToggle.click();
    await waitForSavingDone(page);

    const expandBtn = page.getByTestId('telegram-expand');
    await expandBtn.click();
    await expect(page.getByTestId('telegram-security-row')).toBeHidden();

    await expandBtn.click();
    await expect(page.getByTestId('telegram-security-row')).toBeVisible();

    await page.getByRole('button', { name: 'Preview', exact: true }).first().click();
    await expect(page.getByTestId('telegram-preview-modal')).toBeVisible();
    await page.getByRole('button', { name: 'Close', exact: true }).click();
    await expect(page.getByTestId('telegram-preview-modal')).toBeHidden();

    const testBtn = page.getByTestId('telegram-test');
    await testBtn.click();
    await expect
      .poll(async () => {
        const success = page.getByText('Test notification sent', { exact: false });
        const error = page.locator('[data-testid="telegram-section"] .text-red-500');
        return (await success.isVisible()) || (await error.isVisible());
      })
      .toBe(true);

    await page.getByTestId('telegram-unlink').click();
    await waitForSavingDone(page);
    await expect(page.getByTestId('telegram-connect')).toBeVisible();

    snapshot = await fetchSettings(session.userId);
    expect(snapshot.telegramLinked).toBe(false);
  });

  test('notification drawer flow: emit → read → refresh persists', async ({ page, session }) => {
    test.setTimeout(75_000);
    await mockTelegramLink(session.userId);
    await reloadSettings(page);

    await expect(page.getByTestId('telegram-enabled')).toHaveAttribute('aria-checked', 'true');

    const uniqueTitle = `E2E Flow ${Date.now()}`;
    await emitTestNotification(session.userId, {
      type: 'system.e2e_flow',
      title: uniqueTitle,
      message: 'End-to-end notification flow verification.',
      priority: 'HIGH',
    });

    await expect
      .poll(async () => {
        const rows = await fetchNotifications(session.userId);
        return rows.some((r) => r.title === uniqueTitle);
      })
      .toBe(true);

    await page.goto('/#/dashboard');
    const listResponse = page.waitForResponse(
      (r) => r.url().includes('/api/notifications') && r.request().method() === 'GET' && r.ok(),
    );
    await page.getByTestId('notification-bell').click();
    await listResponse;
    await expect(page.getByTestId('notification-drawer')).toBeVisible();

    const item = page.getByTestId('notification-item').filter({ hasText: uniqueTitle });
    await expect(item).toBeVisible({ timeout: 20_000 });

    const readResponse = page.waitForResponse(
      (r) => /\/api\/notifications\/[^/]+\/read$/.test(r.url()) && r.request().method() === 'POST',
    );
    await item.getByTestId('notification-mark-read').click();
    expect((await readResponse).ok()).toBeTruthy();

    await expect
      .poll(async () => {
        const rows = await fetchNotifications(session.userId);
        return rows.find((n) => n.title === uniqueTitle)?.read;
      })
      .toBe(true);

    await page.reload({ waitUntil: 'domcontentloaded' });

    await expect
      .poll(
        async () => {
          const rows = await fetchNotifications(session.userId);
          return rows.find((n) => n.title === uniqueTitle)?.read === true;
        },
        { timeout: 20_000 },
      )
      .toBe(true);
  });
});
