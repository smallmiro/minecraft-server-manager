import { describe, test, expect } from 'vitest';
import { randomUUID } from 'node:crypto';

// Value Objects
import { ConfigSnapshotFile } from '../src/domain/value-objects/ConfigSnapshotFile.js';
import { FileDiff } from '../src/domain/value-objects/FileDiff.js';
import { SnapshotDiff } from '../src/domain/value-objects/SnapshotDiff.js';

// Entities
import { ConfigSnapshot } from '../src/domain/entities/ConfigSnapshot.js';
import { ConfigSnapshotSchedule } from '../src/domain/entities/ConfigSnapshotSchedule.js';

// Existing VOs for reuse
import { ServerName } from '../src/domain/value-objects/ServerName.js';
import { CronExpression } from '../src/domain/value-objects/CronExpression.js';

// ==========================================
// ConfigSnapshotFile Value Object Tests
// ==========================================
describe('ConfigSnapshotFile', () => {
  const validHash = 'a'.repeat(64); // SHA-256 length

  test('should create a valid ConfigSnapshotFile', () => {
    const file = ConfigSnapshotFile.create({
      path: 'server.properties',
      hash: validHash,
      size: 1024,
    });

    expect(file.path).toBe('server.properties');
    expect(file.hash).toBe(validHash);
    expect(file.size).toBe(1024);
  });

  test('should create with zero size', () => {
    const file = ConfigSnapshotFile.create({
      path: 'empty.txt',
      hash: validHash,
      size: 0,
    });

    expect(file.size).toBe(0);
  });

  test('should throw on empty path', () => {
    expect(() => ConfigSnapshotFile.create({ path: '', hash: validHash, size: 100 })).toThrow(/path cannot be empty/);
  });

  test('should throw on whitespace-only path', () => {
    expect(() => ConfigSnapshotFile.create({ path: '  ', hash: validHash, size: 100 })).toThrow(/path cannot be empty/);
  });

  test('should throw on empty hash', () => {
    expect(() => ConfigSnapshotFile.create({ path: 'test.txt', hash: '', size: 100 })).toThrow(/hash cannot be empty/);
  });

  test('should throw on negative size', () => {
    expect(() => ConfigSnapshotFile.create({ path: 'test.txt', hash: validHash, size: -1 })).toThrow(/size must be non-negative/);
  });

  test('should throw on non-integer size', () => {
    expect(() => ConfigSnapshotFile.create({ path: 'test.txt', hash: validHash, size: 1.5 })).toThrow(/size must be.*integer/);
  });

  test('equals should return true for same path and hash', () => {
    const a = ConfigSnapshotFile.create({ path: 'server.properties', hash: validHash, size: 100 });
    const b = ConfigSnapshotFile.create({ path: 'server.properties', hash: validHash, size: 200 });
    expect(a.equals(b)).toBeTruthy();
  });

  test('equals should return false for different path', () => {
    const a = ConfigSnapshotFile.create({ path: 'server.properties', hash: validHash, size: 100 });
    const b = ConfigSnapshotFile.create({ path: 'config.env', hash: validHash, size: 100 });
    expect(!a.equals(b)).toBeTruthy();
  });

  test('equals should return false for different hash', () => {
    const hashB = 'b'.repeat(64);
    const a = ConfigSnapshotFile.create({ path: 'server.properties', hash: validHash, size: 100 });
    const b = ConfigSnapshotFile.create({ path: 'server.properties', hash: hashB, size: 100 });
    expect(!a.equals(b)).toBeTruthy();
  });

  test('toJSON should return correct data', () => {
    const file = ConfigSnapshotFile.create({ path: 'server.properties', hash: validHash, size: 512 });
    const json = file.toJSON();

    expect(json).toEqual({
      path: 'server.properties',
      hash: validHash,
      size: 512,
    });
  });
});

// ==========================================
// FileDiff Value Object Tests
// ==========================================
describe('FileDiff', () => {
  test('should create an added FileDiff', () => {
    const diff = FileDiff.create({
      path: 'new-file.txt',
      status: 'added',
      newContent: 'new content',
      newHash: 'a'.repeat(64),
    });

    expect(diff.path).toBe('new-file.txt');
    expect(diff.status).toBe('added');
    expect(diff.newContent).toBe('new content');
    expect(diff.oldContent).toBe(undefined);
  });

  test('should create a modified FileDiff', () => {
    const diff = FileDiff.create({
      path: 'server.properties',
      status: 'modified',
      oldContent: 'old',
      newContent: 'new',
      oldHash: 'a'.repeat(64),
      newHash: 'b'.repeat(64),
    });

    expect(diff.status).toBe('modified');
    expect(diff.oldContent).toBe('old');
    expect(diff.newContent).toBe('new');
  });

  test('should create a deleted FileDiff', () => {
    const diff = FileDiff.create({
      path: 'removed.txt',
      status: 'deleted',
      oldContent: 'old content',
      oldHash: 'a'.repeat(64),
    });

    expect(diff.status).toBe('deleted');
    expect(diff.oldContent).toBe('old content');
    expect(diff.newContent).toBe(undefined);
  });

  test('should throw on empty path', () => {
    expect(() => FileDiff.create({ path: '', status: 'added' })).toThrow(/path cannot be empty/);
  });

  test('should throw on invalid status', () => {
    expect(() => FileDiff.create({ path: 'test.txt', status: 'unknown' as any })).toThrow(/invalid status/i);
  });

  test('toJSON should return correct data', () => {
    const diff = FileDiff.create({
      path: 'test.txt',
      status: 'modified',
      oldContent: 'old',
      newContent: 'new',
      oldHash: 'a'.repeat(64),
      newHash: 'b'.repeat(64),
    });

    const json = diff.toJSON();
    expect(json.path).toBe('test.txt');
    expect(json.status).toBe('modified');
    expect(json.oldContent).toBe('old');
    expect(json.newContent).toBe('new');
  });
});

// ==========================================
// SnapshotDiff Value Object Tests
// ==========================================
describe('SnapshotDiff', () => {
  const baseId = randomUUID();
  const compareId = randomUUID();

  test('should create with changes', () => {
    const changes = [
      FileDiff.create({ path: 'added.txt', status: 'added', newContent: 'new' }),
      FileDiff.create({ path: 'modified.txt', status: 'modified', oldContent: 'old', newContent: 'new' }),
      FileDiff.create({ path: 'deleted.txt', status: 'deleted', oldContent: 'old' }),
    ];

    const diff = SnapshotDiff.create({
      baseSnapshotId: baseId,
      compareSnapshotId: compareId,
      changes,
    });

    expect(diff.baseSnapshotId).toBe(baseId);
    expect(diff.compareSnapshotId).toBe(compareId);
    expect(diff.changes.length).toBe(3);
  });

  test('summary should compute correctly', () => {
    const changes = [
      FileDiff.create({ path: 'a.txt', status: 'added' }),
      FileDiff.create({ path: 'b.txt', status: 'added' }),
      FileDiff.create({ path: 'c.txt', status: 'modified', oldContent: 'old', newContent: 'new' }),
      FileDiff.create({ path: 'd.txt', status: 'deleted', oldContent: 'old' }),
    ];

    const diff = SnapshotDiff.create({
      baseSnapshotId: baseId,
      compareSnapshotId: compareId,
      changes,
    });

    expect(diff.summary).toEqual({
      added: 2,
      modified: 1,
      deleted: 1,
    });
  });

  test('hasChanges should return true when changes exist', () => {
    const changes = [
      FileDiff.create({ path: 'a.txt', status: 'added' }),
    ];

    const diff = SnapshotDiff.create({
      baseSnapshotId: baseId,
      compareSnapshotId: compareId,
      changes,
    });

    expect(diff.hasChanges).toBe(true);
  });

  test('hasChanges should return false when no changes', () => {
    const diff = SnapshotDiff.create({
      baseSnapshotId: baseId,
      compareSnapshotId: compareId,
      changes: [],
    });

    expect(diff.hasChanges).toBe(false);
  });

  test('summary should be all zeros for empty changes', () => {
    const diff = SnapshotDiff.create({
      baseSnapshotId: baseId,
      compareSnapshotId: compareId,
      changes: [],
    });

    expect(diff.summary).toEqual({
      added: 0,
      modified: 0,
      deleted: 0,
    });
  });

  test('should throw on empty baseSnapshotId', () => {
    expect(() => SnapshotDiff.create({ baseSnapshotId: '', compareSnapshotId: compareId, changes: [] })).toThrow(/baseSnapshotId cannot be empty/);
  });

  test('should throw on empty compareSnapshotId', () => {
    expect(() => SnapshotDiff.create({ baseSnapshotId: baseId, compareSnapshotId: '', changes: [] })).toThrow(/compareSnapshotId cannot be empty/);
  });

  test('toJSON should return correct data', () => {
    const changes = [
      FileDiff.create({ path: 'a.txt', status: 'added' }),
    ];

    const diff = SnapshotDiff.create({
      baseSnapshotId: baseId,
      compareSnapshotId: compareId,
      changes,
    });

    const json = diff.toJSON();
    expect(json.baseSnapshotId).toBe(baseId);
    expect(json.compareSnapshotId).toBe(compareId);
    expect(json.changes.length).toBe(1);
    expect(json.summary).toEqual({ added: 1, modified: 0, deleted: 0 });
    expect(json.hasChanges).toBe(true);
  });
});

// ==========================================
// ConfigSnapshot Entity Tests
// ==========================================
describe('ConfigSnapshot', () => {
  const validHash = 'a'.repeat(64);

  test('should create with auto-generated id and timestamp', () => {
    const serverName = ServerName.create('myserver');
    const files = [
      ConfigSnapshotFile.create({ path: 'server.properties', hash: validHash, size: 1024 }),
    ];

    const snapshot = ConfigSnapshot.create(serverName, files);

    expect(snapshot.id).toBeTruthy();
    expect(snapshot.serverName.value).toBe('myserver');
    expect(snapshot.createdAt instanceof Date).toBeTruthy();
    expect(snapshot.description).toBe('');
    expect(snapshot.files.length).toBe(1);
    expect(snapshot.scheduleId).toBe(undefined);
  });

  test('should create with description', () => {
    const serverName = ServerName.create('myserver');
    const files = [
      ConfigSnapshotFile.create({ path: 'server.properties', hash: validHash, size: 1024 }),
    ];

    const snapshot = ConfigSnapshot.create(serverName, files, 'Before mod update');

    expect(snapshot.description).toBe('Before mod update');
  });

  test('should create with scheduleId', () => {
    const serverName = ServerName.create('myserver');
    const files = [
      ConfigSnapshotFile.create({ path: 'server.properties', hash: validHash, size: 1024 }),
    ];
    const scheduleId = randomUUID();

    const snapshot = ConfigSnapshot.create(serverName, files, 'Auto snapshot', scheduleId);

    expect(snapshot.scheduleId).toBe(scheduleId);
  });

  test('should create with provided id and date', () => {
    const id = randomUUID();
    const date = new Date('2025-01-01T00:00:00.000Z');
    const serverName = ServerName.create('testserver');
    const files: ConfigSnapshotFile[] = [];

    const snapshot = ConfigSnapshot.fromData({
      id,
      serverName,
      createdAt: date,
      description: 'test',
      files,
    });

    expect(snapshot.id).toBe(id);
    expect(snapshot.createdAt.toISOString()).toBe('2025-01-01T00:00:00.000Z');
  });

  test('should create with empty files', () => {
    const serverName = ServerName.create('emptyserver');
    const snapshot = ConfigSnapshot.create(serverName, []);

    expect(snapshot.files.length).toBe(0);
  });

  test('should create with multiple files', () => {
    const serverName = ServerName.create('multiserver');
    const hashB = 'b'.repeat(64);
    const files = [
      ConfigSnapshotFile.create({ path: 'server.properties', hash: validHash, size: 1024 }),
      ConfigSnapshotFile.create({ path: 'config.env', hash: hashB, size: 512 }),
      ConfigSnapshotFile.create({ path: 'docker-compose.yml', hash: validHash, size: 2048 }),
    ];

    const snapshot = ConfigSnapshot.create(serverName, files, 'Full config');

    expect(snapshot.files.length).toBe(3);
  });

  test('toJSON should return correct serialization', () => {
    const serverName = ServerName.create('jsonserver');
    const files = [
      ConfigSnapshotFile.create({ path: 'server.properties', hash: validHash, size: 100 }),
    ];

    const snapshot = ConfigSnapshot.create(serverName, files, 'test snapshot');
    const json = snapshot.toJSON();

    expect(json.serverName).toBe('jsonserver');
    expect(json.description).toBe('test snapshot');
    expect(json.files.length).toBe(1);
    expect(json.files[0]!.path).toBe('server.properties');
    expect(json.id).toBeTruthy();
    expect(json.createdAt).toBeTruthy();
  });
});

// ==========================================
// ConfigSnapshotSchedule Entity Tests
// ==========================================
describe('ConfigSnapshotSchedule', () => {
  test('should create with auto-generated id and timestamps', () => {
    const serverName = ServerName.create('myserver');
    const schedule = ConfigSnapshotSchedule.create({
      serverName,
      name: 'Hourly Config Backup',
      cronExpression: '0 * * * *',
    });

    expect(schedule.id).toBeTruthy();
    expect(schedule.serverName.value).toBe('myserver');
    expect(schedule.name).toBe('Hourly Config Backup');
    expect(schedule.cronExpression.expression).toBe('0 * * * *');
    expect(schedule.enabled).toBe(true);
    expect(schedule.retentionCount).toBe(10);
    expect(schedule.lastRunAt).toBe(null);
    expect(schedule.lastRunStatus).toBe(null);
    expect(schedule.createdAt instanceof Date).toBeTruthy();
    expect(schedule.updatedAt instanceof Date).toBeTruthy();
  });

  test('should create with custom retentionCount', () => {
    const serverName = ServerName.create('myserver');
    const schedule = ConfigSnapshotSchedule.create({
      serverName,
      name: 'Custom Retention',
      cronExpression: '0 3 * * *',
      retentionCount: 5,
    });

    expect(schedule.retentionCount).toBe(5);
  });

  test('should create disabled', () => {
    const serverName = ServerName.create('myserver');
    const schedule = ConfigSnapshotSchedule.create({
      serverName,
      name: 'Disabled Schedule',
      cronExpression: '0 0 * * *',
      enabled: false,
    });

    expect(schedule.enabled).toBe(false);
  });

  test('should create with provided id', () => {
    const id = randomUUID();
    const serverName = ServerName.create('myserver');
    const schedule = ConfigSnapshotSchedule.create({
      id,
      serverName,
      name: 'With ID',
      cronExpression: '0 0 * * *',
    });

    expect(schedule.id).toBe(id);
  });

  test('should throw on invalid cron expression', () => {
    const serverName = ServerName.create('myserver');
    expect(() =>
      ConfigSnapshotSchedule.create({
        serverName,
        name: 'Bad Cron',
        cronExpression: 'invalid',
      })).toThrow();
  });

  test('should throw on retentionCount < 1', () => {
    const serverName = ServerName.create('myserver');
    expect(() => ConfigSnapshotSchedule.create({
        serverName,
        name: 'Bad Retention',
        cronExpression: '0 0 * * *',
        retentionCount: 0,
      })).toThrow(/retentionCount must be a positive integer/);
  });

  test('should throw on non-integer retentionCount', () => {
    const serverName = ServerName.create('myserver');
    expect(() => ConfigSnapshotSchedule.create({
        serverName,
        name: 'Bad Retention',
        cronExpression: '0 0 * * *',
        retentionCount: 1.5,
      })).toThrow(/retentionCount must be a positive integer/);
  });

  test('should throw on empty name', () => {
    const serverName = ServerName.create('myserver');
    expect(() => ConfigSnapshotSchedule.create({
        serverName,
        name: '',
        cronExpression: '0 0 * * *',
      })).toThrow(/name cannot be empty/);
  });

  // enable / disable (immutable)
  test('enable should return new instance with enabled=true', () => {
    const serverName = ServerName.create('myserver');
    const original = ConfigSnapshotSchedule.create({
      serverName,
      name: 'Test',
      cronExpression: '0 0 * * *',
      enabled: false,
    });

    const enabled = original.enable();

    expect(enabled.enabled).toBe(true);
    expect(original.enabled).toBe(false); // original unchanged
    expect(enabled.id).toBe(original.id);
    expect(enabled.name).toBe(original.name);
    expect(enabled.serverName.value).toBe(original.serverName.value);
  });

  test('disable should return new instance with enabled=false', () => {
    const serverName = ServerName.create('myserver');
    const original = ConfigSnapshotSchedule.create({
      serverName,
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
    const serverName = ServerName.create('myserver');
    const original = ConfigSnapshotSchedule.create({
      serverName,
      name: 'Test',
      cronExpression: '0 0 * * *',
    });

    const updated = original.recordRun('success');

    expect(updated.lastRunStatus).toBe('success');
    expect(updated.lastRunAt instanceof Date).toBeTruthy();
    expect(original.lastRunAt).toBe(null); // original unchanged
    expect(original.lastRunStatus).toBe(null);
  });

  test('recordRun with failure', () => {
    const serverName = ServerName.create('myserver');
    const original = ConfigSnapshotSchedule.create({
      serverName,
      name: 'Test',
      cronExpression: '0 0 * * *',
    });

    const updated = original.recordRun('failure');

    expect(updated.lastRunStatus).toBe('failure');
  });

  // fromRaw
  test('should create from database row', () => {
    const row = {
      id: 'test-id',
      server_name: 'myserver',
      name: 'DB Schedule',
      cron_expression: '0 3 * * *',
      enabled: 1,
      retention_count: 5,
      last_run_at: '2025-01-01T00:00:00.000Z',
      last_run_status: 'success' as const,
      created_at: '2025-01-01T00:00:00.000Z',
      updated_at: '2025-01-01T00:00:00.000Z',
    };

    const schedule = ConfigSnapshotSchedule.fromRaw(row);

    expect(schedule.id).toBe('test-id');
    expect(schedule.serverName.value).toBe('myserver');
    expect(schedule.name).toBe('DB Schedule');
    expect(schedule.cronExpression.expression).toBe('0 3 * * *');
    expect(schedule.retentionCount).toBe(5);
    expect(schedule.enabled).toBe(true);
    expect(schedule.lastRunAt instanceof Date).toBeTruthy();
    expect(schedule.lastRunStatus).toBe('success');
  });

  test('should create from row with null optionals', () => {
    const row = {
      id: 'test-id',
      server_name: 'myserver',
      name: 'Minimal',
      cron_expression: '0 0 * * *',
      enabled: 0,
      retention_count: 10,
      last_run_at: null,
      last_run_status: null,
      created_at: '2025-01-01T00:00:00.000Z',
      updated_at: '2025-01-01T00:00:00.000Z',
    };

    const schedule = ConfigSnapshotSchedule.fromRaw(row);

    expect(schedule.enabled).toBe(false);
    expect(schedule.lastRunAt).toBe(null);
    expect(schedule.lastRunStatus).toBe(null);
  });

  // toJSON
  test('toJSON returns correct serialization', () => {
    const serverName = ServerName.create('myserver');
    const schedule = ConfigSnapshotSchedule.create({
      serverName,
      name: 'Daily Config',
      cronExpression: '0 3 * * *',
      retentionCount: 5,
    });

    const json = schedule.toJSON();

    expect(json.serverName).toBe('myserver');
    expect(json.name).toBe('Daily Config');
    expect(json.cronExpression).toBe('0 3 * * *');
    expect(json.retentionCount).toBe(5);
    expect(json.enabled).toBe(true);
    expect(json.createdAt).toBeTruthy();
    expect(json.updatedAt).toBeTruthy();
  });
});
