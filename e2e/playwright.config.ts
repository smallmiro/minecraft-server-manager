import { defineConfig, devices } from '@playwright/test';

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
// import dotenv from 'dotenv';
// import path from 'path';
// dotenv.config({ path: path.resolve(__dirname, '.env') });

/**
 * Playwright configuration for E2E tests.
 *
 * Services are managed via PM2 (not Docker).
 * - Console runs on localhost:5000
 * - API runs on localhost:5001
 *
 * Before running tests:
 * 1. Run 'mcctl console init' to generate ecosystem.config.cjs
 * 2. Tests will auto-start services via PM2 (or use existing running services)
 *
 * Environment variables:
 * - E2E_BASE_URL: Console URL (default: http://localhost:5000)
 * - E2E_API_URL: API URL (default: http://localhost:5001)
 * - E2E_SKIP_SERVICE_START: Skip PM2 service start (for pre-started services)
 * - E2E_STOP_SERVICES: Stop services after tests (default: false, keep running)
 *
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './tests',
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['list'],
    ...(process.env.CI ? [['github'] as const] : []),
  ],
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:5000',

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',

    /* Take screenshot on failure */
    screenshot: 'only-on-failure',

    /* Record video on failure */
    video: 'on-first-retry',
  },

  /* Global setup/teardown */
  globalSetup: require.resolve('./global-setup'),
  globalTeardown: require.resolve('./global-teardown'),

  /* Configure projects for major browsers */
  projects: [
    /* Setup project - runs before all tests */
    {
      name: 'setup',
      testMatch: /global\.setup\.ts/,
    },

    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup'],
    },

    /* Uncomment for additional browser testing
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
      dependencies: ['setup'],
    },

    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
      dependencies: ['setup'],
    },
    */
  ],

  /*
   * Web server configuration removed.
   * Services are managed via PM2 in global-setup.ts.
   *
   * PM2 advantages over Docker for E2E tests:
   * - Faster startup time (~3s vs ~30s)
   * - Easier debugging (direct access to Node.js processes)
   * - Simpler CI integration
   * - Services persist between test runs for faster development
   *
   * To start services manually:
   *   cd platform && pm2 start ecosystem.config.cjs
   *
   * To view logs:
   *   pm2 logs
   */

  /* Expect timeout */
  expect: {
    timeout: 10000,
  },

  /* Test timeout */
  timeout: 30000,
});
