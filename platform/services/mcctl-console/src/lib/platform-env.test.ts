import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
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
    writeFileSync(join(root, 'ecosystem.config.cjs'), 'module.exports = { apps: [{ env: { PORT: 5000 } }] };\n');
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

  describe('ecosystem defines the key (#699)', () => {
    const eco = "module.exports = { apps: [{ env: {\n    BETTER_AUTH_SECRET: 'eco-secret',\n    BETTER_AUTH_BASE_URL: \"http://eco:5000\",\n  } }] };\n";

    it('keeps the env value and warns without leaking values', () => {
      writeFileSync(join(root, 'ecosystem.config.cjs'), eco);
      writeFileSync(join(root, '.env'), "BETTER_AUTH_SECRET=env-secret\nBETTER_AUTH_BASE_URL=https://mc.example.com\n");
      const env: Record<string, string | undefined> = { MCCTL_ROOT: root, BETTER_AUTH_SECRET: 'eco-secret', BETTER_AUTH_BASE_URL: 'http://eco:5000' };
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

      applyPlatformAuthEnv(env);

      expect(env.BETTER_AUTH_SECRET).toBe('eco-secret');
      expect(env.BETTER_AUTH_BASE_URL).toBe('http://eco:5000');
      const msgs = warn.mock.calls.map((c) => c.join(' ')).join('\n');
      expect(msgs).toContain('BETTER_AUTH_SECRET');
      expect(msgs).toContain('BETTER_AUTH_BASE_URL');
      expect(msgs).toContain('mcctl upgrade');
      for (const v of ['env-secret', 'eco-secret', 'mc.example.com', 'eco:5000']) expect(msgs).not.toContain(v);
      warn.mockRestore();
    });

    it('does not warn when .env has no differing value', () => {
      writeFileSync(join(root, 'ecosystem.config.cjs'), eco);
      writeFileSync(join(root, '.env'), 'TZ=UTC\n');
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      applyPlatformAuthEnv({ MCCTL_ROOT: root, BETTER_AUTH_SECRET: 'eco-secret' });
      expect(warn).not.toHaveBeenCalled();
      warn.mockRestore();
    });

    it('decides per key: only the key absent from the ecosystem is overridden', () => {
      writeFileSync(join(root, 'ecosystem.config.cjs'), "module.exports = { apps: [{ env: {\n    BETTER_AUTH_SECRET: 'eco-secret',\n  } }] };\n");
      writeFileSync(join(root, '.env'), "BETTER_AUTH_SECRET=env-secret\nBETTER_AUTH_BASE_URL=https://mc.example.com\n");
      const env: Record<string, string | undefined> = { MCCTL_ROOT: root, BETTER_AUTH_SECRET: 'eco-secret', BETTER_AUTH_BASE_URL: 'http://localhost:5000' };
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

      applyPlatformAuthEnv(env);

      expect(env.BETTER_AUTH_SECRET).toBe('eco-secret');
      expect(env.BETTER_AUTH_BASE_URL).toBe('https://mc.example.com');
      warn.mockRestore();
    });

    it('missing ecosystem file counts as not defined', () => {
      writeFileSync(join(root, '.env'), 'BETTER_AUTH_SECRET=env-secret\n');
      const env: Record<string, string | undefined> = { MCCTL_ROOT: root, BETTER_AUTH_SECRET: 'x' };
      applyPlatformAuthEnv(env);
      expect(env.BETTER_AUTH_SECRET).toBe('env-secret');
    });
  });
});
