/**
 * openSse (#672): cleanup runs when the client leaves, open streams are
 * capped, and a stream ends at its lifetime.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import http from 'node:http';
import Fastify, { type FastifyInstance } from 'fastify';
import { openSse, openSseStreams, sseLimits } from '../src/lib/sse.js';

const defaults = { ...sseLimits };

function get(port: number): Promise<{ res: http.IncomingMessage; req: http.ClientRequest; first: Promise<string> }> {
  return new Promise((resolve, reject) => {
    const req = http.get({ host: '127.0.0.1', port, path: '/stream' }, (res) => {
      const first = new Promise<string>((done) => res.once('data', (chunk: Buffer) => done(chunk.toString())));
      resolve({ res, req, first });
    });
    req.on('error', reject);
  });
}

const until = async (check: () => boolean) => {
  for (let i = 0; i < 100 && !check(); i++) await new Promise((r) => setTimeout(r, 10));
};

describe('openSse (#672)', () => {
  let app: FastifyInstance;
  let port: number;
  const cleanup = vi.fn();

  beforeEach(async () => {
    cleanup.mockClear();
    app = Fastify({ logger: false });
    app.get('/stream', async (request, reply) => {
      const stream = openSse(request, reply);
      if (!stream) return reply;
      stream.onClose(cleanup);
      stream.send('hello', { ok: true });
    });
    await app.listen({ port: 0, host: '127.0.0.1' });
    port = (app.server.address() as { port: number }).port;
  });

  afterEach(async () => {
    Object.assign(sseLimits, defaults);
    await app.close();
  });

  it('runs cleanup and frees the slot when the client leaves', async () => {
    const { req, first } = await get(port);
    expect(await first).toBe('event: hello\ndata: {"ok":true}\n\n');
    expect(openSseStreams()).toBe(1);
    req.destroy();
    await until(() => cleanup.mock.calls.length > 0);
    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(openSseStreams()).toBe(0);
  });

  it('answers 503 past the stream limit', async () => {
    sseLimits.maxStreams = 1;
    const { req, first } = await get(port);
    await first;
    const { res } = await get(port);
    expect(res.statusCode).toBe(503);
    expect(res.headers['retry-after']).toBe('5');
    res.resume();
    req.destroy();
    await until(() => openSseStreams() === 0);
  });

  it('ends the stream at its lifetime', async () => {
    sseLimits.lifetimeMs = 50;
    const { res } = await get(port);
    res.resume();
    await new Promise((resolve) => res.on('end', resolve));
    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(openSseStreams()).toBe(0);
  });
});
