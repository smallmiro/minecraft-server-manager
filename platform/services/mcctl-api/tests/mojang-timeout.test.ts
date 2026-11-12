/**
 * #672: Mojang profile lookups carry a timeout signal, and a lookup that
 * times out answers 500 instead of holding the request.
 */
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';

vi.mock('@minecraft-docker/mod-source-modrinth', () => ({}));

import { buildApp } from '../src/app.js';

describe('Mojang lookup timeout (#672)', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp({ logger: false });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('GET /api/players/:username passes a timeout signal to fetch', async () => {
    const fetch = vi.fn(async () => Response.json({ id: '069a79f444e94726a5befca90e38aaf5', name: 'Notch' }));
    vi.stubGlobal('fetch', fetch);

    const response = await app.inject({ method: 'GET', url: '/api/players/Notch' });

    expect(response.statusCode).toBe(200);
    expect(fetch).toHaveBeenCalledWith(
      'https://api.mojang.com/users/profiles/minecraft/Notch',
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
  });

  it('answers 500 when the lookup times out', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new DOMException('The operation was aborted due to timeout', 'TimeoutError');
      })
    );

    const response = await app.inject({ method: 'GET', url: '/api/players/Notch' });

    expect(response.statusCode).toBe(500);
  });
});
