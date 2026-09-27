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
  return { requireServerPermission: vi.fn(), AuthError };
});

const mockGetPlayer = vi.fn();

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
    createMcctlApiClient: vi.fn(() => ({ getPlayer: mockGetPlayer })),
    McctlApiError,
    UserContext: undefined,
  };
});

import { requireServerPermission, AuthError } from '@/lib/auth-utils';
import { McctlApiError } from '@/adapters/McctlApiAdapter';
import { GET } from '../[name]/players/[uuid]/route';

const session = { user: { name: 'admin', email: 'a@b.c', role: 'admin' } };
const ctx = (name: string, uuid: string) => ({ params: Promise.resolve({ name, uuid }) });

describe('GET /api/servers/:name/players/:uuid (#528)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (requireServerPermission as ReturnType<typeof vi.fn>).mockResolvedValue(session);
  });

  it('returns the player detail', async () => {
    const player = {
      uuid: 'abc',
      name: 'Steve',
      online: false,
      lastSeen: '2024-01-01T00:00:00Z',
      isOp: false,
      isBanned: false,
      isWhitelisted: true,
    };
    mockGetPlayer.mockResolvedValue(player);

    const res = await GET(
      new NextRequest('http://localhost/api/servers/survival/players/abc'),
      ctx('survival', 'abc')
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(player);
    expect(mockGetPlayer).toHaveBeenCalledWith('survival', 'abc');
  });

  it('returns 404 for an unknown player', async () => {
    mockGetPlayer.mockRejectedValue(new McctlApiError(404, 'NotFound', 'Player not found'));

    const res = await GET(
      new NextRequest('http://localhost/api/servers/survival/players/unknown'),
      ctx('survival', 'unknown')
    );

    expect(res.status).toBe(404);
  });

  it('returns 401 when unauthenticated', async () => {
    (requireServerPermission as ReturnType<typeof vi.fn>).mockRejectedValue(new AuthError('No session'));

    const res = await GET(
      new NextRequest('http://localhost/api/servers/survival/players/abc'),
      ctx('survival', 'abc')
    );

    expect(res.status).toBe(401);
  });

  it('forwards ?include=stats to the adapter (#528 Phase 2)', async () => {
    mockGetPlayer.mockResolvedValue({
      uuid: 'abc',
      name: 'Steve',
      online: false,
      lastSeen: null,
      isOp: false,
      isBanned: false,
      isWhitelisted: true,
      stats: null,
    });

    const res = await GET(
      new NextRequest('http://localhost/api/servers/survival/players/abc?include=stats'),
      ctx('survival', 'abc')
    );

    expect(res.status).toBe(200);
    expect(mockGetPlayer).toHaveBeenCalledWith('survival', 'abc', ['stats']);
  });

  it('drops unrecognized include values instead of forwarding them', async () => {
    mockGetPlayer.mockResolvedValue({
      uuid: 'abc',
      name: 'Steve',
      online: false,
      lastSeen: null,
      isOp: false,
      isBanned: false,
      isWhitelisted: true,
    });

    const res = await GET(
      new NextRequest('http://localhost/api/servers/survival/players/abc?include=stats,sessions'),
      ctx('survival', 'abc')
    );

    expect(res.status).toBe(200);
    expect(mockGetPlayer).toHaveBeenCalledWith('survival', 'abc', ['stats']);
  });

  it('forwards ?include=stats,nbt to the adapter (#528 Phase 3)', async () => {
    mockGetPlayer.mockResolvedValue({
      uuid: 'abc',
      name: 'Steve',
      online: false,
      lastSeen: null,
      isOp: false,
      isBanned: false,
      isWhitelisted: true,
      stats: null,
      data: null,
    });

    const res = await GET(
      new NextRequest('http://localhost/api/servers/survival/players/abc?include=stats,nbt'),
      ctx('survival', 'abc')
    );

    expect(res.status).toBe(200);
    expect(mockGetPlayer).toHaveBeenCalledWith('survival', 'abc', ['stats', 'nbt']);
  });

  it('does not pass an include argument when no include param is given', async () => {
    mockGetPlayer.mockResolvedValue({
      uuid: 'abc',
      name: 'Steve',
      online: false,
      lastSeen: null,
      isOp: false,
      isBanned: false,
      isWhitelisted: true,
    });

    await GET(
      new NextRequest('http://localhost/api/servers/survival/players/abc'),
      ctx('survival', 'abc')
    );

    expect(mockGetPlayer).toHaveBeenCalledWith('survival', 'abc');
  });
});
