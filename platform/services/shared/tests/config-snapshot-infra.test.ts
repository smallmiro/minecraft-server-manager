import { test, describe, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { rm, mkdir, writeFile, readFile, readdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID, createHash } from 'node:crypto';

// Domain
import { ConfigSnapshot } from '../src/domain/entities/ConfigSnapshot.js';
import { ConfigSnapshotSchedule } from '../src/domain/entities/ConfigSnapshotSchedule.js';
import { ConfigSnapshotFile } from '../src/domain/value-objects/ConfigSnapshotFile.js';
import { FileDiff } from '../src/domain/value-objects/FileDiff.js';
import { SnapshotDiff } from '../src/domain/value-objects/SnapshotDiff.js';
import { ServerName } from '../src/domain/value-objects/ServerName.js';

// Infrastructure
import { ConfigSnapshotDatabase } from '../src/infrastructure/adapters/ConfigSnapshotDatabase.js';
import { SqliteConfigSnapshotRepository } from '../src/infrastructure/adapters/SqliteConfigSnapshotRepository.js';
import { SqliteConfigSnapshotScheduleRepository } from '../src/infrastructure/adapters/SqliteConfigSnapshotScheduleRepository.js';
import { FileSystemConfigSnapshotStorage } from '../src/infrastructure/adapters/FileSystemConfigSnapshotStorage.js';
import { FileSystemConfigFileCollector } from '../src/infrastructure/adapters/FileSystemConfigFileCollector.js';

// Use Cases
import { ConfigSnapshotUseCaseImpl } from '../src/application/use-cases/ConfigSnapshotUseCase.js';
import { ConfigSnapshotScheduleUseCaseImpl } from '../src/application/use-cases/ConfigSnapshotScheduleUseCase.js';

// Ports
import type { IConfigSnapshotRepository } from '../src/application/ports/outbound/IConfigSnapshotRepository.js';
import type { IConfigSnapshotScheduleRepository } from '../src/application/ports/outbound/IConfigSnapshotScheduleRepository.js';
import type { IConfigSnapshotStorage } from '../src/application/ports/outbound/IConfigSnapshotStorage.js';
import type { IConfigFileCollector } from '../src/application/ports/outbound/IConfigFileCollector.js';

// ==========================================
// ConfigSnapshotDatabase Tests
// ==========================================
describe('ConfigSnapshotDatabase', () => {
  let testDir: string;

  before(async () => {
    testDir = join(tmpdir(), `config-snapshot-db-test-${randomUUID()}`);
    await mkdir(testDir, { recursive: true });
  });

  after(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  test('should initialize database with all tables', () => {
    const dbPath = join(testDir, 'test-init.db');
    const database = new ConfigSnapshotDatabase(dbPath);

    const db = database.getDatabase();

    // Check config_snapshots table
    const snapshotsTable = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='config_snapshots'")
      .get() as { name: string } | undefined;
    assert.strictEqual(snapshotsTable?.name, 'config_snapshots');

    // Check config_snapshot_files table
    const filesTable = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='config_snapshot_files'")
      .get() as { name: string } | undefined;
    assert.strictEqual(filesTable?.name, 'config_snapshot_files');

    // Check config_snapshot_schedules table
    const schedulesTable = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='config_snapshot_schedules'")
      .get() as { name: string } | undefined;
    assert.strictEqual(schedulesTable?.name, 'config_snapshot_schedules');

    database.close();
  });

  test('should create indexes', () => {
    const dbPath = join(testDir, 'test-indexes.db');
    const database = new ConfigSnapshotDatabase(dbPath);

    const db = database.getDatabase();

    const indexes = db
      .prepare("SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%'")
      .all() as { name: string }[];

    const indexNames = indexes.map((i) => i.name);
    assert.ok(indexNames.includes('idx_config_snapshots_server'));
    assert.ok(indexNames.includes('idx_config_snapshots_created'));
    assert.ok(indexNames.includes('idx_snapshot_files_snapshot'));
    assert.ok(indexNames.includes('idx_schedules_server'));
    assert.ok(indexNames.includes('idx_schedules_enabled'));

    database.close();
  });

  test('should enable WAL mode', () => {
    const dbPath = join(testDir, 'test-wal.db');
    const database = new ConfigSnapshotDatabase(dbPath);

    const db = database.getDatabase();
    const result = db.pragma('journal_mode') as { journal_mode: string }[];
    assert.strictEqual(result[0]?.journal_mode, 'wal');

    database.close();
  });

  test('should enable foreign keys', () => {
    const dbPath = join(testDir, 'test-fk.db');
    const database = new ConfigSnapshotDatabase(dbPath);

    const db = database.getDatabase();
    const result = db.pragma('foreign_keys') as { foreign_keys: number }[];
    assert.strictEqual(result[0]?.foreign_keys, 1);

    database.close();
  });

  test('should create directory if not exists', () => {
    const nestedDir = join(testDir, 'nested', 'deep');
    const dbPath = join(nestedDir, 'test.db');
    const database = new ConfigSnapshotDatabase(dbPath);

    assert.ok(existsSync(nestedDir));

    database.close();
  });

  test('should be idempotent on multiple calls', () => {
    const dbPath = join(testDir, 'test-idempotent.db');
    const db1 = new ConfigSnapshotDatabase(dbPath);
    db1.close();

    const db2 = new ConfigSnapshotDatabase(dbPath);
    db2.close();
    // No error means idempotent
  });

  test('should support in-memory database', () => {
    const database = new ConfigSnapshotDatabase(':memory:');
    const db = database.getDatabase();

    const snapshotsTable = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='config_snapshots'")
      .get() as { name: string } | undefined;
    assert.strictEqual(snapshotsTable?.name, 'config_snapshots');

    database.close();
  });
});

// ==========================================
// SqliteConfigSnapshotRepository Tests
// ==========================================
describe('SqliteConfigSnapshotRepository', () => {
  let database: ConfigSnapshotDatabase;
  let repo: SqliteConfigSnapshotRepository;
  const validHash = 'a'.repeat(64);
  const hashB = 'b'.repeat(64);

  beforeEach(() => {
    database = new ConfigSnapshotDatabase(':memory:');
    repo = new SqliteConfigSnapshotRepository(database);
  });

  afterEach(() => {
    database.close();
  });

  test('should save and find a snapshot by ID', async () => {
    const serverName = ServerName.create('myserver');
    const files = [
      ConfigSnapshotFile.create({ path: 'server.properties', hash: validHash, size: 1024 }),
      ConfigSnapshotFile.create({ path: 'config.env', hash: hashB, size: 512 }),
    ];
    const snapshot = ConfigSnapshot.create(serverName, files, 'Test snapshot');

    await repo.save(snapshot);
    const found = await repo.findById(snapshot.id);

    assert.ok(found);
    assert.strictEqual(found.id, snapshot.id);
    assert.strictEqual(found.serverName.value, 'myserver');
    assert.strictEqual(found.description, 'Test snapshot');
    assert.strictEqual(found.files.length, 2);
    assert.strictEqual(found.files[0]!.path, 'server.properties');
    assert.strictEqual(found.files[0]!.hash, validHash);
    assert.strictEqual(found.files[0]!.size, 1024);
    assert.strictEqual(found.files[1]!.path, 'config.env');
  });

  test('should return null for non-existent snapshot', async () => {
    const found = await repo.findById('non-existent-id');
    assert.strictEqual(found, null);
  });

  test('should save snapshot with no files', async () => {
    const serverName = ServerName.create('emptyserver');
    const snapshot = ConfigSnapshot.create(serverName, [], 'Empty snapshot');

    await repo.save(snapshot);
    const found = await repo.findById(snapshot.id);

    assert.ok(found);
    assert.strictEqual(found.files.length, 0);
  });

  test('should save snapshot with scheduleId', async () => {
    // First create a schedule to satisfy FK
    const scheduleRepo = new SqliteConfigSnapshotScheduleRepository(database);
    const schedule = ConfigSnapshotSchedule.create({
      serverName: ServerName.create('myserver'),
      name: 'Test Schedule',
      cronExpression: '0 * * * *',
    });
    await scheduleRepo.save(schedule);

    const serverName = ServerName.create('myserver');
    const files = [ConfigSnapshotFile.create({ path: 'config.env', hash: validHash, size: 100 })];
    const snapshot = ConfigSnapshot.create(serverName, files, 'Scheduled', schedule.id);

    await repo.save(snapshot);
    const found = await repo.findById(snapshot.id);

    assert.ok(found);
    assert.strictEqual(found.scheduleId, schedule.id);
  });

  test('should find snapshots by server name', async () => {
    const serverA = ServerName.create('servera');
    const serverB = ServerName.create('serverb');

    const snap1 = ConfigSnapshot.create(serverA, [], 'A1');
    const snap2 = ConfigSnapshot.create(serverA, [], 'A2');
    const snap3 = ConfigSnapshot.create(serverB, [], 'B1');

    await repo.save(snap1);
    await repo.save(snap2);
    await repo.save(snap3);

    const serverASnapshots = await repo.findByServer('servera');
    assert.strictEqual(serverASnapshots.length, 2);

    const serverBSnapshots = await repo.findByServer('serverb');
    assert.strictEqual(serverBSnapshots.length, 1);
  });

  test('should support pagination in findByServer', async () => {
    const serverName = ServerName.create('pagserver');

    for (let i = 0; i < 5; i++) {
      const snap = ConfigSnapshot.create(serverName, [], `Snap ${i}`);
      await repo.save(snap);
    }

    const page1 = await repo.findByServer('pagserver', 2, 0);
    assert.strictEqual(page1.length, 2);

    const page2 = await repo.findByServer('pagserver', 2, 2);
    assert.strictEqual(page2.length, 2);

    const page3 = await repo.findByServer('pagserver', 2, 4);
    assert.strictEqual(page3.length, 1);
  });

  test('should count snapshots by server', async () => {
    const serverName = ServerName.create('countserver');

    assert.strictEqual(await repo.countByServer('countserver'), 0);

    const snap1 = ConfigSnapshot.create(serverName, [], 'C1');
    const snap2 = ConfigSnapshot.create(serverName, [], 'C2');
    await repo.save(snap1);
    await repo.save(snap2);

    assert.strictEqual(await repo.countByServer('countserver'), 2);
  });

  test('should delete a snapshot by ID', async () => {
    const serverName = ServerName.create('delserver');
    const files = [ConfigSnapshotFile.create({ path: 'test.txt', hash: validHash, size: 10 })];
    const snapshot = ConfigSnapshot.create(serverName, files, 'To delete');

    await repo.save(snapshot);
    assert.ok(await repo.findById(snapshot.id));

    await repo.delete(snapshot.id);
    assert.strictEqual(await repo.findById(snapshot.id), null);
  });

  test('should cascade delete files when snapshot is deleted', async () => {
    const serverName = ServerName.create('cascadeserver');
    const files = [
      ConfigSnapshotFile.create({ path: 'a.txt', hash: validHash, size: 10 }),
      ConfigSnapshotFile.create({ path: 'b.txt', hash: hashB, size: 20 }),
    ];
    const snapshot = ConfigSnapshot.create(serverName, files, 'Cascade test');

    await repo.save(snapshot);
    await repo.delete(snapshot.id);

    // Files should be gone too (CASCADE)
    const db = database.getDatabase();
    const fileCount = db.prepare('SELECT COUNT(*) as count FROM config_snapshot_files WHERE snapshot_id = ?').get(snapshot.id) as { count: number };
    assert.strictEqual(fileCount.count, 0);
  });

  test('should delete all snapshots by server', async () => {
    const serverName = ServerName.create('delallserver');

    const snap1 = ConfigSnapshot.create(serverName, [], 'DA1');
    const snap2 = ConfigSnapshot.create(serverName, [], 'DA2');
    await repo.save(snap1);
    await repo.save(snap2);

    assert.strictEqual(await repo.countByServer('delallserver'), 2);

    await repo.deleteByServer('delallserver');
    assert.strictEqual(await repo.countByServer('delallserver'), 0);
  });

  test('should order findByServer by createdAt DESC', async () => {
    const serverName = ServerName.create('orderserver');

    // Create snapshots with different dates
    const oldDate = new Date('2025-01-01T00:00:00.000Z');
    const newDate = new Date('2025-06-01T00:00:00.000Z');

    const oldSnap = ConfigSnapshot.fromData({
      id: randomUUID(),
      serverName,
      createdAt: oldDate,
      description: 'Old',
      files: [],
    });
    const newSnap = ConfigSnapshot.fromData({
      id: randomUUID(),
      serverName,
      createdAt: newDate,
      description: 'New',
      files: [],
    });

    // Save old first, then new
    await repo.save(oldSnap);
    await repo.save(newSnap);

    const results = await repo.findByServer('orderserver');
    assert.strictEqual(results[0]!.description, 'New');
    assert.strictEqual(results[1]!.description, 'Old');
  });
});

// ==========================================
// SqliteConfigSnapshotScheduleRepository Tests
// ==========================================
describe('SqliteConfigSnapshotScheduleRepository', () => {
  let database: ConfigSnapshotDatabase;
  let repo: SqliteConfigSnapshotScheduleRepository;

  beforeEach(() => {
    database = new ConfigSnapshotDatabase(':memory:');
    repo = new SqliteConfigSnapshotScheduleRepository(database);
  });

  afterEach(() => {
    database.close();
  });

  test('should save and find a schedule by ID', async () => {
    const schedule = ConfigSnapshotSchedule.create({
      serverName: ServerName.create('myserver'),
      name: 'Hourly Backup',
      cronExpression: '0 * * * *',
      retentionCount: 24,
    });

    await repo.save(schedule);
    const found = await repo.findById(schedule.id);

    assert.ok(found);
    assert.strictEqual(found.id, schedule.id);
    assert.strictEqual(found.serverName.value, 'myserver');
    assert.strictEqual(found.name, 'Hourly Backup');
    assert.strictEqual(found.cronExpression.expression, '0 * * * *');
    assert.strictEqual(found.retentionCount, 24);
    assert.strictEqual(found.enabled, true);
  });

  test('should return null for non-existent schedule', async () => {
    const found = await repo.findById('non-existent-id');
    assert.strictEqual(found, null);
  });

  test('should find schedules by server name', async () => {
    const scheduleA = ConfigSnapshotSchedule.create({
      serverName: ServerName.create('servera'),
      name: 'Schedule A',
      cronExpression: '0 * * * *',
    });
    const scheduleB = ConfigSnapshotSchedule.create({
      serverName: ServerName.create('serverb'),
      name: 'Schedule B',
      cronExpression: '0 3 * * *',
    });

    await repo.save(scheduleA);
    await repo.save(scheduleB);

    const serverASchedules = await repo.findByServer('servera');
    assert.strictEqual(serverASchedules.length, 1);
    assert.strictEqual(serverASchedules[0]!.name, 'Schedule A');
  });

  test('should find all enabled schedules', async () => {
    const enabled = ConfigSnapshotSchedule.create({
      serverName: ServerName.create('myserver'),
      name: 'Enabled',
      cronExpression: '0 * * * *',
      enabled: true,
    });
    const disabled = ConfigSnapshotSchedule.create({
      serverName: ServerName.create('myserver'),
      name: 'Disabled',
      cronExpression: '0 3 * * *',
      enabled: false,
    });

    await repo.save(enabled);
    await repo.save(disabled);

    const enabledSchedules = await repo.findAllEnabled();
    assert.strictEqual(enabledSchedules.length, 1);
    assert.strictEqual(enabledSchedules[0]!.name, 'Enabled');
  });

  test('should update a schedule', async () => {
    const schedule = ConfigSnapshotSchedule.create({
      serverName: ServerName.create('myserver'),
      name: 'Original',
      cronExpression: '0 * * * *',
    });

    await repo.save(schedule);

    const disabled = schedule.disable();
    await repo.update(disabled);

    const found = await repo.findById(schedule.id);
    assert.ok(found);
    assert.strictEqual(found.enabled, false);
  });

  test('should update schedule with recordRun', async () => {
    const schedule = ConfigSnapshotSchedule.create({
      serverName: ServerName.create('myserver'),
      name: 'Run Test',
      cronExpression: '0 * * * *',
    });

    await repo.save(schedule);

    const updated = schedule.recordRun('success');
    await repo.update(updated);

    const found = await repo.findById(schedule.id);
    assert.ok(found);
    assert.strictEqual(found.lastRunStatus, 'success');
    assert.ok(found.lastRunAt instanceof Date);
  });

  test('should delete a schedule', async () => {
    const schedule = ConfigSnapshotSchedule.create({
      serverName: ServerName.create('myserver'),
      name: 'To Delete',
      cronExpression: '0 * * * *',
    });

    await repo.save(schedule);
    assert.ok(await repo.findById(schedule.id));

    await repo.delete(schedule.id);
    assert.strictEqual(await repo.findById(schedule.id), null);
  });

  test('should SET NULL on snapshot.schedule_id when schedule is deleted', async () => {
    const schedule = ConfigSnapshotSchedule.create({
      serverName: ServerName.create('myserver'),
      name: 'FK Test',
      cronExpression: '0 * * * *',
    });
    await repo.save(schedule);

    // Create a snapshot with this schedule
    const snapshotRepo = new SqliteConfigSnapshotRepository(database);
    const snapshot = ConfigSnapshot.create(
      ServerName.create('myserver'),
      [],
      'FK test snapshot',
      schedule.id
    );
    await snapshotRepo.save(snapshot);

    // Delete the schedule
    await repo.delete(schedule.id);

    // Snapshot should still exist but with null schedule_id
    const found = await snapshotRepo.findById(snapshot.id);
    assert.ok(found);
    assert.strictEqual(found.scheduleId, undefined);
  });
});

// ==========================================
// FileSystemConfigSnapshotStorage Tests
// ==========================================
describe('FileSystemConfigSnapshotStorage', () => {
  let testDir: string;
  let storage: FileSystemConfigSnapshotStorage;

  beforeEach(async () => {
    testDir = join(tmpdir(), `config-snapshot-storage-test-${randomUUID()}`);
    await mkdir(testDir, { recursive: true });
    storage = new FileSystemConfigSnapshotStorage(testDir);
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  test('should store and retrieve files', async () => {
    const files = new Map<string, string>();
    files.set('server.properties', 'server-port=25565\ndifficulty=hard');
    files.set('config.env', 'TYPE=PAPER\nVERSION=1.21.1');

    await storage.store('snap-1', 'myserver', files);

    const retrieved = await storage.retrieve('snap-1', 'myserver');
    assert.strictEqual(retrieved.size, 2);
    assert.strictEqual(retrieved.get('server.properties'), 'server-port=25565\ndifficulty=hard');
    assert.strictEqual(retrieved.get('config.env'), 'TYPE=PAPER\nVERSION=1.21.1');
  });

  test('should store files in correct directory structure', async () => {
    const files = new Map<string, string>();
    files.set('test.txt', 'hello');

    await storage.store('snap-1', 'myserver', files);

    const filePath = join(testDir, 'myserver', 'snap-1', 'test.txt');
    assert.ok(existsSync(filePath));
    const content = await readFile(filePath, 'utf-8');
    assert.strictEqual(content, 'hello');
  });

  test('should delete stored files', async () => {
    const files = new Map<string, string>();
    files.set('test.txt', 'hello');

    await storage.store('snap-1', 'myserver', files);
    assert.ok(existsSync(join(testDir, 'myserver', 'snap-1')));

    await storage.delete('snap-1', 'myserver');
    assert.ok(!existsSync(join(testDir, 'myserver', 'snap-1')));
  });

  test('should handle empty file map', async () => {
    const files = new Map<string, string>();

    await storage.store('snap-empty', 'myserver', files);
    const retrieved = await storage.retrieve('snap-empty', 'myserver');
    assert.strictEqual(retrieved.size, 0);
  });

  test('should return empty map for non-existent snapshot', async () => {
    const retrieved = await storage.retrieve('non-existent', 'myserver');
    assert.strictEqual(retrieved.size, 0);
  });

  test('should not throw when deleting non-existent snapshot', async () => {
    await storage.delete('non-existent', 'myserver');
    // Should not throw
  });

  test('should handle nested path files', async () => {
    const files = new Map<string, string>();
    files.set('plugins/config.yml', 'key: value');

    await storage.store('snap-nested', 'myserver', files);

    const retrieved = await storage.retrieve('snap-nested', 'myserver');
    assert.strictEqual(retrieved.get('plugins/config.yml'), 'key: value');
  });
});

// ==========================================
// FileSystemConfigFileCollector Tests
// ==========================================
describe('FileSystemConfigFileCollector', () => {
  let testDir: string;
  let serversDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `config-collector-test-${randomUUID()}`);
    serversDir = join(testDir, 'servers');
    await mkdir(serversDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  test('should collect known config files', async () => {
    const serverDir = join(serversDir, 'myserver');
    await mkdir(serverDir, { recursive: true });

    await writeFile(join(serverDir, 'server.properties'), 'server-port=25565');
    await writeFile(join(serverDir, 'config.env'), 'TYPE=PAPER');
    await writeFile(join(serverDir, 'docker-compose.yml'), 'version: "3"');

    const collector = new FileSystemConfigFileCollector(serversDir);
    const files = await collector.collectFiles('myserver');

    assert.strictEqual(files.length, 3);
    const paths = files.map((f) => f.path);
    assert.ok(paths.includes('server.properties'));
    assert.ok(paths.includes('config.env'));
    assert.ok(paths.includes('docker-compose.yml'));
  });

  test('should compute SHA-256 hashes', async () => {
    const serverDir = join(serversDir, 'hashserver');
    await mkdir(serverDir, { recursive: true });

    const content = 'server-port=25565';
    await writeFile(join(serverDir, 'server.properties'), content);

    const expectedHash = createHash('sha256').update(content).digest('hex');

    const collector = new FileSystemConfigFileCollector(serversDir);
    const files = await collector.collectFiles('hashserver');

    assert.strictEqual(files.length, 1);
    assert.strictEqual(files[0]!.hash, expectedHash);
  });

  test('should report correct file sizes', async () => {
    const serverDir = join(serversDir, 'sizeserver');
    await mkdir(serverDir, { recursive: true });

    const content = 'hello world';
    await writeFile(join(serverDir, 'server.properties'), content);

    const collector = new FileSystemConfigFileCollector(serversDir);
    const files = await collector.collectFiles('sizeserver');

    assert.strictEqual(files[0]!.size, Buffer.byteLength(content));
  });

  test('should skip files larger than 1MB', async () => {
    const serverDir = join(serversDir, 'largeserver');
    await mkdir(serverDir, { recursive: true });

    await writeFile(join(serverDir, 'server.properties'), 'small content');
    // Create a large file > 1MB
    const largeContent = 'x'.repeat(1024 * 1024 + 1);
    await writeFile(join(serverDir, 'ops.json'), largeContent);

    const collector = new FileSystemConfigFileCollector(serversDir);
    const files = await collector.collectFiles('largeserver');

    const paths = files.map((f) => f.path);
    assert.ok(paths.includes('server.properties'));
    assert.ok(!paths.includes('ops.json'));
  });

  test('should skip non-existent optional files', async () => {
    const serverDir = join(serversDir, 'sparseserver');
    await mkdir(serverDir, { recursive: true });

    await writeFile(join(serverDir, 'server.properties'), 'content');
    // bukkit.yml, spigot.yml, etc. do not exist

    const collector = new FileSystemConfigFileCollector(serversDir);
    const files = await collector.collectFiles('sparseserver');

    assert.strictEqual(files.length, 1);
    assert.strictEqual(files[0]!.path, 'server.properties');
  });

  test('should read file content', async () => {
    const serverDir = join(serversDir, 'readserver');
    await mkdir(serverDir, { recursive: true });

    await writeFile(join(serverDir, 'server.properties'), 'server-port=25565');

    const collector = new FileSystemConfigFileCollector(serversDir);
    const content = await collector.readFileContent('readserver', 'server.properties');

    assert.strictEqual(content, 'server-port=25565');
  });

  test('should throw on non-existent file for readFileContent', async () => {
    const serverDir = join(serversDir, 'nofileserver');
    await mkdir(serverDir, { recursive: true });

    const collector = new FileSystemConfigFileCollector(serversDir);

    await assert.rejects(
      () => collector.readFileContent('nofileserver', 'missing.txt'),
      /ENOENT/
    );
  });

  test('should collect additional yml and json files', async () => {
    const serverDir = join(serversDir, 'extraserver');
    await mkdir(serverDir, { recursive: true });

    await writeFile(join(serverDir, 'server.properties'), 'content');
    await writeFile(join(serverDir, 'custom.yml'), 'custom: true');
    await writeFile(join(serverDir, 'data.json'), '{"key":"value"}');

    const collector = new FileSystemConfigFileCollector(serversDir);
    const files = await collector.collectFiles('extraserver');

    const paths = files.map((f) => f.path);
    assert.ok(paths.includes('custom.yml'));
    assert.ok(paths.includes('data.json'));
  });

  test('should not collect non-config files', async () => {
    const serverDir = join(serversDir, 'filterserver');
    await mkdir(serverDir, { recursive: true });

    await writeFile(join(serverDir, 'server.properties'), 'content');
    await writeFile(join(serverDir, 'world.dat'), 'binary data');
    await writeFile(join(serverDir, 'notes.txt'), 'some text');

    const collector = new FileSystemConfigFileCollector(serversDir);
    const files = await collector.collectFiles('filterserver');

    const paths = files.map((f) => f.path);
    assert.ok(paths.includes('server.properties'));
    assert.ok(!paths.includes('world.dat'));
    assert.ok(!paths.includes('notes.txt'));
  });
});

// ==========================================
// ConfigSnapshotUseCaseImpl Tests
// ==========================================
describe('ConfigSnapshotUseCaseImpl', () => {
  // Mock implementations
  class MockConfigSnapshotRepository implements IConfigSnapshotRepository {
    private snapshots: Map<string, ConfigSnapshot> = new Map();

    async save(snapshot: ConfigSnapshot): Promise<void> {
      this.snapshots.set(snapshot.id, snapshot);
    }

    async findById(id: string): Promise<ConfigSnapshot | null> {
      return this.snapshots.get(id) ?? null;
    }

    async findByServer(serverName: string, limit?: number, offset?: number): Promise<ConfigSnapshot[]> {
      const results = Array.from(this.snapshots.values())
        .filter((s) => s.serverName.value === serverName)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

      const start = offset ?? 0;
      const end = limit ? start + limit : undefined;
      return results.slice(start, end);
    }

    async countByServer(serverName: string): Promise<number> {
      return Array.from(this.snapshots.values()).filter(
        (s) => s.serverName.value === serverName
      ).length;
    }

    async delete(id: string): Promise<void> {
      this.snapshots.delete(id);
    }

    async deleteByServer(serverName: string): Promise<void> {
      for (const [id, snap] of this.snapshots) {
        if (snap.serverName.value === serverName) {
          this.snapshots.delete(id);
        }
      }
    }
  }

  class MockConfigSnapshotStorage implements IConfigSnapshotStorage {
    private storage: Map<string, Map<string, string>> = new Map();

    async store(snapshotId: string, serverName: string, files: Map<string, string>): Promise<void> {
      this.storage.set(`${serverName}/${snapshotId}`, files);
    }

    async retrieve(snapshotId: string, serverName: string): Promise<Map<string, string>> {
      return this.storage.get(`${serverName}/${snapshotId}`) ?? new Map();
    }

    async delete(snapshotId: string, serverName: string): Promise<void> {
      this.storage.delete(`${serverName}/${snapshotId}`);
    }
  }

  class MockConfigFileCollector implements IConfigFileCollector {
    private files: Map<string, { hash: string; content: string; size: number }> = new Map();

    addFile(path: string, content: string): void {
      const hash = createHash('sha256').update(content).digest('hex');
      this.files.set(path, { hash, content, size: Buffer.byteLength(content) });
    }

    async collectFiles(_serverName: string): Promise<ConfigSnapshotFile[]> {
      return Array.from(this.files.entries()).map(([path, data]) =>
        ConfigSnapshotFile.create({ path, hash: data.hash, size: data.size })
      );
    }

    async readFileContent(_serverName: string, filePath: string): Promise<string> {
      const file = this.files.get(filePath);
      if (!file) throw new Error(`File not found: ${filePath}`);
      return file.content;
    }
  }

  test('should create a snapshot', async () => {
    const repo = new MockConfigSnapshotRepository();
    const storageAdapter = new MockConfigSnapshotStorage();
    const collector = new MockConfigFileCollector();

    collector.addFile('server.properties', 'server-port=25565');
    collector.addFile('config.env', 'TYPE=PAPER');

    const useCase = new ConfigSnapshotUseCaseImpl(repo, storageAdapter, collector);
    const snapshot = await useCase.create('myserver', 'Test snapshot');

    assert.ok(snapshot.id);
    assert.strictEqual(snapshot.serverName.value, 'myserver');
    assert.strictEqual(snapshot.description, 'Test snapshot');
    assert.strictEqual(snapshot.files.length, 2);

    // Verify stored in repo
    const found = await repo.findById(snapshot.id);
    assert.ok(found);
  });

  test('should list snapshots', async () => {
    const repo = new MockConfigSnapshotRepository();
    const storageAdapter = new MockConfigSnapshotStorage();
    const collector = new MockConfigFileCollector();
    collector.addFile('test.txt', 'content');

    const useCase = new ConfigSnapshotUseCaseImpl(repo, storageAdapter, collector);

    await useCase.create('myserver', 'Snap 1');
    await useCase.create('myserver', 'Snap 2');

    const list = await useCase.list('myserver');
    assert.strictEqual(list.length, 2);
  });

  test('should find snapshot by ID', async () => {
    const repo = new MockConfigSnapshotRepository();
    const storageAdapter = new MockConfigSnapshotStorage();
    const collector = new MockConfigFileCollector();
    collector.addFile('test.txt', 'content');

    const useCase = new ConfigSnapshotUseCaseImpl(repo, storageAdapter, collector);
    const created = await useCase.create('myserver');

    const found = await useCase.findById(created.id);
    assert.ok(found);
    assert.strictEqual(found.id, created.id);
  });

  test('should compute diff between two snapshots', async () => {
    const repo = new MockConfigSnapshotRepository();
    const storageAdapter = new MockConfigSnapshotStorage();
    const collector1 = new MockConfigFileCollector();

    // Snapshot 1: file A and B
    collector1.addFile('server.properties', 'port=25565');
    collector1.addFile('config.env', 'TYPE=PAPER');
    const useCase1 = new ConfigSnapshotUseCaseImpl(repo, storageAdapter, collector1);
    const snap1 = await useCase1.create('myserver', 'Before');

    // Snapshot 2: file A modified, B deleted, C added
    const collector2 = new MockConfigFileCollector();
    collector2.addFile('server.properties', 'port=25566');
    collector2.addFile('new-file.yml', 'key: value');
    const useCase2 = new ConfigSnapshotUseCaseImpl(repo, storageAdapter, collector2);
    const snap2 = await useCase2.create('myserver', 'After');

    const diff = await useCase1.diff(snap1.id, snap2.id);

    assert.ok(diff.hasChanges);
    const summary = diff.summary;
    assert.ok(summary.added >= 1); // new-file.yml
    assert.ok(summary.modified >= 1); // server.properties
    assert.ok(summary.deleted >= 1); // config.env
  });

  test('should delete a snapshot', async () => {
    const repo = new MockConfigSnapshotRepository();
    const storageAdapter = new MockConfigSnapshotStorage();
    const collector = new MockConfigFileCollector();
    collector.addFile('test.txt', 'content');

    const useCase = new ConfigSnapshotUseCaseImpl(repo, storageAdapter, collector);
    const snapshot = await useCase.create('myserver');

    await useCase.delete(snapshot.id);

    const found = await repo.findById(snapshot.id);
    assert.strictEqual(found, null);
  });
});

// ==========================================
// ConfigSnapshotScheduleUseCaseImpl Tests
// ==========================================
describe('ConfigSnapshotScheduleUseCaseImpl', () => {
  class MockScheduleRepository implements IConfigSnapshotScheduleRepository {
    private schedules: Map<string, ConfigSnapshotSchedule> = new Map();

    async save(schedule: ConfigSnapshotSchedule): Promise<void> {
      this.schedules.set(schedule.id, schedule);
    }

    async findById(id: string): Promise<ConfigSnapshotSchedule | null> {
      return this.schedules.get(id) ?? null;
    }

    async findByServer(serverName: string): Promise<ConfigSnapshotSchedule[]> {
      return Array.from(this.schedules.values()).filter(
        (s) => s.serverName.value === serverName
      );
    }

    async findAllEnabled(): Promise<ConfigSnapshotSchedule[]> {
      return Array.from(this.schedules.values()).filter((s) => s.enabled);
    }

    async update(schedule: ConfigSnapshotSchedule): Promise<void> {
      this.schedules.set(schedule.id, schedule);
    }

    async delete(id: string): Promise<void> {
      this.schedules.delete(id);
    }
  }

  test('should create a schedule', async () => {
    const repo = new MockScheduleRepository();
    const useCase = new ConfigSnapshotScheduleUseCaseImpl(repo);

    const schedule = await useCase.create('myserver', 'Hourly', '0 * * * *', 24);

    assert.ok(schedule.id);
    assert.strictEqual(schedule.serverName.value, 'myserver');
    assert.strictEqual(schedule.name, 'Hourly');
    assert.strictEqual(schedule.cronExpression.expression, '0 * * * *');
    assert.strictEqual(schedule.retentionCount, 24);
    assert.strictEqual(schedule.enabled, true);
  });

  test('should update a schedule', async () => {
    const repo = new MockScheduleRepository();
    const useCase = new ConfigSnapshotScheduleUseCaseImpl(repo);

    const schedule = await useCase.create('myserver', 'Original', '0 * * * *');
    const updated = await useCase.update(schedule.id, { name: 'Updated Name' });

    assert.strictEqual(updated.name, 'Updated Name');
    assert.strictEqual(updated.id, schedule.id);
  });

  test('should throw when updating non-existent schedule', async () => {
    const repo = new MockScheduleRepository();
    const useCase = new ConfigSnapshotScheduleUseCaseImpl(repo);

    await assert.rejects(
      () => useCase.update('non-existent', { name: 'New Name' }),
      /not found/i
    );
  });

  test('should enable a schedule', async () => {
    const repo = new MockScheduleRepository();
    const useCase = new ConfigSnapshotScheduleUseCaseImpl(repo);

    const schedule = await useCase.create('myserver', 'Test', '0 * * * *');
    await useCase.disable(schedule.id);
    await useCase.enable(schedule.id);

    const found = await repo.findById(schedule.id);
    assert.ok(found);
    assert.strictEqual(found.enabled, true);
  });

  test('should disable a schedule', async () => {
    const repo = new MockScheduleRepository();
    const useCase = new ConfigSnapshotScheduleUseCaseImpl(repo);

    const schedule = await useCase.create('myserver', 'Test', '0 * * * *');
    await useCase.disable(schedule.id);

    const found = await repo.findById(schedule.id);
    assert.ok(found);
    assert.strictEqual(found.enabled, false);
  });

  test('should delete a schedule', async () => {
    const repo = new MockScheduleRepository();
    const useCase = new ConfigSnapshotScheduleUseCaseImpl(repo);

    const schedule = await useCase.create('myserver', 'Test', '0 * * * *');
    await useCase.delete(schedule.id);

    const found = await repo.findById(schedule.id);
    assert.strictEqual(found, null);
  });

  test('should find all schedules', async () => {
    const repo = new MockScheduleRepository();
    const useCase = new ConfigSnapshotScheduleUseCaseImpl(repo);

    await useCase.create('servera', 'Schedule A', '0 * * * *');
    await useCase.create('serverb', 'Schedule B', '0 3 * * *');

    const all = await useCase.findAll();
    assert.strictEqual(all.length, 2);
  });

  test('should find schedules by server', async () => {
    const repo = new MockScheduleRepository();
    const useCase = new ConfigSnapshotScheduleUseCaseImpl(repo);

    await useCase.create('servera', 'Schedule A', '0 * * * *');
    await useCase.create('serverb', 'Schedule B', '0 3 * * *');

    const serverA = await useCase.findByServer('servera');
    assert.strictEqual(serverA.length, 1);
    assert.strictEqual(serverA[0]!.name, 'Schedule A');
  });
});
