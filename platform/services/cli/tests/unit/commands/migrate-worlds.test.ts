/**
 * `mcctl migrate worlds` checks and stops running servers through the
 * runtime port (#668, ADR-0001 row 14) instead of `docker inspect` / `docker stop`.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { chmodSync, mkdtempSync, mkdirSync, writeFileSync, existsSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ConfigEnvWorldAssignmentAdapter,
  FileServerSpecRepository,
  Paths,
  ServerName,
  type IContainerRuntimePort,
} from '@minecraft-docker/shared';

const runtime = {
  getStatusAsync: vi.fn(),
  stop: vi.fn(),
};
let root = '';

vi.mock('../../../src/infrastructure/index.js', () => ({
  getContainer: () => ({
    containerRuntime: runtime,
    promptPort: { isCancel: () => false, confirm: vi.fn(), select: vi.fn() },
    worldAssignmentPort: new ConfigEnvWorldAssignmentAdapter(new Paths(root)),
  }),
}));

import { migrateCommand } from '../../../src/commands/migrate.js';
import { serverSpecRepositories } from '../../../src/lib/server-config.js';

const TEMPLATE_COMPOSE = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../../../templates/servers/_template/docker-compose.yml'),
  'utf-8'
);

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'mcctl-migrate-'));
  writeFileSync(join(root, 'docker-compose.yml'), 'services: {}\n');
  mkdirSync(join(root, 'servers', 'alpha', 'data', 'world'), { recursive: true });
  writeFileSync(join(root, 'servers', 'alpha', 'config.env'), 'TYPE=PAPER\n');
  // The spec write (#675) needs the server's compose and a runtime that reports it stopped
  writeFileSync(
    join(root, 'servers', 'alpha', 'docker-compose.yml'),
    TEMPLATE_COMPOSE.replace(/mc-template/g, 'mc-alpha').replace('mc-router.host: "template.local"', 'mc-router.host: "alpha.local"')
  );
  const stopped = { getStatus: () => 'exited' } as unknown as IContainerRuntimePort;
  serverSpecRepositories.create = (p) => new FileServerSpecRepository(p, undefined, stopped, () => []);
  writeFileSync(join(root, 'servers', 'alpha', 'data', 'world', 'level.dat'), 'x');
  runtime.getStatusAsync.mockReset();
  runtime.stop.mockReset();
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
  rmSync(root, { recursive: true, force: true });
});

describe('migrate worlds (runtime port)', () => {
  it('stops a running server through the runtime port before moving its world', async () => {
    runtime.getStatusAsync.mockResolvedValue('running');
    let finishStop!: () => void;
    runtime.stop.mockReturnValue(new Promise((resolve) => (finishStop = () => resolve({ success: true }))));

    const migrating = migrateCommand({ root, subCommand: 'worlds', all: true, force: true });
    await vi.waitFor(() => expect(runtime.stop).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 20));
    // Not moved while the stop is still running
    expect(existsSync(join(root, 'servers', 'alpha', 'data', 'world', 'level.dat'))).toBe(true);
    finishStop();
    const code = await migrating;

    expect(code).toBe(0);
    const stopped = runtime.stop.mock.calls[0]![0] as ServerName;
    expect(stopped).toBeInstanceOf(ServerName);
    expect(stopped.value).toBe('alpha');
    expect(existsSync(join(root, 'worlds', 'alpha', 'level.dat'))).toBe(true);
  });

  it('does not stop a server that is not running', async () => {
    runtime.getStatusAsync.mockResolvedValue('exited');

    const code = await migrateCommand({ root, subCommand: 'worlds', all: true, force: true });

    expect(code).toBe(0);
    expect(runtime.stop).not.toHaveBeenCalled();
  });

  it('moves the world back and leaves the config as it was when the compose cannot be written', async () => {
    runtime.getStatusAsync.mockResolvedValue('exited');
    const alpha = join(root, 'servers', 'alpha');
    const compose = readFileSync(join(alpha, 'docker-compose.yml'), 'utf-8');
    chmodSync(join(alpha, 'docker-compose.yml'), 0o444);

    const code = await migrateCommand({ root, subCommand: 'worlds', all: true, force: true });

    expect(code).toBe(1);
    expect(existsSync(join(alpha, 'data', 'world', 'level.dat'))).toBe(true);
    expect(existsSync(join(root, 'worlds', 'alpha'))).toBe(false);
    // The next start still finds the world where config.env says it is
    expect(readFileSync(join(alpha, 'config.env'), 'utf-8')).toBe('TYPE=PAPER\n');
    expect(existsSync(join(alpha, 'server.yaml'))).toBe(false);
    expect(readFileSync(join(alpha, 'docker-compose.yml'), 'utf-8')).toBe(compose);
  });

  it('fails without migrating when the stop fails', async () => {
    runtime.getStatusAsync.mockResolvedValue('running');
    runtime.stop.mockResolvedValue({ success: false, error: 'boom' });

    const code = await migrateCommand({ root, subCommand: 'worlds', all: true, force: true });

    expect(code).toBe(1);
    expect(existsSync(join(root, 'servers', 'alpha', 'data', 'world', 'level.dat'))).toBe(true);
  });
});
