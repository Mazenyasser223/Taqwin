import { test, expect } from '../fixtures/settings.fixture';
import { fetchSettings } from '../helpers/api-client';
import {
  reloadSettings,
  scrollToTestId,
  waitForGamificationSection,
} from '../helpers/auth';

test.describe('Settings E2E — Privacy', () => {
  test('public profile toggle persists', async ({ page, session }) => {
    await scrollToTestId(page, 'settings-public-profile');
    const toggle = page.getByTestId('settings-public-profile');
    const before = await fetchSettings(session.userId);
    const initial = Boolean(before.settings?.publicProfile);

    await toggle.click({ force: true });
    await expect
      .poll(async () => (await fetchSettings(session.userId)).settings?.publicProfile)
      .toBe(!initial);

    await reloadSettings(page);
    await scrollToTestId(page, 'settings-public-profile');
    await expect(toggle).toHaveAttribute('aria-checked', initial ? 'false' : 'true');
    const after = await fetchSettings(session.userId);
    expect(after.settings?.publicProfile).toBe(!initial);
  });
});

test.describe('Settings E2E — Leaderboards', () => {
  test('join league, show name, visibility persist', async ({ page, session }) => {
    test.setTimeout(120_000);
    await waitForGamificationSection(page);

    const league = page.getByTestId('compete-league-opt-in');
    if ((await league.getAttribute('aria-checked')) !== 'true') {
      await league.click({ force: true });
    }
    await expect
      .poll(async () => (await fetchSettings(session.userId)).settings?.leagueOptIn)
      .toBe(true);

    await reloadSettings(page);
    await waitForGamificationSection(page);
    await expect(league).toHaveAttribute('aria-checked', 'true');

    const showOnBoard = page.getByTestId('compete-show-on-board');
    await expect(showOnBoard).toBeEnabled({ timeout: 15_000 });
    if ((await showOnBoard.getAttribute('aria-checked')) !== 'true') {
      await showOnBoard.click({ force: true });
    }
    await expect
      .poll(async () => (await fetchSettings(session.userId)).settings?.showOnLeaderboard)
      .toBe(true);

    await reloadSettings(page);
    await waitForGamificationSection(page);
    await expect(showOnBoard).toHaveAttribute('aria-checked', 'true');

    const visibility = page.getByTestId('compete-visibility');
    await visibility.selectOption('friends');
    await expect
      .poll(async () => (await fetchSettings(session.userId)).settings?.leaderboardVisibility)
      .toBe('friends');

    await reloadSettings(page);
    await waitForGamificationSection(page);

    await expect(league).toHaveAttribute('aria-checked', 'true');
    await expect(showOnBoard).toHaveAttribute('aria-checked', 'true');
    await expect(visibility).toHaveValue('friends');
  });
});
