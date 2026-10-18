import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Paths } from '@minecraft-docker/shared';
import { readLegacyAuthSecret, ensureConsoleAuthSecret } from '../../../src/lib/console-auth-secret.js';

const ECOSYSTEM = `module.exports = { apps: [ { name: 'mcctl-console', env: {
        BETTER_AUTH_SECRET: 'legacy0123456789',
        BETTER_AUTH_BASE_URL: 'http://localhost:5000',
} } ] };
`;

describe('console auth secret (#686)', () => {
  let root: string;
  let paths: Paths;
  const env = () => readFileSync(join(root, '.env'), 'utf-8');

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'mcctl-auth-secret-'));
    paths = new Paths(root);
    writeFileSync(join(root, '.env'), 'TZ=UTC\n');
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('reads the secret an older ecosystem file injected, by text only', () => {
    writeFileSync(join(root, 'ecosystem.config.cjs'), ECOSYSTEM);
    expect(readLegacyAuthSecret(join(root, 'ecosystem.config.cjs'))).toBe('legacy0123456789');
    expect(readLegacyAuthSecret(join(root, 'missing.cjs'))).toBeUndefined();
  });

  it('keeps an existing .env secret', async () => {
    writeFileSync(join(root, '.env'), 'BETTER_AUTH_SECRET=keepme\n');
    expect(await ensureConsoleAuthSecret(paths, 'legacy0123456789')).toBe('kept');
    expect(env()).toBe('BETTER_AUTH_SECRET=keepme\n');
  });

  it('moves the legacy ecosystem secret into .env so sessions survive', async () => {
    expect(await ensureConsoleAuthSecret(paths, 'legacy0123456789')).toBe('migrated');
    expect(env()).toBe('TZ=UTC\nBETTER_AUTH_SECRET=legacy0123456789\n');
  });

  it('generates a secret when there is none', async () => {
    expect(await ensureConsoleAuthSecret(paths, undefined)).toBe('generated');
    expect(env()).toMatch(/^TZ=UTC\nBETTER_AUTH_SECRET=[0-9a-f]{64}\n$/);
  });
});
