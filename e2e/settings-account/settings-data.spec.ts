import { test, expect } from '../fixtures/settings.fixture';
import { scrollToTestId } from '../helpers/auth';

test.describe('Settings E2E — Data & Support', () => {
  test('export data downloads PDF', async ({ page }) => {
    test.setTimeout(90_000);

    await scrollToTestId(page, 'settings-export');

    const exportResponse = page.waitForResponse(
      (r) => r.url().includes('/api/settings/account/export') && r.ok(),
    );
    const downloadPromise = page.waitForEvent('download');
    await page.getByTestId('settings-export').click();

    await exportResponse;
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^taqwin-export-\d{4}-\d{2}-\d{2}\.pdf$/);
    await expect(page.getByText('Export downloaded', { exact: false })).toBeVisible();
  });

  test('product tour replay CTA is visible', async ({ page }) => {
    await expect(page.getByTestId('settings-replay-tour')).toBeVisible({ timeout: 30_000 });
    await scrollToTestId(page, 'settings-replay-tour');
  });

  test('support link navigates to support page', async ({ page }) => {
    await scrollToTestId(page, 'settings-support-link');
    await page.getByTestId('settings-support-link').click();
    await expect(page).toHaveURL(/#\/support/);
  });
});
