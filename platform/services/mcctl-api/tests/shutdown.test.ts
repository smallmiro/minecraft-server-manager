/**
 * Graceful close (#650): an open SSE stream or a request that never answers
 * must not hold app.close() (and the onClose hooks after it) until PM2's
 * SIGKILL. Real sockets: server.close() only waits for real connections.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import http from 'node:http';
import type { FastifyInstance } from 'fastify';
import { buildApp, shutdownLimits } from '../src/app.js';
import { openSse, openSseStreams } from '../src/lib/sse.js';

const defaults = { ...shutdownLimits };

function get(port: number, path: string): http.ClientRequest {
  const req = http.get({ host: '127.0.0.1', port, path });
  req.on('error', () => undefined); // the server cuts it
  return req;
}

const until = async (check: () => boolean) => {
  for (let i = 0; i < 200 && !check(); i++) await new Promise((r) => setTimeout(r, 10));
};

describe('graceful close (#650)', () => {
  let app: FastifyInstance;
  let port: number;
  let started = 0;
  const onClose = vi.fn();

  beforeEach(async () => {
    started = 0;
    onClose.mockClear();
    app = await buildApp({ logger: false });
    app.get('/test/stream', async (request, reply) => {
      started++;
      if (!openSse(request, reply)) return reply;
    });
    app.get('/test/hang', async () => {
      started++;
      await new Promise(() => undefined);
    });
    app.addHook('onClose', async () => onClose());
    await app.listen({ port: 0, host: '127.0.0.1' });
    port = (app.server.address() as { port: number }).port;
  });

  afterEach(() => {
    Object.assign(shutdownLimits, defaults);
  });

  it('ends open SSE streams, then runs the onClose hooks', async () => {
    const req = get(port, '/test/stream');
    await until(() => openSseStreams() === 1);

    await app.close();

    expect(openSseStreams()).toBe(0);
    expect(onClose).toHaveBeenCalledOnce();
    req.destroy();
  });

  it('cuts a request still running after the drain timeout', async () => {
    shutdownLimits.drainMs = 100;
    const req = get(port, '/test/hang');
    await until(() => started === 1);

    const t0 = Date.now();
    await app.close();

    expect(Date.now() - t0).toBeLessThan(2_000);
    expect(onClose).toHaveBeenCalledOnce();
    req.destroy();
  });
});
