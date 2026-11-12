/**
 * World routes on a fake container (#667): the use cases come from
 * buildApp({ container }), so the tests need no worlds on disk, no
 * child_process mock and no module mocks.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import type { ApiContainer, WorldUseCaseOptions } from '../src/plugins/container.js';

describe('world routes with a fake container (#667)', () => {
  let app: FastifyInstance;
  const useCaseOptions: Array<WorldUseCaseOptions | undefined> = [];
  const deleted: Array<{ name: string; force?: boolean }> = [];

  const worldUseCase = {
    listWorlds: async () => [
      { name: 'alpha', path: '/fake/worlds/alpha', isLocked: true, lockedBy: 'survival', size: '1 MB', servers: ['survival'] },
    ],
    getAssignmentReport: async () => ({ duplicates: [{ world: 'alpha', servers: ['a', 'b'] }], undetermined: [] }),
    deleteWorldByName: async (name: string, force?: boolean) => {
      deleted.push({ name, force });
      return { success: true, worldName: name, size: '1 MB' };
    },
  };

  const container: Partial<ApiContainer> = {
    worldManagementUseCase: (options) => {
      useCaseOptions.push(options);
      return worldUseCase as never;
    },
    worldInfoUseCase: () =>
      ({
        getWorldInfo: async (name: string) => {
          throw new Error(`World '${name}' not found`);
        },
      }) as never,
  };

  beforeAll(async () => {
    app = await buildApp({ logger: false, container });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    useCaseOptions.length = 0;
    deleted.length = 0;
  });

  it('GET /api/worlds lists the fake use case worlds and its assignment warnings', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/worlds' });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.total).toBe(1);
    expect(body.worlds[0]).toMatchObject({ name: 'alpha', isLocked: true, lockedBy: 'survival', servers: ['survival'] });
    expect(body.assignmentWarnings).toHaveLength(1);
    expect(body.assignmentWarnings[0]).toContain("World 'alpha'");
  });

  it('GET /api/worlds/:name is 404 for a world the fake use case does not list', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/worlds/missing' });

    expect(response.statusCode).toBe(404);
  });

  it('GET /api/worlds/:name/info maps the info use case "not found" to 404', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/worlds/missing/info' });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ error: 'NotFound', message: "World 'missing' not found" });
  });

  it('DELETE /api/worlds/:name builds the use case with the world name and auto-confirm', async () => {
    const response = await app.inject({ method: 'DELETE', url: '/api/worlds/alpha?force=true' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ success: true, worldName: 'alpha', size: '1 MB' });
    expect(useCaseOptions).toEqual([{ worldName: 'alpha', confirmValue: true }]);
    expect(deleted).toEqual([{ name: 'alpha', force: true }]);
  });
});
