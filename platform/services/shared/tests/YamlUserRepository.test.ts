import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import { rm, mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { YamlUserRepository } from '../src/infrastructure/adapters/YamlUserRepository.js';
import { User } from '../src/domain/entities/User.js';
import { UserId } from '../src/domain/value-objects/UserId.js';
import { Username } from '../src/domain/value-objects/Username.js';
import { Role } from '../src/domain/value-objects/Role.js';

describe('YamlUserRepository', () => {
  let testDir: string;
  let testFilePath: string;
  let repository: YamlUserRepository;

  before(async () => {
    testDir = join(tmpdir(), `yaml-user-repo-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });
    testFilePath = join(testDir, 'users.yaml');
    repository = new YamlUserRepository(testFilePath);
  });

  after(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  test('should return empty array when file does not exist', async () => {
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

    const retrieved = await repository.findByUsername(Username.create('anotheruser'));
    assert.ok(retrieved);
    assert.strictEqual(retrieved.username.value, 'anotheruser');
    assert.strictEqual(retrieved.role.value, 'viewer');
  });

  test('should find user by username case-insensitively', async () => {
    const retrieved = await repository.findByUsername(Username.create('ANOTHERUSER'));
    assert.ok(retrieved);
    assert.strictEqual(retrieved.username.value, 'anotheruser');
  });

  test('should return null when user not found by ID', async () => {
    const nonExistentId = UserId.generate();
    const result = await repository.findById(nonExistentId);
    assert.strictEqual(result, null);
  });

  test('should return null when user not found by username', async () => {
    const result = await repository.findByUsername(Username.create('nonexistent'));
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

  test('should create valid YAML file structure', async () => {
    const content = await readFile(testFilePath, 'utf-8');

    assert.ok(content.includes('users:'));
    assert.ok(content.includes('id:'));
    assert.ok(content.includes('username:'));
    assert.ok(content.includes('passwordHash:'));
    assert.ok(content.includes('role:'));
    assert.ok(content.includes('createdAt:'));
    assert.ok(content.includes('updatedAt:'));
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
    const newFilePath = join(newDir, 'users.yaml');
    const newRepo = new YamlUserRepository(newFilePath);

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
  });
});
