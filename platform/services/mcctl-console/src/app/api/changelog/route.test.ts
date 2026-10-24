import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

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

const CHANGELOG = (v: string) =>
  `# Changelog\n\n## [${v}] - 2026-10-01\n\n### Added\n- **Feature ${v}** - desc\n`;

const TTL = 60 * 60 * 1000;

function okResponse(body: string) {
  return new Response(body, { status: 200 });
}

describe('GET /api/changelog', () => {
  let GET: typeof import('./route').GET;
  let requireAuth: ReturnType<typeof vi.fn>;
  let AuthError: new (m: string, s?: number) => Error;
  const fetchMock = vi.fn();

  beforeEach(async () => {
    vi.resetModules();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-24T00:00:00Z'));
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    const auth = await import('@/lib/auth-utils');
    requireAuth = vi.mocked(auth.requireAuth) as unknown as ReturnType<typeof vi.fn>;
    AuthError = auth.AuthError as unknown as typeof AuthError;
    requireAuth.mockResolvedValue({ user: { id: 'u1' } });
    ({ GET } = await import('./route'));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('returns 401 when unauthenticated', async () => {
    requireAuth.mockRejectedValue(new AuthError('Unauthorized', 401));
    const res = await GET();
    expect(res.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns the latest version and the installed version', async () => {
    fetchMock.mockResolvedValue(okResponse(CHANGELOG('2.34.0')));
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.latest).toMatchObject({
      version: '2.34.0',
      date: '2026-10-01',
      items: [{ type: 'added', message: 'Feature 2.34.0' }],
    });
    expect(typeof body.installedVersion).toBe('string');
    expect(body.stale).toBe(false);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
  });

  it('serves from cache within the TTL', async () => {
    fetchMock.mockResolvedValue(okResponse(CHANGELOG('2.34.0')));
    await GET();
    vi.advanceTimersByTime(TTL - 1000);
    const res = await GET();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect((await res.json()).latest.version).toBe('2.34.0');
  });

  it('refreshes after the TTL', async () => {
    fetchMock.mockResolvedValueOnce(okResponse(CHANGELOG('2.34.0')));
    await GET();
    vi.advanceTimersByTime(TTL + 1000);
    fetchMock.mockResolvedValueOnce(okResponse(CHANGELOG('2.35.0')));
    const res = await GET();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect((await res.json()).latest.version).toBe('2.35.0');
  });

  it('returns the last good value (stale) when a refresh fails', async () => {
    fetchMock.mockResolvedValueOnce(okResponse(CHANGELOG('2.34.0')));
    await GET();
    vi.advanceTimersByTime(TTL + 1000);
    fetchMock.mockRejectedValueOnce(new Error('network down'));
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.latest.version).toBe('2.34.0');
    expect(body.stale).toBe(true);
  });

  it('treats a non-OK GitHub response as a failure and keeps the last good value', async () => {
    fetchMock.mockResolvedValueOnce(okResponse(CHANGELOG('2.34.0')));
    await GET();
    vi.advanceTimersByTime(TTL + 1000);
    fetchMock.mockResolvedValueOnce(new Response('rate limited', { status: 403 }));
    const res = await GET();
    expect((await res.json()).latest.version).toBe('2.34.0');
  });

  it('returns 502 when GitHub fails and nothing is cached', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));
    const res = await GET();
    expect(res.status).toBe(502);
    expect((await res.json()).error).toBe('ChangelogUnavailable');
  });

  it('returns 502 when the content has no parseable version', async () => {
    fetchMock.mockResolvedValue(okResponse('# Changelog\n\nnothing'));
    const res = await GET();
    expect(res.status).toBe(502);
  });

  it('shares one in-flight request between concurrent callers', async () => {
    fetchMock.mockResolvedValue(okResponse(CHANGELOG('2.34.0')));
    await Promise.all([GET(), GET(), GET()]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('passes a timeout signal to fetch', async () => {
    fetchMock.mockResolvedValue(okResponse(CHANGELOG('2.34.0')));
    await GET();
    expect(fetchMock.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
  });
});
