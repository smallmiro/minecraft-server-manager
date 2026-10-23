import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import type { FastifyInstance } from 'fastify';

// Server create and delete run one at a time (#656). Every script runs through
// spawn; each fake script stays running until the test finishes it.
type FakeScript = EventEmitter & {
  pid: number;
  args: string[];
  options: { detached?: boolean };
  stdout: EventEmitter;
  stderr: EventEmitter;
  done: () => void;
  fail: (stderr: string) => void;
};
const calls = vi.hoisted(() => ({ scripts: [] as FakeScript[] }));

// 'child_process' and 'node:child_process' are one module to vitest, so one mock.
vi.mock('node:child_process', async (importOriginal) => ({
  ...(await importOriginal<typeof import('node:child_process')>()),
  execFile: vi.fn(() => {
    throw new Error('create/delete scripts must run through spawn (process group)');
  }),
  spawn: vi.fn((_cmd: string, args: string[], options: { detached?: boolean }) => {
    const script = Object.assign(new EventEmitter(), {
      pid: 4242,
      args,
      options,
      stdout: new EventEmitter(),
      stderr: new EventEmitter(),
      kill: vi.fn(),
    }) as unknown as FakeScript;
    script.done = () => { script.emit('close', 0); };
    script.fail = (stderr: string) => {
      script.stderr.emit('data', Buffer.from(stderr));
      script.emit('close', 1);
    };
    calls.scripts.push(script);
    return script;
  }),
}));

vi.mock('@minecraft-docker/shared', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@minecraft-docker/shared')>()),
  serverExists: vi.fn(),
  getContainerStatus: vi.fn(() => 'exited'),
  stopContainer: vi.fn(),
}));

vi.mock('@minecraft-docker/mod-source-modrinth', () => ({}));

vi.mock('../src/lib/script-resolver.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/lib/script-resolver.js')>()),
  resolveScriptPath: vi.fn((name: string) => ({ scriptPath: `/scripts/${name}`, scriptsDir: '/scripts' })),
}));

vi.mock('../src/services/audit-log-service.js', () => ({
  writeAuditLog: vi.fn().mockResolvedValue(undefined),
}));

import type { FastifyReply } from 'fastify';
import { serverExists } from '@minecraft-docker/shared';
import { buildApp } from '../src/app.js';
import { lifecycleLimits } from '../src/routes/servers.js';

/** Let pending handlers run until they block on the lock or a script. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

/** Script names in start order. */
const scripts = () => calls.scripts.map((s) => s.args[0]!.split('/').pop());

describe('server create/delete single-flight (#656)', () => {
  let app: FastifyInstance;

  let lastReply: FastifyReply | undefined;
  const defaults = { ...lifecycleLimits };

  beforeAll(async () => {
    app = await buildApp({ logger: false });
    app.addHook('onRequest', async (request, reply) => {
      if (request.url.includes('follow=true')) lastReply = reply;
    });
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    calls.scripts.length = 0;
    vi.restoreAllMocks();
    vi.mocked(serverExists).mockImplementation((name: string) => name === 'old');
    Object.assign(lifecycleLimits, defaults);
  });

  it('queues a delete behind a running create and runs it after', async () => {
    const create = app.inject({ method: 'POST', url: '/api/servers', payload: { name: 'fresh', type: 'PAPER' } });
    await settle();
    const remove = app.inject({ method: 'DELETE', url: '/api/servers/old' });
    await settle();
    expect(scripts()).toEqual(['create-server.sh']);

    calls.scripts[0]!.done();
    expect((await create).statusCode).toBe(201);
    await settle();

    expect(scripts()).toEqual(['create-server.sh', 'delete-server.sh']);
    calls.scripts[1]!.done();
    expect((await remove).statusCode).toBe(200);
  });

  it('checks existence inside the lock, so a second create of the same name gets 409', async () => {
    const first = app.inject({ method: 'POST', url: '/api/servers', payload: { name: 'twin', type: 'PAPER' } });
    await settle();
    const second = app.inject({ method: 'POST', url: '/api/servers', payload: { name: 'twin', type: 'PAPER' } });
    await settle();
    expect(scripts()).toHaveLength(1);

    vi.mocked(serverExists).mockImplementation((name: string) => name === 'twin');
    calls.scripts[0]!.done();
    expect((await first).statusCode).toBe(201);
    expect((await second).statusCode).toBe(409);
    expect(scripts()).toHaveLength(1);
  });

  it('holds the lock for a streaming create until the script exits', async () => {
    const create = app.inject({ method: 'POST', url: '/api/servers?follow=true', payload: { name: 'stream', type: 'PAPER' } });
    await settle();
    const remove = app.inject({ method: 'DELETE', url: '/api/servers/old' });
    await settle();
    expect(scripts()).toEqual(['create-server.sh']);

    calls.scripts[0]!.done();
    await create;
    await settle();
    expect(scripts()).toEqual(['create-server.sh', 'delete-server.sh']);
    calls.scripts[1]!.done();
    expect((await remove).statusCode).toBe(200);
  });

  it('releases the lock when a create fails, and reports the script error', async () => {
    const create = app.inject({ method: 'POST', url: '/api/servers', payload: { name: 'broken', type: 'PAPER' } });
    await settle();
    calls.scripts[0]!.fail('boom');
    const response = await create;
    expect(response.statusCode).toBe(500);
    expect(response.json().message).toContain('boom');

    const remove = app.inject({ method: 'DELETE', url: '/api/servers/old' });
    await settle();
    expect(scripts()).toEqual(['create-server.sh', 'delete-server.sh']);
    calls.scripts[1]!.done();
    expect((await remove).statusCode).toBe(200);
  });

  describe('a hung script cannot hold the queue (#656 review)', () => {
    const kills = () => vi.mocked(process.kill).mock.calls.map(([pid, sig]) => `${pid}:${sig}`);
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    beforeEach(() => {
      vi.spyOn(process, 'kill').mockImplementation(() => true);
      Object.assign(lifecycleLimits, { sseCreateTimeoutMs: 40, createTimeoutMs: 40, deleteTimeoutMs: 40, killGraceMs: 40 });
    });

    it.each([
      ['streaming create', 'POST', '/api/servers?follow=true', { name: 'group', type: 'PAPER' }],
      ['JSON create', 'POST', '/api/servers', { name: 'group', type: 'PAPER' }],
      ['delete', 'DELETE', '/api/servers/old', undefined],
    ] as const)('runs the %s script in its own process group', async (_label, method, url, payload) => {
      const request = app.inject({ method, url, ...(payload ? { payload } : {}) });
      await settle();
      expect(calls.scripts[0]!.options.detached).toBe(true);
      calls.scripts[0]!.done();
      await request;
    });

    it('a stalled streaming create times out: TERM then KILL to the group, then the next request runs', async () => {
      const create = app.inject({ method: 'POST', url: '/api/servers?follow=true', payload: { name: 'stall', type: 'PAPER' } });
      await settle();
      const remove = app.inject({ method: 'DELETE', url: '/api/servers/old' });
      await settle();
      expect(scripts()).toEqual(['create-server.sh']);

      // The script never exits, even after SIGKILL (a child still holds the pipes).
      await wait(250);
      expect(kills()).toEqual(['-4242:SIGTERM', '-4242:SIGKILL']);
      expect((await create).body).toContain('timed out');

      expect(scripts()).toEqual(['create-server.sh', 'delete-server.sh']);
      calls.scripts[1]!.done();
      expect((await remove).statusCode).toBe(200);
    });

    it('a client disconnect stops the streaming create group and frees the queue when it exits', async () => {
      lifecycleLimits.sseCreateTimeoutMs = 60_000;
      const create = app.inject({ method: 'POST', url: '/api/servers?follow=true', payload: { name: 'gone', type: 'PAPER' } });
      await settle();
      const remove = app.inject({ method: 'DELETE', url: '/api/servers/old' });
      await settle();

      lastReply!.raw.destroy();
      await create.catch(() => undefined);
      await settle();
      expect(kills()).toEqual(['-4242:SIGTERM']);
      expect(scripts()).toEqual(['create-server.sh']);

      calls.scripts[0]!.emit('close', null);
      await settle();
      expect(scripts()).toEqual(['create-server.sh', 'delete-server.sh']);
      calls.scripts[1]!.done();
      expect((await remove).statusCode).toBe(200);
    });

    it('a stalled JSON create: TERM, then KILL to the group, and the next request starts only after that', async () => {
      const create = app.inject({ method: 'POST', url: '/api/servers', payload: { name: 'hang', type: 'PAPER' } });
      await settle();
      const remove = app.inject({ method: 'DELETE', url: '/api/servers/old' });

      await wait(60); // past the timeout, inside the grace period
      expect(kills()).toEqual(['-4242:SIGTERM']);
      expect(scripts()).toEqual(['create-server.sh']);

      const response = await create; // the script never exits
      expect(kills()).toEqual(['-4242:SIGTERM', '-4242:SIGKILL']);
      expect(response.statusCode).toBe(500);
      expect(response.json().message).toContain('timed out');

      await settle();
      expect(scripts()).toEqual(['create-server.sh', 'delete-server.sh']);
      calls.scripts[1]!.done();
      expect((await remove).statusCode).toBe(200);
    });

    it('a JSON create that exits on SIGTERM frees the queue right away', async () => {
      lifecycleLimits.killGraceMs = 60_000;
      const create = app.inject({ method: 'POST', url: '/api/servers', payload: { name: 'term', type: 'PAPER' } });
      await settle();
      const remove = app.inject({ method: 'DELETE', url: '/api/servers/old' });
      await wait(60);
      expect(kills()).toEqual(['-4242:SIGTERM']);

      calls.scripts[0]!.emit('close', null);
      expect((await create).statusCode).toBe(500);
      await settle();
      expect(scripts()).toEqual(['create-server.sh', 'delete-server.sh']);
      calls.scripts[1]!.done();
      expect((await remove).statusCode).toBe(200);
    });
  });
});
