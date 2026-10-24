/**
 * `mcctl migrate worlds` checks and stops running servers through the
 * runtime port (#668, ADR-0001 row 14) instead of `docker inspect` / `docker stop`.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ConfigEnvWorldAssignmentAdapter, Paths, ServerName } from '@minecraft-docker/shared';

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

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'mcctl-migrate-'));
  writeFileSync(join(root, 'docker-compose.yml'), 'services: {}\n');
  mkdirSync(join(root, 'servers', 'alpha', 'data', 'world'), { recursive: true });
  writeFileSync(join(root, 'servers', 'alpha', 'config.env'), 'TYPE=PAPER\n');
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

  it('fails without migrating when the stop fails', async () => {
    runtime.getStatusAsync.mockResolvedValue('running');
    runtime.stop.mockResolvedValue({ success: false, error: 'boom' });

    const code = await migrateCommand({ root, subCommand: 'worlds', all: true, force: true });

    expect(code).toBe(1);
    expect(existsSync(join(root, 'servers', 'alpha', 'data', 'world', 'level.dat'))).toBe(true);
  });
});
