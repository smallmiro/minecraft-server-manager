import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import type { FastifyInstance } from 'fastify';

// Server create and delete run one at a time (#656). Each fake script call
// stays pending until the test finishes it.
const calls = vi.hoisted(() => ({
  exec: [] as Array<{ args: string[]; done: () => void; fail: (err: Error) => void }>,
  spawned: [] as Array<{ pid: number; options: { detached?: boolean }; emit: (event: string, ...args: unknown[]) => boolean }>,
}));

// 'child_process' and 'node:child_process' are one module to vitest, so one mock.
vi.mock('node:child_process', async (importOriginal) => ({
  ...(await importOriginal<typeof import('node:child_process')>()),
  execFile: vi.fn((_cmd: string, args: string[], _opts: unknown, cb: (e: Error | null, r?: object) => void) => {
    calls.exec.push({ args, done: () => cb(null, { stdout: '', stderr: '' }), fail: (err) => cb(err) });
  }),
  spawn: vi.fn((_cmd: string, _args: string[], options: { detached?: boolean }) => {
    const proc = Object.assign(new EventEmitter(), {
      pid: 4242,
      options,
      stdout: new EventEmitter(),
      stderr: new EventEmitter(),
      kill: vi.fn(),
    });
    calls.spawned.push(proc);
    return proc;
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

describe('server create/delete single-flight (#656)', () => {
  let app: FastifyInstance;

  let lastReply: FastifyReply | undefined;
  const defaults = { ...lifecycleLimits };

  beforeAll(async () => {
    app = await buildApp({ logger: false });
    app.addHook('onRequest', async (_request, reply) => {
      lastReply = reply;
    });
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    calls.exec.length = 0;
    calls.spawned.length = 0;
    vi.restoreAllMocks();
    vi.mocked(serverExists).mockImplementation((name: string) => name === 'old');
    Object.assign(lifecycleLimits, defaults);
  });

  it('queues a delete behind a running create and runs it after', async () => {
    const create = app.inject({ method: 'POST', url: '/api/servers', payload: { name: 'fresh', type: 'PAPER' } });
    await settle();
    const remove = app.inject({ method: 'DELETE', url: '/api/servers/old' });
    await settle();

    expect(calls.exec.map((c) => c.args[0])).toEqual(['/scripts/create-server.sh']);

    calls.exec[0]!.done();
    expect((await create).statusCode).toBe(201);
    await settle();

    expect(calls.exec.map((c) => c.args[0])).toEqual(['/scripts/create-server.sh', '/scripts/delete-server.sh']);
    calls.exec[1]!.done();
    expect((await remove).statusCode).toBe(200);
  });

  it('checks existence inside the lock, so a second create of the same name gets 409', async () => {
    const first = app.inject({ method: 'POST', url: '/api/servers', payload: { name: 'twin', type: 'PAPER' } });
    await settle();
    const second = app.inject({ method: 'POST', url: '/api/servers', payload: { name: 'twin', type: 'PAPER' } });
    await settle();
    expect(calls.exec).toHaveLength(1);

    vi.mocked(serverExists).mockImplementation((name: string) => name === 'twin');
    calls.exec[0]!.done();
    expect((await first).statusCode).toBe(201);
    expect((await second).statusCode).toBe(409);
    expect(calls.exec).toHaveLength(1);
  });

  it('holds the lock for a streaming create until the script exits', async () => {
    const create = app.inject({ method: 'POST', url: '/api/servers?follow=true', payload: { name: 'stream', type: 'PAPER' } });
    await settle();
    expect(calls.spawned).toHaveLength(1);

    const remove = app.inject({ method: 'DELETE', url: '/api/servers/old' });
    await settle();
    expect(calls.exec).toHaveLength(0);

    calls.spawned[0]!.emit('close', 0);
    await create;
    await settle();
    expect(calls.exec.map((c) => c.args[0])).toEqual(['/scripts/delete-server.sh']);
    calls.exec[0]!.done();
    expect((await remove).statusCode).toBe(200);
  });

  it('releases the lock when a create fails', async () => {
    const create = app.inject({ method: 'POST', url: '/api/servers', payload: { name: 'broken', type: 'PAPER' } });
    await settle();
    calls.exec[0]!.fail(Object.assign(new Error('boom'), { stderr: 'boom' }));
    expect((await create).statusCode).toBe(500);

    const remove = app.inject({ method: 'DELETE', url: '/api/servers/old' });
    await settle();
    expect(calls.exec.map((c) => c.args[0])).toEqual(['/scripts/create-server.sh', '/scripts/delete-server.sh']);
    calls.exec[1]!.done();
    expect((await remove).statusCode).toBe(200);
  });

  describe('the queue is released when a create hangs (#656 review)', () => {
    const kills = () => vi.mocked(process.kill).mock.calls.map(([pid, sig]) => `${pid}:${sig}`);

    beforeEach(() => {
      vi.spyOn(process, 'kill').mockImplementation(() => true);
      Object.assign(lifecycleLimits, { sseCreateTimeoutMs: 40, createTimeoutMs: 40, killGraceMs: 40 });
    });

    it('starts the streaming script in its own process group', async () => {
      const create = app.inject({ method: 'POST', url: '/api/servers?follow=true', payload: { name: 'group', type: 'PAPER' } });
      await settle();
      expect(calls.spawned[0]!.options.detached).toBe(true);
      calls.spawned[0]!.emit('close', 0);
      await create;
    });

    it('a stalled streaming create times out: TERM then KILL to the group, then the next request runs', async () => {
      const create = app.inject({ method: 'POST', url: '/api/servers?follow=true', payload: { name: 'stall', type: 'PAPER' } });
      await settle();
      const remove = app.inject({ method: 'DELETE', url: '/api/servers/old' });
      await settle();
      expect(calls.exec).toHaveLength(0);

      // The script never exits, even after SIGKILL (a child still holds the pipes).
      await new Promise((resolve) => setTimeout(resolve, 250));
      expect(kills()).toEqual(['-4242:SIGTERM', '-4242:SIGKILL']);
      expect((await create).body).toContain('timed out');

      expect(calls.exec.map((c) => c.args[0])).toEqual(['/scripts/delete-server.sh']);
      calls.exec[0]!.done();
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
      expect(calls.exec).toHaveLength(0);

      calls.spawned[0]!.emit('close', null);
      await settle();
      expect(calls.exec.map((c) => c.args[0])).toEqual(['/scripts/delete-server.sh']);
      calls.exec[0]!.done();
      expect((await remove).statusCode).toBe(200);
    });

    it('a JSON create whose script never returns frees the queue after its timeout', async () => {
      const create = app.inject({ method: 'POST', url: '/api/servers', payload: { name: 'hang', type: 'PAPER' } });
      await settle();
      const remove = app.inject({ method: 'DELETE', url: '/api/servers/old' });
      await new Promise((resolve) => setTimeout(resolve, 200));

      expect(calls.exec.map((c) => c.args[0])).toEqual(['/scripts/create-server.sh', '/scripts/delete-server.sh']);
      calls.exec[1]!.done();
      expect((await remove).statusCode).toBe(200);
      calls.exec[0]!.done();
      await create;
    });
  });
});
