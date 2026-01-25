import { test as base, expect, Page, BrowserContext } from '@playwright/test';

/**
 * Test credentials for E2E tests.
 * These should match the default credentials in mcctl-api.
 */
export const TEST_CREDENTIALS = {
  valid: {
    username: 'admin',
    password: 'admin',
  },
  invalid: {
    username: 'invalid-user',
    password: 'wrong-password',
  },
};

/**
 * Custom test fixtures for authenticated tests.
 */
export interface AuthFixtures {
  /** Page that is already logged in */
  authenticatedPage: Page;
  /** Browser context with authentication state */
  authenticatedContext: BrowserContext;
}

/**
 * Helper function to perform login.
 */
export async function performLogin(
  page: Page,
  username: string,
  password: string
): Promise<void> {
  await page.goto('/login');

  // Wait for the login form to be visible
  await page.waitForSelector('[data-testid="login-form"]', { timeout: 10000 }).catch(() => {
    // Fallback: wait for form elements if data-testid is not present
    return page.waitForSelector('input[name="username"]', { timeout: 10000 });
  });

  // Fill in credentials
  await page.fill('input[name="username"]', username);
  await page.fill('input[name="password"]', password);

  // Click submit button
  await page.click('button[type="submit"]');
}

/**
 * Extended test with authentication fixtures.
 */
export const test = base.extend<AuthFixtures>({
  /**
   * Provides a page that is already logged in.
   */
  authenticatedPage: async ({ browser }, use) => {
    // Create a new context for isolation
    const context = await browser.newContext();
    const page = await context.newPage();

    // Perform login
    await performLogin(page, TEST_CREDENTIALS.valid.username, TEST_CREDENTIALS.valid.password);

    // Wait for successful login (redirect to dashboard or home)
    await expect(page).not.toHaveURL(/\/login/);

    // Provide the authenticated page to the test
    await use(page);

    // Cleanup
    await context.close();
  },

  /**
   * Provides a browser context with authentication state.
   */
  authenticatedContext: async ({ browser }, use) => {
    // Create a new context
    const context = await browser.newContext();
    const page = await context.newPage();

    // Perform login
    await performLogin(page, TEST_CREDENTIALS.valid.username, TEST_CREDENTIALS.valid.password);

    // Wait for successful login
    await expect(page).not.toHaveURL(/\/login/);

    // Close the setup page but keep the context
    await page.close();

    // Provide the authenticated context to the test
    await use(context);

    // Cleanup
    await context.close();
  },
});

export { expect };
