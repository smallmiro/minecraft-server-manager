import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('next/headers', () => ({
  headers: vi.fn(async () => new Headers({ cookie: 'session=test' })),
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
  return { requireAuth: vi.fn(), AuthError };
});

const mockRestartRouter = vi.fn();

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
    createMcctlApiClient: vi.fn(() => ({ restartRouter: mockRestartRouter })),
    McctlApiError,
  };
});

import { POST } from '../restart/route';
import { requireAuth, AuthError } from '@/lib/auth-utils';
import { McctlApiError } from '@/adapters/McctlApiAdapter';

const mockSession = {
  user: { id: 'u1', name: 'Test User', email: 'test@example.com', role: 'admin' },
  session: { id: 's1', token: 't' },
};

describe('POST /api/router/restart', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAuth).mockResolvedValue(mockSession as any);
  });

  it('proxies the restart to mcctl-api', async () => {
    mockRestartRouter.mockResolvedValue({ success: true, message: 'mc-router restarted' });

    const response = await POST();

    expect(mockRestartRouter).toHaveBeenCalled();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true, message: 'mc-router restarted' });
  });

  it('returns 401 when unauthenticated', async () => {
    vi.mocked(requireAuth).mockRejectedValue(new AuthError('Authentication required', 401));

    const response = await POST();

    expect(response.status).toBe(401);
    expect((await response.json()).error).toBe('Unauthorized');
    expect(mockRestartRouter).not.toHaveBeenCalled();
  });

  it('forwards mcctl-api errors', async () => {
    mockRestartRouter.mockRejectedValue(new McctlApiError(500, 'InternalServerError', 'docker restart failed'));

    const response = await POST();

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'InternalServerError', message: 'docker restart failed' });
  });
});
