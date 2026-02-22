/**
 * Backup Schedule API Route Tests
 * Tests CRUD operations for /api/backup/schedules endpoints
 * Uses mock repository to avoid better-sqlite3 native module issues
 */
import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { mkdirSync, rmSync } from 'fs';
import { join } from 'path';

const TEST_PLATFORM_PATH = join(import.meta.dirname, '.tmp-backup-schedule-test');
const TEST_DATA_DIR = join(TEST_PLATFORM_PATH, 'data');

// Set env vars BEFORE any imports
process.env.PLATFORM_PATH = TEST_PLATFORM_PATH;
process.env.MCCTL_ROOT = TEST_PLATFORM_PATH;
process.env.AUTH_MODE = 'disabled';
process.env.NODE_ENV = 'test';

// Mock audit-log-service
vi.mock('../src/services/audit-log-service.js', () => ({
  writeAuditLog: vi.fn().mockResolvedValue(undefined),
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

// Mock SqliteBackupScheduleRepository to avoid better-sqlite3 native module issues
// We use an in-memory store to simulate DB behavior
import { BackupSchedule, type IBackupScheduleRepository } from '@minecraft-docker/shared';

class InMemoryBackupScheduleRepository implements IBackupScheduleRepository {
  private store: Map<string, BackupSchedule> = new Map();

  async save(schedule: BackupSchedule): Promise<void> {
    this.store.set(schedule.id, schedule);
  }

  async findAll(): Promise<BackupSchedule[]> {
    return Array.from(this.store.values());
  }

  async findById(id: string): Promise<BackupSchedule | null> {
    return this.store.get(id) ?? null;
  }

  async findEnabled(): Promise<BackupSchedule[]> {
    return Array.from(this.store.values()).filter((s) => s.enabled);
  }

  async delete(id: string): Promise<void> {
    this.store.delete(id);
  }

  close(): void {
    this.store.clear();
  }
}

vi.mock('@minecraft-docker/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@minecraft-docker/shared')>();
  return {
    ...actual,
    SqliteBackupScheduleRepository: vi.fn().mockImplementation(() => {
      return new InMemoryBackupScheduleRepository();
    }),
  };
});

import { buildApp } from '../src/app.js';

describe('Backup Schedule Routes', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    // Create required directories
    mkdirSync(TEST_DATA_DIR, { recursive: true });
    mkdirSync(join(TEST_PLATFORM_PATH, 'servers'), { recursive: true });
    mkdirSync(join(TEST_PLATFORM_PATH, 'worlds'), { recursive: true });

    app = await buildApp({ logger: false });
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
    rmSync(TEST_PLATFORM_PATH, { recursive: true, force: true });
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/backup/schedules', () => {
    it('should return list with total count', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/backup/schedules',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.schedules).toBeDefined();
      expect(Array.isArray(body.schedules)).toBe(true);
      expect(body.total).toBeDefined();
      expect(typeof body.total).toBe('number');
    });
  });

  describe('POST /api/backup/schedules', () => {
    it('should create a backup schedule', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/backup/schedules',
        payload: {
          name: 'Daily Test Backup',
          cron: '0 3 * * *',
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.id).toBeDefined();
      expect(body.name).toBe('Daily Test Backup');
      expect(body.cronExpression).toBe('0 3 * * *');
      expect(body.enabled).toBe(true);
    });

    it('should create a schedule with retention policy', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/backup/schedules',
        payload: {
          name: 'Retention Schedule',
          cron: '0 6 * * *',
          maxCount: 5,
          maxAgeDays: 14,
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.retentionPolicy.maxCount).toBe(5);
      expect(body.retentionPolicy.maxAgeDays).toBe(14);
    });

    it('should return 400 for invalid cron expression', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/backup/schedules',
        payload: {
          name: 'Invalid Cron',
          cron: 'not-a-cron',
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBeDefined();
    });

    it('should return 400 for empty name', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/backup/schedules',
        payload: {
          name: '',
          cron: '0 3 * * *',
        },
      });

      // Fastify schema validation should reject empty name (minLength: 1)
      expect(response.statusCode).toBe(400);
    });
  });

  describe('GET /api/backup/schedules/:id', () => {
    it('should get a schedule by ID', async () => {
      // First, create a schedule
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/backup/schedules',
        payload: {
          name: 'Get Test',
          cron: '0 12 * * *',
        },
      });
      const created = JSON.parse(createResponse.body);

      // Get by ID
      const response = await app.inject({
        method: 'GET',
        url: `/api/backup/schedules/${created.id}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.id).toBe(created.id);
      expect(body.name).toBe('Get Test');
    });

    it('should return 404 for non-existent schedule', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/backup/schedules/non-existent-id',
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('NotFound');
    });
  });

  describe('PUT /api/backup/schedules/:id', () => {
    it('should update a schedule', async () => {
      // Create
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/backup/schedules',
        payload: {
          name: 'Update Test',
          cron: '0 0 * * *',
        },
      });
      const created = JSON.parse(createResponse.body);

      // Update
      const response = await app.inject({
        method: 'PUT',
        url: `/api/backup/schedules/${created.id}`,
        payload: {
          name: 'Updated Name',
          cron: '0 6 * * *',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.name).toBe('Updated Name');
      expect(body.cronExpression).toBe('0 6 * * *');
    });

    it('should return 404 when updating non-existent schedule', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: '/api/backup/schedules/non-existent-id',
        payload: {
          name: 'Does Not Exist',
        },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('PATCH /api/backup/schedules/:id/toggle', () => {
    it('should disable a schedule', async () => {
      // Create an enabled schedule
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/backup/schedules',
        payload: {
          name: 'Toggle Test',
          cron: '0 0 * * *',
        },
      });
      const created = JSON.parse(createResponse.body);
      expect(created.enabled).toBe(true);

      // Disable
      const response = await app.inject({
        method: 'PATCH',
        url: `/api/backup/schedules/${created.id}/toggle`,
        payload: {
          enabled: false,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.enabled).toBe(false);
    });

    it('should enable a disabled schedule', async () => {
      // Create and disable
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/backup/schedules',
        payload: {
          name: 'Enable Test',
          cron: '0 0 * * *',
        },
      });
      const created = JSON.parse(createResponse.body);

      await app.inject({
        method: 'PATCH',
        url: `/api/backup/schedules/${created.id}/toggle`,
        payload: { enabled: false },
      });

      // Re-enable
      const response = await app.inject({
        method: 'PATCH',
        url: `/api/backup/schedules/${created.id}/toggle`,
        payload: { enabled: true },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.enabled).toBe(true);
    });

    it('should return 404 for non-existent schedule', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: '/api/backup/schedules/non-existent-id/toggle',
        payload: { enabled: true },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('DELETE /api/backup/schedules/:id', () => {
    it('should delete a schedule', async () => {
      // Create
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/backup/schedules',
        payload: {
          name: 'Delete Test',
          cron: '0 0 * * *',
        },
      });
      const created = JSON.parse(createResponse.body);

      // Delete
      const response = await app.inject({
        method: 'DELETE',
        url: `/api/backup/schedules/${created.id}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);

      // Verify deleted
      const getResponse = await app.inject({
        method: 'GET',
        url: `/api/backup/schedules/${created.id}`,
      });
      expect(getResponse.statusCode).toBe(404);
    });

    it('should return 404 for non-existent schedule', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: '/api/backup/schedules/non-existent-id',
      });

      expect(response.statusCode).toBe(404);
    });
  });
});
