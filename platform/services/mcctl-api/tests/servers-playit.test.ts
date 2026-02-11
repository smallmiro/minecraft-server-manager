import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';

// Mock @minecraft-docker/shared module
vi.mock('@minecraft-docker/shared', () => ({
  getAllServers: vi.fn(),
  getServerInfoFromConfig: vi.fn(),
  serverExists: vi.fn(),
  getServerDetailedInfo: vi.fn(),
  getServerPlayitDomain: vi.fn(),
  containerExists: vi.fn(),
  getContainerLogs: vi.fn(),
  getContainerStatus: vi.fn(),
  getContainerHealth: vi.fn(),
  stopContainer: vi.fn(),
  AuditActionEnum: {},
}));

// Mock audit log service
vi.mock('../src/services/audit-log-service.js', () => ({
  writeAuditLog: vi.fn().mockResolvedValue(undefined),
}));

describe('Server Routes - Playit Domain Integration', () => {
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

  describe('GET /api/servers/:name - with playitDomain field', () => {
    it('should include playitDomain when server has external access configured', async () => {
      const { serverExists, getServerDetailedInfo, getServerPlayitDomain } = await import('@minecraft-docker/shared');

      vi.mocked(serverExists).mockReturnValue(true);

      vi.mocked(getServerDetailedInfo).mockResolvedValue({
        name: 'survival',
        container: 'mc-survival',
        status: 'running',
        health: 'healthy',
        hostname: 'survival.192.168.1.5.nip.io',
        type: 'PAPER',
        version: '1.21.1',
        memory: '4G',
        uptime: '1h 30m',
        uptimeSeconds: 5400,
      });

      vi.mocked(getServerPlayitDomain).mockReturnValue('aa.example.com');

      const response = await app.inject({
        method: 'GET',
        url: '/api/servers/survival',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      expect(body.server).toHaveProperty('playitDomain');
      expect(body.server.playitDomain).toBe('aa.example.com');
    });

    it('should include null playitDomain when server has no external access', async () => {
      const { serverExists, getServerDetailedInfo, getServerPlayitDomain } = await import('@minecraft-docker/shared');

      vi.mocked(serverExists).mockReturnValue(true);

      vi.mocked(getServerDetailedInfo).mockResolvedValue({
        name: 'creative',
        container: 'mc-creative',
        status: 'running',
        health: 'healthy',
        hostname: 'creative.192.168.1.5.nip.io',
        type: 'VANILLA',
        version: '1.21.1',
      });

      vi.mocked(getServerPlayitDomain).mockReturnValue(null);

      const response = await app.inject({
        method: 'GET',
        url: '/api/servers/creative',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      expect(body.server).toHaveProperty('playitDomain');
      expect(body.server.playitDomain).toBeNull();
    });
  });
});
