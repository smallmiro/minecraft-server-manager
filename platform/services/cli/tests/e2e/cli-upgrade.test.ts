import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runCli, isCliBuild } from './helpers.js';

describe('CLI Upgrade installId', () => {
  let root: string;
  const configPath = () => join(root, '.mcctl.json');

  beforeAll(async () => {
    if (!(await isCliBuild())) throw new Error('CLI not built. Run "pnpm build" first.');
  });

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'mcctl-e2e-upgrade-'));
    writeFileSync(join(root, 'docker-compose.yml'), 'services: {}\n');
    writeFileSync(join(root, '.mcctl.json'), JSON.stringify({ version: '1.0.0', playitEnabled: true }));
  });

  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it('--dry-run does not write installId', async () => {
    const result = await runCli(['upgrade', '--root', root, '--dry-run', '--non-interactive']);
    expect(result.exitCode).toBe(0);
    expect(JSON.parse(readFileSync(configPath(), 'utf-8')).installId).toBeUndefined();
  });

  it('adds a UUID installId once and keeps other fields', async () => {
    const args = ['upgrade', '--root', root, '--non-interactive'];
    expect((await runCli(args)).exitCode).toBe(0);
    const first = JSON.parse(readFileSync(configPath(), 'utf-8'));
    expect(first.installId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    expect(first.playitEnabled).toBe(true);

    expect((await runCli(args)).exitCode).toBe(0);
    expect(JSON.parse(readFileSync(configPath(), 'utf-8')).installId).toBe(first.installId);
  });
});

describe('CLI Upgrade console auth migration (#699)', () => {
  let root: string;
  const eco = () => join(root, 'ecosystem.config.cjs');
  const env = () => join(root, '.env');
  const ecosystem = [
    'module.exports = { apps: [{ name: "mcctl-console", env: {',
    "  BETTER_AUTH_SECRET: 'eco_secret_value',",
    "  BETTER_AUTH_BASE_URL: 'http://localhost:5000',",
    "  PORT: '5000',",
    '} }] };',
    '',
  ].join('\n');

  beforeAll(async () => {
    if (!(await isCliBuild())) throw new Error('CLI not built. Run "pnpm build" first.');
  });

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'mcctl-e2e-upgrade-auth-'));
    writeFileSync(join(root, 'docker-compose.yml'), 'services: {}\n');
    writeFileSync(join(root, '.mcctl.json'), JSON.stringify({ version: '1.0.0' }));
    writeFileSync(env(), 'TZ=UTC\nBETTER_AUTH_SECRET=stale_secret\nBETTER_AUTH_BASE_URL=http://old:3000\n');
    writeFileSync(eco(), ecosystem);
  });

  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it('--dry-run reports the move and changes nothing', async () => {
    const result = await runCli(['upgrade', '--root', root, '--dry-run', '--non-interactive']);
    expect(result.exitCode).toBe(0);
    expect(result.stdout + result.stderr).toContain('BETTER_AUTH_SECRET');
    expect(readFileSync(eco(), 'utf-8')).toBe(ecosystem);
    expect(readFileSync(env(), 'utf-8')).toContain('BETTER_AUTH_SECRET=stale_secret');
  });

  it('moves the ecosystem values into .env once, without printing them', async () => {
    const args = ['upgrade', '--root', root, '--non-interactive'];
    const result = await runCli(args);
    expect(result.exitCode).toBe(0);
    expect(result.stdout + result.stderr).not.toContain('eco_secret_value');

    const envText = readFileSync(env(), 'utf-8');
    expect(envText).toContain('BETTER_AUTH_SECRET=eco_secret_value');
    expect(envText).toContain('BETTER_AUTH_BASE_URL=');
    expect(envText).not.toContain('stale_secret');
    const ecoText = readFileSync(eco(), 'utf-8');
    expect(ecoText).not.toContain('BETTER_AUTH_');
    expect(ecoText).toContain("PORT: '5000'");

    expect((await runCli(args)).exitCode).toBe(0);
    expect(readFileSync(env(), 'utf-8')).toBe(envText);
  });
});
