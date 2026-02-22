/**
 * Config Snapshot API Route Tests
 * Tests CRUD operations for /api/servers/:name/config-snapshots endpoints
 * and /api/config-snapshots/:id1/diff/:id2 endpoint
 *
 * Uses mock services to avoid native module and filesystem dependencies
 */
import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { mkdirSync, rmSync } from 'fs';
import { join } from 'path';

const TEST_PLATFORM_PATH = join(import.meta.dirname, '.tmp-config-snapshot-test');
const TEST_DATA_DIR = join(TEST_PLATFORM_PATH, 'data');
const TEST_SERVERS_DIR = join(TEST_PLATFORM_PATH, 'servers');

// Set env vars BEFORE any imports
process.env.PLATFORM_PATH = TEST_PLATFORM_PATH;
process.env.MCCTL_ROOT = TEST_PLATFORM_PATH;
process.env.AUTH_MODE = 'disabled';
process.env.NODE_ENV = 'test';

// Mock audit-log-service
vi.mock('../src/services/audit-log-service.js', () => ({
  writeAuditLog: vi.fn().mockResolvedValue(undefined),
  getAuditLogRepository: vi.fn(),
}));

// Mock child_process
vi.mock('child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('child_process')>();
  return {
    ...actual,
    exec: vi.fn(),
    execFile: vi.fn(),
  };
});

// In-memory config snapshot state
const snapshotStore = new Map<string, {
  id: string;
  serverName: string;
  createdAt: string;
  description: string;
  files: Array<{ path: string; hash: string; size: number }>;
  scheduleId?: string;
}>();

let snapshotIdCounter = 0;

function createMockSnapshot(serverName: string, description?: string) {
  snapshotIdCounter++;
  const id = `snapshot-${snapshotIdCounter}`;
  const snapshot = {
    id,
    serverName,
    createdAt: new Date().toISOString(),
    description: description ?? '',
    files: [
      { path: 'server.properties', hash: `hash-${snapshotIdCounter}-a`, size: 1024 },
      { path: 'config.env', hash: `hash-${snapshotIdCounter}-b`, size: 512 },
    ],
  };
  snapshotStore.set(id, snapshot);
  return snapshot;
}

// Mock config-snapshot-service
vi.mock('../src/services/config-snapshot-service.js', () => ({
  createSnapshot: vi.fn().mockImplementation(async (serverName: string, description?: string) => {
    const s = createMockSnapshot(serverName, description);
    return {
      toJSON: () => s,
      id: s.id,
      serverName: { value: s.serverName },
      files: s.files.map((f: { path: string; hash: string; size: number }) => ({
        path: f.path,
        hash: f.hash,
        size: f.size,
        toJSON: () => f,
      })),
    };
  }),

  listSnapshots: vi.fn().mockImplementation(async (serverName: string, _limit?: number, _offset?: number) => {
    const snapshots = Array.from(snapshotStore.values())
      .filter((s) => s.serverName === serverName);
    return {
      snapshots: snapshots.map((s) => ({
        toJSON: () => s,
        id: s.id,
        serverName: { value: s.serverName },
      })),
      total: snapshots.length,
    };
  }),

  getSnapshotById: vi.fn().mockImplementation(async (id: string) => {
    const s = snapshotStore.get(id);
    if (!s) return null;
    return {
      toJSON: () => s,
      id: s.id,
      serverName: { value: s.serverName },
      files: s.files.map((f: { path: string; hash: string; size: number }) => ({
        path: f.path,
        hash: f.hash,
        size: f.size,
        toJSON: () => f,
      })),
    };
  }),

  deleteSnapshot: vi.fn().mockImplementation(async (id: string) => {
    snapshotStore.delete(id);
  }),

  diffSnapshots: vi.fn().mockImplementation(async (id1: string, id2: string) => {
    return {
      toJSON: () => ({
        baseSnapshotId: id1,
        compareSnapshotId: id2,
        changes: [
          {
            path: 'server.properties',
            status: 'modified',
            oldContent: 'old-content',
            newContent: 'new-content',
            oldHash: 'old-hash',
            newHash: 'new-hash',
          },
        ],
        summary: { added: 0, modified: 1, deleted: 0 },
        hasChanges: true,
      }),
    };
  }),

  restoreSnapshot: vi.fn().mockResolvedValue(undefined),

  checkServerExists: vi.fn().mockImplementation(async (serverName: string) => {
    return serverName === 'testserver' || serverName === 'myserver';
  }),

  isServerRunning: vi.fn().mockImplementation(async (serverName: string) => {
    return serverName === 'running-server';
  }),
}));

import { buildApp } from '../src/app.js';

describe('Config Snapshot Routes', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    mkdirSync(TEST_DATA_DIR, { recursive: true });
    mkdirSync(TEST_SERVERS_DIR, { recursive: true });
    app = await buildApp({ logger: false });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    try {
      rmSync(TEST_PLATFORM_PATH, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  beforeEach(() => {
    snapshotStore.clear();
    snapshotIdCounter = 0;
    vi.clearAllMocks();
  });

  // ==========================================================
  // POST /api/servers/:name/config-snapshots
  // ==========================================================
  describe('POST /api/servers/:name/config-snapshots', () => {
    it('should create a snapshot and return 201', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/servers/testserver/config-snapshots',
        payload: { description: 'Test snapshot' },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('id');
      expect(body.serverName).toBe('testserver');
      expect(body.description).toBe('Test snapshot');
      expect(body.files).toHaveLength(2);
    });

    it('should create a snapshot without description', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/servers/testserver/config-snapshots',
        payload: {},
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.description).toBe('');
    });

    it('should return 404 for non-existent server', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/servers/nonexistent/config-snapshots',
        payload: {},
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('NotFound');
    });
  });

  // ==========================================================
  // GET /api/servers/:name/config-snapshots
  // ==========================================================
  describe('GET /api/servers/:name/config-snapshots', () => {
    it('should list snapshots for a server', async () => {
      // Create some snapshots first
      createMockSnapshot('testserver', 'Snapshot 1');
      createMockSnapshot('testserver', 'Snapshot 2');
      createMockSnapshot('otherserver', 'Other');

      const response = await app.inject({
        method: 'GET',
        url: '/api/servers/testserver/config-snapshots',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('snapshots');
      expect(body).toHaveProperty('total');
      expect(body.total).toBe(2);
    });

    it('should return empty list for server with no snapshots', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/servers/testserver/config-snapshots',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.snapshots).toHaveLength(0);
      expect(body.total).toBe(0);
    });

    it('should return 404 for non-existent server', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/servers/nonexistent/config-snapshots',
      });

      expect(response.statusCode).toBe(404);
    });

    it('should support limit and offset query params', async () => {
      createMockSnapshot('testserver', 'Snapshot 1');
      createMockSnapshot('testserver', 'Snapshot 2');

      const response = await app.inject({
        method: 'GET',
        url: '/api/servers/testserver/config-snapshots?limit=1&offset=0',
      });

      expect(response.statusCode).toBe(200);
    });
  });

  // ==========================================================
  // GET /api/servers/:name/config-snapshots/:id
  // ==========================================================
  describe('GET /api/servers/:name/config-snapshots/:id', () => {
    it('should get snapshot details', async () => {
      const snapshot = createMockSnapshot('testserver', 'My snapshot');

      const response = await app.inject({
        method: 'GET',
        url: `/api/servers/testserver/config-snapshots/${snapshot.id}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.id).toBe(snapshot.id);
      expect(body.description).toBe('My snapshot');
      expect(body.files).toHaveLength(2);
    });

    it('should return 404 for non-existent snapshot', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/servers/testserver/config-snapshots/nonexistent-id',
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('NotFound');
    });

    it('should return 404 if snapshot belongs to different server', async () => {
      const snapshot = createMockSnapshot('myserver', 'Other server snapshot');

      const response = await app.inject({
        method: 'GET',
        url: `/api/servers/testserver/config-snapshots/${snapshot.id}`,
      });

      expect(response.statusCode).toBe(404);
    });
  });

  // ==========================================================
  // DELETE /api/servers/:name/config-snapshots/:id
  // ==========================================================
  describe('DELETE /api/servers/:name/config-snapshots/:id', () => {
    it('should delete a snapshot and return 204', async () => {
      const snapshot = createMockSnapshot('testserver', 'To be deleted');

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/servers/testserver/config-snapshots/${snapshot.id}`,
      });

      expect(response.statusCode).toBe(204);
    });

    it('should return 404 for non-existent snapshot', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: '/api/servers/testserver/config-snapshots/nonexistent-id',
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 404 if snapshot belongs to different server', async () => {
      const snapshot = createMockSnapshot('myserver', 'Other server');

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/servers/testserver/config-snapshots/${snapshot.id}`,
      });

      expect(response.statusCode).toBe(404);
    });
  });

  // ==========================================================
  // POST /api/servers/:name/config-snapshots/:id/restore
  // ==========================================================
  describe('POST /api/servers/:name/config-snapshots/:id/restore', () => {
    it('should restore a snapshot', async () => {
      const snapshot = createMockSnapshot('testserver', 'To restore');

      const response = await app.inject({
        method: 'POST',
        url: `/api/servers/testserver/config-snapshots/${snapshot.id}/restore`,
        payload: { createSnapshotBeforeRestore: false, force: false },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.restored).toBeDefined();
      expect(body.restored.id).toBe(snapshot.id);
    });

    it('should create safety snapshot before restore by default', async () => {
      const snapshot = createMockSnapshot('testserver', 'Original');

      const response = await app.inject({
        method: 'POST',
        url: `/api/servers/testserver/config-snapshots/${snapshot.id}/restore`,
        payload: { createSnapshotBeforeRestore: true },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.restored).toBeDefined();
      expect(body.safetySnapshot).toBeDefined();
    });

    it('should return 404 for non-existent snapshot', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/servers/testserver/config-snapshots/nonexistent/restore',
        payload: {},
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 404 if snapshot belongs to different server', async () => {
      const snapshot = createMockSnapshot('myserver', 'Other');

      const response = await app.inject({
        method: 'POST',
        url: `/api/servers/testserver/config-snapshots/${snapshot.id}/restore`,
        payload: {},
      });

      expect(response.statusCode).toBe(404);
    });
  });

  // ==========================================================
  // GET /api/config-snapshots/:id1/diff/:id2
  // ==========================================================
  describe('GET /api/config-snapshots/:id1/diff/:id2', () => {
    it('should compare two snapshots', async () => {
      const snap1 = createMockSnapshot('testserver', 'First');
      const snap2 = createMockSnapshot('testserver', 'Second');

      const response = await app.inject({
        method: 'GET',
        url: `/api/config-snapshots/${snap1.id}/diff/${snap2.id}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.baseSnapshotId).toBe(snap1.id);
      expect(body.compareSnapshotId).toBe(snap2.id);
      expect(body.changes).toBeDefined();
      expect(body.summary).toBeDefined();
      expect(body.hasChanges).toBe(true);
    });

    it('should return 404 if first snapshot not found', async () => {
      const snap2 = createMockSnapshot('testserver', 'Second');

      const response = await app.inject({
        method: 'GET',
        url: `/api/config-snapshots/nonexistent/diff/${snap2.id}`,
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 404 if second snapshot not found', async () => {
      const snap1 = createMockSnapshot('testserver', 'First');

      const response = await app.inject({
        method: 'GET',
        url: `/api/config-snapshots/${snap1.id}/diff/nonexistent`,
      });

      expect(response.statusCode).toBe(404);
    });
  });
});
