/**
 * #669: a Docker daemon that cannot be asked is not "no containers". With a
 * `docker` on PATH that fails like a stopped daemon, the API answers 503 and
 * nothing that changes state goes ahead.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import {
  RuntimeUnavailableError,
  getContainerStatusAsync,
  invalidateContainerStates,
  type IPlayerSessionUseCase,
} from '@minecraft-docker/shared';
import { buildApp } from '../src/app.js';
import { isServerRunning } from '../src/services/config-snapshot-service.js';
import { PlayerSessionCollectorService } from '../src/services/player-session-collector.js';

const ROOT = process.env.MCCTL_ROOT!;
const BIN = mkdtempSync(join(tmpdir(), 'mcctl-api-docker-down-'));
const WORLD_FILE = join(ROOT, 'worlds', 'alpha-world', 'level.dat');

describe('Docker daemon down (#669)', () => {
  let app: FastifyInstance;
  const savedPath = process.env.PATH;

  beforeAll(async () => {
    const docker = join(BIN, 'docker');
    writeFileSync(
      docker,
      '#!/bin/sh\necho "Cannot connect to the Docker daemon at unix:///var/run/docker.sock. Is the docker daemon running?" >&2\nexit 1\n'
    );
    chmodSync(docker, 0o755);
    process.env.PATH = `${BIN}${delimiter}${savedPath}`;
    mkdirSync(join(ROOT, 'servers', 'alpha'), { recursive: true });
    writeFileSync(join(ROOT, 'servers', 'alpha', 'config.env'), 'TYPE=PAPER\nLEVEL=alpha-world\n');
    mkdirSync(join(ROOT, 'worlds', 'alpha-world'), { recursive: true });
    writeFileSync(WORLD_FILE, 'world data');
    app = await buildApp({ logger: false });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    process.env.PATH = savedPath;
    rmSync(BIN, { recursive: true, force: true });
    rmSync(join(ROOT, 'servers'), { recursive: true, force: true });
    rmSync(join(ROOT, 'worlds'), { recursive: true, force: true });
  });

  beforeEach(() => {
    invalidateContainerStates();
  });

  it.each([
    ['GET', '/api/servers'],
    ['GET', '/api/servers-status'],
    ['GET', '/api/servers/alpha'],
    ['GET', '/api/servers/alpha/status'],
    ['GET', '/api/router/status'],
    ['GET', '/api/playit/status'],
  ] as const)('%s %s answers 503, not a list of absent servers', async (method, url) => {
    const response = await app.inject({ method, url });
    expect(response.statusCode).toBe(503);
    expect(response.json()).toMatchObject({ error: 'ServiceUnavailable' });
  });

  it('refuses a world reset with 503 and leaves the world alone', async () => {
    const response = await app.inject({ method: 'POST', url: '/api/servers/alpha/world/reset' });
    expect(response.statusCode).toBe(503);
    expect(response.json()).toMatchObject({ error: 'ServiceUnavailable' });
    expect(existsSync(WORLD_FILE)).toBe(true);
  });

  it('does not report the server as stopped to the snapshot restore check', async () => {
    await expect(isServerRunning('alpha')).rejects.toBeInstanceOf(RuntimeUnavailableError);
  });

  it('does not close player sessions', async () => {
    const sessions = {
      markServerStopped: vi.fn(),
      getCursor: vi.fn(),
      ingestLogLines: vi.fn(),
    } as unknown as IPlayerSessionUseCase;
    const fetchLogs = vi.fn(async () => []);
    const collector = new PlayerSessionCollectorService(sessions, () => ['alpha'], getContainerStatusAsync, fetchLogs);
    await collector.tick();
    expect(sessions.markServerStopped).not.toHaveBeenCalled();
    expect(fetchLogs).not.toHaveBeenCalled();
  });
});
