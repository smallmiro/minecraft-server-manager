/**
 * DELETE /api/servers/:name with TypeScript deprovision (#735): the real
 * route, use case and ServerSpec repository on a temp root; the Docker and
 * avahi adapters are recording fakes, so no docker, sudo or /etc/avahi/hosts.
 *
 * Reproduces the #735 finding: the script-based route never passed the sudo
 * password, so avahi removal failed unless sudo needed none.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const ROOT = mkdtempSync(join(tmpdir(), 'mcctl-api-delete-'));
process.env.MCCTL_ROOT = ROOT;
process.env.AUTH_MODE = 'disabled';
process.env.NODE_ENV = 'test';

const fakes = vi.hoisted(() => ({
  avahi: [] as Array<{ sudoPassword?: string; unregistered: string[] }>,
  removed: [] as string[],
  removeResult: { success: true } as { success: boolean; error?: string },
}));

vi.mock('@minecraft-docker/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@minecraft-docker/shared')>();
  const { existsSync: exists } = await import('fs');
  const { join: joinPath } = await import('path');
  class FakeAvahi {
    readonly record: { sudoPassword?: string; unregistered: string[] };
    constructor(options: { sudoPassword?: string } = {}) {
      this.record = { sudoPassword: options.sudoPassword, unregistered: [] };
      fakes.avahi.push(this.record);
    }
    getStatus() {
      return 'running';
    }
    async register() {
      return { status: 'unchanged' };
    }
    async unregister(host: string) {
      this.record.unregistered.push(host);
      return { status: 'changed' };
    }
  }
  class FakeRuntime {
    async remove(name: { value: string }) {
      fakes.removed.push(name.value);
      return fakes.removeResult;
    }
  }
  return {
    ...actual,
    serverExists: vi.fn((name: string) => exists(joinPath(process.env.MCCTL_ROOT!, 'servers', name, 'config.env'))),
    AvahiHostnameRegistrarAdapter: FakeAvahi,
    DockerComposeRuntimeAdapter: FakeRuntime,
  };
});

vi.mock('@minecraft-docker/mod-source-modrinth', () => ({}));

vi.mock('../src/services/audit-log-service.js', () => ({
  writeAuditLog: vi.fn().mockResolvedValue(undefined),
}));

import { writeAuditLog } from '../src/services/audit-log-service.js';

const at = (...p: string[]) => join(ROOT, ...p);
const SECRET = 'top-secret-sudo';

describe('DELETE /api/servers/:name (#735)', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    const { config } = await import('../src/config/index.js');
    (config as { mcctlRoot: string }).mcctlRoot = ROOT;
    const { buildApp } = await import('../src/app.js');
    app = await buildApp({ logger: false });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    rmSync(ROOT, { recursive: true, force: true });
  });

  beforeEach(() => {
    vi.mocked(writeAuditLog).mockClear();
    fakes.avahi.length = 0;
    fakes.removed.length = 0;
    fakes.removeResult = { success: true };
    rmSync(at('servers'), { recursive: true, force: true });
    rmSync(at('worlds'), { recursive: true, force: true });
    mkdirSync(at('servers', 'alpha', 'data', 'alpha'), { recursive: true });
    mkdirSync(at('worlds'));
    writeFileSync(at('servers', 'alpha', 'config.env'), 'LEVEL=alpha\n');
    writeFileSync(at('servers', 'alpha', 'data', 'alpha', 'level.dat'), 'level');
    writeFileSync(at('servers', 'compose.yml'), 'include:\n  - alpha/docker-compose.yml\n');
  });

  it('deletes without a script: container, files, world kept in worlds/, hostname', async () => {
    const response = await app.inject({ method: 'DELETE', url: '/api/servers/alpha' });

    expect(response.statusCode, response.body).toBe(200);
    expect(response.json()).toEqual({ success: true, server: 'alpha', message: 'Server deleted successfully' });
    expect(fakes.removed).toEqual(['alpha']);
    expect(existsSync(at('servers', 'alpha'))).toBe(false);
    expect(existsSync(at('worlds', 'alpha', 'level.dat'))).toBe(true);
    expect(fakes.avahi.flatMap((a) => a.unregistered)).toEqual(['alpha.local']);
    expect(writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'server.delete', status: 'success', details: { force: false, deleteWorld: false } })
    );
  });

  it("hands the request's sudoPassword to the avahi adapter, never to logs, audit or env (#735)", async () => {
    const logged = [vi.spyOn(app.log, 'info'), vi.spyOn(app.log, 'error'), vi.spyOn(app.log, 'warn')];

    const response = await app.inject({ method: 'DELETE', url: '/api/servers/alpha', payload: { sudoPassword: SECRET } });

    expect(response.statusCode, response.body).toBe(200);
    expect(fakes.avahi).toEqual([{ sudoPassword: SECRET, unregistered: ['alpha.local'] }]);
    expect(JSON.stringify(vi.mocked(writeAuditLog).mock.calls)).not.toContain(SECRET);
    expect(JSON.stringify(logged.map((spy) => spy.mock.calls))).not.toContain(SECRET);
    expect(Object.values(process.env)).not.toContain(SECRET);
    logged.forEach((spy) => spy.mockRestore());
  });

  it('without a body there is no password (sudo -n, NOPASSWD)', async () => {
    await app.inject({ method: 'DELETE', url: '/api/servers/alpha' });
    expect(fakes.avahi.map((a) => a.sudoPassword)).toEqual([undefined]);
  });

  it('deleteWorld deletes the world inside the server', async () => {
    const response = await app.inject({ method: 'DELETE', url: '/api/servers/alpha?deleteWorld=true' });
    expect(response.statusCode).toBe(200);
    expect(existsSync(at('worlds', 'alpha'))).toBe(false);
    expect(writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({ details: { force: false, deleteWorld: true } }));
  });

  it('refuses an unsafe world plan with 500 before the container is touched (#652)', async () => {
    mkdirSync(at('worlds', 'alpha'));

    const response = await app.inject({ method: 'DELETE', url: '/api/servers/alpha', payload: { sudoPassword: SECRET } });

    expect(response.statusCode).toBe(500);
    expect(response.json().message).toMatch(/worlds\/alpha already exists/);
    expect(fakes.removed).toEqual([]);
    expect(existsSync(at('servers', 'alpha', 'data', 'alpha', 'level.dat'))).toBe(true);
    expect(writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({ status: 'failure' }));
    expect(JSON.stringify(vi.mocked(writeAuditLog).mock.calls)).not.toContain(SECRET);
  });

  it('a container that cannot be stopped fails with 500 and deletes nothing (#652)', async () => {
    fakes.removeResult = { success: false, error: 'Failed to stop container mc-alpha: boom' };
    const response = await app.inject({ method: 'DELETE', url: '/api/servers/alpha' });
    expect(response.statusCode).toBe(500);
    expect(response.json().message).toMatch(/stop container mc-alpha/);
    expect(existsSync(at('servers', 'alpha', 'data', 'alpha', 'level.dat'))).toBe(true);
  });

  it('404 for an unknown server', async () => {
    const response = await app.inject({ method: 'DELETE', url: '/api/servers/nope' });
    expect(response.statusCode).toBe(404);
    expect(fakes.removed).toEqual([]);
  });
});
