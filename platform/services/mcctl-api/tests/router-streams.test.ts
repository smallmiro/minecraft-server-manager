import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import http from 'node:http';
import type { AddressInfo } from 'node:net';

type FollowFn = (
  name: string,
  onChunk: (c: string) => void,
  signal: AbortSignal,
  options?: { tail?: number; follow?: boolean; onExit?: (code: number | null, error?: Error) => void }
) => Promise<void>;

const h = vi.hoisted(() => ({ followLogs: vi.fn() }));

vi.mock('@minecraft-docker/shared', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@minecraft-docker/shared')>()),
  getRouterDetailInfoAsync: vi.fn(),
  getAvahiStatus: vi.fn().mockReturnValue('running'),
  getPlayitAgentStatus: vi.fn().mockResolvedValue({
    enabled: false,
    agentRunning: false,
    secretKeyConfigured: false,
    containerStatus: 'not_found',
  }),
  DockerComposeRuntimeAdapter: vi.fn().mockImplementation(() => ({ followLogs: h.followLogs })),
}));

vi.mock('../src/services/audit-log-service.js', () => ({
  writeAuditLog: vi.fn().mockResolvedValue(undefined),
}));

import authPlugin from '../src/plugins/auth.js';
import { routerPlugin, clampLogTail } from '../src/routes/router.js';
import { getRouterDetailInfoAsync } from '@minecraft-docker/shared';

const API_KEY = 'test-api-key-12345';
const auth = { 'x-api-key': API_KEY };

const baseInfo = (over: Record<string, unknown> = {}, routeStatus = 'running') => ({
  name: 'mc-router',
  status: 'running' as const,
  health: 'healthy' as const,
  port: 25565,
  uptime: '1 minute',
  uptimeSeconds: 60,
  routes: [{ hostname: 'a.local', target: 'mc-a:25565', serverStatus: routeStatus as 'running' }],
  ...over,
});

interface SseClient {
  res: http.IncomingMessage;
  text: () => string;
  close: () => void;
}

describe('Router SSE streams (#769)', () => {
  let app: FastifyInstance;
  let port: number;
  const clients: http.ClientRequest[] = [];

  beforeAll(async () => {
    app = Fastify({ logger: false });
    await app.register(authPlugin, { config: { mode: 'api-key', apiKey: API_KEY } });
    await app.register(routerPlugin);
    await app.listen({ port: 0, host: '127.0.0.1' });
    port = (app.server.address() as AddressInfo).port;
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    h.followLogs.mockReset();
  });

  afterEach(() => {
    for (const c of clients.splice(0)) c.destroy();
    vi.useRealTimers();
  });

  const open = (path: string, headers: Record<string, string> = auth): Promise<SseClient> =>
    new Promise((resolve, reject) => {
      let buf = '';
      const req = http.get({ host: '127.0.0.1', port, path, headers }, (res) => {
        res.setEncoding('utf8');
        res.on('data', (d) => { buf += d; });
        resolve({ res, text: () => buf, close: () => req.destroy() });
      });
      req.on('error', (e) => { if ((e as NodeJS.ErrnoException).code !== 'ECONNRESET') reject(e); });
      clients.push(req);
    });

  const waitFor = async (cond: () => boolean, ms = 2000) => {
    const start = Date.now();
    while (!cond()) {
      if (Date.now() - start > ms) throw new Error('timeout waiting for condition');
      await new Promise((r) => setTimeout(r, 5));
    }
  };

  const events = (text: string, name: string) =>
    text
      .split('\n\n')
      .filter((b) => b.startsWith(`event: ${name}\n`))
      .map((b) => JSON.parse(b.split('\n').find((l) => l.startsWith('data: '))!.slice(6)));

  describe('GET /api/router/logs/stream', () => {
    // Keeps the stream open until aborted; exposes onChunk/onExit to the test
    const hold = () => {
      const state: { onChunk?: (c: string) => void; onExit?: (c: number | null, e?: Error) => void; signal?: AbortSignal; args?: unknown[] } = {};
      h.followLogs.mockImplementation(((name, onChunk, signal, options) => {
        state.onChunk = onChunk;
        state.onExit = options?.onExit;
        state.signal = signal;
        state.args = [name, options];
        return new Promise<void>((resolve) => {
          signal.addEventListener('abort', () => resolve());
        });
      }) as FollowFn);
      return state;
    };

    it('returns 401 without credentials and does not spawn', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/router/logs/stream' });
      expect(res.statusCode).toBe(401);
      expect(h.followLogs).not.toHaveBeenCalled();
    });

    it('sends SSE headers and a connected event', async () => {
      hold();
      const c = await open('/api/router/logs/stream');
      expect(c.res.statusCode).toBe(200);
      expect(c.res.headers['content-type']).toContain('text/event-stream');
      await waitFor(() => events(c.text(), 'connected').length === 1);
    });

    it('follows mc-router with default tail 100', async () => {
      const state = hold();
      const c = await open('/api/router/logs/stream');
      await waitFor(() => h.followLogs.mock.calls.length === 1);
      expect(state.args).toEqual(['mc-router', expect.objectContaining({ tail: 100 })]);
      c.close();
    });

    it.each([
      ['5', 5],
      ['0', 1],
      ['-7', 1],
      ['9999', 500],
      ['abc', 100],
    ])('clamps ?tail=%s to %i', async (q, expected) => {
      const state = hold();
      const c = await open(`/api/router/logs/stream?tail=${q}`);
      await waitFor(() => h.followLogs.mock.calls.length === 1);
      expect((state.args as [string, { tail: number }])[1].tail).toBe(expected);
      c.close();
    });

    it('emits router-log events parsed from lines, including stderr-style chunks and split lines', async () => {
      const state = hold();
      const c = await open('/api/router/logs/stream');
      await waitFor(() => state.onChunk !== undefined);

      state.onChunk!(
        'time="2026-01-01T00:00:00Z" level=info msg="Connecting to backend" backendHostPort="mc-a:25565" client="1.2.3.4:5" player=Steve/0f3c1e2a-1111-2222-3333-444455556666 server=a.local\n'
      );
      // a line split across two chunks, then a plain info line with CRLF
      state.onChunk!('some partial ');
      state.onChunk!('line\r\n\n');

      await waitFor(() => events(c.text(), 'router-log').length === 2);
      const [first, second] = events(c.text(), 'router-log');
      expect(first.kind).toBe('connect');
      expect(first).toMatchObject({ hostname: 'a.local', target: 'mc-a:25565', player: 'Steve' });
      expect(second).toEqual({ kind: 'info', raw: 'some partial line' });
    });

    it('sends end event and closes when the process exits; flushes the trailing partial line', async () => {
      const state = hold();
      const c = await open('/api/router/logs/stream');
      await waitFor(() => state.onChunk !== undefined);

      state.onChunk!('no newline at end');
      state.onExit!(0);

      await new Promise<void>((resolve) => c.res.on('end', () => resolve()));
      expect(events(c.text(), 'router-log')).toEqual([{ kind: 'info', raw: 'no newline at end' }]);
      expect(events(c.text(), 'end')).toEqual([{ code: 0 }]);
    });

    it('reports a spawn error in the end event', async () => {
      const state = hold();
      const c = await open('/api/router/logs/stream');
      await waitFor(() => state.onExit !== undefined);

      state.onExit!(null, new Error('spawn docker ENOENT'));
      await new Promise<void>((resolve) => c.res.on('end', () => resolve()));
      expect(events(c.text(), 'end')).toEqual([{ code: null, error: 'spawn docker ENOENT' }]);
    });

    it('aborts the docker logs process when the client disconnects', async () => {
      const state = hold();
      const c = await open('/api/router/logs/stream');
      await waitFor(() => state.signal !== undefined);
      expect(state.signal!.aborted).toBe(false);

      c.close();
      await waitFor(() => state.signal!.aborted);
    });
  });

  describe('GET /api/router/status/stream', () => {
    const fakeIntervals = () => vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    const tick = async (ms: number) => {
      await vi.advanceTimersByTimeAsync(ms);
    };

    it('returns 401 without credentials', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/router/status/stream' });
      expect(res.statusCode).toBe(401);
      expect(getRouterDetailInfoAsync).not.toHaveBeenCalled();
    });

    it('sends the first payload immediately with the status response shape', async () => {
      vi.mocked(getRouterDetailInfoAsync).mockResolvedValue(baseInfo());
      const c = await open('/api/router/status/stream');
      expect(c.res.headers['content-type']).toContain('text/event-stream');
      await waitFor(() => events(c.text(), 'router-status').length === 1);

      const [payload] = events(c.text(), 'router-status');
      expect(payload.router).toMatchObject({ name: 'mc-router', status: 'running' });
      expect(payload.router.routes[0]).toMatchObject({ hostname: 'a.local', serverStatus: 'running' });
      expect(payload.avahi).toEqual({ name: 'avahi-daemon', status: 'running', type: 'system' });
    });

    it('ignores uptimeSeconds ticks but sends the displayed uptime and route status changes', async () => {
      fakeIntervals();
      vi.mocked(getRouterDetailInfoAsync).mockResolvedValue(baseInfo());
      const c = await open('/api/router/status/stream?interval=1000');
      await waitFor(() => events(c.text(), 'router-status').length === 1);

      vi.mocked(getRouterDetailInfoAsync).mockResolvedValue(baseInfo({ uptimeSeconds: 61 }));
      await tick(1000);
      await tick(1000);
      expect(vi.mocked(getRouterDetailInfoAsync).mock.calls.length).toBeGreaterThanOrEqual(3);
      expect(events(c.text(), 'router-status')).toHaveLength(1);

      // Polling is off while the stream is live, so the shown uptime must still move
      vi.mocked(getRouterDetailInfoAsync).mockResolvedValue(baseInfo({ uptime: '2 minutes', uptimeSeconds: 120 }));
      await tick(1000);
      await waitFor(() => events(c.text(), 'router-status').length === 2);
      expect(events(c.text(), 'router-status')[1].router.uptime).toBe('2 minutes');

      vi.mocked(getRouterDetailInfoAsync).mockResolvedValue(baseInfo({ uptime: '2 minutes', uptimeSeconds: 125 }, 'stopped'));
      await tick(1000);
      await waitFor(() => events(c.text(), 'router-status').length === 3);
      expect(events(c.text(), 'router-status')[2].router.routes[0].serverStatus).toBe('stopped');
    });

    it('tells the client when a poll fails, then resends the status once polling recovers', async () => {
      fakeIntervals();
      vi.mocked(getRouterDetailInfoAsync).mockResolvedValue(baseInfo());
      const c = await open('/api/router/status/stream?interval=1000');
      await waitFor(() => events(c.text(), 'router-status').length === 1);

      vi.mocked(getRouterDetailInfoAsync).mockRejectedValue(new Error('docker unavailable'));
      await tick(1000);
      await waitFor(() => events(c.text(), 'router-status-error').length === 1);

      vi.mocked(getRouterDetailInfoAsync).mockResolvedValue(baseInfo());
      await tick(1000);
      await waitFor(() => events(c.text(), 'router-status').length === 2);
    });

    it('shares one poll between connections with the same interval', async () => {
      fakeIntervals();
      vi.mocked(getRouterDetailInfoAsync).mockResolvedValue(baseInfo());
      const a = await open('/api/router/status/stream?interval=1000');
      await waitFor(() => events(a.text(), 'router-status').length === 1);
      const b = await open('/api/router/status/stream?interval=1000');
      await waitFor(() => events(b.text(), 'router-status').length === 1);

      const before = vi.mocked(getRouterDetailInfoAsync).mock.calls.length;
      await tick(1000);
      await waitFor(() => vi.mocked(getRouterDetailInfoAsync).mock.calls.length > before);
      expect(vi.mocked(getRouterDetailInfoAsync).mock.calls.length).toBe(before + 1);
    });

    it('sends a heartbeat comment every 30 seconds', async () => {
      fakeIntervals();
      vi.mocked(getRouterDetailInfoAsync).mockResolvedValue(baseInfo());
      const c = await open('/api/router/status/stream?interval=60000');
      await waitFor(() => events(c.text(), 'router-status').length === 1);
      await tick(30000);
      await waitFor(() => c.text().includes(': heartbeat'));
    });

    it('clears its intervals when the client disconnects', async () => {
      fakeIntervals();
      vi.mocked(getRouterDetailInfoAsync).mockResolvedValue(baseInfo());
      const c = await open('/api/router/status/stream?interval=1000');
      await waitFor(() => events(c.text(), 'router-status').length === 1);
      expect(vi.getTimerCount()).toBe(2);

      c.close();
      await waitFor(() => vi.getTimerCount() === 0);
    });
  });

  it('falls back to the default tail for an empty ?tail=', () => {
    expect(clampLogTail('')).toBe(100);
  });
});
