import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';

// Mock audit-log-service
vi.mock('../src/services/audit-log-service.js', () => ({
  writeAuditLog: vi.fn().mockResolvedValue(undefined),
}));

// Mock child_process so no real docker compose runs
vi.mock('child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('child_process')>();
  return {
    ...actual,
    exec: vi.fn(),
    execFile: vi.fn(),
  };
});

// BACKUP_AUTO_ON_STOP (#734, #732 B-Q9): a fake backup port
const backupPort = {
  status: vi.fn(),
  push: vi.fn(),
};
vi.mock('../src/lib/world-backup.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/lib/world-backup.js')>();
  return { ...actual, createWorldBackupPort: vi.fn(() => backupPort) };
});

function autoOnStop(enabled: boolean) {
  backupPort.status.mockResolvedValue({
    ok: true,
    value: { configured: true, branch: 'main', autoOnStop: enabled },
  });
}

import { exec, execFile } from 'child_process';

const mockedExec = vi.mocked(exec);
const mockedExecFile = vi.mocked(execFile);

/** Answer docker compose calls through the execFile callback. */
function mockCompose(error: Error | null, stdout: string, stderr = '') {
  mockedExecFile.mockImplementation(((...args: unknown[]) => {
    const callback = args[args.length - 1];
    if (typeof callback === 'function') {
      callback(error, stdout, stderr);
    }
    return {} as ReturnType<typeof execFile>;
  }) as never);
}

describe('Server Action Routes', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp({ logger: false });
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    autoOnStop(false);
    backupPort.push.mockResolvedValue({
      ok: true,
      value: { changed: true, commit: 'abc1234', flushed: [], skipped: [], warnings: [] },
    });
  });

  describe('POST /api/servers/:name/start', () => {
    it('should start a server successfully', async () => {
      // Mock successful docker compose up
      mockCompose(null, 'Starting mc-myserver...\nmc-myserver Started', '');

      const response = await app.inject({
        method: 'POST',
        url: '/api/servers/myserver/start',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.server).toBe('myserver');
      expect(body.action).toBe('start');
      expect(backupPort.status).not.toHaveBeenCalled(); // only a stop backs up
    });

    it('should return 400 for invalid server name', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/servers/invalid server!/start',
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBeDefined();
    });

    it('should return 500 when docker compose fails', async () => {
      mockCompose(new Error('Container not found'), '', 'Error: No such container');

      const response = await app.inject({
        method: 'POST',
        url: '/api/servers/nonexistent/start',
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error).toBeDefined();
    });
  });

  describe('POST /api/servers/:name/stop', () => {
    it('should stop a server successfully', async () => {
      mockCompose(null, 'Stopping mc-myserver...', '');

      const response = await app.inject({
        method: 'POST',
        url: '/api/servers/myserver/stop',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.server).toBe('myserver');
      expect(body.action).toBe('stop');
    });

    it('should return 500 when stop fails', async () => {
      mockCompose(new Error('Permission denied'), '', 'Error: Permission denied');

      const response = await app.inject({
        method: 'POST',
        url: '/api/servers/myserver/stop',
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
    });

    it('runs the auto-backup after a stop when BACKUP_AUTO_ON_STOP=true (#734)', async () => {
      mockCompose(null, 'Stopping mc-myserver...', '');
      autoOnStop(true);

      const response = await app.inject({ method: 'POST', url: '/api/servers/myserver/stop' });

      expect(response.statusCode).toBe(200);
      await vi.waitFor(() =>
        expect(backupPort.push).toHaveBeenCalledWith(expect.objectContaining({ lockWaitMs: 600_000 }))
      );
    });

    it('does not back up when BACKUP_AUTO_ON_STOP is off', async () => {
      mockCompose(null, 'Stopping mc-myserver...', '');

      const response = await app.inject({ method: 'POST', url: '/api/servers/myserver/stop' });

      expect(response.statusCode).toBe(200);
      await vi.waitFor(() => expect(backupPort.status).toHaveBeenCalled());
      expect(backupPort.push).not.toHaveBeenCalled();
    });

    it('a failed auto-backup does not fail the stop', async () => {
      mockCompose(null, 'Stopping mc-myserver...', '');
      autoOnStop(true);
      backupPort.push.mockResolvedValue({ ok: false, error: { code: 'auth_failed', message: 'bad token' } });

      const response = await app.inject({ method: 'POST', url: '/api/servers/myserver/stop' });

      expect(response.statusCode).toBe(200);
      expect(response.json().success).toBe(true);
      await vi.waitFor(() => expect(backupPort.push).toHaveBeenCalled());
    });

    it('close waits for a running auto-backup so its save-on recovery finishes (#734 review)', async () => {
      const local = await buildApp({ logger: false });
      mockCompose(null, 'Stopping mc-myserver...', '');
      autoOnStop(true);
      let finishPush!: () => void;
      backupPort.push.mockImplementation(
        () =>
          new Promise((resolve) => {
            finishPush = () =>
              resolve({ ok: true, value: { changed: true, commit: 'abc1234', flushed: [], skipped: [], warnings: [] } });
          })
      );

      expect((await local.inject({ method: 'POST', url: '/api/servers/myserver/stop' })).statusCode).toBe(200);
      await vi.waitFor(() => expect(backupPort.push).toHaveBeenCalled());

      let closed = false;
      const closing = local.close().then(() => {
        closed = true;
      });
      await new Promise((r) => setTimeout(r, 50));
      expect(closed).toBe(false);

      finishPush();
      await closing;
      expect(closed).toBe(true);
    });

    it('does not back up when the stop failed', async () => {
      mockCompose(new Error('Permission denied'), '', 'Error: Permission denied');
      autoOnStop(true);

      await app.inject({ method: 'POST', url: '/api/servers/myserver/stop' });

      expect(backupPort.status).not.toHaveBeenCalled();
      expect(backupPort.push).not.toHaveBeenCalled();
    });
  });

  describe('POST /api/servers/:name/restart', () => {
    it('should restart a server successfully', async () => {
      mockCompose(null, 'Restarting mc-myserver...', '');

      const response = await app.inject({
        method: 'POST',
        url: '/api/servers/myserver/restart',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.server).toBe('myserver');
      expect(body.action).toBe('restart');
    });

    it('should return 500 when restart fails', async () => {
      mockCompose(new Error('Docker daemon not running'), '', 'Cannot connect to Docker daemon');

      const response = await app.inject({
        method: 'POST',
        url: '/api/servers/myserver/restart',
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
    });
  });

  describe('docker compose runs without a shell (#720)', () => {
    it.each([
      ['start', ['compose', 'up', '-d', 'mc-My_Server']],
      ['stop', ['compose', 'stop', 'mc-My_Server']],
      ['restart', ['compose', 'restart', 'mc-My_Server']],
    ])('%s passes the service name as one argument', async (action, args) => {
      mockCompose(null, 'ok', '');

      const response = await app.inject({
        method: 'POST',
        url: `/api/servers/My_Server/${action}`,
      });

      expect(response.statusCode).toBe(200);
      expect(mockedExec).not.toHaveBeenCalled();
      expect(mockedExecFile).toHaveBeenCalledWith(
        'docker',
        args,
        expect.objectContaining({
          timeout: 60000,
          env: expect.objectContaining({ COMPOSE_FILE: 'docker-compose.yml' }),
        }),
        expect.any(Function)
      );
    });
  });

  describe('Server name validation', () => {
    it('should reject names with special characters', async () => {
      const invalidNames = ['my server', 'server@test', 'server/name', 'server;cmd'];

      for (const name of invalidNames) {
        const response = await app.inject({
          method: 'POST',
          url: `/api/servers/${encodeURIComponent(name)}/start`,
        });

        expect(response.statusCode).toBe(400);
      }
    });

    it('should accept valid server names', async () => {
      mockCompose(null, 'Started', '');

      const validNames = ['myserver', 'my-server', 'server123', 'My_Server'];

      for (const name of validNames) {
        const response = await app.inject({
          method: 'POST',
          url: `/api/servers/${name}/start`,
        });

        expect(response.statusCode).toBe(200);
      }
    });
  });
});

describe('Server Action Routes - Response Format', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp({ logger: false });
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockCompose(null, 'Success', '');
  });

  it('should return JSON content type', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/servers/myserver/start',
    });

    expect(response.headers['content-type']).toContain('application/json');
  });

  it('should include timestamp in response', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/servers/myserver/start',
    });

    const body = JSON.parse(response.body);
    expect(body.timestamp).toBeDefined();
    expect(new Date(body.timestamp).toISOString()).toBe(body.timestamp);
  });
});
