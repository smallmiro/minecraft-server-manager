/**
 * Config Snapshot Schedule API Route Tests
 * Tests CRUD operations for /api/config-snapshot-schedules endpoints
 * Uses in-memory mock repository to avoid better-sqlite3 native module issues
 *
 * TDD Red phase: write tests first, then implement
 */
import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { mkdirSync, rmSync } from 'fs';
import { join } from 'path';

const TEST_PLATFORM_PATH = join(import.meta.dirname, '.tmp-config-snapshot-schedule-test');
const TEST_DATA_DIR = join(TEST_PLATFORM_PATH, 'data');

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

// Mock child_process to avoid actual shell execution
vi.mock('child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('child_process')>();
  return {
    ...actual,
    exec: vi.fn(),
    execFile: vi.fn(),
  };
});

// Mock config-snapshot-service to avoid filesystem deps
vi.mock('../src/services/config-snapshot-service.js', () => ({
  createSnapshot: vi.fn(),
  listSnapshots: vi.fn(),
  getSnapshotById: vi.fn(),
  deleteSnapshot: vi.fn(),
  diffSnapshots: vi.fn(),
  restoreSnapshot: vi.fn(),
  checkServerExists: vi.fn().mockResolvedValue(true),
  isServerRunning: vi.fn().mockResolvedValue(false),
  closeConfigSnapshotDatabase: vi.fn(),
}));

// In-memory store for ConfigSnapshotSchedule
import {
  ConfigSnapshotSchedule,
  type IConfigSnapshotScheduleRepository,
} from '@minecraft-docker/shared';

class InMemoryConfigSnapshotScheduleRepository
  implements IConfigSnapshotScheduleRepository
{
  private store: Map<string, ConfigSnapshotSchedule> = new Map();

  async save(schedule: ConfigSnapshotSchedule): Promise<void> {
    this.store.set(schedule.id, schedule);
  }

  async findAll(): Promise<ConfigSnapshotSchedule[]> {
    return Array.from(this.store.values());
  }

  async findById(id: string): Promise<ConfigSnapshotSchedule | null> {
    return this.store.get(id) ?? null;
  }

  async findByServer(serverName: string): Promise<ConfigSnapshotSchedule[]> {
    return Array.from(this.store.values()).filter(
      (s) => s.serverName.value === serverName
    );
  }

  async findAllEnabled(): Promise<ConfigSnapshotSchedule[]> {
    return Array.from(this.store.values()).filter((s) => s.enabled);
  }

  async update(schedule: ConfigSnapshotSchedule): Promise<void> {
    if (!this.store.has(schedule.id)) {
      throw new Error(`Schedule not found: ${schedule.id}`);
    }
    this.store.set(schedule.id, schedule);
  }

  async delete(id: string): Promise<void> {
    this.store.delete(id);
  }

  clear(): void {
    this.store.clear();
  }
}

const inMemoryRepository = new InMemoryConfigSnapshotScheduleRepository();

vi.mock('@minecraft-docker/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@minecraft-docker/shared')>();
  return {
    ...actual,
    SqliteConfigSnapshotScheduleRepository: vi.fn().mockImplementation(() => inMemoryRepository),
    // ConfigSnapshotDatabase mock to avoid SQLite native module
    ConfigSnapshotDatabase: vi.fn().mockImplementation(() => ({
      getDatabase: vi.fn(),
      close: vi.fn(),
    })),
    // SqliteConfigSnapshotRepository mock
    SqliteConfigSnapshotRepository: vi.fn().mockImplementation(() => ({
      save: vi.fn(),
      findById: vi.fn().mockResolvedValue(null),
      findByServer: vi.fn().mockResolvedValue([]),
      findAll: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
      delete: vi.fn(),
    })),
    // FileSystemConfigSnapshotStorage mock
    FileSystemConfigSnapshotStorage: vi.fn().mockImplementation(() => ({
      save: vi.fn(),
      load: vi.fn(),
      delete: vi.fn(),
    })),
    // FileSystemConfigFileCollector mock
    FileSystemConfigFileCollector: vi.fn().mockImplementation(() => ({
      collect: vi.fn().mockResolvedValue([]),
    })),
    // SqliteBackupScheduleRepository mock
    SqliteBackupScheduleRepository: vi.fn().mockImplementation(() => ({
      save: vi.fn(),
      findAll: vi.fn().mockResolvedValue([]),
      findById: vi.fn().mockResolvedValue(null),
      findEnabled: vi.fn().mockResolvedValue([]),
      delete: vi.fn(),
      close: vi.fn(),
    })),
  };
});

import { buildApp } from '../src/app.js';

describe('Config Snapshot Schedule Routes', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    mkdirSync(TEST_DATA_DIR, { recursive: true });
    mkdirSync(join(TEST_PLATFORM_PATH, 'servers'), { recursive: true });
    mkdirSync(join(TEST_PLATFORM_PATH, 'worlds'), { recursive: true });

    app = await buildApp({ logger: false });
    await app.ready();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
    rmSync(TEST_PLATFORM_PATH, { recursive: true, force: true });
  });

  beforeEach(() => {
    inMemoryRepository.clear();
    vi.clearAllMocks();
  });

  // ==========================================================
  // GET /api/config-snapshot-schedules
  // ==========================================================
  describe('GET /api/config-snapshot-schedules', () => {
    it('should return empty list when no schedules exist', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/config-snapshot-schedules',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.schedules).toBeDefined();
      expect(Array.isArray(body.schedules)).toBe(true);
      expect(body.schedules).toHaveLength(0);
    });

    it('should return list of schedules', async () => {
      // Create schedules via POST first
      await app.inject({
        method: 'POST',
        url: '/api/config-snapshot-schedules',
        payload: {
          serverName: 'testserver',
          name: 'Daily Snapshot',
          cronExpression: '0 3 * * *',
        },
      });

      await app.inject({
        method: 'POST',
        url: '/api/config-snapshot-schedules',
        payload: {
          serverName: 'anotherserver',
          name: 'Hourly Snapshot',
          cronExpression: '0 * * * *',
        },
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/config-snapshot-schedules',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.schedules).toHaveLength(2);
    });

    it('should filter by serverName query param', async () => {
      // Create schedules for different servers
      await app.inject({
        method: 'POST',
        url: '/api/config-snapshot-schedules',
        payload: {
          serverName: 'server-a',
          name: 'Schedule A',
          cronExpression: '0 3 * * *',
        },
      });

      await app.inject({
        method: 'POST',
        url: '/api/config-snapshot-schedules',
        payload: {
          serverName: 'server-b',
          name: 'Schedule B',
          cronExpression: '0 4 * * *',
        },
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/config-snapshot-schedules?serverName=server-a',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.schedules).toHaveLength(1);
      expect(body.schedules[0].serverName).toBe('server-a');
    });
  });

  // ==========================================================
  // POST /api/config-snapshot-schedules
  // ==========================================================
  describe('POST /api/config-snapshot-schedules', () => {
    it('should create a schedule with required fields', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/config-snapshot-schedules',
        payload: {
          serverName: 'testserver',
          name: 'Daily Snapshot',
          cronExpression: '0 3 * * *',
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.id).toBeDefined();
      expect(body.serverName).toBe('testserver');
      expect(body.name).toBe('Daily Snapshot');
      expect(body.cronExpression).toBe('0 3 * * *');
      expect(body.enabled).toBe(true);
      expect(body.retentionCount).toBe(10); // default
    });

    it('should create a schedule with all optional fields', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/config-snapshot-schedules',
        payload: {
          serverName: 'testserver',
          name: 'Custom Schedule',
          cronExpression: '0 */6 * * *',
          retentionCount: 5,
          enabled: false,
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.retentionCount).toBe(5);
      expect(body.enabled).toBe(false);
    });

    it('should return 400 for invalid cron expression', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/config-snapshot-schedules',
        payload: {
          serverName: 'testserver',
          name: 'Invalid Cron',
          cronExpression: 'not-a-cron',
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBeDefined();
    });

    it('should return 400 for missing required fields', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/config-snapshot-schedules',
        payload: {
          name: 'Missing serverName',
          cronExpression: '0 3 * * *',
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 for empty name', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/config-snapshot-schedules',
        payload: {
          serverName: 'testserver',
          name: '',
          cronExpression: '0 3 * * *',
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 for retentionCount below minimum', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/config-snapshot-schedules',
        payload: {
          serverName: 'testserver',
          name: 'Invalid Retention',
          cronExpression: '0 3 * * *',
          retentionCount: 0,
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 for retentionCount above maximum', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/config-snapshot-schedules',
        payload: {
          serverName: 'testserver',
          name: 'Invalid Retention',
          cronExpression: '0 3 * * *',
          retentionCount: 101,
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  // ==========================================================
  // GET /api/config-snapshot-schedules/:id
  // ==========================================================
  describe('GET /api/config-snapshot-schedules/:id', () => {
    it('should get a schedule by ID', async () => {
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/config-snapshot-schedules',
        payload: {
          serverName: 'testserver',
          name: 'Get Test',
          cronExpression: '0 12 * * *',
        },
      });
      const created = JSON.parse(createResponse.body);

      const response = await app.inject({
        method: 'GET',
        url: `/api/config-snapshot-schedules/${created.id}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.id).toBe(created.id);
      expect(body.name).toBe('Get Test');
      expect(body.serverName).toBe('testserver');
    });

    it('should return 404 for non-existent schedule', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/config-snapshot-schedules/non-existent-id',
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('NotFound');
    });
  });

  // ==========================================================
  // PUT /api/config-snapshot-schedules/:id
  // ==========================================================
  describe('PUT /api/config-snapshot-schedules/:id', () => {
    it('should update schedule name', async () => {
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/config-snapshot-schedules',
        payload: {
          serverName: 'testserver',
          name: 'Original Name',
          cronExpression: '0 0 * * *',
        },
      });
      const created = JSON.parse(createResponse.body);

      const response = await app.inject({
        method: 'PUT',
        url: `/api/config-snapshot-schedules/${created.id}`,
        payload: {
          name: 'Updated Name',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.name).toBe('Updated Name');
      expect(body.cronExpression).toBe('0 0 * * *'); // unchanged
    });

    it('should update cron expression', async () => {
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/config-snapshot-schedules',
        payload: {
          serverName: 'testserver',
          name: 'Cron Update Test',
          cronExpression: '0 0 * * *',
        },
      });
      const created = JSON.parse(createResponse.body);

      const response = await app.inject({
        method: 'PUT',
        url: `/api/config-snapshot-schedules/${created.id}`,
        payload: {
          cronExpression: '0 6 * * *',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.cronExpression).toBe('0 6 * * *');
    });

    it('should update retentionCount', async () => {
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/config-snapshot-schedules',
        payload: {
          serverName: 'testserver',
          name: 'Retention Update Test',
          cronExpression: '0 0 * * *',
        },
      });
      const created = JSON.parse(createResponse.body);

      const response = await app.inject({
        method: 'PUT',
        url: `/api/config-snapshot-schedules/${created.id}`,
        payload: {
          retentionCount: 20,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.retentionCount).toBe(20);
    });

    it('should return 400 for invalid cron expression', async () => {
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/config-snapshot-schedules',
        payload: {
          serverName: 'testserver',
          name: 'Invalid Cron Test',
          cronExpression: '0 0 * * *',
        },
      });
      const created = JSON.parse(createResponse.body);

      const response = await app.inject({
        method: 'PUT',
        url: `/api/config-snapshot-schedules/${created.id}`,
        payload: {
          cronExpression: 'invalid-cron',
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 404 when updating non-existent schedule', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: '/api/config-snapshot-schedules/non-existent-id',
        payload: {
          name: 'Does Not Exist',
        },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  // ==========================================================
  // PATCH /api/config-snapshot-schedules/:id/toggle
  // ==========================================================
  describe('PATCH /api/config-snapshot-schedules/:id/toggle', () => {
    it('should disable an enabled schedule', async () => {
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/config-snapshot-schedules',
        payload: {
          serverName: 'testserver',
          name: 'Toggle Test',
          cronExpression: '0 0 * * *',
          enabled: true,
        },
      });
      const created = JSON.parse(createResponse.body);
      expect(created.enabled).toBe(true);

      const response = await app.inject({
        method: 'PATCH',
        url: `/api/config-snapshot-schedules/${created.id}/toggle`,
        payload: {
          enabled: false,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.enabled).toBe(false);
    });

    it('should enable a disabled schedule', async () => {
      // Create disabled
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/config-snapshot-schedules',
        payload: {
          serverName: 'testserver',
          name: 'Enable Test',
          cronExpression: '0 0 * * *',
          enabled: false,
        },
      });
      const created = JSON.parse(createResponse.body);
      expect(created.enabled).toBe(false);

      const response = await app.inject({
        method: 'PATCH',
        url: `/api/config-snapshot-schedules/${created.id}/toggle`,
        payload: {
          enabled: true,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.enabled).toBe(true);
    });

    it('should return 404 for non-existent schedule', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: '/api/config-snapshot-schedules/non-existent-id/toggle',
        payload: {
          enabled: true,
        },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 400 when enabled field is missing', async () => {
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/config-snapshot-schedules',
        payload: {
          serverName: 'testserver',
          name: 'Toggle Missing Test',
          cronExpression: '0 0 * * *',
        },
      });
      const created = JSON.parse(createResponse.body);

      const response = await app.inject({
        method: 'PATCH',
        url: `/api/config-snapshot-schedules/${created.id}/toggle`,
        payload: {},
      });

      expect(response.statusCode).toBe(400);
    });
  });

  // ==========================================================
  // DELETE /api/config-snapshot-schedules/:id
  // ==========================================================
  describe('DELETE /api/config-snapshot-schedules/:id', () => {
    it('should delete a schedule and return 204', async () => {
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/config-snapshot-schedules',
        payload: {
          serverName: 'testserver',
          name: 'Delete Test',
          cronExpression: '0 0 * * *',
        },
      });
      const created = JSON.parse(createResponse.body);

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/config-snapshot-schedules/${created.id}`,
      });

      expect(response.statusCode).toBe(204);

      // Verify it is deleted
      const getResponse = await app.inject({
        method: 'GET',
        url: `/api/config-snapshot-schedules/${created.id}`,
      });
      expect(getResponse.statusCode).toBe(404);
    });

    it('should return 404 for non-existent schedule', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: '/api/config-snapshot-schedules/non-existent-id',
      });

      expect(response.statusCode).toBe(404);
    });
  });

  // ==========================================================
  // Schedule shape validation
  // ==========================================================
  describe('Schedule response shape', () => {
    it('should include all required fields in response', async () => {
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/config-snapshot-schedules',
        payload: {
          serverName: 'testserver',
          name: 'Shape Test',
          cronExpression: '0 3 * * *',
          retentionCount: 15,
        },
      });

      expect(createResponse.statusCode).toBe(201);
      const body = JSON.parse(createResponse.body);

      expect(body).toHaveProperty('id');
      expect(body).toHaveProperty('serverName');
      expect(body).toHaveProperty('name');
      expect(body).toHaveProperty('cronExpression');
      expect(body).toHaveProperty('cronHumanReadable');
      expect(body).toHaveProperty('enabled');
      expect(body).toHaveProperty('retentionCount');
      expect(body).toHaveProperty('lastRunAt');
      expect(body).toHaveProperty('lastRunStatus');
      expect(body).toHaveProperty('createdAt');
      expect(body).toHaveProperty('updatedAt');
      expect(body.lastRunAt).toBeNull();
      expect(body.lastRunStatus).toBeNull();
    });
  });
});
