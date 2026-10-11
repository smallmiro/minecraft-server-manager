import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { mockRepoCtor } = vi.hoisted(() => ({ mockRepoCtor: vi.fn() }));

vi.mock('../../src/lib/rcon.js');
vi.mock('../../src/lib/shell.js');
vi.mock('@minecraft-docker/shared', async () => {
  const actual = await vi.importActual<typeof import('@minecraft-docker/shared')>(
    '@minecraft-docker/shared'
  );
  return {
    ...actual,
    SqliteAuditLogRepository: mockRepoCtor,
    Paths: vi.fn().mockImplementation(() => ({
      isInitialized: vi.fn().mockReturnValue(true),
      root: '/tmp/mcctl-test-root',
    })),
  };
});

import { kickCommand } from '../../src/commands/kick.js';
import * as rcon from '../../src/lib/rcon.js';
import { ShellExecutor } from '../../src/lib/shell.js';
import { resetContainer } from '../../src/infrastructure/di/container.js';

describe('audit log failures do not change command results (#602)', () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    resetContainer();
    mockRepoCtor.mockReset();
    mockRepoCtor.mockImplementation(() => {
      throw new Error(
        'was compiled against a different Node.js version using NODE_MODULE_VERSION 127'
      );
    });
    vi.mocked(ShellExecutor.prototype.readConfig).mockReturnValue({ TYPE: 'PAPER' });
    vi.mocked(rcon.getContainerName).mockReturnValue('mc-factory');
    vi.mocked(rcon.isContainerRunning).mockResolvedValue(true);
    vi.mocked(rcon.execRconWithOutput).mockResolvedValue({ code: 0, output: 'Kicked Steve' });
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy.mockRestore();
    logSpy.mockRestore();
    resetContainer();
  });

  it('kick returns 0 and warns once when the audit repository cannot load', async () => {
    const code = await kickCommand({
      root: '/tmp/mcctl-test-root',
      serverName: 'factory',
      playerName: 'Steve',
      json: true,
    });

    expect(code).toBe(0);
    expect(mockRepoCtor).toHaveBeenCalled();
    const warnings = errorSpy.mock.calls.filter((c) => c.join(' ').includes('Audit log unavailable'));
    expect(warnings).toHaveLength(1);
    // stdout (JSON output) stays untouched by the warning
    expect(logSpy.mock.calls.flat().join(' ')).not.toContain('Audit log unavailable');
  });
});
