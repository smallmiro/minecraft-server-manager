import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { rm, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { CronExpression } from '../src/domain/value-objects/CronExpression.js';
import { BackupRetentionPolicy } from '../src/domain/value-objects/BackupRetentionPolicy.js';
import {
  BackupSchedule,
  type BackupScheduleData,
} from '../src/domain/entities/BackupSchedule.js';
import { BackupScheduleUseCase } from '../src/application/use-cases/BackupScheduleUseCase.js';
import type { IBackupScheduleRepository } from '../src/application/ports/outbound/IBackupScheduleRepository.js';
import { SqliteBackupScheduleRepository } from '../src/infrastructure/adapters/SqliteBackupScheduleRepository.js';

// ==========================================
// CronExpression Value Object Tests
// ==========================================
describe('CronExpression', () => {
  test('should create valid cron expression', () => {
    const cron = CronExpression.create('0 3 * * *');
    expect(cron.expression).toBe('0 3 * * *');
  });

  test('should create with complex expression', () => {
    const cron = CronExpression.create('*/15 2-4 1,15 * 1-5');
    expect(cron.expression).toBe('*/15 2-4 1,15 * 1-5');
  });

  test('should trim whitespace', () => {
    const cron = CronExpression.create('  0 3 * * *  ');
    expect(cron.expression).toBe('0 3 * * *');
  });

  test('should throw on empty expression', () => {
    expect(() => CronExpression.create('')).toThrow(/cannot be empty/);
  });

  test('should throw on wrong number of fields', () => {
    expect(() => CronExpression.create('0 3 *')).toThrow(/expected 5 fields/);
    expect(() => CronExpression.create('0 3 * * * *')).toThrow(/expected 5 fields/);
  });

  test('should throw on invalid minute value', () => {
    expect(() => CronExpression.create('60 * * * *')).toThrow(/out of range.*minute/);
  });

  test('should throw on invalid hour value', () => {
    expect(() => CronExpression.create('0 24 * * *')).toThrow(/out of range.*hour/);
  });

  test('should throw on invalid day-of-month value', () => {
    expect(() => CronExpression.create('0 0 32 * *')).toThrow(/out of range.*day of month/);
    expect(() => CronExpression.create('0 0 0 * *')).toThrow(/out of range.*day of month/);
  });

  test('should throw on invalid month value', () => {
    expect(() => CronExpression.create('0 0 1 13 *')).toThrow(/out of range.*month/);
    expect(() => CronExpression.create('0 0 1 0 *')).toThrow(/out of range.*month/);
  });

  test('should throw on invalid day-of-week value', () => {
    expect(() => CronExpression.create('0 0 * * 8')).toThrow(/out of range.*day of week/);
  });

  test('should allow day-of-week 7 (Sunday)', () => {
    const cron = CronExpression.create('0 0 * * 7');
    expect(cron.expression).toBe('0 0 * * 7');
  });

  test('should throw on non-numeric value', () => {
    expect(() => CronExpression.create('abc * * * *')).toThrow(/Invalid value/);
  });

  test('should validate step expressions', () => {
    const cron = CronExpression.create('*/5 */2 * * *');
    expect(cron.expression).toBe('*/5 */2 * * *');
  });

  test('should throw on invalid step', () => {
    expect(() => CronExpression.create('*/0 * * * *')).toThrow(/Invalid step/);
  });

  test('should validate range expressions', () => {
    const cron = CronExpression.create('0 9-17 * * *');
    expect(cron.expression).toBe('0 9-17 * * *');
  });

  test('should throw on invalid range (start > end)', () => {
    expect(() => CronExpression.create('0 17-9 * * *')).toThrow(/start.*>.*end/);
  });

  test('should validate list expressions', () => {
    const cron = CronExpression.create('0 0 1,15 * *');
    expect(cron.expression).toBe('0 0 1,15 * *');
  });

  // Presets
  test('should create from daily preset', () => {
    const cron = CronExpression.fromPreset('daily');
    expect(cron.expression).toBe('0 3 * * *');
  });

  test('should create from every-6h preset', () => {
    const cron = CronExpression.fromPreset('every-6h');
    expect(cron.expression).toBe('0 */6 * * *');
  });

  test('should create from every-12h preset', () => {
    const cron = CronExpression.fromPreset('every-12h');
    expect(cron.expression).toBe('0 */12 * * *');
  });

  test('should create from hourly preset', () => {
    const cron = CronExpression.fromPreset('hourly');
    expect(cron.expression).toBe('0 * * * *');
  });

  test('should create from weekly preset', () => {
    const cron = CronExpression.fromPreset('weekly');
    expect(cron.expression).toBe('0 3 * * 0');
  });

  test('should throw on unknown preset', () => {
    expect(() => CronExpression.fromPreset('unknown')).toThrow(/Unknown cron preset/);
  });

  test('should return available presets', () => {
    const presets = CronExpression.getPresets();
    expect(presets['daily']).toBeTruthy();
    expect(presets['hourly']).toBeTruthy();
    expect(presets['weekly']).toBeTruthy();
    expect(presets['every-6h']).toBeTruthy();
    expect(presets['every-12h']).toBeTruthy();
  });

  // Human readable
  test('should return human-readable for daily', () => {
    const cron = CronExpression.fromPreset('daily');
    expect(cron.toHumanReadable()).toBe('Daily at 3:00 AM');
  });

  test('should return human-readable for hourly', () => {
    const cron = CronExpression.fromPreset('hourly');
    expect(cron.toHumanReadable()).toBe('Every hour');
  });

  test('should return human-readable for weekly', () => {
    const cron = CronExpression.fromPreset('weekly');
    expect(cron.toHumanReadable()).toBe('Weekly on Sunday at 3:00 AM');
  });

  test('should return raw cron for custom expression', () => {
    const cron = CronExpression.create('15 4 * * 1-5');
    expect(cron.toHumanReadable()).toBe('Cron: 15 4 * * 1-5');
  });

  // Equality
  test('should be equal for same expression', () => {
    const a = CronExpression.create('0 3 * * *');
    const b = CronExpression.create('0 3 * * *');
    expect(a.equals(b)).toBeTruthy();
  });

  test('should not be equal for different expression', () => {
    const a = CronExpression.create('0 3 * * *');
    const b = CronExpression.create('0 4 * * *');
    expect(!a.equals(b)).toBeTruthy();
  });

  test('toString should return expression', () => {
    const cron = CronExpression.create('0 3 * * *');
    expect(cron.toString()).toBe('0 3 * * *');
  });
});

// ==========================================
// BackupRetentionPolicy Value Object Tests
// ==========================================
describe('BackupRetentionPolicy', () => {
  test('should create with maxCount only', () => {
    const policy = BackupRetentionPolicy.create({ maxCount: 5 });
    expect(policy.maxCount).toBe(5);
    expect(policy.maxAgeDays).toBe(undefined);
  });

  test('should create with maxAgeDays only', () => {
    const policy = BackupRetentionPolicy.create({ maxAgeDays: 14 });
    expect(policy.maxCount).toBe(undefined);
    expect(policy.maxAgeDays).toBe(14);
  });

  test('should create with both', () => {
    const policy = BackupRetentionPolicy.create({ maxCount: 10, maxAgeDays: 30 });
    expect(policy.maxCount).toBe(10);
    expect(policy.maxAgeDays).toBe(30);
  });

  test('should create with empty (no limits)', () => {
    const policy = BackupRetentionPolicy.create({});
    expect(policy.maxCount).toBe(undefined);
    expect(policy.maxAgeDays).toBe(undefined);
  });

  test('should create default policy', () => {
    const policy = BackupRetentionPolicy.default();
    expect(policy.maxCount).toBe(10);
    expect(policy.maxAgeDays).toBe(30);
  });

  test('should throw on maxCount < 1', () => {
    expect(() => BackupRetentionPolicy.create({ maxCount: 0 })).toThrow(/positive integer/);
  });

  test('should throw on negative maxCount', () => {
    expect(() => BackupRetentionPolicy.create({ maxCount: -1 })).toThrow(/positive integer/);
  });

  test('should throw on non-integer maxCount', () => {
    expect(() => BackupRetentionPolicy.create({ maxCount: 1.5 })).toThrow(/positive integer/);
  });

  test('should throw on maxAgeDays < 1', () => {
    expect(() => BackupRetentionPolicy.create({ maxAgeDays: 0 })).toThrow(/positive integer/);
  });

  // shouldPrune
  test('shouldPrune returns true when count exceeds maxCount', () => {
    const policy = BackupRetentionPolicy.create({ maxCount: 5 });
    expect(policy.shouldPrune(6, new Date())).toBeTruthy();
  });

  test('shouldPrune returns false when count is within maxCount', () => {
    const policy = BackupRetentionPolicy.create({ maxCount: 5 });
    expect(!policy.shouldPrune(5, new Date())).toBeTruthy();
  });

  test('shouldPrune returns true when oldest backup exceeds maxAgeDays', () => {
    const policy = BackupRetentionPolicy.create({ maxAgeDays: 7 });
    const oldDate = new Date();
    oldDate.setDate(oldDate.getDate() - 10);
    expect(policy.shouldPrune(1, oldDate)).toBeTruthy();
  });

  test('shouldPrune returns false when oldest backup is within maxAgeDays', () => {
    const policy = BackupRetentionPolicy.create({ maxAgeDays: 7 });
    const recentDate = new Date();
    recentDate.setDate(recentDate.getDate() - 3);
    expect(!policy.shouldPrune(1, recentDate)).toBeTruthy();
  });

  test('shouldPrune returns false with no limits', () => {
    const policy = BackupRetentionPolicy.create({});
    const oldDate = new Date('2020-01-01');
    expect(!policy.shouldPrune(1000, oldDate)).toBeTruthy();
  });

  // toJSON
  test('toJSON returns correct data', () => {
    const policy = BackupRetentionPolicy.create({ maxCount: 5, maxAgeDays: 14 });
    const json = policy.toJSON();
    expect(json).toEqual({ maxCount: 5, maxAgeDays: 14 });
  });

  // equals
  test('equals returns true for same values', () => {
    const a = BackupRetentionPolicy.create({ maxCount: 5, maxAgeDays: 14 });
    const b = BackupRetentionPolicy.create({ maxCount: 5, maxAgeDays: 14 });
    expect(a.equals(b)).toBeTruthy();
  });

  test('equals returns false for different values', () => {
    const a = BackupRetentionPolicy.create({ maxCount: 5 });
    const b = BackupRetentionPolicy.create({ maxCount: 10 });
    expect(!a.equals(b)).toBeTruthy();
  });
});

// ==========================================
// BackupSchedule Entity Tests
// ==========================================
describe('BackupSchedule', () => {
  test('should create with auto-generated id and timestamps', () => {
    const schedule = BackupSchedule.create({
      name: 'Daily Backup',
      cronExpression: '0 3 * * *',
    });

    expect(schedule.id).toBeTruthy();
    expect(schedule.name).toBe('Daily Backup');
    expect(schedule.cronExpression.expression).toBe('0 3 * * *');
    expect(schedule.enabled).toBe(true);
    expect(schedule.lastRunAt).toBe(null);
    expect(schedule.lastRunStatus).toBe(null);
    expect(schedule.lastRunMessage).toBe(null);
    expect(schedule.createdAt instanceof Date).toBeTruthy();
    expect(schedule.updatedAt instanceof Date).toBeTruthy();
    // Default retention policy
    expect(schedule.retentionPolicy.maxCount).toBe(10);
    expect(schedule.retentionPolicy.maxAgeDays).toBe(30);
  });

  test('should create with custom retention policy', () => {
    const schedule = BackupSchedule.create({
      name: 'Custom',
      cronExpression: '0 */6 * * *',
      retentionPolicy: { maxCount: 5, maxAgeDays: 7 },
    });

    expect(schedule.retentionPolicy.maxCount).toBe(5);
    expect(schedule.retentionPolicy.maxAgeDays).toBe(7);
  });

  test('should create with provided id', () => {
    const id = randomUUID();
    const schedule = BackupSchedule.create({
      id,
      name: 'Test',
      cronExpression: '0 0 * * *',
    });

    expect(schedule.id).toBe(id);
  });

  test('should create disabled', () => {
    const schedule = BackupSchedule.create({
      name: 'Disabled',
      cronExpression: '0 0 * * *',
      enabled: false,
    });

    expect(schedule.enabled).toBe(false);
  });

  test('should throw on invalid cron expression', () => {
    expect(() =>
      BackupSchedule.create({
        name: 'Bad',
        cronExpression: 'invalid',
      })).toThrow();
  });

  // fromRaw
  test('should create from database row', () => {
    const row = {
      id: 'test-id',
      name: 'DB Schedule',
      cron_expression: '0 3 * * *',
      retention_max_count: 5,
      retention_max_age_days: 14,
      enabled: 1,
      last_run_at: '2025-01-01T00:00:00.000Z',
      last_run_status: 'success',
      last_run_message: 'Backed up 3 worlds',
      created_at: '2025-01-01T00:00:00.000Z',
      updated_at: '2025-01-01T00:00:00.000Z',
    };

    const schedule = BackupSchedule.fromRaw(row);

    expect(schedule.id).toBe('test-id');
    expect(schedule.name).toBe('DB Schedule');
    expect(schedule.cronExpression.expression).toBe('0 3 * * *');
    expect(schedule.retentionPolicy.maxCount).toBe(5);
    expect(schedule.retentionPolicy.maxAgeDays).toBe(14);
    expect(schedule.enabled).toBe(true);
    expect(schedule.lastRunAt instanceof Date).toBeTruthy();
    expect(schedule.lastRunStatus).toBe('success');
    expect(schedule.lastRunMessage).toBe('Backed up 3 worlds');
  });

  test('should create from row with null optionals', () => {
    const row = {
      id: 'test-id',
      name: 'Minimal',
      cron_expression: '0 0 * * *',
      retention_max_count: null,
      retention_max_age_days: null,
      enabled: 0,
      last_run_at: null,
      last_run_status: null,
      last_run_message: null,
      created_at: '2025-01-01T00:00:00.000Z',
      updated_at: '2025-01-01T00:00:00.000Z',
    };

    const schedule = BackupSchedule.fromRaw(row);

    expect(schedule.enabled).toBe(false);
    expect(schedule.lastRunAt).toBe(null);
    expect(schedule.lastRunStatus).toBe(null);
    expect(schedule.lastRunMessage).toBe(null);
    expect(schedule.retentionPolicy.maxCount).toBe(undefined);
    expect(schedule.retentionPolicy.maxAgeDays).toBe(undefined);
  });

  // enable / disable (immutable)
  test('enable should return new instance with enabled=true', () => {
    const original = BackupSchedule.create({
      name: 'Test',
      cronExpression: '0 0 * * *',
      enabled: false,
    });

    const enabled = original.enable();

    expect(enabled.enabled).toBe(true);
    expect(original.enabled).toBe(false); // original unchanged
    expect(enabled.id).toBe(original.id);
    expect(enabled.name).toBe(original.name);
  });

  test('disable should return new instance with enabled=false', () => {
    const original = BackupSchedule.create({
      name: 'Test',
      cronExpression: '0 0 * * *',
      enabled: true,
    });

    const disabled = original.disable();

    expect(disabled.enabled).toBe(false);
    expect(original.enabled).toBe(true); // original unchanged
  });

  // recordRun (immutable)
  test('recordRun should return new instance with run data', () => {
    const original = BackupSchedule.create({
      name: 'Test',
      cronExpression: '0 0 * * *',
    });

    const updated = original.recordRun('success', 'All good');

    expect(updated.lastRunStatus).toBe('success');
    expect(updated.lastRunMessage).toBe('All good');
    expect(updated.lastRunAt instanceof Date).toBeTruthy();
    expect(original.lastRunAt).toBe(null); // original unchanged
    expect(original.lastRunStatus).toBe(null);
  });

  test('recordRun with failure', () => {
    const original = BackupSchedule.create({
      name: 'Test',
      cronExpression: '0 0 * * *',
    });

    const updated = original.recordRun('failure', 'Disk full');

    expect(updated.lastRunStatus).toBe('failure');
    expect(updated.lastRunMessage).toBe('Disk full');
  });

  test('recordRun without message', () => {
    const original = BackupSchedule.create({
      name: 'Test',
      cronExpression: '0 0 * * *',
    });

    const updated = original.recordRun('success');

    expect(updated.lastRunStatus).toBe('success');
    expect(updated.lastRunMessage).toBe(null);
  });

  // toJSON
  test('toJSON returns correct serialization', () => {
    const schedule = BackupSchedule.create({
      name: 'Daily',
      cronExpression: '0 3 * * *',
      retentionPolicy: { maxCount: 5 },
    });

    const json = schedule.toJSON();

    expect(json.name).toBe('Daily');
    expect(json.cronExpression).toBe('0 3 * * *');
    expect(json.cronHumanReadable).toBe('Daily at 3:00 AM');
    expect(json.retentionPolicy.maxCount).toBe(5);
    expect(json.enabled).toBe(true);
    expect(json.createdAt).toBeTruthy();
    expect(json.updatedAt).toBeTruthy();
  });
});

// ==========================================
// BackupScheduleUseCase Tests
// ==========================================
describe('BackupScheduleUseCase', () => {
  // In-memory mock repository
  class MockBackupScheduleRepository implements IBackupScheduleRepository {
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
  }

  let repo: MockBackupScheduleRepository;
  let useCase: BackupScheduleUseCase;

  beforeAll(() => {
    repo = new MockBackupScheduleRepository();
    useCase = new BackupScheduleUseCase(repo);
  });

  test('create should persist and return schedule', async () => {
    const schedule = await useCase.create({
      name: 'Daily Backup',
      cron: '0 3 * * *',
      maxCount: 5,
    });

    expect(schedule.id).toBeTruthy();
    expect(schedule.name).toBe('Daily Backup');
    expect(schedule.cronExpression.expression).toBe('0 3 * * *');
    expect(schedule.retentionPolicy.maxCount).toBe(5);

    // Verify persisted
    const found = await repo.findById(schedule.id);
    expect(found).toBeTruthy();
    expect(found!.name).toBe('Daily Backup');
  });

  test('findAll should return all schedules', async () => {
    // Reset
    repo = new MockBackupScheduleRepository();
    useCase = new BackupScheduleUseCase(repo);

    await useCase.create({ name: 'A', cron: '0 0 * * *' });
    await useCase.create({ name: 'B', cron: '0 6 * * *' });

    const all = await useCase.findAll();
    expect(all.length).toBe(2);
  });

  test('findById should return schedule or null', async () => {
    repo = new MockBackupScheduleRepository();
    useCase = new BackupScheduleUseCase(repo);

    const created = await useCase.create({ name: 'Test', cron: '0 0 * * *' });

    const found = await useCase.findById(created.id);
    expect(found).toBeTruthy();
    expect(found!.id).toBe(created.id);

    const notFound = await useCase.findById('nonexistent');
    expect(notFound).toBe(null);
  });

  test('update should modify and persist', async () => {
    repo = new MockBackupScheduleRepository();
    useCase = new BackupScheduleUseCase(repo);

    const created = await useCase.create({ name: 'Original', cron: '0 0 * * *' });
    const updated = await useCase.update(created.id, {
      name: 'Updated',
      cron: '0 6 * * *',
    });

    expect(updated.name).toBe('Updated');
    expect(updated.cronExpression.expression).toBe('0 6 * * *');
    expect(updated.id).toBe(created.id);
  });

  test('update should throw on non-existent', async () => {
    await expect(useCase.update('nonexistent', { name: 'X' })).rejects.toThrow(/not found/);
  });

  test('remove should delete schedule', async () => {
    repo = new MockBackupScheduleRepository();
    useCase = new BackupScheduleUseCase(repo);

    const created = await useCase.create({ name: 'ToDelete', cron: '0 0 * * *' });
    await useCase.remove(created.id);

    const found = await useCase.findById(created.id);
    expect(found).toBe(null);
  });

  test('remove should throw on non-existent', async () => {
    await expect(useCase.remove('nonexistent')).rejects.toThrow(/not found/);
  });

  test('enable should set enabled=true', async () => {
    repo = new MockBackupScheduleRepository();
    useCase = new BackupScheduleUseCase(repo);

    const created = await useCase.create({
      name: 'Disabled',
      cron: '0 0 * * *',
      enabled: false,
    });
    expect(created.enabled).toBe(false);

    const enabled = await useCase.enable(created.id);
    expect(enabled.enabled).toBe(true);
  });

  test('disable should set enabled=false', async () => {
    repo = new MockBackupScheduleRepository();
    useCase = new BackupScheduleUseCase(repo);

    const created = await useCase.create({ name: 'Active', cron: '0 0 * * *' });
    expect(created.enabled).toBe(true);

    const disabled = await useCase.disable(created.id);
    expect(disabled.enabled).toBe(false);
  });

  test('recordRun should update run data', async () => {
    repo = new MockBackupScheduleRepository();
    useCase = new BackupScheduleUseCase(repo);

    const created = await useCase.create({ name: 'Runner', cron: '0 0 * * *' });
    const updated = await useCase.recordRun(created.id, 'success', 'OK');

    expect(updated.lastRunStatus).toBe('success');
    expect(updated.lastRunMessage).toBe('OK');
    expect(updated.lastRunAt instanceof Date).toBeTruthy();
  });
});

// ==========================================
// SqliteBackupScheduleRepository Tests
// ==========================================
describe('SqliteBackupScheduleRepository', () => {
  let repo: SqliteBackupScheduleRepository;
  let testDir: string;

  beforeAll(async () => {
    testDir = join(tmpdir(), `backup-schedule-test-${randomUUID()}`);
    await mkdir(testDir, { recursive: true });
    const dbPath = join(testDir, 'test.db');
    repo = new SqliteBackupScheduleRepository(dbPath);
  });

  afterAll(async () => {
    repo.close();
    await rm(testDir, { recursive: true, force: true });
  });

  test('save and findById', async () => {
    const schedule = BackupSchedule.create({
      name: 'Test Schedule',
      cronExpression: '0 3 * * *',
      retentionPolicy: { maxCount: 5, maxAgeDays: 14 },
    });

    await repo.save(schedule);

    const found = await repo.findById(schedule.id);
    expect(found).toBeTruthy();
    expect(found!.id).toBe(schedule.id);
    expect(found!.name).toBe('Test Schedule');
    expect(found!.cronExpression.expression).toBe('0 3 * * *');
    expect(found!.retentionPolicy.maxCount).toBe(5);
    expect(found!.retentionPolicy.maxAgeDays).toBe(14);
    expect(found!.enabled).toBe(true);
  });

  test('save should upsert (update existing)', async () => {
    const schedule = BackupSchedule.create({
      name: 'Original',
      cronExpression: '0 0 * * *',
    });

    await repo.save(schedule);

    // Update via enable
    const enabled = schedule.disable();
    await repo.save(enabled);

    const found = await repo.findById(schedule.id);
    expect(found).toBeTruthy();
    expect(found!.enabled).toBe(false);
  });

  test('findAll returns all schedules', async () => {
    // Create a fresh repo
    const dbPath2 = join(testDir, 'test2.db');
    const repo2 = new SqliteBackupScheduleRepository(dbPath2);

    await repo2.save(
      BackupSchedule.create({ name: 'A', cronExpression: '0 0 * * *' })
    );
    await repo2.save(
      BackupSchedule.create({ name: 'B', cronExpression: '0 6 * * *' })
    );
    await repo2.save(
      BackupSchedule.create({ name: 'C', cronExpression: '0 12 * * *' })
    );

    const all = await repo2.findAll();
    expect(all.length).toBe(3);

    repo2.close();
  });

  test('findEnabled returns only enabled', async () => {
    const dbPath3 = join(testDir, 'test3.db');
    const repo3 = new SqliteBackupScheduleRepository(dbPath3);

    const enabled = BackupSchedule.create({
      name: 'Enabled',
      cronExpression: '0 0 * * *',
      enabled: true,
    });
    const disabled = BackupSchedule.create({
      name: 'Disabled',
      cronExpression: '0 6 * * *',
      enabled: false,
    });

    await repo3.save(enabled);
    await repo3.save(disabled);

    const result = await repo3.findEnabled();
    expect(result.length).toBe(1);
    expect(result[0]!.name).toBe('Enabled');

    repo3.close();
  });

  test('findById returns null for non-existent', async () => {
    const found = await repo.findById('non-existent-id');
    expect(found).toBe(null);
  });

  test('delete removes schedule', async () => {
    const schedule = BackupSchedule.create({
      name: 'ToDelete',
      cronExpression: '0 0 * * *',
    });

    await repo.save(schedule);
    expect(await repo.findById(schedule.id)).toBeTruthy();

    await repo.delete(schedule.id);
    expect(await repo.findById(schedule.id)).toBe(null);
  });

  test('save with run data', async () => {
    const schedule = BackupSchedule.create({
      name: 'WithRun',
      cronExpression: '0 0 * * *',
    });

    const withRun = schedule.recordRun('success', 'Backed up 3 worlds');
    await repo.save(withRun);

    const found = await repo.findById(withRun.id);
    expect(found).toBeTruthy();
    expect(found!.lastRunStatus).toBe('success');
    expect(found!.lastRunMessage).toBe('Backed up 3 worlds');
    expect(found!.lastRunAt instanceof Date).toBeTruthy();
  });
});
