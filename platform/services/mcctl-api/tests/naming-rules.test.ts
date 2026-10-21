import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { FastifyInstance } from 'fastify';
import { resolveMcctlRoot } from '@minecraft-docker/shared';
import { buildApp } from '../src/app.js';

vi.mock('../src/services/audit-log-service.js', () => ({
  writeAuditLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('child_process')>();
  return { ...actual, execFile: vi.fn() };
});

import { execFile } from 'child_process';

/** Answer docker compose calls with success. */
function mockComposeSuccess() {
  vi.mocked(execFile).mockImplementation(((...args: unknown[]) => {
    const callback = args[args.length - 1];
    if (typeof callback === 'function') callback(null, 'Started', '');
    return {} as ReturnType<typeof execFile>;
  }) as never);
}

describe('Unified naming rules in the API (#649)', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp({ logger: false });
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('POST /api/servers uses the shared new-name rule', () => {
    it.each(['router', 'a', 'a'.repeat(33), 'server-', 'my--server', '1server'])(
      'rejects %s',
      async (name) => {
        const response = await app.inject({
          method: 'POST',
          url: '/api/servers',
          payload: { name, type: 'PAPER' },
        });
        expect(response.statusCode).toBe(400);
      }
    );

    it('rejects a worldName that is not a valid world name', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/servers',
        payload: { name: 'survival', worldName: '../escape' },
      });
      expect(response.statusCode).toBe(400);
    });
  });

  describe('server name path params use the existing-name rule', () => {
    it.each(['bad.name', '..%2Fservers', 'a%3Bid', 'a%20b'])('rejects %s', async (name) => {
      for (const url of [
        `/api/servers/${name}`,
        `/api/servers/${name}/config`,
        `/api/servers/${name}/config-snapshots`,
      ]) {
        const response = await app.inject({ method: 'GET', url });
        expect(response.statusCode, url).toBe(400);
      }
    });

    it('rejects a server name with shell metacharacters on delete', async () => {
      const response = await app.inject({ method: 'DELETE', url: '/api/servers/a%3Bid' });
      expect(response.statusCode).toBe(400);
    });
  });

  describe('server actions accept existing names and only warn', () => {
    it('starts a legacy-named server and logs a warning', async () => {
      mockComposeSuccess();
      const warn = vi.spyOn(app.log, 'warn');

      const response = await app.inject({ method: 'POST', url: '/api/servers/My_Server/start' });

      expect(response.statusCode).toBe(200);
      expect(warn).toHaveBeenCalled();
    });

    it('does not warn for a name that follows the rule', async () => {
      mockComposeSuccess();
      const warn = vi.spyOn(app.log, 'warn');

      await app.inject({ method: 'POST', url: '/api/servers/survival/start' });

      expect(warn).not.toHaveBeenCalled();
    });

    it('rejects names that are unsafe even for existing servers', async () => {
      const response = await app.inject({ method: 'POST', url: '/api/servers/-x/start' });
      expect(response.statusCode).toBe(400);
    });
  });
});

describe('API root path (#649)', () => {
  const saved = { MCCTL_ROOT: process.env['MCCTL_ROOT'], PLATFORM_PATH: process.env['PLATFORM_PATH'] };

  afterEach(() => {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    vi.resetModules();
  });

  it('resolves one root like shared Paths and ignores PLATFORM_PATH', async () => {
    process.env['MCCTL_ROOT'] = '/srv/mc/';
    process.env['PLATFORM_PATH'] = '/somewhere/else';
    vi.resetModules();

    const { config } = await import('../src/config/index.js');

    expect(config.mcctlRoot).toBe(resolveMcctlRoot());
    expect(config.mcctlRoot).toBe('/srv/mc');
  });
});
