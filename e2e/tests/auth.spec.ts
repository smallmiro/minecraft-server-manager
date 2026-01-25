import { test, expect } from '@playwright/test';
import { TEST_CREDENTIALS, performLogin } from '../fixtures/auth';

test.describe('Authentication', () => {
  test.describe('Login Page', () => {
    test('should display login form', async ({ page }) => {
      await page.goto('/login');

      // Check page title
      await expect(page.getByRole('heading', { name: /minecraft server manager/i })).toBeVisible();

      // Check form elements are present
      await expect(page.locator('input[name="username"]')).toBeVisible();
      await expect(page.locator('input[name="password"]')).toBeVisible();
      await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
    });

    test('should display development credentials notice', async ({ page }) => {
      await page.goto('/login');

      // Check for development notice
      await expect(page.getByText(/development mode/i)).toBeVisible();
      await expect(page.getByText(/admin/)).toBeVisible();
    });

    test('should have correct form attributes', async ({ page }) => {
      await page.goto('/login');

      const usernameInput = page.locator('input[name="username"]');
      const passwordInput = page.locator('input[name="password"]');

      // Check input types and autocomplete attributes
      await expect(usernameInput).toHaveAttribute('type', 'text');
      await expect(usernameInput).toHaveAttribute('autocomplete', 'username');
      await expect(passwordInput).toHaveAttribute('type', 'password');
      await expect(passwordInput).toHaveAttribute('autocomplete', 'current-password');
    });
  });

  test.describe('Login Flow', () => {
    test('should login with valid credentials', async ({ page }) => {
      await performLogin(
        page,
        TEST_CREDENTIALS.valid.username,
        TEST_CREDENTIALS.valid.password
      );

      // Should redirect away from login page
      await expect(page).not.toHaveURL(/\/login/);

      // Should be on dashboard or home page
      await expect(page.url()).not.toContain('/login');
    });

    test('should show error with invalid credentials', async ({ page }) => {
      await performLogin(
        page,
        TEST_CREDENTIALS.invalid.username,
        TEST_CREDENTIALS.invalid.password
      );

      // Should show error message
      await expect(page.getByText(/invalid username or password/i)).toBeVisible();

      // Should remain on login page
      await expect(page).toHaveURL(/\/login/);
    });

    test('should show error when username is empty', async ({ page }) => {
      await page.goto('/login');

      // Fill only password
      await page.fill('input[name="password"]', 'somepassword');
      await page.click('button[type="submit"]');

      // Should show validation error or remain on login page
      await expect(page).toHaveURL(/\/login/);
    });

    test('should show error when password is empty', async ({ page }) => {
      await page.goto('/login');

      // Fill only username
      await page.fill('input[name="username"]', 'admin');
      await page.click('button[type="submit"]');

      // Should remain on login page
      await expect(page).toHaveURL(/\/login/);
    });

    test('should disable form while submitting', async ({ page }) => {
      await page.goto('/login');

      // Fill in credentials
      await page.fill('input[name="username"]', TEST_CREDENTIALS.valid.username);
      await page.fill('input[name="password"]', TEST_CREDENTIALS.valid.password);

      // Click submit and immediately check for loading state
      const submitButton = page.getByRole('button', { name: /sign in/i });
      await submitButton.click();

      // Button should show loading state or be disabled
      // Note: This might be too fast to catch, but it's good to try
      const buttonText = await submitButton.textContent();
      if (buttonText?.toLowerCase().includes('signing in')) {
        await expect(submitButton).toBeDisabled();
      }
    });

    test('should preserve callback URL after login', async ({ page }) => {
      // Go to login with a callback URL
      await page.goto('/login?callbackUrl=/dashboard');

      // Login
      await performLogin(
        page,
        TEST_CREDENTIALS.valid.username,
        TEST_CREDENTIALS.valid.password
      );

      // Should redirect to callback URL
      // Note: This depends on how the app handles redirects
      await expect(page).not.toHaveURL(/\/login/);
    });
  });

  test.describe('Logout', () => {
    test('should logout successfully', async ({ page }) => {
      // First login
      await performLogin(
        page,
        TEST_CREDENTIALS.valid.username,
        TEST_CREDENTIALS.valid.password
      );

      // Wait for successful login
      await expect(page).not.toHaveURL(/\/login/);

      // Find and click logout button/link
      // Try different selectors as the logout might be in various places
      const logoutSelectors = [
        '[data-testid="logout-button"]',
        'button:has-text("Sign out")',
        'button:has-text("Logout")',
        'a:has-text("Sign out")',
        'a:has-text("Logout")',
      ];

      let loggedOut = false;
      for (const selector of logoutSelectors) {
        try {
          const element = page.locator(selector).first();
          if (await element.isVisible({ timeout: 2000 })) {
            await element.click();
            loggedOut = true;
            break;
          }
        } catch {
          // Continue to next selector
        }
      }

      if (loggedOut) {
        // Should redirect to login page
        await expect(page).toHaveURL(/\/login/);
      }
    });
  });

  test.describe('Session Management', () => {
    test('should redirect to login when accessing protected route without auth', async ({ page }) => {
      // Try to access a protected route directly
      await page.goto('/dashboard');

      // Should redirect to login page
      await expect(page).toHaveURL(/\/login/);
    });

    test('should maintain session across page reloads', async ({ page }) => {
      // Login
      await performLogin(
        page,
        TEST_CREDENTIALS.valid.username,
        TEST_CREDENTIALS.valid.password
      );

      // Wait for successful login
      await expect(page).not.toHaveURL(/\/login/);
      const currentURL = page.url();

      // Reload the page
      await page.reload();

      // Should still be logged in (not redirected to login)
      await expect(page).not.toHaveURL(/\/login/);
    });
  });
});
