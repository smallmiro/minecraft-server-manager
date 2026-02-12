import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';

// Mock @minecraft-docker/shared module
vi.mock('@minecraft-docker/shared', () => ({
  // Existing mocks (keep them for other tests)
  getAllServers: vi.fn(),
  getServerInfoFromConfig: vi.fn(),
  serverExists: vi.fn(),
  getRouterDetailInfo: vi.fn(),
  getAvahiStatus: vi.fn(),

  // Playit-specific mocks
  getPlayitAgentStatus: vi.fn(),
  startPlayitAgent: vi.fn(),
  stopPlayitAgent: vi.fn(),
  getServerPlayitDomain: vi.fn(),

  // Audit log enum
  AuditActionEnum: {
    PLAYIT_START: 'PLAYIT_START',
    PLAYIT_STOP: 'PLAYIT_STOP',
  },
}));

// Mock audit log service
vi.mock('../src/services/audit-log-service.js', () => ({
  writeAuditLog: vi.fn().mockResolvedValue(undefined),
}));

describe('Playit Routes', () => {
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

  describe('GET /api/playit/status', () => {
    it('should return playit status with running agent', async () => {
      const { getPlayitAgentStatus, getAllServers, getServerPlayitDomain, getServerInfoFromConfig } = await import('@minecraft-docker/shared');

      // Mock playit agent status
      vi.mocked(getPlayitAgentStatus).mockResolvedValue({
        enabled: true,
        agentRunning: true,
        secretKeyConfigured: true,
        containerStatus: 'running',
        uptime: '2h 30m',
        uptimeSeconds: 9000,
      });

      // Mock servers list
      vi.mocked(getAllServers).mockReturnValue(['survival', 'creative']);

      // Mock server info for hostnames
      vi.mocked(getServerInfoFromConfig)
        .mockReturnValueOnce({
          name: 'survival',
          container: 'mc-survival',
          status: 'running',
          health: 'healthy',
          hostname: 'survival.192.168.1.5.nip.io',
        })
        .mockReturnValueOnce({
          name: 'creative',
          container: 'mc-creative',
          status: 'running',
          health: 'healthy',
          hostname: 'creative.192.168.1.5.nip.io',
        });

      // Mock playit domains
      vi.mocked(getServerPlayitDomain)
        .mockReturnValueOnce('aa.example.com')
        .mockReturnValueOnce(null);

      const response = await app.inject({
        method: 'GET',
        url: '/api/playit/status',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      expect(body).toEqual({
        enabled: true,
        agentRunning: true,
        secretKeyConfigured: true,
        containerStatus: 'running',
        uptime: '2h 30m',
        uptimeSeconds: 9000,
        servers: [
          {
            serverName: 'survival',
            playitDomain: 'aa.example.com',
            lanHostname: 'survival.192.168.1.5.nip.io',
          },
          {
            serverName: 'creative',
            playitDomain: null,
            lanHostname: 'creative.192.168.1.5.nip.io',
          },
        ],
      });
    });

    it('should return playit status when agent is stopped', async () => {
      const { getPlayitAgentStatus, getAllServers } = await import('@minecraft-docker/shared');

      vi.mocked(getPlayitAgentStatus).mockResolvedValue({
        enabled: true,
        agentRunning: false,
        secretKeyConfigured: true,
        containerStatus: 'exited',
      });

      vi.mocked(getAllServers).mockReturnValue([]);

      const response = await app.inject({
        method: 'GET',
        url: '/api/playit/status',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      expect(body.enabled).toBe(true);
      expect(body.agentRunning).toBe(false);
      expect(body.servers).toEqual([]);
    });

    it('should return playit status when not configured', async () => {
      const { getPlayitAgentStatus, getAllServers } = await import('@minecraft-docker/shared');

      vi.mocked(getPlayitAgentStatus).mockResolvedValue({
        enabled: false,
        agentRunning: false,
        secretKeyConfigured: false,
        containerStatus: 'not_found',
      });

      vi.mocked(getAllServers).mockReturnValue([]);

      const response = await app.inject({
        method: 'GET',
        url: '/api/playit/status',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      expect(body.enabled).toBe(false);
      expect(body.agentRunning).toBe(false);
      expect(body.secretKeyConfigured).toBe(false);
    });

    it('should handle errors gracefully', async () => {
      const { getPlayitAgentStatus } = await import('@minecraft-docker/shared');

      vi.mocked(getPlayitAgentStatus).mockRejectedValue(new Error('Docker not available'));

      const response = await app.inject({
        method: 'GET',
        url: '/api/playit/status',
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('InternalServerError');
    });
  });

  describe('POST /api/playit/start', () => {
    it('should start playit agent successfully', async () => {
      const { startPlayitAgent } = await import('@minecraft-docker/shared');

      vi.mocked(startPlayitAgent).mockResolvedValue({ success: true });

      const response = await app.inject({
        method: 'POST',
        url: '/api/playit/start',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      expect(body).toEqual({
        success: true,
        message: 'playit-agent started',
      });
      expect(startPlayitAgent).toHaveBeenCalledOnce();
    });

    it('should handle start failure', async () => {
      const { startPlayitAgent } = await import('@minecraft-docker/shared');

      vi.mocked(startPlayitAgent).mockResolvedValue({ success: false, error: 'compose failed' });

      const response = await app.inject({
        method: 'POST',
        url: '/api/playit/start',
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);

      expect(body.error).toBe('InternalServerError');
      expect(body.message).toBe('compose failed');
    });

    it('should handle errors gracefully', async () => {
      const { startPlayitAgent } = await import('@minecraft-docker/shared');

      vi.mocked(startPlayitAgent).mockRejectedValue(new Error('Docker not available'));

      const response = await app.inject({
        method: 'POST',
        url: '/api/playit/start',
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('InternalServerError');
    });
  });

  describe('POST /api/playit/stop', () => {
    it('should stop playit agent successfully', async () => {
      const { stopPlayitAgent } = await import('@minecraft-docker/shared');

      vi.mocked(stopPlayitAgent).mockResolvedValue(true);

      const response = await app.inject({
        method: 'POST',
        url: '/api/playit/stop',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      expect(body).toEqual({
        success: true,
        message: 'playit-agent stopped',
      });
      expect(stopPlayitAgent).toHaveBeenCalledOnce();
    });

    it('should handle stop failure', async () => {
      const { stopPlayitAgent } = await import('@minecraft-docker/shared');

      vi.mocked(stopPlayitAgent).mockResolvedValue(false);

      const response = await app.inject({
        method: 'POST',
        url: '/api/playit/stop',
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);

      expect(body.error).toBe('InternalServerError');
      expect(body.message).toContain('Failed to stop');
    });

    it('should handle errors gracefully', async () => {
      const { stopPlayitAgent } = await import('@minecraft-docker/shared');

      vi.mocked(stopPlayitAgent).mockRejectedValue(new Error('Docker not available'));

      const response = await app.inject({
        method: 'POST',
        url: '/api/playit/stop',
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('InternalServerError');
    });
  });
});
