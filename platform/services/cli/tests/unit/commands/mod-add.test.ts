/**
 * mcctl mod add decides by the ServerType (#826): the Paper forks LEAF,
 * FOLIA and PUFFERFISH are plugin servers, so no --force and --url goes to
 * PLUGINS.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

vi.mock('../../../src/lib/server-config.js', () => ({ writeServerConfig: vi.fn() }));
import { writeServerConfig } from '../../../src/lib/server-config.js';
import { modCommand } from '../../../src/commands/mod.js';

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'mcctl-mod-add-'));
  writeFileSync(join(root, 'docker-compose.yml'), 'services: {}\n');
  vi.mocked(writeServerConfig).mockReset();
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
  vi.restoreAllMocks();
});

const addUrl = (type: string, force = false) => {
  mkdirSync(join(root, 'servers', 'alpha'), { recursive: true });
  writeFileSync(join(root, 'servers', 'alpha', 'config.env'), `TYPE=${type}\n`);
  return modCommand({
    root,
    subCommand: 'add',
    serverName: 'alpha',
    modNames: ['https://example.com/a.jar'],
    source: 'url',
    force,
  });
};

describe('mcctl mod add --url', () => {
  it.each(['PAPER', 'PURPUR', 'LEAF', 'FOLIA', 'PUFFERFISH'])('adds to PLUGINS on %s without --force', async (type) => {
    expect(await addUrl(type)).toBe(0);
    expect(writeServerConfig).toHaveBeenCalledWith(expect.anything(), 'alpha', {
      set: { PLUGINS: 'https://example.com/a.jar' },
    });
  });

  it.each(['FORGE', 'NEOFORGE', 'FABRIC', 'QUILT'])('adds to MODS on %s', async (type) => {
    expect(await addUrl(type)).toBe(0);
    expect(writeServerConfig).toHaveBeenCalledWith(expect.anything(), 'alpha', {
      set: { MODS: 'https://example.com/a.jar' },
    });
  });

  it.each(['VANILLA', 'MODRINTH', 'FTBA'])('asks for --force on %s', async (type) => {
    expect(await addUrl(type)).toBe(1);
    expect(writeServerConfig).not.toHaveBeenCalled();
    expect(await addUrl(type, true)).toBe(0);
  });
});
