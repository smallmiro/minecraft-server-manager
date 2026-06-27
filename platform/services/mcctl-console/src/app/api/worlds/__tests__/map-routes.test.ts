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

const mockGetWorldInfo = vi.fn();
const mockGetWorldPlayers = vi.fn();
const mockGetWorldMapStatus = vi.fn();
const mockWriteMapMarkers = vi.fn();
const mockGetWorldStats = vi.fn();

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
      getWorldInfo: mockGetWorldInfo,
      getWorldPlayers: mockGetWorldPlayers,
      getWorldMapStatus: mockGetWorldMapStatus,
      writeMapMarkers: mockWriteMapMarkers,
      getWorldStats: mockGetWorldStats,
    })),
    McctlApiError,
    UserContext: undefined,
  };
});

import { requireAuth, AuthError } from '@/lib/auth-utils';
import { GET as getInfo } from '../[name]/info/route';
import { GET as getPlayers } from '../[name]/players/route';
import { GET as getMapStatus } from '../[name]/map/status/route';
import { POST as postMarkers } from '../[name]/map/markers/route';
import { GET as getStats } from '../[name]/stats/route';

const session = { user: { name: 'admin', email: 'a@b.c', role: 'admin' } };
const ctx = (name: string) => ({ params: Promise.resolve({ name }) });

describe('World info/players/map BFF proxy routes (#525/#529)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue(session);
  });

  it('GET /info proxies world info', async () => {
    mockGetWorldInfo.mockResolvedValue({ info: { name: 'factory' } });
    const res = await getInfo(new NextRequest('http://localhost/api/worlds/factory/info'), ctx('factory'));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ info: { name: 'factory' } });
    expect(mockGetWorldInfo).toHaveBeenCalledWith('factory');
  });

  it('GET /players proxies offline player locations', async () => {
    mockGetWorldPlayers.mockResolvedValue({ players: [] });
    const res = await getPlayers(new NextRequest('http://localhost/api/worlds/factory/players'), ctx('factory'));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ players: [] });
  });

  it('GET /map/status proxies render status', async () => {
    mockGetWorldMapStatus.mockResolvedValue({ rendered: true, maps: ['overworld'] });
    const res = await getMapStatus(new NextRequest('http://localhost/api/worlds/factory/map/status'), ctx('factory'));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ rendered: true, maps: ['overworld'] });
  });

  it('POST /map/markers proxies the marker write', async () => {
    mockWriteMapMarkers.mockResolvedValue({ counts: { overworld: 2 }, total: 2 });
    const res = await postMarkers(
      new NextRequest('http://localhost/api/worlds/factory/map/markers', { method: 'POST' }),
      ctx('factory')
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ counts: { overworld: 2 }, total: 2 });
    expect(mockWriteMapMarkers).toHaveBeenCalledWith('factory');
  });

  it('GET /stats proxies cached block stats', async () => {
    mockGetWorldStats.mockResolvedValue({ world: 'factory', totalBlocks: 100, ores: {} });
    const res = await getStats(new NextRequest('http://localhost/api/worlds/factory/stats'), ctx('factory'));
    expect(res.status).toBe(200);
    expect((await res.json()).world).toBe('factory');
    expect(mockGetWorldStats).toHaveBeenCalledWith('factory');
  });

  it('returns 401 when unauthenticated', async () => {
    (requireAuth as ReturnType<typeof vi.fn>).mockRejectedValue(new AuthError('No session'));
    const res = await getMapStatus(new NextRequest('http://localhost/api/worlds/factory/map/status'), ctx('factory'));
    expect(res.status).toBe(401);
  });
});
