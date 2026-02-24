/**
 * Backup Routes Tests (#423)
 *
 * Tests for:
 * 1. Correct git repository path: <MCCTL_ROOT>/backups/worlds/ (not platform/worlds/)
 * 2. Shell command injection prevention: execFile instead of exec
 * 3. status, history, push, restore endpoints
 */
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { join } from 'path';

const TEST_PLATFORM_PATH = join(import.meta.dirname, '.tmp-backup-routes-test');

// Set env vars BEFORE any imports
process.env.PLATFORM_PATH = TEST_PLATFORM_PATH;
process.env.MCCTL_ROOT = TEST_PLATFORM_PATH;
process.env.AUTH_MODE = 'disabled';
process.env.NODE_ENV = 'test';

// Mock audit-log-service
vi.mock('../src/services/audit-log-service.js', () => ({
  writeAuditLog: vi.fn().mockResolvedValue(undefined),
}));

// Mock child_process
// The route uses promisify(execFile). Node.js's child_process.execFile has a
// util.promisify.custom symbol that returns { stdout, stderr }.
// We store the promisify.custom impl in a separate vi.fn() that we can update
// per-test, and the mock execFile delegates to it.
vi.mock('child_process', () => {
  const { promisify } = require('util');

  // This is the "current implementation" holder - tests update this via the module-level variable
  let currentImpl: (file: string, args: string[], opts?: any) => Promise<{ stdout: string; stderr: string }>
    = () => Promise.resolve({ stdout: '', stderr: '' });

  const execFileMock = vi.fn((file: any, args: any, opts: any, callback: any) => {
    // For tests that use the raw callback form (CWD capture)
    if (typeof callback === 'function') {
      currentImpl(file, args, opts).then(
        ({ stdout, stderr }) => callback(null, stdout, stderr),
        (err) => callback(err, '', '')
      );
    }
    return {} as any;
  });

  // promisify.custom delegates to currentImpl
  execFileMock[promisify.custom] = (file: string, args: string[], opts?: any) => {
    return currentImpl(file, args, opts);
  };

  // Expose a way to update currentImpl (will be accessed via the module mock)
  (execFileMock as any).__setImpl = (impl: typeof currentImpl) => {
    currentImpl = impl;
  };

  const execMock = vi.fn();
  execMock[promisify.custom] = vi.fn().mockResolvedValue({ stdout: '', stderr: '' });

  return {
    execFile: execFileMock,
    exec: execMock,
  };
});

// Mock fs
vi.mock('fs', () => ({
  existsSync: vi.fn().mockReturnValue(true),
  mkdirSync: vi.fn(),
  rmSync: vi.fn(),
}));

// Mock SqliteBackupScheduleRepository to avoid better-sqlite3 native module issues
import { BackupSchedule, type IBackupScheduleRepository } from '@minecraft-docker/shared';

class InMemoryBackupScheduleRepository implements IBackupScheduleRepository {
  private store: Map<string, BackupSchedule> = new Map();
  async save(schedule: BackupSchedule) { this.store.set(schedule.id, schedule); }
  async findAll() { return Array.from(this.store.values()); }
  async findById(id: string) { return this.store.get(id) ?? null; }
  async findEnabled() { return Array.from(this.store.values()).filter(s => s.enabled); }
  async delete(id: string) { this.store.delete(id); }
  close() { this.store.clear(); }
}

vi.mock('@minecraft-docker/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@minecraft-docker/shared')>();
  return {
    ...actual,
    SqliteBackupScheduleRepository: vi.fn().mockImplementation(() => new InMemoryBackupScheduleRepository()),
    ConfigSnapshotDatabase: vi.fn().mockImplementation(() => ({
      getDb: () => ({ prepare: vi.fn().mockReturnValue({ run: vi.fn(), all: vi.fn().mockReturnValue([]), get: vi.fn() }), exec: vi.fn() }),
      close: vi.fn(),
    })),
    SqliteConfigSnapshotRepository: vi.fn().mockImplementation(() => ({
      findAll: vi.fn().mockResolvedValue([]),
      findById: vi.fn().mockResolvedValue(null),
      save: vi.fn(),
      delete: vi.fn(),
      count: vi.fn().mockResolvedValue(0),
    })),
    SqliteConfigSnapshotScheduleRepository: vi.fn().mockImplementation(() => ({
      findAll: vi.fn().mockResolvedValue([]),
      findById: vi.fn().mockResolvedValue(null),
      findByServer: vi.fn().mockResolvedValue([]),
      findEnabled: vi.fn().mockResolvedValue([]),
      save: vi.fn(),
      delete: vi.fn(),
    })),
  };
});

import { execFile, exec } from 'child_process';
import { existsSync } from 'fs';
import { promisify } from 'util';
import { buildApp } from '../src/app.js';
import { config } from '../src/config/index.js';

const mockedExecFile = vi.mocked(execFile);
const mockedExec = vi.mocked(exec);
const mockedExistsSync = vi.mocked(existsSync);

// Use config.mcctlRoot to match the route's BACKUP_CACHE_DIR computation
// (config is resolved at module-load time, before process.env is set)
const BACKUP_CACHE_DIR = join(config.mcctlRoot, 'backups', 'worlds');

/**
 * Helper: set execFile mock to succeed with given stdout/stderr.
 * Uses __setImpl to update the per-test implementation inside the mock factory.
 */
function mockExecFileSuccess(stdout = '', stderr = '') {
  (mockedExecFile as any).__setImpl(
    (_file: string, _args: string[], _opts?: any) =>
      Promise.resolve({ stdout, stderr })
  );
}

/**
 * Helper: set execFile mock to fail with given error.
 */
function mockExecFileFailure(errorMsg: string, stderr = '') {
  const err = Object.assign(new Error(errorMsg), { stderr });
  (mockedExecFile as any).__setImpl(
    (_file: string, _args: string[], _opts?: any) =>
      Promise.reject(err)
  );
}

/**
 * Helper: set execFile mock to capture CWD and succeed.
 * Returns the captured CWD values array.
 */
function mockExecFileCapturesCwd(stdout = '', stderr = ''): string[] {
  const capturedCwdValues: string[] = [];
  (mockedExecFile as any).__setImpl(
    (_file: string, _args: string[], opts?: any) => {
      if (opts?.cwd) capturedCwdValues.push(opts.cwd);
      return Promise.resolve({ stdout, stderr });
    }
  );
  return capturedCwdValues;
}

/**
 * Helper: set execFile mock to capture file/args calls.
 * Returns the captured calls array.
 */
function mockExecFileCaptureCalls(stdout = '', stderr = ''): { cmd: string; args: string[] }[] {
  const capturedCalls: { cmd: string; args: string[] }[] = [];
  (mockedExecFile as any).__setImpl(
    (file: string, args: string[], _opts?: any) => {
      capturedCalls.push({ cmd: file, args: args || [] });
      return Promise.resolve({ stdout, stderr });
    }
  );
  return capturedCalls;
}

describe('Backup Routes (#423)', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    // Create required directories using real fs
    const { mkdirSync: realMkdir } = await vi.importActual<typeof import('fs')>('fs');
    realMkdir(join(TEST_PLATFORM_PATH, 'data'), { recursive: true });
    realMkdir(join(TEST_PLATFORM_PATH, 'servers'), { recursive: true });
    realMkdir(join(TEST_PLATFORM_PATH, 'worlds'), { recursive: true });

    app = await buildApp({ logger: false });
  });

  afterAll(async () => {
    if (app) await app.close();
    const { rmSync: realRmSync } = await vi.importActual<typeof import('fs')>('fs');
    realRmSync(TEST_PLATFORM_PATH, { recursive: true, force: true });
  });

  beforeEach(() => {
    // Do NOT use vi.clearAllMocks() as it resets the mock's own fn which breaks the __setImpl pattern
    vi.clearAllMocks();
    // Default: everything exists
    mockedExistsSync.mockReturnValue(true);
    // Default: execFile succeeds with empty output
    mockExecFileSuccess('', '');
  });

  // ============================================================
  // GET /api/backup/status
  // ============================================================
  describe('GET /api/backup/status', () => {
    it('should return configured=false when env vars are missing', async () => {
      const savedRepo = process.env['BACKUP_GITHUB_REPO'];
      const savedToken = process.env['BACKUP_GITHUB_TOKEN'];
      delete process.env['BACKUP_GITHUB_REPO'];
      delete process.env['BACKUP_GITHUB_TOKEN'];

      const response = await app.inject({
        method: 'GET',
        url: '/api/backup/status',
      });

      if (savedRepo !== undefined) process.env['BACKUP_GITHUB_REPO'] = savedRepo;
      if (savedToken !== undefined) process.env['BACKUP_GITHUB_TOKEN'] = savedToken;

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.configured).toBe(false);
      expect(body.lastBackup).toBeUndefined();
    });

    it('should return configured=true when env vars are set', async () => {
      process.env['BACKUP_GITHUB_REPO'] = 'user/test-backup';
      process.env['BACKUP_GITHUB_TOKEN'] = 'ghp_test';
      process.env['BACKUP_GITHUB_BRANCH'] = 'main';

      const response = await app.inject({
        method: 'GET',
        url: '/api/backup/status',
      });

      delete process.env['BACKUP_GITHUB_REPO'];
      delete process.env['BACKUP_GITHUB_TOKEN'];
      delete process.env['BACKUP_GITHUB_BRANCH'];

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.configured).toBe(true);
      expect(body.repository).toBe('user/test-backup');
      expect(body.branch).toBe('main');
    });

    it('should check <MCCTL_ROOT>/backups/worlds/.git for lastBackup (not platform/worlds/)', async () => {
      process.env['BACKUP_GITHUB_REPO'] = 'user/test-backup';
      process.env['BACKUP_GITHUB_TOKEN'] = 'ghp_test';

      // The route checks existsSync(join(BACKUP_CACHE_DIR, '.git'))
      const backupGitPath = join(BACKUP_CACHE_DIR, '.git');
      mockedExistsSync.mockImplementation((p: string) => {
        return String(p) === backupGitPath;
      });

      const capturedCwdValues = mockExecFileCapturesCwd('2024-01-15T10:00:00Z\n');

      const response = await app.inject({
        method: 'GET',
        url: '/api/backup/status',
      });

      delete process.env['BACKUP_GITHUB_REPO'];
      delete process.env['BACKUP_GITHUB_TOKEN'];

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      // lastBackup should be populated
      expect(body.lastBackup).toBe('2024-01-15T10:00:00Z');

      // Verify git was called with backup cache dir, NOT platform/worlds/
      const worldsPath = join(TEST_PLATFORM_PATH, 'worlds');
      expect(capturedCwdValues.length).toBeGreaterThan(0);
      for (const cwd of capturedCwdValues) {
        expect(cwd).not.toBe(worldsPath);
      }
      expect(capturedCwdValues[0]).toBe(BACKUP_CACHE_DIR);
    });

    it('should return lastBackup=undefined when backup cache .git does not exist', async () => {
      process.env['BACKUP_GITHUB_REPO'] = 'user/test-backup';
      process.env['BACKUP_GITHUB_TOKEN'] = 'ghp_test';

      // Cache .git does not exist
      mockedExistsSync.mockReturnValue(false);

      const response = await app.inject({
        method: 'GET',
        url: '/api/backup/status',
      });

      delete process.env['BACKUP_GITHUB_REPO'];
      delete process.env['BACKUP_GITHUB_TOKEN'];

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.configured).toBe(true);
      expect(body.lastBackup).toBeUndefined();
      // execFile should NOT have been called (no git repo to query)
      expect(mockedExecFile).not.toHaveBeenCalled();
    });
  });

  // ============================================================
  // GET /api/backup/history
  // ============================================================
  describe('GET /api/backup/history', () => {
    it('should return 400 when backup is not configured', async () => {
      const savedRepo = process.env['BACKUP_GITHUB_REPO'];
      const savedToken = process.env['BACKUP_GITHUB_TOKEN'];
      delete process.env['BACKUP_GITHUB_REPO'];
      delete process.env['BACKUP_GITHUB_TOKEN'];

      const response = await app.inject({
        method: 'GET',
        url: '/api/backup/history',
      });

      if (savedRepo !== undefined) process.env['BACKUP_GITHUB_REPO'] = savedRepo;
      if (savedToken !== undefined) process.env['BACKUP_GITHUB_TOKEN'] = savedToken;

      expect(response.statusCode).toBe(400);
    });

    it('should return empty commits when backup cache does not exist', async () => {
      process.env['BACKUP_GITHUB_REPO'] = 'user/test-backup';
      process.env['BACKUP_GITHUB_TOKEN'] = 'ghp_test';

      // Cache does not exist
      mockedExistsSync.mockReturnValue(false);

      const response = await app.inject({
        method: 'GET',
        url: '/api/backup/history',
      });

      delete process.env['BACKUP_GITHUB_REPO'];
      delete process.env['BACKUP_GITHUB_TOKEN'];

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.commits).toEqual([]);
      expect(body.total).toBe(0);
    });

    it('should use <MCCTL_ROOT>/backups/worlds for git log (not platform/worlds/)', async () => {
      process.env['BACKUP_GITHUB_REPO'] = 'user/test-backup';
      process.env['BACKUP_GITHUB_TOKEN'] = 'ghp_test';

      // existsSync(BACKUP_CACHE_DIR) must be true for the route to proceed
      mockedExistsSync.mockImplementation((p: string) =>
        String(p) === BACKUP_CACHE_DIR
      );

      const gitLogOutput = 'abc1234|Test backup|2024-01-15T10:00:00Z|Minecraft Backup\ndef5678|Initial setup|2024-01-14T10:00:00Z|Minecraft Backup';
      const capturedCwdValues = mockExecFileCapturesCwd(gitLogOutput);

      const response = await app.inject({
        method: 'GET',
        url: '/api/backup/history',
      });

      delete process.env['BACKUP_GITHUB_REPO'];
      delete process.env['BACKUP_GITHUB_TOKEN'];

      expect(response.statusCode).toBe(200);

      // Verify git was NOT called against platform/worlds/ path
      const worldsPath = join(TEST_PLATFORM_PATH, 'worlds');
      expect(capturedCwdValues.length).toBeGreaterThan(0);
      for (const cwd of capturedCwdValues) {
        expect(cwd).not.toBe(worldsPath);
      }
      // Should have called git against backup cache dir
      expect(capturedCwdValues.some(cwd => cwd === BACKUP_CACHE_DIR)).toBe(true);
    });

    it('should parse git log output correctly', async () => {
      process.env['BACKUP_GITHUB_REPO'] = 'user/test-backup';
      process.env['BACKUP_GITHUB_TOKEN'] = 'ghp_test';

      // existsSync(BACKUP_CACHE_DIR) must be true
      mockedExistsSync.mockImplementation((p: string) =>
        String(p) === BACKUP_CACHE_DIR
      );

      const gitLogOutput = 'abc1234|Scheduled backup|2024-01-15T10:00:00Z|Minecraft Backup\ndef5678|Manual backup|2024-01-14T10:00:00Z|Admin';
      mockExecFileSuccess(gitLogOutput);

      const response = await app.inject({
        method: 'GET',
        url: '/api/backup/history',
      });

      delete process.env['BACKUP_GITHUB_REPO'];
      delete process.env['BACKUP_GITHUB_TOKEN'];

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.commits).toHaveLength(2);
      expect(body.total).toBe(2);
      expect(body.commits[0].hash).toBe('abc1234');
      expect(body.commits[0].message).toBe('Scheduled backup');
      expect(body.commits[1].hash).toBe('def5678');
    });
  });

  // ============================================================
  // POST /api/backup/push
  // ============================================================
  describe('POST /api/backup/push', () => {
    it('should return 400 when backup is not configured', async () => {
      const savedRepo = process.env['BACKUP_GITHUB_REPO'];
      const savedToken = process.env['BACKUP_GITHUB_TOKEN'];
      delete process.env['BACKUP_GITHUB_REPO'];
      delete process.env['BACKUP_GITHUB_TOKEN'];

      const response = await app.inject({
        method: 'POST',
        url: '/api/backup/push',
        payload: {},
      });

      if (savedRepo !== undefined) process.env['BACKUP_GITHUB_REPO'] = savedRepo;
      if (savedToken !== undefined) process.env['BACKUP_GITHUB_TOKEN'] = savedToken;

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 when worlds directory does not exist', async () => {
      process.env['BACKUP_GITHUB_REPO'] = 'user/test-backup';
      process.env['BACKUP_GITHUB_TOKEN'] = 'ghp_test';

      mockedExistsSync.mockReturnValue(false);

      const response = await app.inject({
        method: 'POST',
        url: '/api/backup/push',
        payload: {},
      });

      delete process.env['BACKUP_GITHUB_REPO'];
      delete process.env['BACKUP_GITHUB_TOKEN'];

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toMatch(/worlds directory not found/i);
    });

    it('should use execFile (not exec) when backup script exists', async () => {
      process.env['BACKUP_GITHUB_REPO'] = 'user/test-backup';
      process.env['BACKUP_GITHUB_TOKEN'] = 'ghp_test';

      mockedExistsSync.mockReturnValue(true);

      // Track that execFile was called via captured calls
      const capturedCalls = mockExecFileCaptureCalls('Backup complete: abc1234');

      const response = await app.inject({
        method: 'POST',
        url: '/api/backup/push',
        payload: { message: 'Manual backup' },
      });

      delete process.env['BACKUP_GITHUB_REPO'];
      delete process.env['BACKUP_GITHUB_TOKEN'];

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);

      // execFile should have been called (captured via __setImpl)
      expect(capturedCalls.length).toBeGreaterThan(0);
      // exec (old way) should NOT have been called
      expect(mockedExec).not.toHaveBeenCalled();
    });

    it('should pass message as array argument to prevent shell injection', async () => {
      process.env['BACKUP_GITHUB_REPO'] = 'user/test-backup';
      process.env['BACKUP_GITHUB_TOKEN'] = 'ghp_test';

      mockedExistsSync.mockReturnValue(true);

      const capturedCalls = mockExecFileCaptureCalls();

      const maliciousMessage = '"; rm -rf / #';
      const response = await app.inject({
        method: 'POST',
        url: '/api/backup/push',
        payload: { message: maliciousMessage },
      });

      delete process.env['BACKUP_GITHUB_REPO'];
      delete process.env['BACKUP_GITHUB_TOKEN'];

      expect(response.statusCode).toBe(200);

      // The command itself should be 'bash' or 'git', not the malicious message
      expect(capturedCalls.length).toBeGreaterThan(0);
      const { cmd } = capturedCalls[0]!;
      expect(['bash', 'git']).toContain(cmd);
      // The command should not be interpolated with the message
      expect(cmd).not.toContain(maliciousMessage);
    });

    it('should use <MCCTL_ROOT>/backups/worlds as cwd for fallback git commands', async () => {
      process.env['BACKUP_GITHUB_REPO'] = 'user/test-backup';
      process.env['BACKUP_GITHUB_TOKEN'] = 'ghp_test';

      // Worlds dir exists, but backup.sh does NOT exist
      const scriptPath = join(TEST_PLATFORM_PATH, 'scripts', 'backup.sh');
      mockedExistsSync.mockImplementation((p: string) => {
        return String(p) !== scriptPath;
      });

      const capturedCwdValues = mockExecFileCapturesCwd();

      await app.inject({
        method: 'POST',
        url: '/api/backup/push',
        payload: {},
      });

      delete process.env['BACKUP_GITHUB_REPO'];
      delete process.env['BACKUP_GITHUB_TOKEN'];

      // Verify git fallback commands were NOT executed against platform/worlds/
      const worldsPath = join(TEST_PLATFORM_PATH, 'worlds');
      expect(capturedCwdValues.length).toBeGreaterThan(0);
      for (const cwd of capturedCwdValues) {
        expect(cwd).not.toBe(worldsPath);
      }

      // At least one call should use the backup cache dir
      const usesBackupCache = capturedCwdValues.some(cwd => cwd === BACKUP_CACHE_DIR);
      expect(usesBackupCache).toBe(true);
    });

    it('should handle "nothing to commit" as success', async () => {
      process.env['BACKUP_GITHUB_REPO'] = 'user/test-backup';
      process.env['BACKUP_GITHUB_TOKEN'] = 'ghp_test';

      mockedExistsSync.mockReturnValue(true);
      mockExecFileFailure('nothing to commit', 'nothing to commit, working tree clean');

      const response = await app.inject({
        method: 'POST',
        url: '/api/backup/push',
        payload: {},
      });

      delete process.env['BACKUP_GITHUB_REPO'];
      delete process.env['BACKUP_GITHUB_TOKEN'];

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.message).toMatch(/no changes/i);
    });
  });

  // ============================================================
  // POST /api/backup/restore
  // ============================================================
  describe('POST /api/backup/restore', () => {
    it('should return 400 when backup is not configured', async () => {
      const savedRepo = process.env['BACKUP_GITHUB_REPO'];
      const savedToken = process.env['BACKUP_GITHUB_TOKEN'];
      delete process.env['BACKUP_GITHUB_REPO'];
      delete process.env['BACKUP_GITHUB_TOKEN'];

      const response = await app.inject({
        method: 'POST',
        url: '/api/backup/restore',
        payload: { commitHash: 'abc1234' },
      });

      if (savedRepo !== undefined) process.env['BACKUP_GITHUB_REPO'] = savedRepo;
      if (savedToken !== undefined) process.env['BACKUP_GITHUB_TOKEN'] = savedToken;

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 when worlds directory does not exist', async () => {
      process.env['BACKUP_GITHUB_REPO'] = 'user/test-backup';
      process.env['BACKUP_GITHUB_TOKEN'] = 'ghp_test';

      mockedExistsSync.mockReturnValue(false);

      const response = await app.inject({
        method: 'POST',
        url: '/api/backup/restore',
        payload: { commitHash: 'abc1234' },
      });

      delete process.env['BACKUP_GITHUB_REPO'];
      delete process.env['BACKUP_GITHUB_TOKEN'];

      expect(response.statusCode).toBe(400);
    });

    it('should use execFile instead of exec for restore', async () => {
      process.env['BACKUP_GITHUB_REPO'] = 'user/test-backup';
      process.env['BACKUP_GITHUB_TOKEN'] = 'ghp_test';

      mockedExistsSync.mockReturnValue(true);
      const capturedCalls = mockExecFileCaptureCalls('Restore complete');

      const response = await app.inject({
        method: 'POST',
        url: '/api/backup/restore',
        payload: { commitHash: 'abc1234' },
      });

      delete process.env['BACKUP_GITHUB_REPO'];
      delete process.env['BACKUP_GITHUB_TOKEN'];

      expect(response.statusCode).toBe(200);
      // execFile should have been called (captured via __setImpl)
      expect(capturedCalls.length).toBeGreaterThan(0);
      // exec should NOT have been called
      expect(mockedExec).not.toHaveBeenCalled();
    });

    it('should pass commitHash as array argument (not interpolated into shell)', async () => {
      process.env['BACKUP_GITHUB_REPO'] = 'user/test-backup';
      process.env['BACKUP_GITHUB_TOKEN'] = 'ghp_test';

      mockedExistsSync.mockReturnValue(true);

      const capturedCalls = mockExecFileCaptureCalls();

      const maliciousHash = 'abc1234"; rm -rf /';
      await app.inject({
        method: 'POST',
        url: '/api/backup/restore',
        payload: { commitHash: maliciousHash },
      });

      delete process.env['BACKUP_GITHUB_REPO'];
      delete process.env['BACKUP_GITHUB_TOKEN'];

      // execFile should be called with command as first arg (not interpolated)
      expect(capturedCalls.length).toBeGreaterThan(0);
      const { cmd } = capturedCalls[0]!;
      expect(['bash', 'git']).toContain(cmd);
      expect(cmd).not.toContain(maliciousHash);
    });

    it('should return success message with commit hash', async () => {
      process.env['BACKUP_GITHUB_REPO'] = 'user/test-backup';
      process.env['BACKUP_GITHUB_TOKEN'] = 'ghp_test';

      mockedExistsSync.mockReturnValue(true);
      mockExecFileSuccess();

      const response = await app.inject({
        method: 'POST',
        url: '/api/backup/restore',
        payload: { commitHash: 'abc1234' },
      });

      delete process.env['BACKUP_GITHUB_REPO'];
      delete process.env['BACKUP_GITHUB_TOKEN'];

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.message).toContain('abc1234');
    });
  });
});
