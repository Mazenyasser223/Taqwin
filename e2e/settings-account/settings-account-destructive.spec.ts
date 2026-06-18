import { test, expect } from '../fixtures/destructive.fixture';
import { generateSync } from 'otplib';
import { enable2fa, fetchSettings, mockTelegramLink, setup2fa } from '../helpers/api-client';
import { reloadSettings, waitForSavingDone } from '../helpers/auth';

test.describe('Settings E2E — Account (destructive)', () => {
  test('change password forces re-login', async ({ page, session }) => {
    const dialog = page.getByRole('dialog');
    await page.getByTestId('settings-password-manage').click();
    await dialog.locator('input[type="password"]').first().fill(session.password);
    await dialog.getByRole('button', { name: 'Continue', exact: true }).click();
    await dialog.locator('input[type="password"]').nth(0).fill('E2eNewPass1!');
    await dialog.locator('input[type="password"]').nth(1).fill('E2eNewPass1!');
    await dialog.getByRole('button', { name: 'Update password', exact: true }).click();

    await expect(dialog.getByText('Sign in again with your new password', { exact: false })).toBeVisible({
      timeout: 10_000,
    });
    await dialog.getByRole('button', { name: 'Logout', exact: true }).click();
    await expect(page).toHaveURL(/#\/(login|landing|$)/);
  });

  test('change email dialog opens and validates', async ({ page, session }) => {
    const dialog = page.getByRole('dialog');
    await page.getByTestId('settings-email-manage').click();
    await expect(dialog).toBeVisible();
    await dialog.getByPlaceholder('New email address').fill('not-an-email');
    await dialog.locator('input[type="password"]').fill(session.password);
    await dialog.getByRole('button', { name: 'Continue', exact: true }).click();
    await expect(dialog.locator('input[type="email"]:invalid')).toHaveCount(1);
  });

  test('enable and disable 2FA', async ({ page, session }) => {
    const { secret } = await setup2fa(session.token);
    const code = generateSync({ secret });
    await enable2fa(session.token, code);

    await page.getByTestId('settings-2fa-manage').click();
    await expect(page.getByText('Enter your code and password to disable 2FA', { exact: false })).toBeVisible();

    const disableCode = generateSync({ secret });
    await page.getByPlaceholder('6-digit code').fill(disableCode);
    await page.locator('input[type="password"]').fill(session.password);
    await page.getByRole('button', { name: 'Disable 2FA', exact: true }).click();
    await waitForSavingDone(page);
    await expect(page.getByRole('dialog')).toBeHidden();
  });

  test('logout clears session', async ({ page }) => {
    await page.getByTestId('settings-logout').click();
    await expect(page).toHaveURL(/#\/(login|landing|$)/);

    const token = await page.evaluate(() => localStorage.getItem('taqwin_token'));
    expect(token).toBeNull();
  });

  test('delete account removes user', async ({ page, session }) => {
    await page.getByTestId('settings-delete').click();
    const dialog = page.getByRole('dialog');
    await dialog.locator('input[type="password"]').fill(session.password);
    await expect(dialog.getByRole('button', { name: 'Delete my account', exact: true })).toBeEnabled();

    const deleteResponse = page.waitForResponse(
      (r) =>
        r.url().includes('/api/settings/account') &&
        r.request().method() === 'DELETE' &&
        r.ok(),
    );
    await dialog.getByRole('button', { name: 'Delete my account', exact: true }).click();
    await deleteResponse;
    await expect(page).toHaveURL(/#\/(login|landing|$)/, { timeout: 15_000 });
  });

  test('telegram unlink on disposable user', async ({ page, session }) => {
    await mockTelegramLink(session.userId);
    await reloadSettings(page);
    const unlinkBtn = page.getByTestId('telegram-unlink');
    await expect(unlinkBtn).toBeVisible({ timeout: 15_000 });
    await expect(unlinkBtn).toBeEnabled();

    const unlinkResponse = page.waitForResponse(
      (r) => r.url().includes('/api/settings/telegram/unlink') && r.request().method() === 'DELETE',
      { timeout: 30_000 },
    );
    await unlinkBtn.click({ force: true });
    const response = await unlinkResponse;
    expect(response.ok(), `unlink HTTP ${response.status()}`).toBeTruthy();

    await expect.poll(async () => (await fetchSettings(session.userId)).telegramLinked).toBe(false);

    await reloadSettings(page);
    await expect(page.getByTestId('telegram-connect')).toBeVisible({ timeout: 15_000 });
  });
});
