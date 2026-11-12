/**
 * #672: when an SSE client leaves, the route's timers and children go with it,
 * even when it leaves during the first poll, and a docker logs child that
 * fails to spawn ends the stream instead of crashing the API.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import http from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { FastifyInstance } from 'fastify';

vi.mock('@minecraft-docker/shared', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@minecraft-docker/shared')>()),
  serverExists: vi.fn(() => true),
  serverExistsAsync: vi.fn(async () => true),
  containerExists: vi.fn(() => true),
  containerExistsAsync: vi.fn(async () => true),
  getContainerLogs: vi.fn(() => 'first line'),
  getContainerLogsAsync: vi.fn(async () => 'first line'),
  getOnlinePlayers: vi.fn(),
}));
vi.mock('@minecraft-docker/mod-source-modrinth', () => ({}));

import { getOnlinePlayers } from '@minecraft-docker/shared';
import { buildApp } from '../src/app.js';
import { openSseStreams } from '../src/lib/sse.js';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('SSE cleanup when the client leaves (#672)', () => {
  let app: FastifyInstance;
  let port: number;

  beforeAll(async () => {
    app = await buildApp({ logger: false });
    await app.listen({ port: 0, host: '127.0.0.1' });
    port = (app.server.address() as { port: number }).port;
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.mocked(getOnlinePlayers).mockReset();
  });

  it('players/live stops polling when the client leaves during the first poll', async () => {
    let answerFirst: (value: null) => void = () => {};
    vi.mocked(getOnlinePlayers)
      .mockImplementationOnce(() => new Promise((resolve) => (answerFirst = resolve)))
      .mockResolvedValue(null);

    const req = http.get({ host: '127.0.0.1', port, path: '/api/servers/alpha/players/live?follow=true&interval=1000' });
    req.on('error', () => {});
    for (let i = 0; i < 100 && vi.mocked(getOnlinePlayers).mock.calls.length === 0; i++) await sleep(10);
    expect(getOnlinePlayers).toHaveBeenCalledTimes(1);

    req.destroy();
    await sleep(50);
    answerFirst(null);
    await sleep(1_500);

    expect(getOnlinePlayers).toHaveBeenCalledTimes(1);
    expect(openSseStreams()).toBe(0);
  }, 10_000);

  it('logs?follow ends the stream when docker logs cannot be spawned', async () => {
    const empty = mkdtempSync(join(tmpdir(), 'mcctl-api-no-docker-'));
    const savedPath = process.env.PATH;
    process.env.PATH = empty;
    try {
      const body = await new Promise<string>((resolve, reject) => {
        const req = http.get({ host: '127.0.0.1', port, path: '/api/servers/alpha/logs?follow=true' }, (res) => {
          let text = '';
          res.on('data', (chunk: Buffer) => (text += chunk.toString()));
          res.on('end', () => resolve(text));
        });
        req.on('error', reject);
      });
      expect(body).toContain('first line');
      expect(body).toContain('connection-closed');
      expect(openSseStreams()).toBe(0);
    } finally {
      process.env.PATH = savedPath;
      rmSync(empty, { recursive: true, force: true });
    }
  });
});
