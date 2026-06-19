import { test, expect } from '../fixtures/settings.fixture';
import { fetchSettings } from '../helpers/api-client';
import { reloadSettings, setClientLanguage, waitForSavingDone } from '../helpers/auth';

test.describe('Settings E2E — Preferences', () => {
  test('language, theme, timezone persist after refresh', async ({ page, session }) => {
    await page.getByTestId('settings-theme').selectOption('dark');
    await waitForSavingDone(page);

    await page.getByTestId('settings-timezone').selectOption('Africa/Cairo');
    await waitForSavingDone(page);

    await page.getByTestId('settings-language').selectOption('ar');
    await waitForSavingDone(page);

    const beforeRefresh = await fetchSettings(session.userId);
    expect(beforeRefresh.settings?.language).toBe('ar');
    expect(beforeRefresh.settings?.theme).toBe('dark');
    expect(beforeRefresh.settings?.timezone).toBe('Africa/Cairo');

    await setClientLanguage(page, 'ar');
    await reloadSettings(page);

    await expect(page.getByTestId('settings-language')).toHaveValue('ar');
    await expect(page.getByTestId('settings-theme')).toHaveValue('dark');
    await expect(page.getByTestId('settings-timezone')).toHaveValue('Africa/Cairo');

    const afterRefresh = await fetchSettings(session.userId);
    expect(afterRefresh.settings?.language).toBe('ar');
    expect(afterRefresh.settings?.theme).toBe('dark');
    expect(afterRefresh.settings?.timezone).toBe('Africa/Cairo');
  });
});
