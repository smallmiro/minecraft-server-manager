import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Mocks (vi.mock factories are hoisted) ---

vi.mock('next/headers', () => ({
  headers: vi.fn(async () => new Headers({ cookie: 'session=test' })),
}));

vi.mock('@/lib/auth', () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    },
  },
  getServerSession: vi.fn(),
}));

vi.mock('@/lib/auth-utils', () => {
  class AuthError extends Error {
    statusCode: number;
    constructor(message: string, statusCode = 401) {
      super(message);
      this.name = 'AuthError';
      this.statusCode = statusCode;
    }
  }
  return {
    requireAuth: vi.fn(),
    getServerSession: vi.fn(),
    AuthError,
  };
});

const mockGetPlayitStatus = vi.fn();
const mockStartPlayit = vi.fn();
const mockStopPlayit = vi.fn();

vi.mock('@/adapters/McctlApiAdapter', () => {
  class McctlApiError extends Error {
    statusCode: number;
    error: string;
    constructor(statusCode: number, error: string, message: string) {
      super(message);
      this.statusCode = statusCode;
      this.error = error;
    }
  }
  return {
    createMcctlApiClient: vi.fn(() => ({
      getPlayitStatus: mockGetPlayitStatus,
      startPlayit: mockStartPlayit,
      stopPlayit: mockStopPlayit,
    })),
    McctlApiError,
    UserContext: undefined,
  };
});

import { GET as getStatus } from '../status/route';
import { POST as startAction } from '../start/route';
import { POST as stopAction } from '../stop/route';
import { requireAuth } from '@/lib/auth-utils';
import { getServerSession } from '@/lib/auth';
import { McctlApiError } from '@/adapters/McctlApiAdapter';

const mockRequireAuth = vi.mocked(requireAuth);
const mockGetServerSession = vi.mocked(getServerSession);

// --- Fixtures ---

const mockSession = {
  user: {
    id: 'test-user',
    name: 'Test User',
    email: 'test@example.com',
    role: 'admin',
  },
  session: { id: 'session-1', token: 'test-token' },
};

const mockPlayitStatus = {
  enabled: true,
  agentRunning: true,
  secretKeyConfigured: true,
  containerStatus: 'running' as const,
  uptime: '2h 30m',
  uptimeSeconds: 9000,
  servers: [
    { serverName: 'survival', playitDomain: 'aa.example.com', lanHostname: 'survival.192.168.1.5.nip.io' },
    { serverName: 'creative', playitDomain: null, lanHostname: 'creative.192.168.1.5.nip.io' },
  ],
};

describe('Playit BFF Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuth.mockResolvedValue(mockSession as any);
    mockGetServerSession.mockResolvedValue(mockSession as any);
  });

  describe('GET /api/playit/status', () => {
    it('should return playit status for authenticated user', async () => {
      mockGetPlayitStatus.mockResolvedValue(mockPlayitStatus);

      const response = await getStatus();
      const data = await response.json();

      expect(mockGetPlayitStatus).toHaveBeenCalled();
      expect(data).toEqual(mockPlayitStatus);
      expect(response.status).toBe(200);
    });

    it('should return 401 when user is not authenticated', async () => {
      mockGetServerSession.mockResolvedValue(null);

      const response = await getStatus();
      const data = await response.json();

      expect(data.error).toBe('Unauthorized');
      expect(response.status).toBe(401);
    });

    it('should return 500 on mcctl-api error', async () => {
      const apiError = new McctlApiError(500, 'InternalServerError', 'Failed to get status');
      mockGetPlayitStatus.mockRejectedValue(apiError);

      const response = await getStatus();
      const data = await response.json();

      expect(data.error).toBe('InternalServerError');
      expect(response.status).toBe(500);
    });
  });

  describe('POST /api/playit/start', () => {
    it('should start playit agent for authenticated user', async () => {
      mockStartPlayit.mockResolvedValue({ success: true, message: 'playit-agent started' });

      const response = await startAction();
      const data = await response.json();

      expect(mockStartPlayit).toHaveBeenCalled();
      expect(data.success).toBe(true);
      expect(data.message).toBe('playit-agent started');
      expect(response.status).toBe(200);
    });
  });

  describe('POST /api/playit/stop', () => {
    it('should stop playit agent for authenticated user', async () => {
      mockStopPlayit.mockResolvedValue({ success: true, message: 'playit-agent stopped' });

      const response = await stopAction();
      const data = await response.json();

      expect(mockStopPlayit).toHaveBeenCalled();
      expect(data.success).toBe(true);
      expect(data.message).toBe('playit-agent stopped');
      expect(response.status).toBe(200);
    });
  });
});
