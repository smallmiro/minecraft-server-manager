import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FileServerSpecRepository, Paths } from '@minecraft-docker/shared';
import { ShellExecutor } from '../../../src/lib/shell.js';
import { modCommand } from '../../../src/commands/mod.js';
import { serverSpecRepositories } from '../../../src/lib/server-config.js';

const TEMPLATE_COMPOSE = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../../../templates/servers/_template/docker-compose.yml'),
  'utf-8'
);

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

  it('mod remove rewrites only the changed key and keeps comments (through server.yaml, #675)', async () => {
    const before =
      '# Server\nTYPE=FABRIC\n\n# Mods\nMODRINTH_PROJECTS=sodium,lithium\nMOTD=Hello World\nLEVEL=alpha\nEXTRA_ARGS=--universe /worlds/\n';
    writeFileSync(configPath, before);
    writeFileSync(
      join(root, 'servers', 'alpha', 'docker-compose.yml'),
      TEMPLATE_COMPOSE.replace(/mc-template/g, 'mc-alpha').replace('mc-router.host: "template.local"', 'mc-router.host: "alpha.local"')
    );
    writeFileSync(join(root, 'servers', 'compose.yml'), 'include: []\n');
    serverSpecRepositories.create = (p) => new FileServerSpecRepository(p, undefined, undefined, () => []);
    const code = await modCommand({ root, subCommand: 'remove', serverName: 'alpha', modNames: ['lithium'] });
    expect(code).toBe(0);
    const written = readFileSync(configPath, 'utf-8');
    expect(written.slice(written.indexOf('\n') + 1)).toBe(before.replace('sodium,lithium', 'sodium'));
  });
});
