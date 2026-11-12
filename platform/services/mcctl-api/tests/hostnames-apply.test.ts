/**
 * POST /api/servers/:name/hostnames/apply (#671): saved hostnames reach
 * mc-router only on a new container, so the route recreates it through the
 * runtime port (fake container, no docker).
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { RuntimeActionResult, ServerName } from '@minecraft-docker/shared';
import { buildApp } from '../src/app.js';
import type { ApiContainer } from '../src/plugins/container.js';

vi.mock('@minecraft-docker/shared', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@minecraft-docker/shared')>()),
  serverExists: vi.fn(),
}));

vi.mock('@minecraft-docker/mod-source-modrinth', () => ({}));

vi.mock('../src/services/audit-log-service.js', () => ({
  writeAuditLog: vi.fn().mockResolvedValue(undefined),
}));

describe('POST /api/servers/:name/hostnames/apply', () => {
  let app: FastifyInstance;
  const recreate = vi.fn<(name: ServerName | string) => Promise<RuntimeActionResult>>();
  const container: Partial<ApiContainer> = {
    containerRuntime: () => ({ recreate }) as never,
  };

  beforeAll(async () => {
    app = await buildApp({ logger: false, container });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    const { serverExists } = await import('@minecraft-docker/shared');
    vi.mocked(serverExists).mockReturnValue(true);
  });

  const apply = (name = 'factory') => app.inject({ method: 'POST', url: `/api/servers/${name}/hostnames/apply` });

  it('recreates the server container and audits it as a hostname change', async () => {
    recreate.mockResolvedValue({ success: true });

    const res = await apply();

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ success: true, serverName: 'factory' });
    expect(recreate).toHaveBeenCalledTimes(1);
    expect(String(recreate.mock.calls[0]![0])).toBe('factory');
    const { writeAuditLog } = await import('../src/services/audit-log-service.js');
    expect(writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'server.hostname', targetName: 'factory', status: 'success', details: { applied: true } })
    );
  });

  it('is 404 for an unknown server and recreates nothing', async () => {
    const { serverExists } = await import('@minecraft-docker/shared');
    vi.mocked(serverExists).mockReturnValue(false);

    const res = await apply();

    expect(res.statusCode).toBe(404);
    expect(recreate).not.toHaveBeenCalled();
  });

  it('is 500 with the compose output when the recreate fails', async () => {
    recreate.mockResolvedValue({ success: false, error: 'Command failed', stderr: 'no such service: mc-factory' });

    const res = await apply();

    expect(res.statusCode).toBe(500);
    expect(res.json().message).toContain('no such service: mc-factory');
    const { writeAuditLog } = await import('../src/services/audit-log-service.js');
    expect(writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({ status: 'failure' }));
  });
});
