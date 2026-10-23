import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import type { FastifyInstance } from 'fastify';

// Server create and delete run one at a time (#656). Create provisions in
// TypeScript (#675, fake use case below); delete still runs its script through
// spawn. Each fake create or script stays running until the test finishes it.
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
const log = vi.hoisted(() => [] as string[]);

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
    log.push(args[0]!.split('/').pop()!);
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
import { fakeProvision } from './fake-provision.js';

/** Let pending handlers run until they block on the lock or a script. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

/** A create waiting for the test: done() succeeds, fail() rejects. */
interface PendingCreate {
  name: string;
  done: () => void;
  fail: (message: string) => void;
}
const creates: PendingCreate[] = [];
/** Creates and delete scripts, in start order. */
const scripts = () => log;

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
    log.length = 0;
    creates.length = 0;
    fakeProvision(
      (config) =>
        new Promise<void>((resolve, reject) => {
          log.push(`create ${config.name}`);
          creates.push({ name: config.name, done: resolve, fail: (m) => reject(new Error(m)) });
        })
    );
    vi.restoreAllMocks();
    vi.mocked(serverExists).mockImplementation((name: string) => name === 'old');
    Object.assign(lifecycleLimits, defaults);
  });

  it('queues a delete behind a running create and runs it after', async () => {
    const create = app.inject({ method: 'POST', url: '/api/servers', payload: { name: 'fresh', type: 'PAPER' } });
    await settle();
    const remove = app.inject({ method: 'DELETE', url: '/api/servers/old' });
    await settle();
    expect(scripts()).toEqual(['create fresh']);

    creates[0]!.done();
    expect((await create).statusCode).toBe(201);
    await settle();

    expect(scripts()).toEqual(['create fresh', 'delete-server.sh']);
    calls.scripts[0]!.done();
    expect((await remove).statusCode).toBe(200);
  });

  it('checks existence inside the lock, so a second create of the same name gets 409', async () => {
    const first = app.inject({ method: 'POST', url: '/api/servers', payload: { name: 'twin', type: 'PAPER' } });
    await settle();
    const second = app.inject({ method: 'POST', url: '/api/servers', payload: { name: 'twin', type: 'PAPER' } });
    await settle();
    expect(creates).toHaveLength(1);

    vi.mocked(serverExists).mockImplementation((name: string) => name === 'twin');
    creates[0]!.done();
    expect((await first).statusCode).toBe(201);
    expect((await second).statusCode).toBe(409);
    expect(creates).toHaveLength(1);
  });

  it('holds the lock for a streaming create until provisioning ends', async () => {
    const create = app.inject({ method: 'POST', url: '/api/servers?follow=true', payload: { name: 'stream', type: 'PAPER' } });
    await settle();
    const remove = app.inject({ method: 'DELETE', url: '/api/servers/old' });
    await settle();
    expect(scripts()).toEqual(['create stream']);

    creates[0]!.done();
    await create;
    await settle();
    expect(scripts()).toEqual(['create stream', 'delete-server.sh']);
    calls.scripts[0]!.done();
    expect((await remove).statusCode).toBe(200);
  });

  it('releases the lock when a create fails, and reports the error', async () => {
    const create = app.inject({ method: 'POST', url: '/api/servers', payload: { name: 'broken', type: 'PAPER' } });
    await settle();
    creates[0]!.fail('boom');
    const response = await create;
    expect(response.statusCode).toBe(500);
    expect(response.json().message).toContain('boom');

    const remove = app.inject({ method: 'DELETE', url: '/api/servers/old' });
    await settle();
    expect(scripts()).toEqual(['create broken', 'delete-server.sh']);
    calls.scripts[0]!.done();
    expect((await remove).statusCode).toBe(200);
  });

  it('a client disconnect stops the events, not the provisioning; the queue waits for it (ADR-0003 §5)', async () => {
    const create = app.inject({ method: 'POST', url: '/api/servers?follow=true', payload: { name: 'gone', type: 'PAPER' } });
    await settle();
    const remove = app.inject({ method: 'DELETE', url: '/api/servers/old' });
    await settle();

    lastReply!.raw.destroy();
    await create.catch(() => undefined);
    await settle();
    expect(scripts()).toEqual(['create gone']);

    creates[0]!.done();
    await settle();
    expect(scripts()).toEqual(['create gone', 'delete-server.sh']);
    calls.scripts[0]!.done();
    expect((await remove).statusCode).toBe(200);
  });

  it('a create that never ends holds the queue no longer than sseCreateTimeoutMs', async () => {
    lifecycleLimits.sseCreateTimeoutMs = 40;
    const create = app.inject({ method: 'POST', url: '/api/servers', payload: { name: 'hang', type: 'PAPER' } });
    await settle();
    const remove = app.inject({ method: 'DELETE', url: '/api/servers/old' });
    await new Promise((resolve) => setTimeout(resolve, 120));
    expect(scripts()).toEqual(['create hang', 'delete-server.sh']);
    calls.scripts[0]!.done();
    expect((await remove).statusCode).toBe(200);
    creates[0]!.done();
    expect((await create).statusCode).toBe(201);
  });

  describe('a hung delete script cannot hold the queue (#656 review)', () => {
    beforeEach(() => {
      vi.spyOn(process, 'kill').mockImplementation(() => true);
    });

    it('runs the delete script in its own process group', async () => {
      const request = app.inject({ method: 'DELETE', url: '/api/servers/old' });
      await settle();
      expect(calls.scripts[0]!.options.detached).toBe(true);
      calls.scripts[0]!.done();
      await request;
    });
  });
});
