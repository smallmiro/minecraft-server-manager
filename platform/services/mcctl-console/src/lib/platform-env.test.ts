import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { applyPlatformAuthEnv } from './platform-env';

describe('applyPlatformAuthEnv (#686)', () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'mcctl-console-env-'));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('platform .env wins over the PM2 env for auth keys only', () => {
    writeFileSync(join(root, '.env'), "BETTER_AUTH_SECRET='new s3cret'\nBETTER_AUTH_BASE_URL=https://mc.example.com\nTZ=UTC\n");
    const env: Record<string, string | undefined> = { MCCTL_ROOT: root, BETTER_AUTH_SECRET: 'ecosystem', BETTER_AUTH_BASE_URL: 'http://localhost:5000' };

    applyPlatformAuthEnv(env);

    expect(env).toEqual({ MCCTL_ROOT: root, BETTER_AUTH_SECRET: 'new s3cret', BETTER_AUTH_BASE_URL: 'https://mc.example.com' });
  });

  it('keeps the current env when .env has no or an empty value', () => {
    writeFileSync(join(root, '.env'), 'BETTER_AUTH_BASE_URL=\n');
    const env: Record<string, string | undefined> = { MCCTL_ROOT: root, BETTER_AUTH_SECRET: 'ecosystem', BETTER_AUTH_BASE_URL: 'http://localhost:5000' };

    applyPlatformAuthEnv(env);

    expect(env).toEqual({ MCCTL_ROOT: root, BETTER_AUTH_SECRET: 'ecosystem', BETTER_AUTH_BASE_URL: 'http://localhost:5000' });
  });

  it('does nothing without MCCTL_ROOT or .env', () => {
    const env: Record<string, string | undefined> = { BETTER_AUTH_SECRET: 'dev' };
    applyPlatformAuthEnv(env);
    applyPlatformAuthEnv({ MCCTL_ROOT: join(root, 'missing') });
    expect(env).toEqual({ BETTER_AUTH_SECRET: 'dev' });
  });
});
