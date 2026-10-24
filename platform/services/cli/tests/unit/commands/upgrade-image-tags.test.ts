import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * mcctl update: image tags follow VERSION and the loading MOTD label is
 * added, through the ServerSpec (#675): server.yaml image, compose rendered.
 * Real temp platform built from the bundled template.
 */

// Mock child_process (needed for update.ts imports)
vi.mock('child_process', () => ({
  execFile: vi.fn(),
  spawnSync: vi.fn().mockReturnValue({ status: 0, stdout: '', stderr: '' }),
}));

// Mock @clack/prompts
vi.mock('@clack/prompts', () => ({
  spinner: () => ({ start: vi.fn(), stop: vi.fn() }),
  confirm: vi.fn().mockResolvedValue(true),
  isCancel: vi.fn().mockReturnValue(false),
  log: { warn: vi.fn(), info: vi.fn(), success: vi.fn() },
}));

// Mock update-checker
vi.mock('../../../src/lib/update-checker.js', () => ({
  getInstalledVersion: vi.fn().mockReturnValue('1.0.0'),
  fetchLatestVersionForced: vi.fn().mockResolvedValue('1.0.0'),
  getCachedVersion: vi.fn().mockReturnValue('1.0.0'),
  clearCache: vi.fn(),
  isUpdateAvailable: vi.fn().mockReturnValue(false),
}));

// Mock pm2-utils
vi.mock('../../../src/lib/pm2-utils.js', () => ({
  checkServiceAvailability: vi.fn().mockReturnValue({
    api: { available: false },
    console: { available: false },
  }),
  PM2_SERVICE_NAMES: {
    API: 'mcctl-api',
    CONSOLE: 'mcctl-console',
  },
}));

// Mock Pm2ServiceManagerAdapter
vi.mock('../../../src/infrastructure/adapters/Pm2ServiceManagerAdapter.js', () => ({
  Pm2ServiceManagerAdapter: vi.fn().mockImplementation(() => ({
    restart: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn(),
  })),
}));

import { upgradeServerImageTags } from '../../../src/commands/update.js';
import { serverSpecRepositories, updateServer } from '../../../src/lib/server-config.js';
import { FileServerSpecRepository, Paths } from '@minecraft-docker/shared';

const TEMPLATE = join(dirname(fileURLToPath(import.meta.url)), '../../../templates/servers/_template');
let root: string;
const servers = () => join(root, 'servers');
const read = (...p: string[]) => readFileSync(join(servers(), ...p), 'utf-8');

function server(name: string, opts: { version?: string; tag?: string; noLoadingMotd?: boolean; noCompose?: boolean; noConfig?: boolean } = {}) {
  mkdirSync(join(servers(), name), { recursive: true });
  if (!opts.noConfig) {
    let config = readFileSync(join(TEMPLATE, 'config.env'), 'utf-8').replace(/^LEVEL=.*$/m, `LEVEL=${name}`);
    config = opts.version === undefined ? config.replace(/^VERSION=.*\n/m, '') : config.replace(/^VERSION=.*$/m, `VERSION=${opts.version}`);
    writeFileSync(join(servers(), name, 'config.env'), config);
  }
  if (!opts.noCompose) {
    let compose = readFileSync(join(TEMPLATE, 'docker-compose.yml'), 'utf-8')
      .replace(/mc-template/g, `mc-${name}`)
      .replace('mc-router.host: "template.local"', `mc-router.host: "${name}.local"`)
      .replace('itzg/minecraft-server:java25', `itzg/minecraft-server:${opts.tag ?? 'java25'}`);
    if (opts.noLoadingMotd) compose = compose.replace(/^\s*mc-router\.auto-scale-loading-motd:.*\n/m, '');
    writeFileSync(join(servers(), name, 'docker-compose.yml'), compose);
  }
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'mcctl-update-tags-'));
  mkdirSync(servers());
  writeFileSync(join(servers(), 'compose.yml'), 'include: []\n');
  writeFileSync(join(root, '.env'), 'HOST_IPS=10.0.0.2\n');
  serverSpecRepositories.create = (p) => new FileServerSpecRepository(p); // no runtime: no world changes here
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
  vi.restoreAllMocks();
});

let log: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  log = vi.spyOn(console, 'log').mockImplementation(() => {});
});
const output = () => log.mock.calls.flat().join('\n');

describe('upgradeServerImageTags', () => {
  it('returns 0 when the servers directory does not exist', async () => {
    expect(await upgradeServerImageTags(join(root, 'nope'))).toBe(0);
  });

  it('skips _template, servers without config.env, compose or VERSION', async () => {
    server('_template', { version: 'LATEST', tag: 'java21' });
    server('noconfig', { noConfig: true, tag: 'java21' });
    server('nocompose', { version: 'LATEST', noCompose: true });
    server('noversion', { tag: 'java21' });
    expect(await upgradeServerImageTags(servers())).toBe(0);
  });

  it('moves the image tag to the recommended one through server.yaml', async () => {
    server('alpha', { version: 'LATEST', tag: 'java21' });
    expect(await upgradeServerImageTags(servers())).toBe(1);
    expect(read('alpha', 'server.yaml')).toContain('image: itzg/minecraft-server:java25');
    expect(read('alpha', 'docker-compose.yml')).toContain('itzg/minecraft-server:java25');
  });

  it('reads the quoted image of a compose mcctl rendered (#675)', async () => {
    server('alpha', { version: 'LATEST', tag: 'java21' });
    await updateServer(new Paths(root), 'alpha', (doc) => doc); // renders image: "itzg/minecraft-server:java21"
    expect(read('alpha', 'docker-compose.yml')).toContain('image: "itzg/minecraft-server:java21"');

    expect(await upgradeServerImageTags(servers())).toBe(1);
    expect(read('alpha', 'server.yaml')).toContain('image: itzg/minecraft-server:java25');
    expect(read('alpha', 'docker-compose.yml')).toContain('image: "itzg/minecraft-server:java25"');
  });

  it('keeps a pinned release tag (#798)', async () => {
    server('alpha', { version: '1.21.1', tag: '2026.10.0-java21' });
    expect(await upgradeServerImageTags(servers())).toBe(0);
    expect(read('alpha', 'docker-compose.yml')).toContain('itzg/minecraft-server:2026.10.0-java21');
    expect(output()).toContain('pinned tag, keeping');
  });

  it('keeps a pinned tag whose Java does not fit VERSION, with a warning (#798)', async () => {
    server('alpha', { version: 'LATEST', tag: '2026.10.0-java21' });
    expect(await upgradeServerImageTags(servers())).toBe(0);
    expect(read('alpha', 'docker-compose.yml')).toContain('itzg/minecraft-server:2026.10.0-java21');
    expect(output()).toContain('alpha: 2026.10.0-java21 is pinned, but VERSION=LATEST needs java25');
  });

  it('keeps a digest pin (#798)', async () => {
    server('alpha', { version: '1.21.1', tag: 'java17@sha256:' + 'a'.repeat(64) });
    expect(await upgradeServerImageTags(servers())).toBe(0);
    expect(read('alpha', 'docker-compose.yml')).toContain('java17@sha256:');
  });

  it('keeps a pin made in server.yaml that the compose file does not show yet (#798)', async () => {
    server('alpha', { version: 'LATEST', tag: 'java21' });
    await updateServer(new Paths(root), 'alpha', (doc) => doc); // writes server.yaml
    writeFileSync(
      join(servers(), 'alpha', 'server.yaml'),
      read('alpha', 'server.yaml').replace('image: itzg/minecraft-server:java21', 'image: itzg/minecraft-server:2026.10.0-java21')
    );
    expect(await upgradeServerImageTags(servers())).toBe(0);
    expect(read('alpha', 'server.yaml')).toContain('image: itzg/minecraft-server:2026.10.0-java21');
    expect(output()).toContain('is pinned, but VERSION=LATEST needs java25');
    expect(output()).not.toContain('→');
  });

  it('moves a tag unpinned in server.yaml that the compose file still shows pinned (#798)', async () => {
    server('alpha', { version: 'LATEST', tag: '2026.10.0-java21' });
    await updateServer(new Paths(root), 'alpha', (doc) => doc);
    writeFileSync(
      join(servers(), 'alpha', 'server.yaml'),
      read('alpha', 'server.yaml').replace('image: itzg/minecraft-server:2026.10.0-java21', 'image: itzg/minecraft-server:java21')
    );
    expect(await upgradeServerImageTags(servers())).toBe(1);
    expect(read('alpha', 'server.yaml')).toContain('image: itzg/minecraft-server:java25');
  });

  it('does not warn about a pin on a newer Java than VERSION needs (#798)', async () => {
    server('alpha', { version: '1.21.1', tag: '2026.10.0-java25' });
    expect(await upgradeServerImageTags(servers())).toBe(0);
    expect(output()).toContain('pinned tag, keeping');
  });

  it('adds the loading MOTD label to a pinned server without moving its tag (#798)', async () => {
    server('alpha', { version: 'LATEST', tag: '2026.10.0-java21', noLoadingMotd: true });
    expect(await upgradeServerImageTags(servers())).toBe(1);
    expect(read('alpha', 'server.yaml')).toContain('image: itzg/minecraft-server:2026.10.0-java21');
    expect(read('alpha', 'docker-compose.yml')).toContain('mc-router.auto-scale-loading-motd');
  });

  it('leaves a compatible server alone', async () => {
    server('alpha', { version: 'LATEST', tag: 'java25' });
    expect(await upgradeServerImageTags(servers())).toBe(0);
  });

  it('adds the missing loading MOTD label', async () => {
    server('alpha', { version: 'LATEST', tag: 'java25', noLoadingMotd: true });
    expect(await upgradeServerImageTags(servers())).toBe(1);
    expect(read('alpha', 'docker-compose.yml')).toContain('mc-router.auto-scale-loading-motd');
  });
});
