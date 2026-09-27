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

const mockGetPlayers = vi.fn();

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
    createMcctlApiClient: vi.fn(() => ({ getPlayers: mockGetPlayers })),
    McctlApiError,
    UserContext: undefined,
  };
});

import { requireServerPermission, AuthError } from '@/lib/auth-utils';
import { McctlApiError } from '@/adapters/McctlApiAdapter';
import { GET } from '../[name]/players/route';

const session = { user: { name: 'admin', email: 'a@b.c', role: 'admin' } };
const ctx = (name: string) => ({ params: Promise.resolve({ name }) });

describe('GET /api/servers/:name/players (#528)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (requireServerPermission as ReturnType<typeof vi.fn>).mockResolvedValue(session);
  });

  it('returns the players roster as JSON when not following', async () => {
    const roster = {
      serverName: 'survival',
      running: true,
      online: 1,
      max: 20,
      players: ['Steve'],
      roster: [
        { uuid: 'abc', name: 'Steve', online: true, lastSeen: null, isOp: false, isBanned: false, isWhitelisted: true },
      ],
    };
    mockGetPlayers.mockResolvedValue(roster);

    const res = await GET(
      new NextRequest('http://localhost/api/servers/survival/players'),
      ctx('survival')
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual(roster);
    expect(requireServerPermission).toHaveBeenCalledWith(expect.any(Headers), 'survival', 'view');
    expect(mockGetPlayers).toHaveBeenCalledWith('survival');
  });

  it('returns 401 when unauthenticated', async () => {
    (requireServerPermission as ReturnType<typeof vi.fn>).mockRejectedValue(new AuthError('No session'));

    const res = await GET(
      new NextRequest('http://localhost/api/servers/survival/players'),
      ctx('survival')
    );

    expect(res.status).toBe(401);
  });

  it('propagates a 404 from mcctl-api when the server is undefined', async () => {
    mockGetPlayers.mockRejectedValue(new McctlApiError(404, 'NotFound', "Server 'ghost' not found"));

    const res = await GET(
      new NextRequest('http://localhost/api/servers/ghost/players'),
      ctx('ghost')
    );

    expect(res.status).toBe(404);
  });

  it('proxies an SSE stream from mcctl-api when follow=true', async () => {
    const stream = new ReadableStream();
    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      body: stream,
    });
    process.env.MCCTL_API_URL = 'http://localhost:5001';
    process.env.MCCTL_API_KEY = 'test-key';

    const res = await GET(
      new NextRequest('http://localhost/api/servers/survival/players?follow=true'),
      ctx('survival')
    );

    expect(res.headers.get('content-type')).toBe('text/event-stream');
    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:5001/api/servers/survival/players?follow=true',
      expect.objectContaining({
        headers: expect.objectContaining({ 'X-API-Key': 'test-key' }),
      })
    );

    global.fetch = originalFetch;
  });
});
