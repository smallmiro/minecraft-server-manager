import { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
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

  beforeAll(async () => {
    testDir = join(tmpdir(), `config-snapshot-db-test-${randomUUID()}`);
    await mkdir(testDir, { recursive: true });
  });

  afterAll(async () => {
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
    expect(snapshotsTable?.name).toBe('config_snapshots');

    // Check config_snapshot_files table
    const filesTable = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='config_snapshot_files'")
      .get() as { name: string } | undefined;
    expect(filesTable?.name).toBe('config_snapshot_files');

    // Check config_snapshot_schedules table
    const schedulesTable = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='config_snapshot_schedules'")
      .get() as { name: string } | undefined;
    expect(schedulesTable?.name).toBe('config_snapshot_schedules');

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
    expect(indexNames.includes('idx_config_snapshots_server')).toBeTruthy();
    expect(indexNames.includes('idx_config_snapshots_created')).toBeTruthy();
    expect(indexNames.includes('idx_snapshot_files_snapshot')).toBeTruthy();
    expect(indexNames.includes('idx_schedules_server')).toBeTruthy();
    expect(indexNames.includes('idx_schedules_enabled')).toBeTruthy();

    database.close();
  });

  test('should enable WAL mode', () => {
    const dbPath = join(testDir, 'test-wal.db');
    const database = new ConfigSnapshotDatabase(dbPath);

    const db = database.getDatabase();
    const result = db.pragma('journal_mode') as { journal_mode: string }[];
    expect(result[0]?.journal_mode).toBe('wal');

    database.close();
  });

  test('should enable foreign keys', () => {
    const dbPath = join(testDir, 'test-fk.db');
    const database = new ConfigSnapshotDatabase(dbPath);

    const db = database.getDatabase();
    const result = db.pragma('foreign_keys') as { foreign_keys: number }[];
    expect(result[0]?.foreign_keys).toBe(1);

    database.close();
  });

  test('should create directory if not exists', () => {
    const nestedDir = join(testDir, 'nested', 'deep');
    const dbPath = join(nestedDir, 'test.db');
    const database = new ConfigSnapshotDatabase(dbPath);

    expect(existsSync(nestedDir)).toBeTruthy();

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
    expect(snapshotsTable?.name).toBe('config_snapshots');

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

    expect(found).toBeTruthy();
    expect(found.id).toBe(snapshot.id);
    expect(found.serverName.value).toBe('myserver');
    expect(found.description).toBe('Test snapshot');
    expect(found.files.length).toBe(2);
    expect(found.files[0]!.path).toBe('server.properties');
    expect(found.files[0]!.hash).toBe(validHash);
    expect(found.files[0]!.size).toBe(1024);
    expect(found.files[1]!.path).toBe('config.env');
  });

  test('should return null for non-existent snapshot', async () => {
    const found = await repo.findById('non-existent-id');
    expect(found).toBe(null);
  });

  test('should save snapshot with no files', async () => {
    const serverName = ServerName.create('emptyserver');
    const snapshot = ConfigSnapshot.create(serverName, [], 'Empty snapshot');

    await repo.save(snapshot);
    const found = await repo.findById(snapshot.id);

    expect(found).toBeTruthy();
    expect(found.files.length).toBe(0);
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

    expect(found).toBeTruthy();
    expect(found.scheduleId).toBe(schedule.id);
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
    expect(serverASnapshots.length).toBe(2);

    const serverBSnapshots = await repo.findByServer('serverb');
    expect(serverBSnapshots.length).toBe(1);
  });

  test('should support pagination in findByServer', async () => {
    const serverName = ServerName.create('pagserver');

    for (let i = 0; i < 5; i++) {
      const snap = ConfigSnapshot.create(serverName, [], `Snap ${i}`);
      await repo.save(snap);
    }

    const page1 = await repo.findByServer('pagserver', 2, 0);
    expect(page1.length).toBe(2);

    const page2 = await repo.findByServer('pagserver', 2, 2);
    expect(page2.length).toBe(2);

    const page3 = await repo.findByServer('pagserver', 2, 4);
    expect(page3.length).toBe(1);
  });

  test('should count snapshots by server', async () => {
    const serverName = ServerName.create('countserver');

    expect(await repo.countByServer('countserver')).toBe(0);

    const snap1 = ConfigSnapshot.create(serverName, [], 'C1');
    const snap2 = ConfigSnapshot.create(serverName, [], 'C2');
    await repo.save(snap1);
    await repo.save(snap2);

    expect(await repo.countByServer('countserver')).toBe(2);
  });

  test('should delete a snapshot by ID', async () => {
    const serverName = ServerName.create('delserver');
    const files = [ConfigSnapshotFile.create({ path: 'test.txt', hash: validHash, size: 10 })];
    const snapshot = ConfigSnapshot.create(serverName, files, 'To delete');

    await repo.save(snapshot);
    expect(await repo.findById(snapshot.id)).toBeTruthy();

    await repo.delete(snapshot.id);
    expect(await repo.findById(snapshot.id)).toBe(null);
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
    expect(fileCount.count).toBe(0);
  });

  test('should delete all snapshots by server', async () => {
    const serverName = ServerName.create('delallserver');

    const snap1 = ConfigSnapshot.create(serverName, [], 'DA1');
    const snap2 = ConfigSnapshot.create(serverName, [], 'DA2');
    await repo.save(snap1);
    await repo.save(snap2);

    expect(await repo.countByServer('delallserver')).toBe(2);

    await repo.deleteByServer('delallserver');
    expect(await repo.countByServer('delallserver')).toBe(0);
  });

  test('should find all snapshots across servers', async () => {
    const serverA = ServerName.create('servera');
    const serverB = ServerName.create('serverb');

    const snap1 = ConfigSnapshot.create(serverA, [], 'A1');
    const snap2 = ConfigSnapshot.create(serverA, [], 'A2');
    const snap3 = ConfigSnapshot.create(serverB, [], 'B1');

    await repo.save(snap1);
    await repo.save(snap2);
    await repo.save(snap3);

    const all = await repo.findAll();
    expect(all.length).toBe(3);
  });

  test('should support pagination in findAll', async () => {
    const serverA = ServerName.create('servera');
    const serverB = ServerName.create('serverb');

    for (let i = 0; i < 3; i++) {
      await repo.save(ConfigSnapshot.create(serverA, [], `A${i}`));
    }
    for (let i = 0; i < 2; i++) {
      await repo.save(ConfigSnapshot.create(serverB, [], `B${i}`));
    }

    const page1 = await repo.findAll(3, 0);
    expect(page1.length).toBe(3);

    const page2 = await repo.findAll(3, 3);
    expect(page2.length).toBe(2);
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
    expect(results[0]!.description).toBe('New');
    expect(results[1]!.description).toBe('Old');
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

    expect(found).toBeTruthy();
    expect(found.id).toBe(schedule.id);
    expect(found.serverName.value).toBe('myserver');
    expect(found.name).toBe('Hourly Backup');
    expect(found.cronExpression.expression).toBe('0 * * * *');
    expect(found.retentionCount).toBe(24);
    expect(found.enabled).toBe(true);
  });

  test('should return null for non-existent schedule', async () => {
    const found = await repo.findById('non-existent-id');
    expect(found).toBe(null);
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
    expect(serverASchedules.length).toBe(1);
    expect(serverASchedules[0]!.name).toBe('Schedule A');
  });

  test('should find all schedules including disabled', async () => {
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

    const allSchedules = await repo.findAll();
    expect(allSchedules.length).toBe(2);

    const names = allSchedules.map((s) => s.name);
    expect(names.includes('Enabled')).toBeTruthy();
    expect(names.includes('Disabled')).toBeTruthy();
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
    expect(enabledSchedules.length).toBe(1);
    expect(enabledSchedules[0]!.name).toBe('Enabled');
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
    expect(found).toBeTruthy();
    expect(found.enabled).toBe(false);
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
    expect(found).toBeTruthy();
    expect(found.lastRunStatus).toBe('success');
    expect(found.lastRunAt instanceof Date).toBeTruthy();
  });

  test('should delete a schedule', async () => {
    const schedule = ConfigSnapshotSchedule.create({
      serverName: ServerName.create('myserver'),
      name: 'To Delete',
      cronExpression: '0 * * * *',
    });

    await repo.save(schedule);
    expect(await repo.findById(schedule.id)).toBeTruthy();

    await repo.delete(schedule.id);
    expect(await repo.findById(schedule.id)).toBe(null);
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
    expect(found).toBeTruthy();
    expect(found.scheduleId).toBe(undefined);
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
    expect(retrieved.size).toBe(2);
    expect(retrieved.get('server.properties')).toBe('server-port=25565\ndifficulty=hard');
    expect(retrieved.get('config.env')).toBe('TYPE=PAPER\nVERSION=1.21.1');
  });

  test('should store files in correct directory structure', async () => {
    const files = new Map<string, string>();
    files.set('test.txt', 'hello');

    await storage.store('snap-1', 'myserver', files);

    const filePath = join(testDir, 'myserver', 'snap-1', 'test.txt');
    expect(existsSync(filePath)).toBeTruthy();
    const content = await readFile(filePath, 'utf-8');
    expect(content).toBe('hello');
  });

  test('should delete stored files', async () => {
    const files = new Map<string, string>();
    files.set('test.txt', 'hello');

    await storage.store('snap-1', 'myserver', files);
    expect(existsSync(join(testDir, 'myserver', 'snap-1'))).toBeTruthy();

    await storage.delete('snap-1', 'myserver');
    expect(!existsSync(join(testDir, 'myserver', 'snap-1'))).toBeTruthy();
  });

  test('should handle empty file map', async () => {
    const files = new Map<string, string>();

    await storage.store('snap-empty', 'myserver', files);
    const retrieved = await storage.retrieve('snap-empty', 'myserver');
    expect(retrieved.size).toBe(0);
  });

  test('should return empty map for non-existent snapshot', async () => {
    const retrieved = await storage.retrieve('non-existent', 'myserver');
    expect(retrieved.size).toBe(0);
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
    expect(retrieved.get('plugins/config.yml')).toBe('key: value');
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

    expect(files.length).toBe(3);
    const paths = files.map((f) => f.path);
    expect(paths.includes('server.properties')).toBeTruthy();
    expect(paths.includes('config.env')).toBeTruthy();
    expect(paths.includes('docker-compose.yml')).toBeTruthy();
  });

  test('should compute SHA-256 hashes', async () => {
    const serverDir = join(serversDir, 'hashserver');
    await mkdir(serverDir, { recursive: true });

    const content = 'server-port=25565';
    await writeFile(join(serverDir, 'server.properties'), content);

    const expectedHash = createHash('sha256').update(content).digest('hex');

    const collector = new FileSystemConfigFileCollector(serversDir);
    const files = await collector.collectFiles('hashserver');

    expect(files.length).toBe(1);
    expect(files[0]!.hash).toBe(expectedHash);
  });

  test('should report correct file sizes', async () => {
    const serverDir = join(serversDir, 'sizeserver');
    await mkdir(serverDir, { recursive: true });

    const content = 'hello world';
    await writeFile(join(serverDir, 'server.properties'), content);

    const collector = new FileSystemConfigFileCollector(serversDir);
    const files = await collector.collectFiles('sizeserver');

    expect(files[0]!.size).toBe(Buffer.byteLength(content));
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
    expect(paths.includes('server.properties')).toBeTruthy();
    expect(!paths.includes('ops.json')).toBeTruthy();
  });

  test('should skip non-existent optional files', async () => {
    const serverDir = join(serversDir, 'sparseserver');
    await mkdir(serverDir, { recursive: true });

    await writeFile(join(serverDir, 'server.properties'), 'content');
    // bukkit.yml, spigot.yml, etc. do not exist

    const collector = new FileSystemConfigFileCollector(serversDir);
    const files = await collector.collectFiles('sparseserver');

    expect(files.length).toBe(1);
    expect(files[0]!.path).toBe('server.properties');
  });

  test('should read file content', async () => {
    const serverDir = join(serversDir, 'readserver');
    await mkdir(serverDir, { recursive: true });

    await writeFile(join(serverDir, 'server.properties'), 'server-port=25565');

    const collector = new FileSystemConfigFileCollector(serversDir);
    const content = await collector.readFileContent('readserver', 'server.properties');

    expect(content).toBe('server-port=25565');
  });

  test('should throw on non-existent file for readFileContent', async () => {
    const serverDir = join(serversDir, 'nofileserver');
    await mkdir(serverDir, { recursive: true });

    const collector = new FileSystemConfigFileCollector(serversDir);

    await expect(collector.readFileContent('nofileserver', 'missing.txt')).rejects.toThrow(/ENOENT/);
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
    expect(paths.includes('custom.yml')).toBeTruthy();
    expect(paths.includes('data.json')).toBeTruthy();
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
    expect(paths.includes('server.properties')).toBeTruthy();
    expect(!paths.includes('world.dat')).toBeTruthy();
    expect(!paths.includes('notes.txt')).toBeTruthy();
  });

  test('should write file content to server directory', async () => {
    const serverDir = join(serversDir, 'writeserver');
    await mkdir(serverDir, { recursive: true });

    const collector = new FileSystemConfigFileCollector(serversDir);
    await collector.writeFileContent('writeserver', 'server.properties', 'server-port=25566');

    const content = await readFile(join(serverDir, 'server.properties'), 'utf-8');
    expect(content).toBe('server-port=25566');
  });

  test('should create parent directories when writing file content', async () => {
    const collector = new FileSystemConfigFileCollector(serversDir);
    await collector.writeFileContent('newserver', 'plugins/config.yml', 'key: value');

    const content = await readFile(join(serversDir, 'newserver', 'plugins', 'config.yml'), 'utf-8');
    expect(content).toBe('key: value');
  });

  test('should overwrite existing file when writing file content', async () => {
    const serverDir = join(serversDir, 'overwriteserver');
    await mkdir(serverDir, { recursive: true });
    await writeFile(join(serverDir, 'server.properties'), 'old-content');

    const collector = new FileSystemConfigFileCollector(serversDir);
    await collector.writeFileContent('overwriteserver', 'server.properties', 'new-content');

    const content = await readFile(join(serverDir, 'server.properties'), 'utf-8');
    expect(content).toBe('new-content');
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

    async findAll(limit?: number, offset?: number): Promise<ConfigSnapshot[]> {
      const results = Array.from(this.snapshots.values())
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

      const start = offset ?? 0;
      const end = limit ? start + limit : undefined;
      return results.slice(start, end);
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
    readonly writtenFiles: Map<string, { serverName: string; content: string }> = new Map();

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

    async writeFileContent(serverName: string, filePath: string, content: string): Promise<void> {
      this.writtenFiles.set(filePath, { serverName, content });
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

    expect(snapshot.id).toBeTruthy();
    expect(snapshot.serverName.value).toBe('myserver');
    expect(snapshot.description).toBe('Test snapshot');
    expect(snapshot.files.length).toBe(2);

    // Verify stored in repo
    const found = await repo.findById(snapshot.id);
    expect(found).toBeTruthy();
  });

  test('should list snapshots by server name', async () => {
    const repo = new MockConfigSnapshotRepository();
    const storageAdapter = new MockConfigSnapshotStorage();
    const collector = new MockConfigFileCollector();
    collector.addFile('test.txt', 'content');

    const useCase = new ConfigSnapshotUseCaseImpl(repo, storageAdapter, collector);

    await useCase.create('myserver', 'Snap 1');
    await useCase.create('myserver', 'Snap 2');

    const list = await useCase.list('myserver');
    expect(list.length).toBe(2);
  });

  test('should list all snapshots across servers when no serverName provided', async () => {
    const repo = new MockConfigSnapshotRepository();
    const storageAdapter = new MockConfigSnapshotStorage();
    const collector = new MockConfigFileCollector();
    collector.addFile('test.txt', 'content');

    const useCase = new ConfigSnapshotUseCaseImpl(repo, storageAdapter, collector);

    await useCase.create('servera', 'Snap A');
    await useCase.create('serverb', 'Snap B');
    await useCase.create('serverc', 'Snap C');

    const list = await useCase.list();
    expect(list.length).toBe(3);
  });

  test('should list all snapshots with pagination when no serverName provided', async () => {
    const repo = new MockConfigSnapshotRepository();
    const storageAdapter = new MockConfigSnapshotStorage();
    const collector = new MockConfigFileCollector();
    collector.addFile('test.txt', 'content');

    const useCase = new ConfigSnapshotUseCaseImpl(repo, storageAdapter, collector);

    await useCase.create('servera', 'Snap A');
    await useCase.create('serverb', 'Snap B');
    await useCase.create('serverc', 'Snap C');

    const page1 = await useCase.list(undefined, 2, 0);
    expect(page1.length).toBe(2);

    const page2 = await useCase.list(undefined, 2, 2);
    expect(page2.length).toBe(1);
  });

  test('should find snapshot by ID', async () => {
    const repo = new MockConfigSnapshotRepository();
    const storageAdapter = new MockConfigSnapshotStorage();
    const collector = new MockConfigFileCollector();
    collector.addFile('test.txt', 'content');

    const useCase = new ConfigSnapshotUseCaseImpl(repo, storageAdapter, collector);
    const created = await useCase.create('myserver');

    const found = await useCase.findById(created.id);
    expect(found).toBeTruthy();
    expect(found.id).toBe(created.id);
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

    expect(diff.hasChanges).toBeTruthy();
    const summary = diff.summary;
    expect(summary.added >= 1).toBeTruthy(); // new-file.yml
    expect(summary.modified >= 1).toBeTruthy(); // server.properties
    expect(summary.deleted >= 1).toBeTruthy(); // config.env
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
    expect(found).toBe(null);
  });

  test('should restore files from a snapshot to the server directory', async () => {
    const repo = new MockConfigSnapshotRepository();
    const storageAdapter = new MockConfigSnapshotStorage();
    const collector = new MockConfigFileCollector();

    collector.addFile('server.properties', 'server-port=25565');
    collector.addFile('config.env', 'TYPE=PAPER');

    const useCase = new ConfigSnapshotUseCaseImpl(repo, storageAdapter, collector);
    const snapshot = await useCase.create('myserver', 'Restore test');

    // Restore the snapshot
    await useCase.restore(snapshot.id);

    // Verify files were written via collector.writeFileContent
    expect(collector.writtenFiles.size).toBe(2);
    expect(collector.writtenFiles.get('server.properties')?.content).toBe('server-port=25565');
    expect(collector.writtenFiles.get('server.properties')?.serverName).toBe('myserver');
    expect(collector.writtenFiles.get('config.env')?.content).toBe('TYPE=PAPER');
    expect(collector.writtenFiles.get('config.env')?.serverName).toBe('myserver');
  });

  test('should throw when restoring non-existent snapshot', async () => {
    const repo = new MockConfigSnapshotRepository();
    const storageAdapter = new MockConfigSnapshotStorage();
    const collector = new MockConfigFileCollector();

    const useCase = new ConfigSnapshotUseCaseImpl(repo, storageAdapter, collector);

    await expect(useCase.restore('non-existent-id')).rejects.toThrow(/Snapshot not found/);
  });

  test('should throw when snapshot has no files to restore', async () => {
    const repo = new MockConfigSnapshotRepository();
    const storageAdapter = new MockConfigSnapshotStorage();
    const collector = new MockConfigFileCollector();

    // Create a snapshot with no files
    const useCase = new ConfigSnapshotUseCaseImpl(repo, storageAdapter, collector);
    const snapshot = await useCase.create('myserver', 'Empty snapshot');

    await expect(useCase.restore(snapshot.id)).rejects.toThrow(/No files found/);
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

    async findAll(): Promise<ConfigSnapshotSchedule[]> {
      return Array.from(this.schedules.values());
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

    expect(schedule.id).toBeTruthy();
    expect(schedule.serverName.value).toBe('myserver');
    expect(schedule.name).toBe('Hourly');
    expect(schedule.cronExpression.expression).toBe('0 * * * *');
    expect(schedule.retentionCount).toBe(24);
    expect(schedule.enabled).toBe(true);
  });

  test('should update a schedule', async () => {
    const repo = new MockScheduleRepository();
    const useCase = new ConfigSnapshotScheduleUseCaseImpl(repo);

    const schedule = await useCase.create('myserver', 'Original', '0 * * * *');
    const updated = await useCase.update(schedule.id, { name: 'Updated Name' });

    expect(updated.name).toBe('Updated Name');
    expect(updated.id).toBe(schedule.id);
  });

  test('should throw when updating non-existent schedule', async () => {
    const repo = new MockScheduleRepository();
    const useCase = new ConfigSnapshotScheduleUseCaseImpl(repo);

    await expect(useCase.update('non-existent', { name: 'New Name' })).rejects.toThrow(/not found/i);
  });

  test('should enable a schedule', async () => {
    const repo = new MockScheduleRepository();
    const useCase = new ConfigSnapshotScheduleUseCaseImpl(repo);

    const schedule = await useCase.create('myserver', 'Test', '0 * * * *');
    await useCase.disable(schedule.id);
    await useCase.enable(schedule.id);

    const found = await repo.findById(schedule.id);
    expect(found).toBeTruthy();
    expect(found.enabled).toBe(true);
  });

  test('should disable a schedule', async () => {
    const repo = new MockScheduleRepository();
    const useCase = new ConfigSnapshotScheduleUseCaseImpl(repo);

    const schedule = await useCase.create('myserver', 'Test', '0 * * * *');
    await useCase.disable(schedule.id);

    const found = await repo.findById(schedule.id);
    expect(found).toBeTruthy();
    expect(found.enabled).toBe(false);
  });

  test('should delete a schedule', async () => {
    const repo = new MockScheduleRepository();
    const useCase = new ConfigSnapshotScheduleUseCaseImpl(repo);

    const schedule = await useCase.create('myserver', 'Test', '0 * * * *');
    await useCase.delete(schedule.id);

    const found = await repo.findById(schedule.id);
    expect(found).toBe(null);
  });

  test('should find all schedules', async () => {
    const repo = new MockScheduleRepository();
    const useCase = new ConfigSnapshotScheduleUseCaseImpl(repo);

    await useCase.create('servera', 'Schedule A', '0 * * * *');
    await useCase.create('serverb', 'Schedule B', '0 3 * * *');

    const all = await useCase.findAll();
    expect(all.length).toBe(2);
  });

  test('should find all schedules including disabled ones', async () => {
    const repo = new MockScheduleRepository();
    const useCase = new ConfigSnapshotScheduleUseCaseImpl(repo);

    const enabled = await useCase.create('servera', 'Enabled Schedule', '0 * * * *');
    const toDisable = await useCase.create('serverb', 'To Disable', '0 3 * * *');

    // Disable one schedule
    await useCase.disable(toDisable.id);

    const all = await useCase.findAll();
    expect(all.length).toBe(2);

    // Verify both enabled and disabled are included
    const names = all.map((s) => s.name);
    expect(names.includes('Enabled Schedule')).toBeTruthy();
    expect(names.includes('To Disable')).toBeTruthy();

    // Verify the disabled one is actually disabled
    const disabledSchedule = all.find((s) => s.name === 'To Disable');
    expect(disabledSchedule).toBeTruthy();
    expect(disabledSchedule.enabled).toBe(false);
  });

  test('should find schedules by server', async () => {
    const repo = new MockScheduleRepository();
    const useCase = new ConfigSnapshotScheduleUseCaseImpl(repo);

    await useCase.create('servera', 'Schedule A', '0 * * * *');
    await useCase.create('serverb', 'Schedule B', '0 3 * * *');

    const serverA = await useCase.findByServer('servera');
    expect(serverA.length).toBe(1);
    expect(serverA[0]!.name).toBe('Schedule A');
  });
});
