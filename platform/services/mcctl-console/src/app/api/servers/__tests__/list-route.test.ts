import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue(new Headers({ cookie: 'session=test' })),
}));

vi.mock('@/lib/auth-utils', () => {
  class AuthError extends Error {
    statusCode = 401;
  }
  return { requireAuth: vi.fn(), AuthError };
});

const mockGetServers = vi.fn();
const mockFindByUser = vi.fn();

vi.mock('@/adapters/McctlApiAdapter', () => {
  class McctlApiError extends Error {
    statusCode = 500;
    error = 'err';
  }
  return {
    createMcctlApiClient: vi.fn(() => ({ getServers: mockGetServers })),
    McctlApiError,
  };
});

vi.mock('@/adapters/UserServerRepository', () => ({
  UserServerRepository: class {
    findByUser = mockFindByUser;
  },
}));

vi.mock('@/services/UserServerService', () => ({ UserServerService: class {} }));

import { requireAuth } from '@/lib/auth-utils';
import { GET } from '../route';

const req = (qs = '') => new NextRequest(`http://localhost/api/servers${qs}`);
const adminSession = { user: { id: 'a', name: 'admin', email: 'a@b.c', role: 'admin' } };
const userSession = { user: { id: 'u', name: 'bob', email: 'b@b.c', role: 'user' } };

const base = (name: string, status = 'running') => ({
  name,
  container: `mc-${name}`,
  status,
  health: 'healthy',
  hostname: `${name}.local`,
});

const summaryResponse = {
  servers: [
    { ...base('a'), players: { online: 3, max: 20, players: [] } },
    { ...base('b'), players: { online: 5, max: 10, players: [] } },
    { ...base('c'), players: null },
    { ...base('d', 'stopped') },
  ],
  total: 4,
  totals: { playersOnline: 8, playersMax: 30, running: 3 },
};

describe('GET /api/servers (#764)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue(adminSession);
    mockGetServers.mockResolvedValue(summaryResponse);
  });

  it('forwards include=summary to the API client', async () => {
    await GET(req('?include=summary'));
    expect(mockGetServers).toHaveBeenCalledWith({ include: 'summary' });
  });

  it('ignores other include values and unknown params', async () => {
    await GET(req('?include=everything&x=1'));
    expect(mockGetServers).toHaveBeenCalledWith(undefined);
  });

  it('keeps the default path unchanged without include', async () => {
    await GET(req());
    expect(mockGetServers).toHaveBeenCalledWith(undefined);
  });

  it('returns the API response untouched for admins', async () => {
    const res = await GET(req('?include=summary'));
    expect(await res.json()).toEqual(summaryResponse);
  });

  it('recomputes totals from the filtered list for non-admins', async () => {
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue(userSession);
    mockFindByUser.mockResolvedValue([{ serverId: 'a' }, { serverId: 'c' }, { serverId: 'd' }]);

    const res = await GET(req('?include=summary'));
    const body = await res.json();

    expect(body.servers.map((s: { name: string }) => s.name)).toEqual(['a', 'c', 'd']);
    expect(body.total).toBe(3);
    expect(body.totals).toEqual({ playersOnline: 3, playersMax: 20, running: 2 });
  });

  it('does not add totals for non-admins without include', async () => {
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue(userSession);
    mockGetServers.mockResolvedValue({ servers: summaryResponse.servers.map(({ players, ...s }) => s), total: 4 });
    mockFindByUser.mockResolvedValue([{ serverId: 'a' }]);

    const body = await (await GET(req())).json();

    expect(body).toEqual({ servers: [expect.objectContaining({ name: 'a' })], total: 1 });
  });
});
