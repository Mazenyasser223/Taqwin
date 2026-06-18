import { test, expect } from '../fixtures/settings.fixture';

test.describe('Settings E2E — Account (safe)', () => {
  test('phone number saves', async ({ page }) => {
    await page.getByTestId('settings-phone-manage').click();
    const dialog = page.getByRole('dialog');
    await dialog.getByPlaceholder('01012345678').fill('01098765432');

    const saveResponse = page.waitForResponse(
      (r) => r.url().includes('/api/settings/account/phone') && r.request().method() === 'PATCH' && r.ok(),
    );
    await dialog.getByRole('button', { name: 'Save', exact: true }).click();
    await saveResponse;
    await expect(dialog.getByText('Phone number saved', { exact: false })).toBeVisible();
  });
});
