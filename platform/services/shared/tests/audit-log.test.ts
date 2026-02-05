import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import { rm, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { AuditLog, type AuditLogData } from '../src/domain/entities/AuditLog.js';
import { AuditActionEnum } from '../src/domain/value-objects/AuditAction.js';
import { SqliteAuditLogRepository } from '../src/infrastructure/adapters/SqliteAuditLogRepository.js';

describe('AuditLog Entity', () => {
  test('should create AuditLog with auto-generated id and timestamp', () => {
    const data: AuditLogData = {
      action: AuditActionEnum.SERVER_CREATE,
      actor: 'admin',
      targetType: 'server',
      targetName: 'myserver',
      details: { type: 'PAPER', version: '1.21.1' },
      status: 'success',
    };

    const log = AuditLog.create(data);

    assert.ok(log.id);
    assert.ok(log.timestamp instanceof Date);
    assert.strictEqual(log.action, AuditActionEnum.SERVER_CREATE);
    assert.strictEqual(log.actor, 'admin');
    assert.strictEqual(log.targetType, 'server');
    assert.strictEqual(log.targetName, 'myserver');
    assert.deepStrictEqual(log.details, { type: 'PAPER', version: '1.21.1' });
    assert.strictEqual(log.status, 'success');
    assert.strictEqual(log.errorMessage, undefined);
  });

  test('should create AuditLog with provided id and timestamp', () => {
    const id = randomUUID();
    const timestamp = new Date('2025-01-26T10:00:00Z');
    const data: AuditLogData = {
      id,
      action: AuditActionEnum.SERVER_DELETE,
      actor: 'admin',
      targetType: 'server',
      targetName: 'oldserver',
      details: null,
      status: 'success',
      timestamp,
    };

    const log = AuditLog.create(data);

    assert.strictEqual(log.id, id);
    assert.strictEqual(log.timestamp.toISOString(), timestamp.toISOString());
  });

  test('should create AuditLog with failure status and error message', () => {
    const data: AuditLogData = {
      action: AuditActionEnum.SERVER_START,
      actor: 'operator',
      targetType: 'server',
      targetName: 'failserver',
      details: null,
      status: 'failure',
      errorMessage: 'Container not found',
    };

    const log = AuditLog.create(data);

    assert.strictEqual(log.status, 'failure');
    assert.strictEqual(log.errorMessage, 'Container not found');
  });

  test('should hydrate AuditLog from raw database row', () => {
    const row = {
      id: randomUUID(),
      action: AuditActionEnum.PLAYER_BAN,
      actor: 'admin',
      target_type: 'player',
      target_name: 'Notch',
      details: JSON.stringify({ reason: 'Griefing' }),
      status: 'success',
      error_message: null,
      timestamp: '2025-01-26T12:00:00.000Z',
    };

    const log = AuditLog.fromRaw(row);

    assert.strictEqual(log.id, row.id);
    assert.strictEqual(log.action, AuditActionEnum.PLAYER_BAN);
    assert.strictEqual(log.actor, 'admin');
    assert.strictEqual(log.targetType, 'player');
    assert.strictEqual(log.targetName, 'Notch');
    assert.deepStrictEqual(log.details, { reason: 'Griefing' });
    assert.strictEqual(log.status, 'success');
    assert.strictEqual(log.errorMessage, null);
    assert.strictEqual(log.timestamp.toISOString(), '2025-01-26T12:00:00.000Z');
  });
});

describe('SqliteAuditLogRepository', () => {
  let testDir: string;
  let testDbPath: string;
  let repository: SqliteAuditLogRepository;

  before(async () => {
    testDir = join(tmpdir(), `sqlite-audit-log-test-${randomUUID()}`);
    await mkdir(testDir, { recursive: true });
    testDbPath = join(testDir, 'audit.db');
    repository = new SqliteAuditLogRepository(testDbPath);
  });

  after(async () => {
    if (repository) {
      repository.close();
    }
    await rm(testDir, { recursive: true, force: true });
  });

  test('should log and retrieve audit entries', async () => {
    const data: AuditLogData = {
      action: AuditActionEnum.SERVER_CREATE,
      actor: 'admin',
      targetType: 'server',
      targetName: 'testserver',
      details: { type: 'PAPER', version: '1.21.1' },
      status: 'success',
    };

    await repository.log(data);

    const logs = await repository.findAll();
    assert.ok(logs.length > 0);

    const log = logs[0];
    assert.strictEqual(log.action, AuditActionEnum.SERVER_CREATE);
    assert.strictEqual(log.actor, 'admin');
    assert.strictEqual(log.targetType, 'server');
    assert.strictEqual(log.targetName, 'testserver');
    assert.deepStrictEqual(log.details, { type: 'PAPER', version: '1.21.1' });
    assert.strictEqual(log.status, 'success');
  });

  test('should find logs by action', async () => {
    await repository.log({
      action: AuditActionEnum.SERVER_START,
      actor: 'admin',
      targetType: 'server',
      targetName: 'server1',
      details: null,
      status: 'success',
    });

    await repository.log({
      action: AuditActionEnum.SERVER_STOP,
      actor: 'admin',
      targetType: 'server',
      targetName: 'server1',
      details: null,
      status: 'success',
    });

    const startLogs = await repository.findByAction(AuditActionEnum.SERVER_START);
    assert.ok(startLogs.length > 0);
    assert.ok(startLogs.every(log => log.action === AuditActionEnum.SERVER_START));
  });

  test('should find logs by actor', async () => {
    await repository.log({
      action: AuditActionEnum.SERVER_RESTART,
      actor: 'operator1',
      targetType: 'server',
      targetName: 'server2',
      details: null,
      status: 'success',
    });

    await repository.log({
      action: AuditActionEnum.SERVER_RESTART,
      actor: 'operator2',
      targetType: 'server',
      targetName: 'server2',
      details: null,
      status: 'success',
    });

    const operator1Logs = await repository.findByActor('operator1');
    assert.ok(operator1Logs.length > 0);
    assert.ok(operator1Logs.every(log => log.actor === 'operator1'));
  });

  test('should find logs by target', async () => {
    await repository.log({
      action: AuditActionEnum.PLAYER_WHITELIST_ADD,
      actor: 'admin',
      targetType: 'player',
      targetName: 'Steve',
      details: { server: 'server1' },
      status: 'success',
    });

    const playerLogs = await repository.findByTarget('player', 'Steve');
    assert.ok(playerLogs.length > 0);
    assert.ok(playerLogs.every(log => log.targetType === 'player' && log.targetName === 'Steve'));
  });

  test('should count logs', async () => {
    const count = await repository.count();
    assert.ok(count > 0);
  });

  test('should count logs with filters', async () => {
    const successCount = await repository.count({ status: 'success' });
    assert.ok(successCount > 0);

    const adminCount = await repository.count({ actor: 'admin' });
    assert.ok(adminCount > 0);

    const serverCreateCount = await repository.count({
      action: AuditActionEnum.SERVER_CREATE
    });
    assert.ok(serverCreateCount > 0);
  });

  test('should findAll with limit and offset', async () => {
    const allLogs = await repository.findAll();
    const totalCount = allLogs.length;

    const firstPage = await repository.findAll({ limit: 2, offset: 0 });
    assert.strictEqual(firstPage.length, Math.min(2, totalCount));

    const secondPage = await repository.findAll({ limit: 2, offset: 2 });
    assert.ok(secondPage.length <= 2);

    if (firstPage.length > 0 && secondPage.length > 0) {
      assert.notStrictEqual(firstPage[0].id, secondPage[0].id);
    }
  });

  test('should findAll with date range filters', async () => {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    await repository.log({
      action: AuditActionEnum.AUDIT_PURGE,
      actor: 'system',
      targetType: 'audit',
      targetName: 'logs',
      details: null,
      status: 'success',
    });

    const logsFromYesterday = await repository.findAll({ from: yesterday });
    assert.ok(logsFromYesterday.length > 0);

    const logsUntilTomorrow = await repository.findAll({ to: tomorrow });
    assert.ok(logsUntilTomorrow.length > 0);

    const logsInRange = await repository.findAll({
      from: yesterday,
      to: tomorrow
    });
    assert.ok(logsInRange.length > 0);
  });

  test('should findAll with multiple filters', async () => {
    await repository.log({
      action: AuditActionEnum.PLAYER_BAN,
      actor: 'moderator',
      targetType: 'player',
      targetName: 'Griefer',
      details: { reason: 'Breaking rules' },
      status: 'success',
    });

    const filtered = await repository.findAll({
      action: AuditActionEnum.PLAYER_BAN,
      actor: 'moderator',
      status: 'success',
    });

    assert.ok(filtered.length > 0);
    assert.ok(filtered.every(log =>
      log.action === AuditActionEnum.PLAYER_BAN &&
      log.actor === 'moderator' &&
      log.status === 'success'
    ));
  });

  test('should delete logs older than specified date', async () => {
    const oldDate = new Date('2020-01-01T00:00:00Z');

    await repository.log({
      id: randomUUID(),
      action: AuditActionEnum.SERVER_DELETE,
      actor: 'admin',
      targetType: 'server',
      targetName: 'oldserver',
      details: null,
      status: 'success',
      timestamp: oldDate,
    });

    const countBefore = await repository.count();
    const cutoffDate = new Date('2024-01-01T00:00:00Z');
    const deletedCount = await repository.deleteOlderThan(cutoffDate);

    assert.ok(deletedCount > 0);

    const countAfter = await repository.count();
    assert.strictEqual(countAfter, countBefore - deletedCount);
  });

  test('should handle empty results gracefully', async () => {
    const nonExistent = await repository.findByAction(AuditActionEnum.PLAYER_KICK);
    // May or may not be empty depending on previous tests, just check it returns array
    assert.ok(Array.isArray(nonExistent));

    const nonExistentActor = await repository.findByActor('nonexistent-user-' + randomUUID());
    assert.deepStrictEqual(nonExistentActor, []);

    const nonExistentTarget = await repository.findByTarget('unknown', 'unknown-' + randomUUID());
    assert.deepStrictEqual(nonExistentTarget, []);
  });

  test('should handle null details correctly', async () => {
    await repository.log({
      action: AuditActionEnum.SERVER_STOP,
      actor: 'admin',
      targetType: 'server',
      targetName: 'simpleserver',
      details: null,
      status: 'success',
    });

    const logs = await repository.findAll({
      targetType: 'server',
      targetName: 'simpleserver'
    });

    const log = logs.find(l => l.targetName === 'simpleserver');
    assert.ok(log);
    assert.strictEqual(log.details, null);
  });
});
