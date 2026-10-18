import { test, expect, type APIRequestContext } from '@playwright/test';
import { chmodSync, existsSync, readFileSync, statSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

/**
 * Platform settings API (#683): GET/PUT /api/platform-settings
 *
 * These tests WRITE the platform .env that the API under test points at.
 * - E2E_API_URL        API under test (default http://localhost:5001)
 * - E2E_PLATFORM_ENV   path of that API's platform .env
 *                      (default: $MCCTL_ROOT/.env, else ~/minecraft-servers/.env)
 * - E2E_API_KEY        optional X-API-Key when the API runs with AUTH_MODE=api-key
 * The original .env is backed up in beforeAll and restored (bytes + mode) in afterAll.
 */
const API = process.env.E2E_API_URL || 'http://localhost:5001';
const ENV_PATH =
  process.env.E2E_PLATFORM_ENV || join(process.env.MCCTL_ROOT || join(homedir(), 'minecraft-servers'), '.env');
const URL = `${API}/api/platform-settings`;

const base: Record<string, string> = process.env.E2E_API_KEY ? { 'x-api-key': process.env.E2E_API_KEY } : {};
const admin = { ...base, 'x-role': 'admin', 'x-user': 'e2e-admin' };

let original: Buffer;
let originalMode: number;

const get = async (request: APIRequestContext) => {
  const res = await request.get(URL, { headers: admin });
  expect(res.status()).toBe(200);
  return { res, text: await res.text() };
};
const put = (request: APIRequestContext, data: unknown) => request.put(URL, { headers: admin, data });

// Tests mutate one shared file: run serially.
test.describe.configure({ mode: 'serial' });

test.describe('Platform settings API', () => {
  test.beforeAll(async ({ request }) => {
    expect(existsSync(ENV_PATH), `platform .env not found at ${ENV_PATH} (set E2E_PLATFORM_ENV)`).toBe(true);
    original = readFileSync(ENV_PATH);
    originalMode = statSync(ENV_PATH).mode & 0o777;
    // Fail fast (before any write) if the API under test is not serving this route.
    const res = await request.get(URL, { headers: admin });
    expect(res.status(), 'API must serve /api/platform-settings').toBe(200);
  });

  test.afterAll(() => {
    if (!original) return;
    writeFileSync(ENV_PATH, original);
    chmodSync(ENV_PATH, originalMode);
    expect(readFileSync(ENV_PATH).equals(original)).toBe(true);
    expect(statSync(ENV_PATH).mode & 0o777).toBe(originalMode);
  });

  test('admin updates a non-secret key and it persists', async ({ request }) => {
    const { res, text } = await get(request);
    expect(res.headers()['cache-control']).toContain('no-store');
    const { revision } = JSON.parse(text);

    const value = 'Asia/Seoul';
    const upd = await put(request, { revision, set: { TZ: value }, remove: [] });
    expect(upd.status()).toBe(200);
    const body = await upd.json();
    expect(body.changedKeys).toContain('TZ');
    expect(body.revision).not.toBe(revision);

    const after = JSON.parse((await get(request)).text);
    expect(after.revision).toBe(body.revision);
    const tz = after.settings.find((s: { key: string }) => s.key === 'TZ');
    expect(tz.value).toBe(value);
    expect(readFileSync(ENV_PATH, 'utf8')).toMatch(/^TZ=.*Asia\/Seoul/m);
  });

  test('rotating BACKUP_GITHUB_TOKEN never exposes old or new plaintext', async ({ request }) => {
    const oldToken = 'ghp_e2eOLDtoken0000000000000000000000';
    const newToken = 'ghp_e2eNEWtoken1111111111111111111111';

    let { text } = await get(request);
    let upd = await put(request, { revision: JSON.parse(text).revision, set: { BACKUP_GITHUB_TOKEN: oldToken }, remove: [] });
    expect(upd.status()).toBe(200);
    expect(JSON.stringify(await upd.json())).not.toContain(oldToken);

    ({ text } = await get(request));
    upd = await put(request, { revision: JSON.parse(text).revision, set: { BACKUP_GITHUB_TOKEN: newToken }, remove: [] });
    expect(upd.status()).toBe(200);
    expect(JSON.stringify(await upd.json())).not.toContain(newToken);

    ({ text } = await get(request));
    expect(text).not.toContain(oldToken);
    expect(text).not.toContain(newToken);
    const entry = JSON.parse(text).settings.find((s: { key: string }) => s.key === 'BACKUP_GITHUB_TOKEN');
    expect(entry.configured).toBe(true);
    expect(entry).not.toHaveProperty('value');
    // the file itself holds the new token (rotation really happened)
    expect(readFileSync(ENV_PATH, 'utf8')).toContain(newToken);
  });

  test('stale revision returns 409 and leaves the file unchanged', async ({ request }) => {
    const { text } = await get(request);
    const { revision } = JSON.parse(text);
    const before = readFileSync(ENV_PATH);

    const res = await put(request, { revision: `${revision}-stale`, set: { TZ: 'UTC' }, remove: [] });
    expect(res.status()).toBe(409);
    const body = await res.json();
    expect(body.currentRevision).toBe(revision);
    expect(readFileSync(ENV_PATH).equals(before)).toBe(true);
  });

  test('non-admin access is denied', async ({ request }) => {
    const before = readFileSync(ENV_PATH);
    for (const headers of [base, { ...base, 'x-role': 'user' }]) {
      expect((await request.get(URL, { headers })).status()).toBe(403);
      const res = await request.put(URL, { headers, data: { revision: 'x', set: { TZ: 'UTC' }, remove: [] } });
      expect(res.status()).toBe(403);
    }
    expect(readFileSync(ENV_PATH).equals(before)).toBe(true);
  });
});
