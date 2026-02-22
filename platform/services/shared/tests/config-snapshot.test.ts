import { test, describe } from 'node:test';
import assert from 'node:assert';
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

    assert.strictEqual(file.path, 'server.properties');
    assert.strictEqual(file.hash, validHash);
    assert.strictEqual(file.size, 1024);
  });

  test('should create with zero size', () => {
    const file = ConfigSnapshotFile.create({
      path: 'empty.txt',
      hash: validHash,
      size: 0,
    });

    assert.strictEqual(file.size, 0);
  });

  test('should throw on empty path', () => {
    assert.throws(
      () => ConfigSnapshotFile.create({ path: '', hash: validHash, size: 100 }),
      /path cannot be empty/
    );
  });

  test('should throw on whitespace-only path', () => {
    assert.throws(
      () => ConfigSnapshotFile.create({ path: '  ', hash: validHash, size: 100 }),
      /path cannot be empty/
    );
  });

  test('should throw on empty hash', () => {
    assert.throws(
      () => ConfigSnapshotFile.create({ path: 'test.txt', hash: '', size: 100 }),
      /hash cannot be empty/
    );
  });

  test('should throw on negative size', () => {
    assert.throws(
      () => ConfigSnapshotFile.create({ path: 'test.txt', hash: validHash, size: -1 }),
      /size must be non-negative/
    );
  });

  test('should throw on non-integer size', () => {
    assert.throws(
      () => ConfigSnapshotFile.create({ path: 'test.txt', hash: validHash, size: 1.5 }),
      /size must be.*integer/
    );
  });

  test('equals should return true for same path and hash', () => {
    const a = ConfigSnapshotFile.create({ path: 'server.properties', hash: validHash, size: 100 });
    const b = ConfigSnapshotFile.create({ path: 'server.properties', hash: validHash, size: 200 });
    assert.ok(a.equals(b));
  });

  test('equals should return false for different path', () => {
    const a = ConfigSnapshotFile.create({ path: 'server.properties', hash: validHash, size: 100 });
    const b = ConfigSnapshotFile.create({ path: 'config.env', hash: validHash, size: 100 });
    assert.ok(!a.equals(b));
  });

  test('equals should return false for different hash', () => {
    const hashB = 'b'.repeat(64);
    const a = ConfigSnapshotFile.create({ path: 'server.properties', hash: validHash, size: 100 });
    const b = ConfigSnapshotFile.create({ path: 'server.properties', hash: hashB, size: 100 });
    assert.ok(!a.equals(b));
  });

  test('toJSON should return correct data', () => {
    const file = ConfigSnapshotFile.create({ path: 'server.properties', hash: validHash, size: 512 });
    const json = file.toJSON();

    assert.deepStrictEqual(json, {
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

    assert.strictEqual(diff.path, 'new-file.txt');
    assert.strictEqual(diff.status, 'added');
    assert.strictEqual(diff.newContent, 'new content');
    assert.strictEqual(diff.oldContent, undefined);
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

    assert.strictEqual(diff.status, 'modified');
    assert.strictEqual(diff.oldContent, 'old');
    assert.strictEqual(diff.newContent, 'new');
  });

  test('should create a deleted FileDiff', () => {
    const diff = FileDiff.create({
      path: 'removed.txt',
      status: 'deleted',
      oldContent: 'old content',
      oldHash: 'a'.repeat(64),
    });

    assert.strictEqual(diff.status, 'deleted');
    assert.strictEqual(diff.oldContent, 'old content');
    assert.strictEqual(diff.newContent, undefined);
  });

  test('should throw on empty path', () => {
    assert.throws(
      () => FileDiff.create({ path: '', status: 'added' }),
      /path cannot be empty/
    );
  });

  test('should throw on invalid status', () => {
    assert.throws(
      () => FileDiff.create({ path: 'test.txt', status: 'unknown' as any }),
      /invalid status/i
    );
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
    assert.strictEqual(json.path, 'test.txt');
    assert.strictEqual(json.status, 'modified');
    assert.strictEqual(json.oldContent, 'old');
    assert.strictEqual(json.newContent, 'new');
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

    assert.strictEqual(diff.baseSnapshotId, baseId);
    assert.strictEqual(diff.compareSnapshotId, compareId);
    assert.strictEqual(diff.changes.length, 3);
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

    assert.deepStrictEqual(diff.summary, {
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

    assert.strictEqual(diff.hasChanges, true);
  });

  test('hasChanges should return false when no changes', () => {
    const diff = SnapshotDiff.create({
      baseSnapshotId: baseId,
      compareSnapshotId: compareId,
      changes: [],
    });

    assert.strictEqual(diff.hasChanges, false);
  });

  test('summary should be all zeros for empty changes', () => {
    const diff = SnapshotDiff.create({
      baseSnapshotId: baseId,
      compareSnapshotId: compareId,
      changes: [],
    });

    assert.deepStrictEqual(diff.summary, {
      added: 0,
      modified: 0,
      deleted: 0,
    });
  });

  test('should throw on empty baseSnapshotId', () => {
    assert.throws(
      () => SnapshotDiff.create({ baseSnapshotId: '', compareSnapshotId: compareId, changes: [] }),
      /baseSnapshotId cannot be empty/
    );
  });

  test('should throw on empty compareSnapshotId', () => {
    assert.throws(
      () => SnapshotDiff.create({ baseSnapshotId: baseId, compareSnapshotId: '', changes: [] }),
      /compareSnapshotId cannot be empty/
    );
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
    assert.strictEqual(json.baseSnapshotId, baseId);
    assert.strictEqual(json.compareSnapshotId, compareId);
    assert.strictEqual(json.changes.length, 1);
    assert.deepStrictEqual(json.summary, { added: 1, modified: 0, deleted: 0 });
    assert.strictEqual(json.hasChanges, true);
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

    assert.ok(snapshot.id);
    assert.strictEqual(snapshot.serverName.value, 'myserver');
    assert.ok(snapshot.createdAt instanceof Date);
    assert.strictEqual(snapshot.description, '');
    assert.strictEqual(snapshot.files.length, 1);
    assert.strictEqual(snapshot.scheduleId, undefined);
  });

  test('should create with description', () => {
    const serverName = ServerName.create('myserver');
    const files = [
      ConfigSnapshotFile.create({ path: 'server.properties', hash: validHash, size: 1024 }),
    ];

    const snapshot = ConfigSnapshot.create(serverName, files, 'Before mod update');

    assert.strictEqual(snapshot.description, 'Before mod update');
  });

  test('should create with scheduleId', () => {
    const serverName = ServerName.create('myserver');
    const files = [
      ConfigSnapshotFile.create({ path: 'server.properties', hash: validHash, size: 1024 }),
    ];
    const scheduleId = randomUUID();

    const snapshot = ConfigSnapshot.create(serverName, files, 'Auto snapshot', scheduleId);

    assert.strictEqual(snapshot.scheduleId, scheduleId);
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

    assert.strictEqual(snapshot.id, id);
    assert.strictEqual(snapshot.createdAt.toISOString(), '2025-01-01T00:00:00.000Z');
  });

  test('should create with empty files', () => {
    const serverName = ServerName.create('emptyserver');
    const snapshot = ConfigSnapshot.create(serverName, []);

    assert.strictEqual(snapshot.files.length, 0);
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

    assert.strictEqual(snapshot.files.length, 3);
  });

  test('toJSON should return correct serialization', () => {
    const serverName = ServerName.create('jsonserver');
    const files = [
      ConfigSnapshotFile.create({ path: 'server.properties', hash: validHash, size: 100 }),
    ];

    const snapshot = ConfigSnapshot.create(serverName, files, 'test snapshot');
    const json = snapshot.toJSON();

    assert.strictEqual(json.serverName, 'jsonserver');
    assert.strictEqual(json.description, 'test snapshot');
    assert.strictEqual(json.files.length, 1);
    assert.strictEqual(json.files[0]!.path, 'server.properties');
    assert.ok(json.id);
    assert.ok(json.createdAt);
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

    assert.ok(schedule.id);
    assert.strictEqual(schedule.serverName.value, 'myserver');
    assert.strictEqual(schedule.name, 'Hourly Config Backup');
    assert.strictEqual(schedule.cronExpression.expression, '0 * * * *');
    assert.strictEqual(schedule.enabled, true);
    assert.strictEqual(schedule.retentionCount, 10);
    assert.strictEqual(schedule.lastRunAt, null);
    assert.strictEqual(schedule.lastRunStatus, null);
    assert.ok(schedule.createdAt instanceof Date);
    assert.ok(schedule.updatedAt instanceof Date);
  });

  test('should create with custom retentionCount', () => {
    const serverName = ServerName.create('myserver');
    const schedule = ConfigSnapshotSchedule.create({
      serverName,
      name: 'Custom Retention',
      cronExpression: '0 3 * * *',
      retentionCount: 5,
    });

    assert.strictEqual(schedule.retentionCount, 5);
  });

  test('should create disabled', () => {
    const serverName = ServerName.create('myserver');
    const schedule = ConfigSnapshotSchedule.create({
      serverName,
      name: 'Disabled Schedule',
      cronExpression: '0 0 * * *',
      enabled: false,
    });

    assert.strictEqual(schedule.enabled, false);
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

    assert.strictEqual(schedule.id, id);
  });

  test('should throw on invalid cron expression', () => {
    const serverName = ServerName.create('myserver');
    assert.throws(() =>
      ConfigSnapshotSchedule.create({
        serverName,
        name: 'Bad Cron',
        cronExpression: 'invalid',
      })
    );
  });

  test('should throw on retentionCount < 1', () => {
    const serverName = ServerName.create('myserver');
    assert.throws(
      () => ConfigSnapshotSchedule.create({
        serverName,
        name: 'Bad Retention',
        cronExpression: '0 0 * * *',
        retentionCount: 0,
      }),
      /retentionCount must be a positive integer/
    );
  });

  test('should throw on non-integer retentionCount', () => {
    const serverName = ServerName.create('myserver');
    assert.throws(
      () => ConfigSnapshotSchedule.create({
        serverName,
        name: 'Bad Retention',
        cronExpression: '0 0 * * *',
        retentionCount: 1.5,
      }),
      /retentionCount must be a positive integer/
    );
  });

  test('should throw on empty name', () => {
    const serverName = ServerName.create('myserver');
    assert.throws(
      () => ConfigSnapshotSchedule.create({
        serverName,
        name: '',
        cronExpression: '0 0 * * *',
      }),
      /name cannot be empty/
    );
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

    assert.strictEqual(enabled.enabled, true);
    assert.strictEqual(original.enabled, false); // original unchanged
    assert.strictEqual(enabled.id, original.id);
    assert.strictEqual(enabled.name, original.name);
    assert.strictEqual(enabled.serverName.value, original.serverName.value);
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

    assert.strictEqual(disabled.enabled, false);
    assert.strictEqual(original.enabled, true); // original unchanged
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

    assert.strictEqual(updated.lastRunStatus, 'success');
    assert.ok(updated.lastRunAt instanceof Date);
    assert.strictEqual(original.lastRunAt, null); // original unchanged
    assert.strictEqual(original.lastRunStatus, null);
  });

  test('recordRun with failure', () => {
    const serverName = ServerName.create('myserver');
    const original = ConfigSnapshotSchedule.create({
      serverName,
      name: 'Test',
      cronExpression: '0 0 * * *',
    });

    const updated = original.recordRun('failure');

    assert.strictEqual(updated.lastRunStatus, 'failure');
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

    assert.strictEqual(schedule.id, 'test-id');
    assert.strictEqual(schedule.serverName.value, 'myserver');
    assert.strictEqual(schedule.name, 'DB Schedule');
    assert.strictEqual(schedule.cronExpression.expression, '0 3 * * *');
    assert.strictEqual(schedule.retentionCount, 5);
    assert.strictEqual(schedule.enabled, true);
    assert.ok(schedule.lastRunAt instanceof Date);
    assert.strictEqual(schedule.lastRunStatus, 'success');
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

    assert.strictEqual(schedule.enabled, false);
    assert.strictEqual(schedule.lastRunAt, null);
    assert.strictEqual(schedule.lastRunStatus, null);
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

    assert.strictEqual(json.serverName, 'myserver');
    assert.strictEqual(json.name, 'Daily Config');
    assert.strictEqual(json.cronExpression, '0 3 * * *');
    assert.strictEqual(json.retentionCount, 5);
    assert.strictEqual(json.enabled, true);
    assert.ok(json.createdAt);
    assert.ok(json.updatedAt);
  });
});
