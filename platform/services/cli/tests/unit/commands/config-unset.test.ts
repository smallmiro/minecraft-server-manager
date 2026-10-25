import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FileServerSpecRepository } from '@minecraft-docker/shared';
import { configCommand } from '../../../src/commands/config.js';
import { serverSpecRepositories } from '../../../src/lib/server-config.js';

const TEMPLATE_COMPOSE = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../../../templates/servers/_template/docker-compose.yml'),
  'utf-8'
);

// `mcctl config <server> KEY ""` removes the key, so the image default applies again (#824).
describe('mcctl config <server> KEY ""', () => {
  let root: string;
  let file: string;
  let output: string[];

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'mcctl-cli-config-unset-'));
    writeFileSync(join(root, 'docker-compose.yml'), 'services: {}\n');
    mkdirSync(join(root, 'servers', 'alpha'), { recursive: true });
    file = join(root, 'servers', 'alpha', 'config.env');
    writeFileSync(file, 'TYPE=PAPER\nMOTD=old\nLEVEL=alpha\n');
    writeFileSync(
      join(root, 'servers', 'alpha', 'docker-compose.yml'),
      TEMPLATE_COMPOSE.replace(/mc-template/g, 'mc-alpha').replace('mc-router.host: "template.local"', 'mc-router.host: "alpha.local"')
    );
    writeFileSync(join(root, 'servers', 'compose.yml'), 'include: []\n');
    serverSpecRepositories.create = (p) => new FileServerSpecRepository(p, undefined, undefined, () => []);
    output = [];
    const capture = (...args: unknown[]) => output.push(args.join(' '));
    vi.spyOn(console, 'log').mockImplementation(capture);
    vi.spyOn(console, 'error').mockImplementation(capture);
    vi.spyOn(console, 'warn').mockImplementation(capture);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    rmSync(root, { recursive: true, force: true });
  });

  it('removes the key from config.env and says so', async () => {
    expect(await configCommand({ root, serverName: 'alpha', key: 'MOTD', value: '' })).toBe(0);
    expect(readFileSync(file, 'utf-8')).not.toContain('MOTD');
    expect(readFileSync(file, 'utf-8')).toContain('TYPE=PAPER');
    expect(output.join('\n')).toContain('MOTD removed');
  });

  it('reports a key that is not set and leaves config.env alone', async () => {
    const before = readFileSync(file, 'utf-8');

    expect(await configCommand({ root, serverName: 'alpha', key: 'SEED', value: '' })).toBe(0);
    expect(readFileSync(file, 'utf-8')).toBe(before);
    expect(output.join('\n')).toContain('SEED is not set');
  });

  it('refuses to remove LEVEL, which is the world assignment', async () => {
    expect(await configCommand({ root, serverName: 'alpha', key: 'LEVEL', value: '' })).toBe(1);
    expect(readFileSync(file, 'utf-8')).toContain('LEVEL=alpha');
  });
});
