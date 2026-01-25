import { FullConfig } from '@playwright/test';

/**
 * Global setup for E2E tests.
 *
 * This runs once before all tests. Use it for:
 * - Setting up test database state
 * - Creating test users
 * - Warming up services
 */
async function globalSetup(config: FullConfig): Promise<void> {
  const baseURL = config.projects[0]?.use?.baseURL || 'http://localhost:3000';
  const apiURL = process.env.E2E_API_URL || 'http://localhost:3001';

  console.log('[Global Setup] Starting E2E test setup...');
  console.log(`[Global Setup] Console URL: ${baseURL}`);
  console.log(`[Global Setup] API URL: ${apiURL}`);

  // Wait for services to be ready
  await waitForService(baseURL, 'Console');
  await waitForService(`${apiURL}/health`, 'API');

  console.log('[Global Setup] All services are ready');
}

/**
 * Wait for a service to be ready by polling its URL.
 */
async function waitForService(
  url: string,
  serviceName: string,
  maxRetries = 30,
  retryInterval = 2000
): Promise<void> {
  console.log(`[Global Setup] Waiting for ${serviceName} at ${url}...`);

  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });

      if (response.ok) {
        console.log(`[Global Setup] ${serviceName} is ready (status: ${response.status})`);
        return;
      }
    } catch {
      // Service not ready yet, continue polling
    }

    if (i < maxRetries - 1) {
      console.log(`[Global Setup] ${serviceName} not ready, retrying in ${retryInterval / 1000}s... (${i + 1}/${maxRetries})`);
      await new Promise((resolve) => setTimeout(resolve, retryInterval));
    }
  }

  throw new Error(`[Global Setup] ${serviceName} at ${url} did not become ready within timeout`);
}

export default globalSetup;
