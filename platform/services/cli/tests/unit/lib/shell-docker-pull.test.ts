import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter } from 'node:events';

// Mock child_process spawn
const mockSpawn = vi.fn();
vi.mock('node:child_process', () => ({
  spawn: (...args: any[]) => mockSpawn(...args),
}));

// Mock node:fs
vi.mock('node:fs', () => ({
  existsSync: vi.fn().mockReturnValue(false),
  readFileSync: vi.fn().mockReturnValue(''),
  writeFileSync: vi.fn(),
}));

// Mock @minecraft-docker/shared
vi.mock('@minecraft-docker/shared', () => ({
  log: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
  colors: {
    bold: (s: string) => s,
    cyan: (s: string) => s,
    yellow: (s: string) => s,
    green: (s: string) => s,
    dim: (s: string) => s,
    red: (s: string) => s,
  },
  Paths: vi.fn().mockImplementation((root?: string) => ({
    root: root ?? '/tmp/test-root',
    servers: (root ?? '/tmp/test-root') + '/servers',
    scripts: (root ?? '/tmp/test-root') + '/scripts',
    templates: (root ?? '/tmp/test-root') + '/templates',
  })),
  execScript: vi.fn(),
  execScriptInteractive: vi.fn(),
}));

import { ShellExecutor } from '../../../src/lib/shell.js';

function createMockProcess(exitCode: number) {
  const emitter = new EventEmitter() as NodeJS.EventEmitter & {
    on: (event: string, listener: (...args: any[]) => void) => any;
  };
  // Emit close asynchronously
  setTimeout(() => emitter.emit('close', exitCode), 0);
  return emitter;
}

describe('ShellExecutor.dockerPull', () => {
  let shell: ShellExecutor;

  beforeEach(() => {
    vi.clearAllMocks();
    shell = new ShellExecutor();
  });

  it('should run docker pull with the given image name', async () => {
    const mockProcess = createMockProcess(0);
    mockSpawn.mockReturnValue(mockProcess);

    const code = await shell.dockerPull('itzg/minecraft-server:java21');

    expect(mockSpawn).toHaveBeenCalledWith(
      'docker',
      ['pull', 'itzg/minecraft-server:java21'],
      expect.objectContaining({ stdio: 'inherit' })
    );
    expect(code).toBe(0);
  });

  it('should return exit code from docker pull', async () => {
    const mockProcess = createMockProcess(1);
    mockSpawn.mockReturnValue(mockProcess);

    const code = await shell.dockerPull('itzg/minecraft-server:java21');

    expect(code).toBe(1);
  });

  it('should return 1 on spawn error', async () => {
    const emitter = new EventEmitter();
    mockSpawn.mockReturnValue(emitter);

    const pullPromise = shell.dockerPull('itzg/minecraft-server:java21');
    emitter.emit('error', new Error('docker not found'));
    const code = await pullPromise;

    expect(code).toBe(1);
  });

  it('should inherit stdio so user sees pull progress', async () => {
    const mockProcess = createMockProcess(0);
    mockSpawn.mockReturnValue(mockProcess);

    await shell.dockerPull('itzg/minecraft-server:java21');

    expect(mockSpawn).toHaveBeenCalledWith(
      'docker',
      expect.any(Array),
      expect.objectContaining({ stdio: 'inherit' })
    );
  });
});
