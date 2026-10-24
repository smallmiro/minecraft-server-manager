/**
 * E2E target URLs. There are deliberately no localhost defaults: on a dev host
 * localhost:5000/5001 is usually the live mcctl-console/mcctl-api (#797).
 */
export function resolveTargets(env: Record<string, string | undefined>): {
  baseURL: string;
  apiURL: string;
} {
  const baseURL = env.E2E_BASE_URL;
  const apiURL = env.E2E_API_URL;
  const missing = [!baseURL && 'E2E_BASE_URL', !apiURL && 'E2E_API_URL'].filter(Boolean);
  if (!baseURL || !apiURL) {
    throw new Error(
      `[E2E] ${missing.join(' and ')} not set. The E2E tests create/delete servers and change settings, ` +
        'so they never default to localhost (that may be your live mcctl-api/console).\n' +
        'Point both at a disposable test instance, e.g.:\n' +
        '  E2E_BASE_URL=http://<test-console-host>:<port> E2E_API_URL=http://<test-api-host>:<port> pnpm test:e2e'
    );
  }
  return { baseURL, apiURL };
}

// Empty when unset; global-setup calls resolveTargets() and fails before any request.
export const E2E_BASE_URL = process.env.E2E_BASE_URL ?? '';
export const E2E_API_URL = process.env.E2E_API_URL ?? '';
