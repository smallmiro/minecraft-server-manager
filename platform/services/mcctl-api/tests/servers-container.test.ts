/**
 * Server routes on a fake container (#667): the use cases and ports come from
 * buildApp({ container }), so no child_process mock is needed. The only
 * docker call left is the module-level serverExistsAsync() check; a `docker` on
 * PATH that lists no containers makes it read config.env from the temp root
 * (a failing one is "cannot tell", not "absent", since #669).
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import type { CreateServerConfig, WorldAssignmentSnapshot } from '@minecraft-docker/shared';
import { buildApp } from '../src/app.js';
import type { ApiContainer } from '../src/plugins/container.js';

const ROOT = process.env.MCCTL_ROOT!;
const BIN = mkdtempSync(join(tmpdir(), 'mcctl-api-fake-docker-'));

describe('server routes with a fake container (#667)', () => {
  let app: FastifyInstance;
  const savedPath = process.env.PATH;
  const creates: Array<{ config: CreateServerConfig; sudoPassword?: string; startTimeoutMs?: number }> = [];
  const deletes: Array<{ name: string; deleteWorld?: boolean; sudoPassword?: string }> = [];
  let snapshot: WorldAssignmentSnapshot;

  const container: Partial<ApiContainer> = {
    createServerUseCase: ({ sudoPassword, startTimeoutMs }) => ({
      execute: () => Promise.reject(new Error('not used by the API')),
      executeWithConfig: async (config: CreateServerConfig) => {
        creates.push({ config, sudoPassword, startTimeoutMs });
        return { name: { value: config.name } } as never;
      },
    }),
    deleteServerUseCase: ({ sudoPassword }) => ({
      deprovision: async (name: string, options: { deleteWorld?: boolean } = {}) => {
        deletes.push({ name, deleteWorld: options.deleteWorld, sudoPassword });
        return { movedWorlds: [], deletedWorlds: [] };
      },
    }),
    worldAssignmentPort: () => ({ snapshot: async () => snapshot }) as never,
  };

  beforeAll(async () => {
    const docker = join(BIN, 'docker');
    writeFileSync(docker, '#!/bin/sh\n[ "$1" = ps ] && exit 0\nexit 1\n');
    chmodSync(docker, 0o755);
    process.env.PATH = `${BIN}${delimiter}${savedPath}`;
    app = await buildApp({ logger: false, container });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    process.env.PATH = savedPath;
    rmSync(BIN, { recursive: true, force: true });
  });

  beforeEach(() => {
    creates.length = 0;
    deletes.length = 0;
    snapshot = { assignments: [], undetermined: [] };
    rmSync(join(ROOT, 'servers'), { recursive: true, force: true });
    mkdirSync(join(ROOT, 'servers'), { recursive: true });
  });

  it('POST /api/servers runs the container create use case with the request sudo password', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/servers',
      payload: { name: 'fresh', autoStart: false, sudoPassword: 'pw' },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json().server).toMatchObject({ name: 'fresh', status: 'created' });
    expect(creates).toHaveLength(1);
    expect(creates[0]).toMatchObject({ config: { name: 'fresh' }, sudoPassword: 'pw' });
    expect(creates[0]!.startTimeoutMs).toBeGreaterThan(0);
  });

  it('POST /api/servers is 409 when the fake assignment port says another server holds the world', async () => {
    snapshot = { assignments: [{ world: 'fresh', server: 'other' }], undetermined: [] };

    const response = await app.inject({ method: 'POST', url: '/api/servers', payload: { name: 'fresh' } });

    expect(response.statusCode).toBe(409);
    expect(creates).toEqual([]);
  });

  it('DELETE /api/servers/:name runs the container delete use case', async () => {
    mkdirSync(join(ROOT, 'servers', 'alpha'));
    writeFileSync(join(ROOT, 'servers', 'alpha', 'config.env'), 'LEVEL=alpha\n');

    const response = await app.inject({
      method: 'DELETE',
      url: '/api/servers/alpha?deleteWorld=true',
      payload: { sudoPassword: 'pw' },
    });

    expect(response.statusCode).toBe(200);
    expect(deletes).toEqual([{ name: 'alpha', deleteWorld: true, sudoPassword: 'pw' }]);
  });

  it('DELETE /api/servers/:name is 404 for a server that does not exist, without the use case', async () => {
    const response = await app.inject({ method: 'DELETE', url: '/api/servers/ghost' });

    expect(response.statusCode).toBe(404);
    expect(deletes).toEqual([]);
  });
});
