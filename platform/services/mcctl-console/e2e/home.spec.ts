import { test, expect } from '@playwright/test';

test.describe('Home Page', () => {
  test('should display the main title', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'Minecraft Server Manager' })).toBeVisible();
  });

  test('should display Get Started button', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('button', { name: 'Get Started' })).toBeVisible();
  });

  test('should display Documentation button', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('button', { name: 'Documentation' })).toBeVisible();
  });

  test('should have dark theme applied', async ({ page }) => {
    await page.goto('/');

    const body = page.locator('body');
    const backgroundColor = await body.evaluate((el) => {
      return window.getComputedStyle(el).backgroundColor;
    });

    expect(backgroundColor).not.toBe('rgb(255, 255, 255)');
  });
});

test.describe('Responsive Design', () => {
  test('should render correctly on desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'Minecraft Server Manager' })).toBeVisible();
  });

  test('should render correctly on tablet', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'Minecraft Server Manager' })).toBeVisible();
  });

  test('should render correctly on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'Minecraft Server Manager' })).toBeVisible();
  });
});
