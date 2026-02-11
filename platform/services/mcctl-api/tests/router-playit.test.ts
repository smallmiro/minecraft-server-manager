import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';

// Mock @minecraft-docker/shared module
vi.mock('@minecraft-docker/shared', () => ({
  getRouterDetailInfo: vi.fn(),
  getAvahiStatus: vi.fn(),
  getPlayitAgentStatus: vi.fn(),
  getAllServers: vi.fn(),
  getServerInfoFromConfig: vi.fn(),
  serverExists: vi.fn(),
  getServerDetailedInfo: vi.fn(),
  getServerPlayitDomain: vi.fn(),
  AuditActionEnum: {},
}));

// Mock audit log service
vi.mock('../src/services/audit-log-service.js', () => ({
  writeAuditLog: vi.fn().mockResolvedValue(undefined),
}));

describe('Router Routes - Playit Integration', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp({ logger: false });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/router/status - with playit field', () => {
    it('should include playit status in router response', async () => {
      const { getRouterDetailInfo, getAvahiStatus, getPlayitAgentStatus } = await import('@minecraft-docker/shared');

      vi.mocked(getRouterDetailInfo).mockReturnValue({
        name: 'mc-router',
        status: 'running',
        health: 'healthy',
        port: 25565,
        uptime: '1h 30m',
        uptimeSeconds: 5400,
        mode: 'auto-scale',
        routes: [],
      });

      vi.mocked(getAvahiStatus).mockReturnValue('running');

      vi.mocked(getPlayitAgentStatus).mockResolvedValue({
        enabled: true,
        agentRunning: true,
        secretKeyConfigured: true,
        containerStatus: 'running',
        uptime: '2h 30m',
        uptimeSeconds: 9000,
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/router/status',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      expect(body).toHaveProperty('router');
      expect(body).toHaveProperty('avahi');
      expect(body).toHaveProperty('playit');

      expect(body.playit).toEqual({
        enabled: true,
        agentRunning: true,
        secretKeyConfigured: true,
      });
    });

    it('should omit playit field when playit status fails', async () => {
      const { getRouterDetailInfo, getAvahiStatus, getPlayitAgentStatus } = await import('@minecraft-docker/shared');

      vi.mocked(getRouterDetailInfo).mockReturnValue({
        name: 'mc-router',
        status: 'running',
        health: 'healthy',
        port: 25565,
        routes: [],
      });

      vi.mocked(getAvahiStatus).mockReturnValue('running');

      vi.mocked(getPlayitAgentStatus).mockRejectedValue(new Error('Docker not available'));

      const response = await app.inject({
        method: 'GET',
        url: '/api/router/status',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      expect(body).toHaveProperty('router');
      expect(body).toHaveProperty('avahi');
      expect(body).not.toHaveProperty('playit');
    });

    it('should include playit status when agent is disabled', async () => {
      const { getRouterDetailInfo, getAvahiStatus, getPlayitAgentStatus } = await import('@minecraft-docker/shared');

      vi.mocked(getRouterDetailInfo).mockReturnValue({
        name: 'mc-router',
        status: 'running',
        health: 'healthy',
        port: 25565,
        routes: [],
      });

      vi.mocked(getAvahiStatus).mockReturnValue('running');

      vi.mocked(getPlayitAgentStatus).mockResolvedValue({
        enabled: false,
        agentRunning: false,
        secretKeyConfigured: false,
        containerStatus: 'not_found',
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/router/status',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      expect(body.playit).toEqual({
        enabled: false,
        agentRunning: false,
        secretKeyConfigured: false,
      });
    });
  });
});
