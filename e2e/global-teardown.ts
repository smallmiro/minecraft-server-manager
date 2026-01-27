import { FullConfig } from '@playwright/test';
import { spawnSync } from 'child_process';

/**
 * Global teardown for E2E tests.
 *
 * This runs once after all tests. Use it for:
 * - Stopping PM2-managed services (optional)
 * - Cleaning up test data
 * - Generating reports
 */
async function globalTeardown(config: FullConfig): Promise<void> {
  console.log('[Global Teardown] Starting E2E test teardown...');

  // Only stop services if E2E_STOP_SERVICES is set
  // By default, we keep services running for faster subsequent test runs
  if (process.env.E2E_STOP_SERVICES === 'true') {
    await stopServicesViaPm2();
  } else {
    console.log('[Global Teardown] Keeping services running (set E2E_STOP_SERVICES=true to stop)');
  }

  console.log('[Global Teardown] Teardown complete');
}

/**
 * Stop services via PM2.
 */
async function stopServicesViaPm2(): Promise<void> {
  // Check if PM2 is available
  const pm2Available = checkPm2Available();
  if (!pm2Available) {
    console.log('[Global Teardown] PM2 not found, skipping service stop');
    return;
  }

  console.log('[Global Teardown] Stopping PM2 services...');

  try {
    // Stop mcctl-api and mcctl-console
    const stopResult = spawnSync('pm2', ['stop', 'mcctl-api', 'mcctl-console'], {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    if (stopResult.status !== 0) {
      // Services might not be running, which is fine
      console.log('[Global Teardown] PM2 stop returned non-zero (services may not be running)');
    } else {
      console.log('[Global Teardown] PM2 services stopped successfully');
    }
  } catch (error) {
    console.error('[Global Teardown] Error stopping PM2 services:', error);
  }
}

/**
 * Check if PM2 is available.
 */
function checkPm2Available(): boolean {
  try {
    const result = spawnSync('which', ['pm2'], {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return result.status === 0;
  } catch {
    return false;
  }
}

export default globalTeardown;
