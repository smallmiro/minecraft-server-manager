import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue(new Headers({ cookie: 'session=test' })),
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

const mockGetLivePlayers = vi.fn();

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
    createMcctlApiClient: vi.fn(() => ({ getLivePlayers: mockGetLivePlayers })),
    McctlApiError,
    UserContext: undefined,
  };
});

import { requireAuth, AuthError } from '@/lib/auth-utils';
import { GET as getLive } from '../[name]/players/live/route';

const session = { user: { name: 'admin', email: 'a@b.c', role: 'admin' } };
const ctx = (name: string) => ({ params: Promise.resolve({ name }) });

describe('GET /api/servers/:name/players/live BFF proxy (#538)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue(session);
  });

  it('proxies live player locations from mcctl-api', async () => {
    mockGetLivePlayers.mockResolvedValue({
      players: [{ uuid: '', name: 'Lachphlnn', x: 594, y: 68, z: 904, dimension: 'overworld', online: true }],
    });
    const res = await getLive(
      new NextRequest('http://localhost/api/servers/survival/players/live'),
      ctx('survival')
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.players[0].name).toBe('Lachphlnn');
    expect(body.players[0].online).toBe(true);
    expect(mockGetLivePlayers).toHaveBeenCalledWith('survival');
  });

  it('returns 401 when unauthenticated', async () => {
    (requireAuth as ReturnType<typeof vi.fn>).mockRejectedValue(new AuthError('No session'));
    const res = await getLive(
      new NextRequest('http://localhost/api/servers/survival/players/live'),
      ctx('survival')
    );
    expect(res.status).toBe(401);
  });
});
