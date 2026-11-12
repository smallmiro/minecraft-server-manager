/**
 * #672: a docker that does not answer must not block the API. A `docker` on
 * PATH that sleeps holds GET /api/servers; /health still answers at once.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { buildApp } from '../src/app.js';

const ROOT = process.env.MCCTL_ROOT!;
const BIN = mkdtempSync(join(tmpdir(), 'mcctl-api-slow-docker-'));
const DOCKER_DELAY_S = 2;

describe('/health while docker hangs (#672)', () => {
  let app: FastifyInstance;
  const savedPath = process.env.PATH;

  beforeAll(async () => {
    const docker = join(BIN, 'docker');
    writeFileSync(docker, `#!/bin/sh\nsleep ${DOCKER_DELAY_S}\nexit 1\n`);
    chmodSync(docker, 0o755);
    process.env.PATH = `${BIN}${delimiter}${savedPath}`;
    mkdirSync(join(ROOT, 'servers', 'alpha'), { recursive: true });
    writeFileSync(join(ROOT, 'servers', 'alpha', 'config.env'), 'TYPE=PAPER\n');
    app = await buildApp({ logger: false });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    process.env.PATH = savedPath;
    rmSync(BIN, { recursive: true, force: true });
    rmSync(join(ROOT, 'servers'), { recursive: true, force: true });
  });

  it('answers /health while GET /api/servers waits on docker', async () => {
    const started = Date.now();
    const servers = app.inject({ method: 'GET', url: '/api/servers' });
    // Let the servers request reach its docker call first (a sync call blocks right here).
    await new Promise(resolve => setTimeout(resolve, 100));

    const health = await app.inject({ method: 'GET', url: '/health' });
    expect(health.statusCode).toBe(200);
    expect(Date.now() - started).toBeLessThan(1_000);

    // The slow docker then fails: "cannot tell", not an empty list (#669)
    expect((await servers).statusCode).toBe(503);
  }, 15_000);
});
