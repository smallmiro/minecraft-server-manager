import { test, expect } from '@playwright/test';
import { TEST_CREDENTIALS, performLogin } from '../fixtures/auth';

/**
 * Regression test for #476.
 *
 * On mobile, the navigation drawer is a temporary MUI Drawer (Modal + Backdrop).
 * Tapping a nav item closes the drawer and triggers a route change at the same
 * time. With `keepMounted` the closed Modal + full-screen Backdrop stayed in the
 * DOM and, when the close transition was interrupted by the navigation, lingered
 * over the page and intercepted taps. After the fix the closed drawer unmounts,
 * so no backdrop remains and the page stays interactive.
 */
test.describe('Mobile navigation drawer', () => {
  test('does not leave a backdrop overlay blocking taps after navigation (#476)', async ({
    browser,
  }) => {
    // iPhone-sized viewport (< md breakpoint, so the mobile drawer is used)
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();

    await performLogin(
      page,
      TEST_CREDENTIALS.valid.username,
      TEST_CREDENTIALS.valid.password
    );
    await expect(page).not.toHaveURL(/\/login/);

    await page.goto('/');

    // Open the hamburger drawer; its backdrop scrim should be visible.
    await page.getByLabel('open menu').click();
    await expect(page.locator('.MuiBackdrop-root')).toBeVisible();

    // Tap a nav item: this closes the drawer and navigates simultaneously.
    await page.locator('a[href="/servers"]').click();
    await expect(page).toHaveURL(/\/servers/);

    // No modal backdrop must remain in the DOM after navigating.
    await expect(page.locator('.MuiBackdrop-root')).toHaveCount(0);

    // The page must stay interactive: the menu button is tappable again and
    // reopening the drawer works (would fail if a transparent layer intercepted taps).
    await page.getByLabel('open menu').click();
    await expect(
      page.locator('.MuiDrawer-root a[href="/dashboard"]').first()
    ).toBeVisible();

    await context.close();
  });
});
