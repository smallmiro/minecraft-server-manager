import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { autoBackupCloseLimits } from '../src/routes/servers/actions.js';

// Mock audit-log-service
vi.mock('../src/services/audit-log-service.js', () => ({
  writeAuditLog: vi.fn().mockResolvedValue(undefined),
}));

// BACKUP_AUTO_ON_STOP (#734, #732 B-Q9): a fake backup port
const backupPort = {
  status: vi.fn(),
  push: vi.fn(),
};
// The actions go through the container runtime port (#875): a fake one, so no docker runs
const runtime = { start: vi.fn(), stop: vi.fn(), restart: vi.fn() };
const withBackupPort = {
  logger: false,
  container: { worldBackupPort: () => backupPort as never, containerRuntime: () => runtime as never },
};

function autoOnStop(enabled: boolean) {
  backupPort.status.mockResolvedValue({
    ok: true,
    value: { configured: true, branch: 'main', autoOnStop: enabled },
  });
}

/** Answer every runtime action with this result; an error makes it a failed one. */
function mockAction(error: Error | null, stdout: string, stderr = '') {
  const result = error ? { success: false, stdout, stderr, error: error.message } : { success: true, stdout, stderr };
  for (const action of Object.values(runtime)) action.mockResolvedValue(result);
}

describe('Server Action Routes', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp(withBackupPort);
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
      mockAction(null, 'Starting mc-myserver...\nmc-myserver Started', '');

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
      mockAction(new Error('Container not found'), '', 'Error: No such container');

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
      mockAction(null, 'Stopping mc-myserver...', '');

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
      mockAction(new Error('Permission denied'), '', 'Error: Permission denied');

      const response = await app.inject({
        method: 'POST',
        url: '/api/servers/myserver/stop',
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
    });

    it('runs the auto-backup after a stop when BACKUP_AUTO_ON_STOP=true (#734)', async () => {
      mockAction(null, 'Stopping mc-myserver...', '');
      autoOnStop(true);

      const response = await app.inject({ method: 'POST', url: '/api/servers/myserver/stop' });

      expect(response.statusCode).toBe(200);
      await vi.waitFor(() =>
        expect(backupPort.push).toHaveBeenCalledWith(expect.objectContaining({ lockWaitMs: 600_000 }))
      );
    });

    it('does not back up when BACKUP_AUTO_ON_STOP is off', async () => {
      mockAction(null, 'Stopping mc-myserver...', '');

      const response = await app.inject({ method: 'POST', url: '/api/servers/myserver/stop' });

      expect(response.statusCode).toBe(200);
      await vi.waitFor(() => expect(backupPort.status).toHaveBeenCalled());
      expect(backupPort.push).not.toHaveBeenCalled();
    });

    it('a failed auto-backup does not fail the stop', async () => {
      mockAction(null, 'Stopping mc-myserver...', '');
      autoOnStop(true);
      backupPort.push.mockResolvedValue({ ok: false, error: { code: 'auth_failed', message: 'bad token' } });

      const response = await app.inject({ method: 'POST', url: '/api/servers/myserver/stop' });

      expect(response.statusCode).toBe(200);
      expect(response.json().success).toBe(true);
      await vi.waitFor(() => expect(backupPort.push).toHaveBeenCalled());
    });

    it('close waits for a running auto-backup so its save-on recovery finishes (#734 review)', async () => {
      const local = await buildApp(withBackupPort);
      mockAction(null, 'Stopping mc-myserver...', '');
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

    it('aborts a backup still running late in the close wait, so it turns auto-save back on first (#734 review)', async () => {
      const defaults = { ...autoBackupCloseLimits };
      Object.assign(autoBackupCloseLimits, { abortAfterMs: 30, waitMs: 5_000 });
      try {
        const local = await buildApp(withBackupPort);
        mockAction(null, 'Stopping mc-myserver...', '');
        autoOnStop(true);
        let signal: AbortSignal | undefined;
        // A backup that only ends when aborted (a long copy), like GitWorldBackupAdapter
        backupPort.push.mockImplementation(
          (options?: { signal?: AbortSignal }) =>
            new Promise((resolve) => {
              signal = options?.signal;
              signal?.addEventListener('abort', () =>
                resolve({ ok: false, error: { code: 'aborted', message: 'Backup aborted (shutting down)' } })
              );
            })
        );

        expect((await local.inject({ method: 'POST', url: '/api/servers/myserver/stop' })).statusCode).toBe(200);
        await vi.waitFor(() => expect(backupPort.push).toHaveBeenCalled());
        expect(signal?.aborted).toBe(false);

        await local.close();
        expect(signal?.aborted).toBe(true);
      } finally {
        Object.assign(autoBackupCloseLimits, defaults);
      }
    });

    it('does not back up when the stop failed', async () => {
      mockAction(new Error('Permission denied'), '', 'Error: Permission denied');
      autoOnStop(true);

      await app.inject({ method: 'POST', url: '/api/servers/myserver/stop' });

      expect(backupPort.status).not.toHaveBeenCalled();
      expect(backupPort.push).not.toHaveBeenCalled();
    });
  });

  describe('POST /api/servers/:name/restart', () => {
    it('should restart a server successfully', async () => {
      mockAction(null, 'Restarting mc-myserver...', '');

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
      mockAction(new Error('Docker daemon not running'), '', 'Cannot connect to Docker daemon');

      const response = await app.inject({
        method: 'POST',
        url: '/api/servers/myserver/restart',
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
    });
  });

  describe('actions run through the container runtime port (#875)', () => {
    it.each(['start', 'stop', 'restart'] as const)('%s passes the server name to the runtime', async (action) => {
      mockAction(null, 'ok', '');

      const response = await app.inject({
        method: 'POST',
        url: `/api/servers/My_Server/${action}`,
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().message).toBe('ok');
      expect(runtime[action]).toHaveBeenCalledTimes(1);
      expect(runtime[action].mock.calls[0][0].value).toBe('My_Server');
    });

    it('returns the runtime error and stderr on a failed action', async () => {
      mockAction(new Error('Command failed: docker compose up'), '', 'no such service');

      const response = await app.inject({ method: 'POST', url: '/api/servers/myserver/start' });

      expect(response.statusCode).toBe(500);
      expect(response.json()).toMatchObject({
        success: false,
        error: 'Command failed: docker compose up',
        message: 'no such service',
      });
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
      mockAction(null, 'Started', '');

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
    app = await buildApp(withBackupPort);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockAction(null, 'Success', '');
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
