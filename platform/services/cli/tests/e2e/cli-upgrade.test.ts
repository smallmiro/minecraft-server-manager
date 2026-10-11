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
