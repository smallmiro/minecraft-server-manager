import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Paths } from '@minecraft-docker/shared';
import { ShellExecutor } from '../../../src/lib/shell.js';
import { modCommand } from '../../../src/commands/mod.js';

// CLI env readers/writers use the shared codec (#656).
describe('CLI env codec', () => {
  let root: string;
  let configPath: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'mcctl-cli-env-'));
    writeFileSync(join(root, 'docker-compose.yml'), 'services: {}\n');
    mkdirSync(join(root, 'servers', 'alpha'), { recursive: true });
    configPath = join(root, 'servers', 'alpha', 'config.env');
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    rmSync(root, { recursive: true, force: true });
  });

  it('ShellExecutor.readConfig reads values the way Compose does', () => {
    writeFileSync(configPath, 'TYPE=PAPER # comment\nexport VERSION=1.21.1\nMEMORY = 4G\nMOTD="it\'s"\n');
    const shell = new ShellExecutor({ paths: new Paths(root) });
    expect(shell.readConfig('alpha')).toEqual({ TYPE: 'PAPER', VERSION: '1.21.1', MEMORY: '4G', MOTD: "it's" });
  });

  it('mod remove rewrites only the changed key and keeps comments', async () => {
    const before = '# Server\nTYPE=FABRIC\n\n# Mods\nMODRINTH_PROJECTS=sodium,lithium\nMOTD=Hello World\n';
    writeFileSync(configPath, before);
    const code = await modCommand({ root, subCommand: 'remove', serverName: 'alpha', modNames: ['lithium'] });
    expect(code).toBe(0);
    expect(readFileSync(configPath, 'utf-8')).toBe(before.replace('sodium,lithium', 'sodium'));
  });
});
