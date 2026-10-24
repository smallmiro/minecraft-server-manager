/**
 * McRouterApiAdapter (#768): mc-router management API `GET /routes`
 * (server/api_server.go, v1.47.1): `{ "<server address>": { backend, scalingTarget } }`.
 * Any failure means "unknown" (null), never an error.
 */
import { describe, it, expect, vi } from 'vitest';
import { McRouterApiAdapter } from '../src/infrastructure/adapters/McRouterApiAdapter.js';

const response = (status: number, body: string) => new Response(body, { status });

describe('McRouterApiAdapter.listRoutes', () => {
  it('maps the routes object and calls GET <baseUrl>/routes', async () => {
    const fetchFn = vi.fn(async () =>
      response(
        200,
        JSON.stringify({
          'alpha.local': { backend: 'mc-alpha:25565', scalingTarget: 'mc-alpha' },
          'beta.local': { backend: 'mc-beta:25565' },
          'odd.local': { backend: 42 },
          'skip.local': 'not-an-object',
        })
      )
    );
    const api = new McRouterApiAdapter({ fetch: fetchFn as unknown as typeof fetch });

    const routes = await api.listRoutes();
    expect(routes).toEqual(
      new Map([
        ['alpha.local', { backend: 'mc-alpha:25565', scalingTarget: 'mc-alpha' }],
        ['beta.local', { backend: 'mc-beta:25565' }],
        ['odd.local', { backend: '' }],
      ])
    );
    expect(fetchFn).toHaveBeenCalledWith(
      'http://127.0.0.1:25580/routes',
      expect.objectContaining({ method: 'GET', signal: expect.any(AbortSignal) })
    );
  });

  it('honours a custom base URL (trailing slash tolerated)', async () => {
    const fetchFn = vi.fn(async () => response(200, '{}'));
    await new McRouterApiAdapter({ baseUrl: 'http://router:9000/', fetch: fetchFn as unknown as typeof fetch }).listRoutes();
    expect(fetchFn).toHaveBeenCalledWith('http://router:9000/routes', expect.anything());
  });

  it('is null on a non-200 status', async () => {
    const api = new McRouterApiAdapter({ fetch: (async () => response(500, '{}')) as unknown as typeof fetch });
    expect(await api.listRoutes()).toBeNull();
  });

  it('is null on invalid JSON or a non-object body', async () => {
    for (const body of ['not json', 'null', '[]', '"x"']) {
      const api = new McRouterApiAdapter({ fetch: (async () => response(200, body)) as unknown as typeof fetch });
      expect(await api.listRoutes()).toBeNull();
    }
  });

  it('is null on a network error', async () => {
    const api = new McRouterApiAdapter({
      fetch: (async () => {
        throw new TypeError('fetch failed');
      }) as unknown as typeof fetch,
    });
    expect(await api.listRoutes()).toBeNull();
  });

  it('is null when the request times out', async () => {
    const hang = (_url: string, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
      });
    const api = new McRouterApiAdapter({ fetch: hang as unknown as typeof fetch, timeoutMs: 20 });
    const started = Date.now();
    expect(await api.listRoutes()).toBeNull();
    expect(Date.now() - started).toBeLessThan(1000);
  });

  it('defaults to a 2 s timeout', () => {
    expect(new McRouterApiAdapter().timeoutMs).toBe(2000);
    expect(new McRouterApiAdapter().baseUrl).toBe('http://127.0.0.1:25580');
  });
});

describe('package exports', () => {
  it('exports McRouterApiAdapter from the package root', async () => {
    const shared = await import('../src/index.js');
    expect(shared.McRouterApiAdapter).toBe(McRouterApiAdapter);
  });
});
