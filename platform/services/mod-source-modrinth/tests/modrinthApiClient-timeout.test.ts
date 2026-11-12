/**
 * Every Modrinth request ends at a timeout instead of holding the API
 * request open while the remote stalls (#672).
 */
import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { ModrinthApiClient } from '../src/infrastructure/api/ModrinthApiClient.js';

let server: Server;
let base: string;

beforeAll(async () => {
  // Accepts every request and never answers
  server = createServer(() => {});
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
});

describe('ModrinthApiClient timeouts (#672)', () => {
  const client = () => new ModrinthApiClient(base, 50);

  test.each([
    ['search', (c: ModrinthApiClient) => c.search({ query: 'x' })],
    ['getProject', (c: ModrinthApiClient) => c.getProject('x')],
    ['getVersions', (c: ModrinthApiClient) => c.getVersions('x')],
    ['getProjects', (c: ModrinthApiClient) => c.getProjects(['x'])],
    ['getTeamMembers', (c: ModrinthApiClient) => c.getTeamMembers('x')],
    ['getModpackIndexFiles', (c: ModrinthApiClient) => c.getModpackIndexFiles(`${base}/pack.mrpack`)],
  ])('%s rejects when the server does not answer', async (_name, call) => {
    await expect(call(client())).rejects.toMatchObject({ name: 'TimeoutError' });
  });

  test('isAvailable answers false', async () => {
    expect(await client().isAvailable()).toBe(false);
  });
});
