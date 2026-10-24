/**
 * mcctl whitelist writes WHITELIST / ENABLE_WHITELIST through the ServerSpec
 * (#675). A refused write (writeConfigValue false: import refused, locked,
 * invalid spec) is an error: exit 1 and a failure audit entry.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { whitelistCommand, type WhitelistCommandOptions } from '../../src/commands/whitelist.js';
import * as rcon from '../../src/lib/rcon.js';
import { ShellExecutor } from '../../src/lib/shell.js';
import { getContainer } from '../../src/infrastructure/di/container.js';
import { readPlayerJson } from '../../src/lib/player-json.js';

vi.mock('../../src/lib/rcon.js');
vi.mock('../../src/lib/shell.js');
vi.mock('../../src/infrastructure/di/container.js');
vi.mock('../../src/lib/player-json.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/lib/player-json.js')>()),
  readPlayerJson: vi.fn(),
}));
vi.mock('@minecraft-docker/shared', async () => {
  const actual = await vi.importActual('@minecraft-docker/shared');
  return {
    ...actual,
    Paths: vi.fn().mockImplementation(() => ({
      isInitialized: vi.fn().mockReturnValue(true),
      servers: '/tmp/test/servers',
    })),
  };
});

const audit = vi.fn();
const options = (subCommand: WhitelistCommandOptions['subCommand'], json = false): WhitelistCommandOptions => ({
  root: '/tmp/test',
  serverName: 'alpha',
  subCommand,
  playerName: subCommand === 'add' || subCommand === 'remove' ? 'Steve' : undefined,
  json,
});

describe('whitelist: a refused config write', () => {
  let out: string[];

  beforeEach(() => {
    vi.clearAllMocks();
    out = [];
    vi.spyOn(console, 'log').mockImplementation((...a: unknown[]) => void out.push(a.join(' ')));
    vi.mocked(rcon.isContainerRunning).mockResolvedValue(false);
    vi.mocked(readPlayerJson).mockResolvedValue([]);
    vi.mocked(ShellExecutor.prototype.readConfig).mockReturnValue({ WHITELIST: 'Steve,Alex' });
    vi.mocked(ShellExecutor.prototype.writeConfigValue).mockResolvedValue(false);
    vi.mocked(getContainer).mockReturnValue({ auditLogPort: { log: audit.mockResolvedValue(undefined) } } as never);
  });

  it.each(['add', 'remove'] as const)('%s exits 1 and logs a failure audit entry', async (sub) => {
    vi.mocked(ShellExecutor.prototype.readConfig).mockReturnValue({ WHITELIST: sub === 'add' ? 'Alex' : 'Steve,Alex' });
    expect(await whitelistCommand(options(sub))).toBe(1);
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ status: 'failure', targetName: 'Steve' }));
    expect(out.join('\n')).not.toMatch(/Config updated/);
  });

  it.each(['on', 'off'] as const)('%s exits 1 without a success message', async (sub) => {
    expect(await whitelistCommand(options(sub))).toBe(1);
    expect(out.join('\n')).not.toMatch(/Config updated/);
  });

  it('reports success: false in JSON', async () => {
    vi.mocked(ShellExecutor.prototype.readConfig).mockReturnValue({ WHITELIST: 'Alex' });
    expect(await whitelistCommand(options('add', true))).toBe(1);
    expect(JSON.parse(out.join(''))).toMatchObject({ success: false, player: 'Steve' });
  });

  it('still exits 0 when the write succeeds', async () => {
    vi.mocked(ShellExecutor.prototype.writeConfigValue).mockResolvedValue(true);
    vi.mocked(ShellExecutor.prototype.readConfig).mockReturnValue({ WHITELIST: 'Alex' });
    expect(await whitelistCommand(options('add'))).toBe(0);
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ status: 'success' }));
  });
});
