import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';

const restartMock = vi.hoisted(() => vi.fn());

vi.mock('@minecraft-docker/shared', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@minecraft-docker/shared')>()),
  getRouterDetailInfoAsync: vi.fn(),
  getAvahiStatus: vi.fn().mockReturnValue('running'),
  getPlayitAgentStatus: vi.fn().mockResolvedValue({
    enabled: false,
    agentRunning: false,
    secretKeyConfigured: false,
    containerStatus: 'not_found',
  }),
  DockerComposeRuntimeAdapter: vi.fn().mockImplementation(() => ({ restart: restartMock })),
}));

vi.mock('../src/services/audit-log-service.js', () => ({
  writeAuditLog: vi.fn().mockResolvedValue(undefined),
}));

import authPlugin from '../src/plugins/auth.js';
import { routerPlugin } from '../src/routes/router.js';
import { writeAuditLog } from '../src/services/audit-log-service.js';
import { getRouterDetailInfoAsync, AuditActionEnum } from '@minecraft-docker/shared';

const API_KEY = 'test-api-key-12345';

const baseInfo = {
  name: 'mc-router',
  status: 'running' as const,
  health: 'healthy' as const,
  port: 25565,
  routes: [{ hostname: 'a.local', target: 'mc-a:25565', serverStatus: 'running' as const }],
};

describe('Router routes (#768)', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify({ logger: false });
    await app.register(authPlugin, { config: { mode: 'api-key', apiKey: API_KEY } });
    await app.register(routerPlugin);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    restartMock.mockReset();
  });

  const auth = { 'x-api-key': API_KEY };

  describe('GET /api/router/status', () => {
    it('passes through the new optional fields', async () => {
      vi.mocked(getRouterDetailInfoAsync).mockResolvedValue({
        ...baseInfo,
        image: 'itzg/mc-router:1.2.3',
        autoScale: { up: true, down: true, downAfter: '10m', asleepMotd: 'zzz' },
        resolver: { hostIp: '192.168.1.5', hostIps: ['192.168.1.5', '10.0.0.2'] },
        routes: [
          {
            ...baseInfo.routes[0]!,
            autoScaleUp: true,
            autoScaleDown: false,
            discoveredByRouter: true,
          },
        ],
      });

      const res = await app.inject({ method: 'GET', url: '/api/router/status', headers: auth });
      expect(res.statusCode).toBe(200);
      const { router } = res.json();
      expect(router.image).toBe('itzg/mc-router:1.2.3');
      expect(router.autoScale).toEqual({ up: true, down: true, downAfter: '10m', asleepMotd: 'zzz' });
      expect(router.resolver).toEqual({ hostIp: '192.168.1.5', hostIps: ['192.168.1.5', '10.0.0.2'] });
      expect(router.routes[0]).toMatchObject({
        autoScaleUp: true,
        autoScaleDown: false,
        discoveredByRouter: true,
      });
    });

    it('omits the new fields when absent (backwards compatible)', async () => {
      vi.mocked(getRouterDetailInfoAsync).mockResolvedValue(baseInfo);

      const res = await app.inject({ method: 'GET', url: '/api/router/status', headers: auth });
      expect(res.statusCode).toBe(200);
      const { router } = res.json();
      for (const key of ['image', 'autoScale', 'resolver']) expect(router).not.toHaveProperty(key);
      for (const key of ['autoScaleUp', 'autoScaleDown', 'discoveredByRouter']) {
        expect(router.routes[0]).not.toHaveProperty(key);
      }
      expect(router.routes[0]).toMatchObject({ hostname: 'a.local', target: 'mc-a:25565' });
    });

    it('allows resolver without hostIp and autoScale without optional strings', async () => {
      vi.mocked(getRouterDetailInfoAsync).mockResolvedValue({
        ...baseInfo,
        autoScale: { up: false, down: false },
        resolver: { hostIps: [] },
      });

      const res = await app.inject({ method: 'GET', url: '/api/router/status', headers: auth });
      expect(res.statusCode).toBe(200);
      const { router } = res.json();
      expect(router.autoScale).toEqual({ up: false, down: false });
      expect(router.resolver).toEqual({ hostIps: [] });
    });
  });

  describe('POST /api/router/restart', () => {
    it('returns 401 without credentials and does nothing', async () => {
      const res = await app.inject({ method: 'POST', url: '/api/router/restart' });
      expect(res.statusCode).toBe(401);
      expect(restartMock).not.toHaveBeenCalled();
      expect(writeAuditLog).not.toHaveBeenCalled();
    });

    it('restarts the router and writes a success audit entry', async () => {
      restartMock.mockResolvedValue({ success: true });

      const res = await app.inject({ method: 'POST', url: '/api/router/restart', headers: auth });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toMatchObject({ success: true, message: expect.any(String) });
      expect(restartMock).toHaveBeenCalledWith('router');
      expect(writeAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditActionEnum.ROUTER_RESTART,
          targetType: 'service',
          targetName: 'mc-router',
          status: 'success',
        })
      );
    });

    it('returns 500 and a failure audit entry when the restart fails', async () => {
      restartMock.mockResolvedValue({ success: false, error: 'compose failed' });

      const res = await app.inject({ method: 'POST', url: '/api/router/restart', headers: auth });
      expect(res.statusCode).toBe(500);
      expect(res.json()).toEqual({ error: 'InternalServerError', message: 'compose failed' });
      expect(writeAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditActionEnum.ROUTER_RESTART,
          status: 'failure',
          errorMessage: 'compose failed',
        })
      );
    });

    it('returns 500 and a failure audit entry when the adapter throws', async () => {
      restartMock.mockRejectedValue(new Error('docker missing'));

      const res = await app.inject({ method: 'POST', url: '/api/router/restart', headers: auth });
      expect(res.statusCode).toBe(500);
      expect(writeAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'failure', errorMessage: 'docker missing' })
      );
    });
  });
});
