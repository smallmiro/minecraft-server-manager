import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';

// Server create and delete run one at a time (#656). Both run in TypeScript
// now (create #675, delete #735): the fakes below stay pending until the test
// finishes them. No child process may be started for either.
const log = vi.hoisted(() => [] as string[]);

vi.mock('node:child_process', async (importOriginal) => ({
  ...(await importOriginal<typeof import('node:child_process')>()),
  spawn: vi.fn(() => {
    throw new Error('create/delete must not spawn a process (#675, #735)');
  }),
}));

vi.mock('@minecraft-docker/shared', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@minecraft-docker/shared')>()),
  serverExists: vi.fn(),
}));

vi.mock('@minecraft-docker/mod-source-modrinth', () => ({}));

vi.mock('../src/services/audit-log-service.js', () => ({
  writeAuditLog: vi.fn().mockResolvedValue(undefined),
}));

import type { FastifyReply } from 'fastify';
import { serverExists } from '@minecraft-docker/shared';
import { buildApp } from '../src/app.js';
import { lifecycleLimits } from '../src/routes/servers.js';
import { fakeDelete, fakeProvision } from './fake-provision.js';

/** Give a queued request time to (wrongly) start; only for "has not started" checks. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

/** Poll until the assertion holds, so a slow CI runner does not race the handlers (#757). */
const until = (assertion: () => void) => vi.waitFor(assertion, { interval: 5, timeout: 5_000 });

/** Wait until `n` creates or deletes have started. */
const started = (n: number) => until(() => expect(log).toHaveLength(n));

/** Requests that reached their handler, which queues them synchronously. */
let arrivals = 0;

/** Wait until `n` requests reached the queue, then give the last one time to (wrongly) start. */
const queued = async (n: number) => {
  await until(() => expect(arrivals).toBe(n));
  await settle();
};

/** A create or delete waiting for the test: done() succeeds, fail() rejects. */
interface Pending {
  name: string;
  done: () => void;
  fail: (message: string) => void;
}
const creates: Pending[] = [];
const deletes: Pending[] = [];
/** Creates and deletes, in start order. */
const scripts = () => log;
const pending = (list: Pending[], name: string) =>
  new Promise<void>((resolve, reject) => {
    list.push({ name, done: resolve, fail: (m) => reject(new Error(m)) });
  });

describe('server create/delete single-flight (#656)', () => {
  let app: FastifyInstance;

  let lastReply: FastifyReply | undefined;
  const defaults = { ...lifecycleLimits };

  beforeAll(async () => {
    app = await buildApp({ logger: false });
    app.addHook('onRequest', async (request, reply) => {
      if (request.url.includes('follow=true')) lastReply = reply;
    });
    app.addHook('preHandler', async () => {
      arrivals++;
    });
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    log.length = 0;
    creates.length = 0;
    deletes.length = 0;
    arrivals = 0;
    fakeProvision((config) => {
      log.push(`create ${config.name}`);
      return pending(creates, config.name);
    });
    fakeDelete((name) => {
      log.push(`delete ${name}`);
      return pending(deletes, name);
    });
    vi.restoreAllMocks();
    vi.mocked(serverExists).mockImplementation((name: string) => name === 'old');
    Object.assign(lifecycleLimits, defaults);
  });

  it('queues a delete behind a running create and runs it after', async () => {
    const create = app.inject({ method: 'POST', url: '/api/servers', payload: { name: 'fresh', type: 'PAPER' } });
    await started(1);
    const remove = app.inject({ method: 'DELETE', url: '/api/servers/old' });
    await queued(2);
    expect(scripts()).toEqual(['create fresh']);

    creates[0]!.done();
    expect((await create).statusCode).toBe(201);
    await started(2);

    expect(scripts()).toEqual(['create fresh', 'delete old']);
    deletes[0]!.done();
    expect((await remove).statusCode).toBe(200);
  });

  it('checks existence inside the lock, so a second create of the same name gets 409', async () => {
    const first = app.inject({ method: 'POST', url: '/api/servers', payload: { name: 'twin', type: 'PAPER' } });
    await started(1);
    const second = app.inject({ method: 'POST', url: '/api/servers', payload: { name: 'twin', type: 'PAPER' } });
    await queued(2);
    expect(creates).toHaveLength(1);

    vi.mocked(serverExists).mockImplementation((name: string) => name === 'twin');
    creates[0]!.done();
    expect((await first).statusCode).toBe(201);
    expect((await second).statusCode).toBe(409);
    expect(creates).toHaveLength(1);
  });

  it('holds the lock for a streaming create until provisioning ends', async () => {
    const create = app.inject({ method: 'POST', url: '/api/servers?follow=true', payload: { name: 'stream', type: 'PAPER' } });
    await started(1);
    const remove = app.inject({ method: 'DELETE', url: '/api/servers/old' });
    await queued(2);
    expect(scripts()).toEqual(['create stream']);

    creates[0]!.done();
    await create;
    await started(2);
    expect(scripts()).toEqual(['create stream', 'delete old']);
    deletes[0]!.done();
    expect((await remove).statusCode).toBe(200);
  });

  it('releases the lock when a create fails, and reports the error', async () => {
    const create = app.inject({ method: 'POST', url: '/api/servers', payload: { name: 'broken', type: 'PAPER' } });
    await started(1);
    creates[0]!.fail('boom');
    const response = await create;
    expect(response.statusCode).toBe(500);
    expect(response.json().message).toContain('boom');

    const remove = app.inject({ method: 'DELETE', url: '/api/servers/old' });
    await started(2);
    expect(scripts()).toEqual(['create broken', 'delete old']);
    deletes[0]!.done();
    expect((await remove).statusCode).toBe(200);
  });

  it('a client disconnect stops the events, not the provisioning; the queue waits for it (ADR-0003 §5)', async () => {
    const create = app.inject({ method: 'POST', url: '/api/servers?follow=true', payload: { name: 'gone', type: 'PAPER' } });
    await started(1);
    const remove = app.inject({ method: 'DELETE', url: '/api/servers/old' });
    await queued(2);

    lastReply!.raw.destroy();
    await create.catch(() => undefined);
    await settle();
    expect(scripts()).toEqual(['create gone']);

    creates[0]!.done();
    await started(2);
    expect(scripts()).toEqual(['create gone', 'delete old']);
    deletes[0]!.done();
    expect((await remove).statusCode).toBe(200);
  });

  it('a create that never ends holds the queue no longer than sseCreateTimeoutMs', async () => {
    lifecycleLimits.sseCreateTimeoutMs = 40;
    const create = app.inject({ method: 'POST', url: '/api/servers', payload: { name: 'hang', type: 'PAPER' } });
    await started(1);
    const remove = app.inject({ method: 'DELETE', url: '/api/servers/old' });
    await started(2); // after sseCreateTimeoutMs
    expect(scripts()).toEqual(['create hang', 'delete old']);
    deletes[0]!.done();
    expect((await remove).statusCode).toBe(200);
    creates[0]!.done();
    expect((await create).statusCode).toBe(201);
  });

  describe('a JSON create whose container start outlasts createTimeoutMs (#675 review)', () => {
    /** Writes the files, reports 'starting', then starts until the test calls done(). */
    const slowStart = () =>
      fakeProvision(
        (config, run) =>
          new Promise<void>((resolve, reject) => {
            log.push(`create ${config.name}`);
            run.onProgress?.('creating', 'Creating server directory...');
            run.onProgress?.('starting', 'Starting container...');
            creates.push({ name: config.name, done: resolve, fail: (m) => reject(new Error(m)) });
          })
      );

    it('answers 201 created with a warning that the start goes on in the background', async () => {
      lifecycleLimits.createTimeoutMs = 30;
      slowStart();
      const response = await app.inject({ method: 'POST', url: '/api/servers', payload: { name: 'slow', type: 'PAPER' } });

      expect(response.statusCode).toBe(201);
      const body = response.json();
      expect(body.server.status).toBe('created');
      expect(body.warning).toMatch(/still starting in the background/);
      expect(body.warning).toMatch(/mcctl start slow/);
      creates[0]!.done();
    });

    it('lets the queue move on once it answered; the start keeps running', async () => {
      lifecycleLimits.createTimeoutMs = 30;
      slowStart();
      expect((await app.inject({ method: 'POST', url: '/api/servers', payload: { name: 'slow', type: 'PAPER' } })).statusCode).toBe(201);

      const remove = app.inject({ method: 'DELETE', url: '/api/servers/old' });
      await started(2);
      expect(scripts()).toEqual(['create slow', 'delete old']);
      deletes[0]!.done();
      expect((await remove).statusCode).toBe(200);
      creates[0]!.done();
    });

    it('waits for the files before answering: the limit starts at the container start', async () => {
      lifecycleLimits.createTimeoutMs = 30;
      fakeProvision(
        (config) =>
          new Promise<void>((resolve, reject) => {
            log.push(`create ${config.name}`);
            creates.push({ name: config.name, done: resolve, fail: (m) => reject(new Error(m)) });
          })
      );
      const create = app.inject({ method: 'POST', url: '/api/servers', payload: { name: 'files', type: 'PAPER' } });
      await started(1);
      await new Promise((resolve) => setTimeout(resolve, 60));
      creates[0]!.fail('servers/compose.yml is locked');
      expect((await create).statusCode).toBe(500);
    });

    it('keeps the streaming create waiting for the start (30-minute limit)', async () => {
      lifecycleLimits.createTimeoutMs = 30;
      slowStart();
      const create = app.inject({ method: 'POST', url: '/api/servers?follow=true', payload: { name: 'stream', type: 'PAPER' } });
      await started(1);
      const remove = app.inject({ method: 'DELETE', url: '/api/servers/old' });
      await queued(2);
      await new Promise((resolve) => setTimeout(resolve, 60));
      expect(scripts()).toEqual(['create stream']);

      creates[0]!.done();
      expect((await create).body).toContain('Server created successfully');
      await started(2);
      deletes[0]!.done();
      expect((await remove).statusCode).toBe(200);
    });
  });

  it('a delete holds the queue until it ends, up to 30 minutes like a streaming create (#735 review)', () => {
    // A delete is not killed, and each runtime step or a cross-device world copy can take minutes.
    expect(defaults.deleteHoldMs).toBe(30 * 60_000);
    expect(defaults.deleteHoldMs).toBe(defaults.sseCreateTimeoutMs);
    expect(Object.keys(defaults).sort()).toEqual(['createTimeoutMs', 'deleteHoldMs', 'sseCreateTimeoutMs']);
  });

  it('a slow delete keeps the queue until it ends', async () => {
    lifecycleLimits.deleteHoldMs = 5_000;
    const remove = app.inject({ method: 'DELETE', url: '/api/servers/old' });
    await started(1);
    const create = app.inject({ method: 'POST', url: '/api/servers', payload: { name: 'next', type: 'PAPER' } });
    await queued(2);
    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(scripts()).toEqual(['delete old']);

    deletes[0]!.done();
    expect((await remove).statusCode).toBe(200);
    await started(2);
    creates[0]!.done();
    expect((await create).statusCode).toBe(201);
  });

  it('a delete that never ends holds the queue no longer than deleteHoldMs', async () => {
    lifecycleLimits.deleteHoldMs = 40;
    const remove = app.inject({ method: 'DELETE', url: '/api/servers/old' });
    await started(1);
    const create = app.inject({ method: 'POST', url: '/api/servers', payload: { name: 'next', type: 'PAPER' } });
    await started(2); // after deleteHoldMs
    expect(scripts()).toEqual(['delete old', 'create next']);
    creates[0]!.done();
    expect((await create).statusCode).toBe(201);
    deletes[0]!.done();
    expect((await remove).statusCode).toBe(200);
  });

  it('a failed delete releases the queue and answers 500', async () => {
    const remove = app.inject({ method: 'DELETE', url: '/api/servers/old' });
    await started(1);
    deletes[0]!.fail('worlds/old already exists');
    const response = await remove;
    expect(response.statusCode).toBe(500);
    expect(response.json().message).toContain('worlds/old already exists');

    const create = app.inject({ method: 'POST', url: '/api/servers', payload: { name: 'after', type: 'PAPER' } });
    await started(2);
    creates[0]!.done();
    expect((await create).statusCode).toBe(201);
  });
});
