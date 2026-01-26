import { test, describe, before, after, afterEach } from 'node:test';
import assert from 'node:assert';
import { rm, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { SqliteUserRepository } from '../src/infrastructure/adapters/SqliteUserRepository.js';
import { User } from '../src/domain/entities/User.js';
import { UserId } from '../src/domain/value-objects/UserId.js';
import { Username } from '../src/domain/value-objects/Username.js';
import { Role } from '../src/domain/value-objects/Role.js';

describe('SqliteUserRepository', () => {
  let testDir: string;
  let testDbPath: string;
  let repository: SqliteUserRepository;

  before(async () => {
    testDir = join(tmpdir(), `sqlite-user-repo-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });
    testDbPath = join(testDir, 'users.db');
  });

  after(async () => {
    if (repository) {
      repository.close();
    }
    await rm(testDir, { recursive: true, force: true });
  });

  test('should create database and tables on initialization', async () => {
    repository = new SqliteUserRepository(testDbPath);

    // Database file should be created
    assert.ok(existsSync(testDbPath));

    // Should be able to query without error (tables exist)
    const users = await repository.findAll();
    assert.deepStrictEqual(users, []);
  });

  test('should return empty array when no users exist', async () => {
    const users = await repository.findAll();
    assert.deepStrictEqual(users, []);
  });

  test('should return 0 count when no users exist', async () => {
    const count = await repository.count();
    assert.strictEqual(count, 0);
  });

  test('should save and retrieve a user by ID', async () => {
    const passwordHash = await repository.hashPassword('testPassword123');
    const user = User.create({
      username: Username.create('testuser'),
      passwordHash,
      role: Role.admin(),
    });

    await repository.save(user);

    const retrieved = await repository.findById(user.id);
    assert.ok(retrieved);
    assert.strictEqual(retrieved.id.value, user.id.value);
    assert.strictEqual(retrieved.username.value, 'testuser');
    assert.strictEqual(retrieved.role.value, 'admin');
  });

  test('should save and retrieve a user by username', async () => {
    const passwordHash = await repository.hashPassword('anotherPassword');
    const user = User.create({
      username: Username.create('anotheruser'),
      passwordHash,
      role: Role.viewer(),
    });

    await repository.save(user);

    const retrieved = await repository.findByUsername(
      Username.create('anotheruser')
    );
    assert.ok(retrieved);
    assert.strictEqual(retrieved.username.value, 'anotheruser');
    assert.strictEqual(retrieved.role.value, 'viewer');
  });

  test('should find user by username case-insensitively', async () => {
    const retrieved = await repository.findByUsername(
      Username.create('ANOTHERUSER')
    );
    assert.ok(retrieved);
    assert.strictEqual(retrieved.username.value, 'anotheruser');
  });

  test('should return null when user not found by ID', async () => {
    const nonExistentId = UserId.generate();
    const result = await repository.findById(nonExistentId);
    assert.strictEqual(result, null);
  });

  test('should return null when user not found by username', async () => {
    const result = await repository.findByUsername(
      Username.create('nonexistent')
    );
    assert.strictEqual(result, null);
  });

  test('should update existing user', async () => {
    const users = await repository.findAll();
    const user = users.find((u) => u.username.value === 'testuser');
    assert.ok(user);

    user.updateRole(Role.viewer());
    await repository.save(user);

    const updated = await repository.findById(user.id);
    assert.ok(updated);
    assert.strictEqual(updated.role.value, 'viewer');
  });

  test('should get correct user count', async () => {
    const count = await repository.count();
    assert.strictEqual(count, 2); // testuser and anotheruser
  });

  test('should delete a user', async () => {
    const users = await repository.findAll();
    const user = users.find((u) => u.username.value === 'anotheruser');
    assert.ok(user);

    await repository.delete(user.id);

    const deleted = await repository.findById(user.id);
    assert.strictEqual(deleted, null);

    const newCount = await repository.count();
    assert.strictEqual(newCount, 1);
  });

  test('should hash password correctly', async () => {
    const password = 'mySecurePassword123';
    const hash = await repository.hashPassword(password);

    assert.ok(hash);
    assert.ok(hash.startsWith('$2'));
    assert.notStrictEqual(hash, password);
  });

  test('should verify correct password', async () => {
    const password = 'mySecurePassword123';
    const hash = await repository.hashPassword(password);

    const isValid = await repository.verifyPassword(password, hash);
    assert.strictEqual(isValid, true);
  });

  test('should reject incorrect password', async () => {
    const password = 'mySecurePassword123';
    const hash = await repository.hashPassword(password);

    const isValid = await repository.verifyPassword('wrongPassword', hash);
    assert.strictEqual(isValid, false);
  });

  test('should handle deleting non-existent user gracefully', async () => {
    const nonExistentId = UserId.generate();
    const countBefore = await repository.count();

    await repository.delete(nonExistentId);

    const countAfter = await repository.count();
    assert.strictEqual(countBefore, countAfter);
  });

  test('should create directory if it does not exist', async () => {
    const newDir = join(testDir, 'subdir', 'nested');
    const newDbPath = join(newDir, 'users.db');
    const newRepo = new SqliteUserRepository(newDbPath);

    const passwordHash = await newRepo.hashPassword('test');
    const user = User.create({
      username: Username.create('nesteduser'),
      passwordHash,
      role: Role.admin(),
    });

    await newRepo.save(user);

    const retrieved = await newRepo.findById(user.id);
    assert.ok(retrieved);
    assert.strictEqual(retrieved.username.value, 'nesteduser');

    newRepo.close();
  });

  test('should enforce unique username constraint', async () => {
    const passwordHash = await repository.hashPassword('test');

    // First user with this username should succeed
    const user1 = User.create({
      username: Username.create('uniqueuser'),
      passwordHash,
      role: Role.admin(),
    });
    await repository.save(user1);

    // Second user with same username should fail
    const user2 = User.create({
      username: Username.create('uniqueuser'),
      passwordHash,
      role: Role.viewer(),
    });

    await assert.rejects(async () => {
      await repository.save(user2);
    }, /UNIQUE constraint failed/);
  });

  test('should preserve timestamps on update', async () => {
    const user = await repository.findByUsername(Username.create('testuser'));
    assert.ok(user);

    const originalCreatedAt = user.createdAt.getTime();

    // Small delay to ensure updatedAt differs
    await new Promise((resolve) => setTimeout(resolve, 10));

    user.updateRole(Role.admin());
    await repository.save(user);

    const updated = await repository.findById(user.id);
    assert.ok(updated);

    // createdAt should be preserved
    assert.strictEqual(updated.createdAt.getTime(), originalCreatedAt);
    // updatedAt should be different (updated by entity)
    assert.ok(updated.updatedAt.getTime() >= originalCreatedAt);
  });
});
