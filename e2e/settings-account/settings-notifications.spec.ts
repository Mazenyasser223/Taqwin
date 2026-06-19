import { test, expect } from '../fixtures/settings.fixture';
import { fetchSettings } from '../helpers/api-client';
import { reloadSettings, waitForSavingDone } from '../helpers/auth';

test.describe('Settings E2E — Notifications', () => {
  test('promotions and do not disturb toggles persist', async ({ page, session }) => {
    const promotions = page.getByTestId('settings-promotions');
    const quietHours = page.getByTestId('settings-quiet-hours');

    await expect(promotions).toHaveAttribute('aria-checked', 'true');
    await promotions.click();
    await waitForSavingDone(page);
    await expect(promotions).toHaveAttribute('aria-checked', 'false');

    await quietHours.click();
    await waitForSavingDone(page);
    await expect(quietHours).toHaveAttribute('aria-checked', 'true');

    let snapshot = await fetchSettings(session.userId);
    expect(snapshot.settings?.notifyPromotional).toBe(false);
    expect(snapshot.settings?.quietHoursEnabled).toBe(true);

    await reloadSettings(page);
    await expect(promotions).toHaveAttribute('aria-checked', 'false');
    await expect(quietHours).toHaveAttribute('aria-checked', 'true');

    snapshot = await fetchSettings(session.userId);
    expect(snapshot.settings?.notifyPromotional).toBe(false);
    expect(snapshot.settings?.quietHoursEnabled).toBe(true);
  });
});
