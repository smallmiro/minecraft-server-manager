import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Paths } from '@minecraft-docker/shared';
import { migrateConsoleAuthEnv } from '../../../src/lib/console-auth-migration.js';

const ECO = `module.exports = { apps: [ { name: 'mcctl-console', env: {
        PORT: '5000',
        BETTER_AUTH_SECRET: 'sekret0123456789',
        BETTER_AUTH_BASE_URL: 'http://localhost:5000',
        NODE_ENV: 'production',
} } ] };
`;

describe('migrateConsoleAuthEnv (#699)', () => {
  let root: string;
  let paths: Paths;
  const eco = () => join(root, 'ecosystem.config.cjs');
  const env = () => readFileSync(join(root, '.env'), 'utf-8');
  const backups = () => readdirSync(root).filter((f) => f.startsWith('ecosystem.config.cjs.bak-'));

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'mcctl-auth-mig-'));
    paths = new Paths(root);
    writeFileSync(join(root, '.env'), 'TZ=UTC\n');
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it('moves both keys, keeps other lines, writes a backup', async () => {
    writeFileSync(eco(), ECO);
    const r = await migrateConsoleAuthEnv(paths, false);
    expect(r.moved.sort()).toEqual(['BETTER_AUTH_BASE_URL', 'BETTER_AUTH_SECRET']);
    expect(env()).toContain('sekret0123456789');
    expect(env()).toContain('http://localhost:5000');
    const after = readFileSync(eco(), 'utf-8');
    expect(after).not.toContain('BETTER_AUTH');
    expect(after).toContain("PORT: '5000'");
    expect(after).toContain("NODE_ENV: 'production'");
    expect(backups()).toHaveLength(1);
    expect(readFileSync(join(root, backups()[0]), 'utf-8')).toBe(ECO);
  });

  it('moves only the key that is defined', async () => {
    writeFileSync(eco(), ECO.replace(/.*BETTER_AUTH_BASE_URL.*\n/, ''));
    const r = await migrateConsoleAuthEnv(paths, false);
    expect(r.moved).toEqual(['BETTER_AUTH_SECRET']);
    expect(env()).not.toContain('BETTER_AUTH_BASE_URL');
  });

  it('overwrites a stale .env value', async () => {
    writeFileSync(join(root, '.env'), 'BETTER_AUTH_SECRET=stale\nBETTER_AUTH_BASE_URL=http://192.168.0.2:3000\n');
    writeFileSync(eco(), ECO);
    await migrateConsoleAuthEnv(paths, false);
    expect(env()).not.toContain('stale');
    expect(env()).not.toContain('192.168');
    expect(env()).toContain('sekret0123456789');
  });

  it('changes nothing in dry-run', async () => {
    writeFileSync(eco(), ECO);
    const r = await migrateConsoleAuthEnv(paths, true);
    expect(r.moved.sort()).toEqual(['BETTER_AUTH_BASE_URL', 'BETTER_AUTH_SECRET']);
    expect(readFileSync(eco(), 'utf-8')).toBe(ECO);
    expect(env()).toBe('TZ=UTC\n');
    expect(backups()).toHaveLength(0);
  });

  it('is idempotent', async () => {
    writeFileSync(eco(), ECO);
    await migrateConsoleAuthEnv(paths, false);
    const second = await migrateConsoleAuthEnv(paths, false);
    expect(second).toEqual({ moved: [], skipped: [] });
    expect(backups()).toHaveLength(1);
  });

  it('does nothing without an ecosystem file', async () => {
    expect(existsSync(eco())).toBe(false);
    expect(await migrateConsoleAuthEnv(paths, false)).toEqual({ moved: [], skipped: [] });
  });

  it('skips a key that cannot be written safely and leaves it in the ecosystem', async () => {
    writeFileSync(eco(), ECO.replace('sekret0123456789', 'bad\rcr'));
    const r = await migrateConsoleAuthEnv(paths, false);
    expect(r.skipped).toEqual(['BETTER_AUTH_SECRET']);
    expect(r.moved).toEqual(['BETTER_AUTH_BASE_URL']);
    const after = readFileSync(eco(), 'utf-8');
    expect(after).toContain('BETTER_AUTH_SECRET');
    expect(after).not.toContain('BETTER_AUTH_BASE_URL');
  });

  it('leaves a line with trailing code untouched instead of cutting it (#699)', async () => {
    const eco = "module.exports = { apps: [{ env: {\n  BETTER_AUTH_SECRET: 'abc' || process.env.X,\n} }] };\n";
    writeFileSync(join(root, 'ecosystem.config.cjs'), eco);
    const result = await migrateConsoleAuthEnv(paths, false);
    expect(result.moved).toEqual([]);
    expect(readFileSync(join(root, 'ecosystem.config.cjs'), 'utf-8')).toBe(eco);
  });
});
