import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
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
    assert.strictEqual(cron.expression, '0 3 * * *');
  });

  test('should create with complex expression', () => {
    const cron = CronExpression.create('*/15 2-4 1,15 * 1-5');
    assert.strictEqual(cron.expression, '*/15 2-4 1,15 * 1-5');
  });

  test('should trim whitespace', () => {
    const cron = CronExpression.create('  0 3 * * *  ');
    assert.strictEqual(cron.expression, '0 3 * * *');
  });

  test('should throw on empty expression', () => {
    assert.throws(() => CronExpression.create(''), /cannot be empty/);
  });

  test('should throw on wrong number of fields', () => {
    assert.throws(() => CronExpression.create('0 3 *'), /expected 5 fields/);
    assert.throws(() => CronExpression.create('0 3 * * * *'), /expected 5 fields/);
  });

  test('should throw on invalid minute value', () => {
    assert.throws(() => CronExpression.create('60 * * * *'), /out of range.*minute/);
  });

  test('should throw on invalid hour value', () => {
    assert.throws(() => CronExpression.create('0 24 * * *'), /out of range.*hour/);
  });

  test('should throw on invalid day-of-month value', () => {
    assert.throws(() => CronExpression.create('0 0 32 * *'), /out of range.*day of month/);
    assert.throws(() => CronExpression.create('0 0 0 * *'), /out of range.*day of month/);
  });

  test('should throw on invalid month value', () => {
    assert.throws(() => CronExpression.create('0 0 1 13 *'), /out of range.*month/);
    assert.throws(() => CronExpression.create('0 0 1 0 *'), /out of range.*month/);
  });

  test('should throw on invalid day-of-week value', () => {
    assert.throws(() => CronExpression.create('0 0 * * 8'), /out of range.*day of week/);
  });

  test('should allow day-of-week 7 (Sunday)', () => {
    const cron = CronExpression.create('0 0 * * 7');
    assert.strictEqual(cron.expression, '0 0 * * 7');
  });

  test('should throw on non-numeric value', () => {
    assert.throws(() => CronExpression.create('abc * * * *'), /Invalid value/);
  });

  test('should validate step expressions', () => {
    const cron = CronExpression.create('*/5 */2 * * *');
    assert.strictEqual(cron.expression, '*/5 */2 * * *');
  });

  test('should throw on invalid step', () => {
    assert.throws(() => CronExpression.create('*/0 * * * *'), /Invalid step/);
  });

  test('should validate range expressions', () => {
    const cron = CronExpression.create('0 9-17 * * *');
    assert.strictEqual(cron.expression, '0 9-17 * * *');
  });

  test('should throw on invalid range (start > end)', () => {
    assert.throws(() => CronExpression.create('0 17-9 * * *'), /start.*>.*end/);
  });

  test('should validate list expressions', () => {
    const cron = CronExpression.create('0 0 1,15 * *');
    assert.strictEqual(cron.expression, '0 0 1,15 * *');
  });

  // Presets
  test('should create from daily preset', () => {
    const cron = CronExpression.fromPreset('daily');
    assert.strictEqual(cron.expression, '0 3 * * *');
  });

  test('should create from every-6h preset', () => {
    const cron = CronExpression.fromPreset('every-6h');
    assert.strictEqual(cron.expression, '0 */6 * * *');
  });

  test('should create from every-12h preset', () => {
    const cron = CronExpression.fromPreset('every-12h');
    assert.strictEqual(cron.expression, '0 */12 * * *');
  });

  test('should create from hourly preset', () => {
    const cron = CronExpression.fromPreset('hourly');
    assert.strictEqual(cron.expression, '0 * * * *');
  });

  test('should create from weekly preset', () => {
    const cron = CronExpression.fromPreset('weekly');
    assert.strictEqual(cron.expression, '0 3 * * 0');
  });

  test('should throw on unknown preset', () => {
    assert.throws(() => CronExpression.fromPreset('unknown'), /Unknown cron preset/);
  });

  test('should return available presets', () => {
    const presets = CronExpression.getPresets();
    assert.ok(presets['daily']);
    assert.ok(presets['hourly']);
    assert.ok(presets['weekly']);
    assert.ok(presets['every-6h']);
    assert.ok(presets['every-12h']);
  });

  // Human readable
  test('should return human-readable for daily', () => {
    const cron = CronExpression.fromPreset('daily');
    assert.strictEqual(cron.toHumanReadable(), 'Daily at 3:00 AM');
  });

  test('should return human-readable for hourly', () => {
    const cron = CronExpression.fromPreset('hourly');
    assert.strictEqual(cron.toHumanReadable(), 'Every hour');
  });

  test('should return human-readable for weekly', () => {
    const cron = CronExpression.fromPreset('weekly');
    assert.strictEqual(cron.toHumanReadable(), 'Weekly on Sunday at 3:00 AM');
  });

  test('should return raw cron for custom expression', () => {
    const cron = CronExpression.create('15 4 * * 1-5');
    assert.strictEqual(cron.toHumanReadable(), 'Cron: 15 4 * * 1-5');
  });

  // Equality
  test('should be equal for same expression', () => {
    const a = CronExpression.create('0 3 * * *');
    const b = CronExpression.create('0 3 * * *');
    assert.ok(a.equals(b));
  });

  test('should not be equal for different expression', () => {
    const a = CronExpression.create('0 3 * * *');
    const b = CronExpression.create('0 4 * * *');
    assert.ok(!a.equals(b));
  });

  test('toString should return expression', () => {
    const cron = CronExpression.create('0 3 * * *');
    assert.strictEqual(cron.toString(), '0 3 * * *');
  });
});

// ==========================================
// BackupRetentionPolicy Value Object Tests
// ==========================================
describe('BackupRetentionPolicy', () => {
  test('should create with maxCount only', () => {
    const policy = BackupRetentionPolicy.create({ maxCount: 5 });
    assert.strictEqual(policy.maxCount, 5);
    assert.strictEqual(policy.maxAgeDays, undefined);
  });

  test('should create with maxAgeDays only', () => {
    const policy = BackupRetentionPolicy.create({ maxAgeDays: 14 });
    assert.strictEqual(policy.maxCount, undefined);
    assert.strictEqual(policy.maxAgeDays, 14);
  });

  test('should create with both', () => {
    const policy = BackupRetentionPolicy.create({ maxCount: 10, maxAgeDays: 30 });
    assert.strictEqual(policy.maxCount, 10);
    assert.strictEqual(policy.maxAgeDays, 30);
  });

  test('should create with empty (no limits)', () => {
    const policy = BackupRetentionPolicy.create({});
    assert.strictEqual(policy.maxCount, undefined);
    assert.strictEqual(policy.maxAgeDays, undefined);
  });

  test('should create default policy', () => {
    const policy = BackupRetentionPolicy.default();
    assert.strictEqual(policy.maxCount, 10);
    assert.strictEqual(policy.maxAgeDays, 30);
  });

  test('should throw on maxCount < 1', () => {
    assert.throws(() => BackupRetentionPolicy.create({ maxCount: 0 }), /positive integer/);
  });

  test('should throw on negative maxCount', () => {
    assert.throws(() => BackupRetentionPolicy.create({ maxCount: -1 }), /positive integer/);
  });

  test('should throw on non-integer maxCount', () => {
    assert.throws(() => BackupRetentionPolicy.create({ maxCount: 1.5 }), /positive integer/);
  });

  test('should throw on maxAgeDays < 1', () => {
    assert.throws(() => BackupRetentionPolicy.create({ maxAgeDays: 0 }), /positive integer/);
  });

  // shouldPrune
  test('shouldPrune returns true when count exceeds maxCount', () => {
    const policy = BackupRetentionPolicy.create({ maxCount: 5 });
    assert.ok(policy.shouldPrune(6, new Date()));
  });

  test('shouldPrune returns false when count is within maxCount', () => {
    const policy = BackupRetentionPolicy.create({ maxCount: 5 });
    assert.ok(!policy.shouldPrune(5, new Date()));
  });

  test('shouldPrune returns true when oldest backup exceeds maxAgeDays', () => {
    const policy = BackupRetentionPolicy.create({ maxAgeDays: 7 });
    const oldDate = new Date();
    oldDate.setDate(oldDate.getDate() - 10);
    assert.ok(policy.shouldPrune(1, oldDate));
  });

  test('shouldPrune returns false when oldest backup is within maxAgeDays', () => {
    const policy = BackupRetentionPolicy.create({ maxAgeDays: 7 });
    const recentDate = new Date();
    recentDate.setDate(recentDate.getDate() - 3);
    assert.ok(!policy.shouldPrune(1, recentDate));
  });

  test('shouldPrune returns false with no limits', () => {
    const policy = BackupRetentionPolicy.create({});
    const oldDate = new Date('2020-01-01');
    assert.ok(!policy.shouldPrune(1000, oldDate));
  });

  // toJSON
  test('toJSON returns correct data', () => {
    const policy = BackupRetentionPolicy.create({ maxCount: 5, maxAgeDays: 14 });
    const json = policy.toJSON();
    assert.deepStrictEqual(json, { maxCount: 5, maxAgeDays: 14 });
  });

  // equals
  test('equals returns true for same values', () => {
    const a = BackupRetentionPolicy.create({ maxCount: 5, maxAgeDays: 14 });
    const b = BackupRetentionPolicy.create({ maxCount: 5, maxAgeDays: 14 });
    assert.ok(a.equals(b));
  });

  test('equals returns false for different values', () => {
    const a = BackupRetentionPolicy.create({ maxCount: 5 });
    const b = BackupRetentionPolicy.create({ maxCount: 10 });
    assert.ok(!a.equals(b));
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

    assert.ok(schedule.id);
    assert.strictEqual(schedule.name, 'Daily Backup');
    assert.strictEqual(schedule.cronExpression.expression, '0 3 * * *');
    assert.strictEqual(schedule.enabled, true);
    assert.strictEqual(schedule.lastRunAt, null);
    assert.strictEqual(schedule.lastRunStatus, null);
    assert.strictEqual(schedule.lastRunMessage, null);
    assert.ok(schedule.createdAt instanceof Date);
    assert.ok(schedule.updatedAt instanceof Date);
    // Default retention policy
    assert.strictEqual(schedule.retentionPolicy.maxCount, 10);
    assert.strictEqual(schedule.retentionPolicy.maxAgeDays, 30);
  });

  test('should create with custom retention policy', () => {
    const schedule = BackupSchedule.create({
      name: 'Custom',
      cronExpression: '0 */6 * * *',
      retentionPolicy: { maxCount: 5, maxAgeDays: 7 },
    });

    assert.strictEqual(schedule.retentionPolicy.maxCount, 5);
    assert.strictEqual(schedule.retentionPolicy.maxAgeDays, 7);
  });

  test('should create with provided id', () => {
    const id = randomUUID();
    const schedule = BackupSchedule.create({
      id,
      name: 'Test',
      cronExpression: '0 0 * * *',
    });

    assert.strictEqual(schedule.id, id);
  });

  test('should create disabled', () => {
    const schedule = BackupSchedule.create({
      name: 'Disabled',
      cronExpression: '0 0 * * *',
      enabled: false,
    });

    assert.strictEqual(schedule.enabled, false);
  });

  test('should throw on invalid cron expression', () => {
    assert.throws(() =>
      BackupSchedule.create({
        name: 'Bad',
        cronExpression: 'invalid',
      })
    );
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

    assert.strictEqual(schedule.id, 'test-id');
    assert.strictEqual(schedule.name, 'DB Schedule');
    assert.strictEqual(schedule.cronExpression.expression, '0 3 * * *');
    assert.strictEqual(schedule.retentionPolicy.maxCount, 5);
    assert.strictEqual(schedule.retentionPolicy.maxAgeDays, 14);
    assert.strictEqual(schedule.enabled, true);
    assert.ok(schedule.lastRunAt instanceof Date);
    assert.strictEqual(schedule.lastRunStatus, 'success');
    assert.strictEqual(schedule.lastRunMessage, 'Backed up 3 worlds');
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

    assert.strictEqual(schedule.enabled, false);
    assert.strictEqual(schedule.lastRunAt, null);
    assert.strictEqual(schedule.lastRunStatus, null);
    assert.strictEqual(schedule.lastRunMessage, null);
    assert.strictEqual(schedule.retentionPolicy.maxCount, undefined);
    assert.strictEqual(schedule.retentionPolicy.maxAgeDays, undefined);
  });

  // enable / disable (immutable)
  test('enable should return new instance with enabled=true', () => {
    const original = BackupSchedule.create({
      name: 'Test',
      cronExpression: '0 0 * * *',
      enabled: false,
    });

    const enabled = original.enable();

    assert.strictEqual(enabled.enabled, true);
    assert.strictEqual(original.enabled, false); // original unchanged
    assert.strictEqual(enabled.id, original.id);
    assert.strictEqual(enabled.name, original.name);
  });

  test('disable should return new instance with enabled=false', () => {
    const original = BackupSchedule.create({
      name: 'Test',
      cronExpression: '0 0 * * *',
      enabled: true,
    });

    const disabled = original.disable();

    assert.strictEqual(disabled.enabled, false);
    assert.strictEqual(original.enabled, true); // original unchanged
  });

  // recordRun (immutable)
  test('recordRun should return new instance with run data', () => {
    const original = BackupSchedule.create({
      name: 'Test',
      cronExpression: '0 0 * * *',
    });

    const updated = original.recordRun('success', 'All good');

    assert.strictEqual(updated.lastRunStatus, 'success');
    assert.strictEqual(updated.lastRunMessage, 'All good');
    assert.ok(updated.lastRunAt instanceof Date);
    assert.strictEqual(original.lastRunAt, null); // original unchanged
    assert.strictEqual(original.lastRunStatus, null);
  });

  test('recordRun with failure', () => {
    const original = BackupSchedule.create({
      name: 'Test',
      cronExpression: '0 0 * * *',
    });

    const updated = original.recordRun('failure', 'Disk full');

    assert.strictEqual(updated.lastRunStatus, 'failure');
    assert.strictEqual(updated.lastRunMessage, 'Disk full');
  });

  test('recordRun without message', () => {
    const original = BackupSchedule.create({
      name: 'Test',
      cronExpression: '0 0 * * *',
    });

    const updated = original.recordRun('success');

    assert.strictEqual(updated.lastRunStatus, 'success');
    assert.strictEqual(updated.lastRunMessage, null);
  });

  // toJSON
  test('toJSON returns correct serialization', () => {
    const schedule = BackupSchedule.create({
      name: 'Daily',
      cronExpression: '0 3 * * *',
      retentionPolicy: { maxCount: 5 },
    });

    const json = schedule.toJSON();

    assert.strictEqual(json.name, 'Daily');
    assert.strictEqual(json.cronExpression, '0 3 * * *');
    assert.strictEqual(json.cronHumanReadable, 'Daily at 3:00 AM');
    assert.strictEqual(json.retentionPolicy.maxCount, 5);
    assert.strictEqual(json.enabled, true);
    assert.ok(json.createdAt);
    assert.ok(json.updatedAt);
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

  before(() => {
    repo = new MockBackupScheduleRepository();
    useCase = new BackupScheduleUseCase(repo);
  });

  test('create should persist and return schedule', async () => {
    const schedule = await useCase.create({
      name: 'Daily Backup',
      cron: '0 3 * * *',
      maxCount: 5,
    });

    assert.ok(schedule.id);
    assert.strictEqual(schedule.name, 'Daily Backup');
    assert.strictEqual(schedule.cronExpression.expression, '0 3 * * *');
    assert.strictEqual(schedule.retentionPolicy.maxCount, 5);

    // Verify persisted
    const found = await repo.findById(schedule.id);
    assert.ok(found);
    assert.strictEqual(found!.name, 'Daily Backup');
  });

  test('findAll should return all schedules', async () => {
    // Reset
    repo = new MockBackupScheduleRepository();
    useCase = new BackupScheduleUseCase(repo);

    await useCase.create({ name: 'A', cron: '0 0 * * *' });
    await useCase.create({ name: 'B', cron: '0 6 * * *' });

    const all = await useCase.findAll();
    assert.strictEqual(all.length, 2);
  });

  test('findById should return schedule or null', async () => {
    repo = new MockBackupScheduleRepository();
    useCase = new BackupScheduleUseCase(repo);

    const created = await useCase.create({ name: 'Test', cron: '0 0 * * *' });

    const found = await useCase.findById(created.id);
    assert.ok(found);
    assert.strictEqual(found!.id, created.id);

    const notFound = await useCase.findById('nonexistent');
    assert.strictEqual(notFound, null);
  });

  test('update should modify and persist', async () => {
    repo = new MockBackupScheduleRepository();
    useCase = new BackupScheduleUseCase(repo);

    const created = await useCase.create({ name: 'Original', cron: '0 0 * * *' });
    const updated = await useCase.update(created.id, {
      name: 'Updated',
      cron: '0 6 * * *',
    });

    assert.strictEqual(updated.name, 'Updated');
    assert.strictEqual(updated.cronExpression.expression, '0 6 * * *');
    assert.strictEqual(updated.id, created.id);
  });

  test('update should throw on non-existent', async () => {
    await assert.rejects(
      () => useCase.update('nonexistent', { name: 'X' }),
      /not found/
    );
  });

  test('remove should delete schedule', async () => {
    repo = new MockBackupScheduleRepository();
    useCase = new BackupScheduleUseCase(repo);

    const created = await useCase.create({ name: 'ToDelete', cron: '0 0 * * *' });
    await useCase.remove(created.id);

    const found = await useCase.findById(created.id);
    assert.strictEqual(found, null);
  });

  test('remove should throw on non-existent', async () => {
    await assert.rejects(
      () => useCase.remove('nonexistent'),
      /not found/
    );
  });

  test('enable should set enabled=true', async () => {
    repo = new MockBackupScheduleRepository();
    useCase = new BackupScheduleUseCase(repo);

    const created = await useCase.create({
      name: 'Disabled',
      cron: '0 0 * * *',
      enabled: false,
    });
    assert.strictEqual(created.enabled, false);

    const enabled = await useCase.enable(created.id);
    assert.strictEqual(enabled.enabled, true);
  });

  test('disable should set enabled=false', async () => {
    repo = new MockBackupScheduleRepository();
    useCase = new BackupScheduleUseCase(repo);

    const created = await useCase.create({ name: 'Active', cron: '0 0 * * *' });
    assert.strictEqual(created.enabled, true);

    const disabled = await useCase.disable(created.id);
    assert.strictEqual(disabled.enabled, false);
  });

  test('recordRun should update run data', async () => {
    repo = new MockBackupScheduleRepository();
    useCase = new BackupScheduleUseCase(repo);

    const created = await useCase.create({ name: 'Runner', cron: '0 0 * * *' });
    const updated = await useCase.recordRun(created.id, 'success', 'OK');

    assert.strictEqual(updated.lastRunStatus, 'success');
    assert.strictEqual(updated.lastRunMessage, 'OK');
    assert.ok(updated.lastRunAt instanceof Date);
  });
});

// ==========================================
// SqliteBackupScheduleRepository Tests
// ==========================================
describe('SqliteBackupScheduleRepository', () => {
  let repo: SqliteBackupScheduleRepository;
  let testDir: string;

  before(async () => {
    testDir = join(tmpdir(), `backup-schedule-test-${randomUUID()}`);
    await mkdir(testDir, { recursive: true });
    const dbPath = join(testDir, 'test.db');
    repo = new SqliteBackupScheduleRepository(dbPath);
  });

  after(async () => {
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
    assert.ok(found);
    assert.strictEqual(found!.id, schedule.id);
    assert.strictEqual(found!.name, 'Test Schedule');
    assert.strictEqual(found!.cronExpression.expression, '0 3 * * *');
    assert.strictEqual(found!.retentionPolicy.maxCount, 5);
    assert.strictEqual(found!.retentionPolicy.maxAgeDays, 14);
    assert.strictEqual(found!.enabled, true);
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
    assert.ok(found);
    assert.strictEqual(found!.enabled, false);
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
    assert.strictEqual(all.length, 3);

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
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0]!.name, 'Enabled');

    repo3.close();
  });

  test('findById returns null for non-existent', async () => {
    const found = await repo.findById('non-existent-id');
    assert.strictEqual(found, null);
  });

  test('delete removes schedule', async () => {
    const schedule = BackupSchedule.create({
      name: 'ToDelete',
      cronExpression: '0 0 * * *',
    });

    await repo.save(schedule);
    assert.ok(await repo.findById(schedule.id));

    await repo.delete(schedule.id);
    assert.strictEqual(await repo.findById(schedule.id), null);
  });

  test('save with run data', async () => {
    const schedule = BackupSchedule.create({
      name: 'WithRun',
      cronExpression: '0 0 * * *',
    });

    const withRun = schedule.recordRun('success', 'Backed up 3 worlds');
    await repo.save(withRun);

    const found = await repo.findById(withRun.id);
    assert.ok(found);
    assert.strictEqual(found!.lastRunStatus, 'success');
    assert.strictEqual(found!.lastRunMessage, 'Backed up 3 worlds');
    assert.ok(found!.lastRunAt instanceof Date);
  });
});
