import { describe, test, expect, beforeAll, afterAll } from 'vitest';
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

  beforeAll(async () => {
    testDir = join(tmpdir(), `yaml-user-repo-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });
    testFilePath = join(testDir, 'users.yaml');
    repository = new YamlUserRepository(testFilePath);
  });

  afterAll(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  test('should return empty array when file does not exist', async () => {
    const users = await repository.findAll();
    expect(users).toEqual([]);
  });

  test('should return 0 count when no users exist', async () => {
    const count = await repository.count();
    expect(count).toBe(0);
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
    expect(retrieved).toBeTruthy();
    expect(retrieved.id.value).toBe(user.id.value);
    expect(retrieved.username.value).toBe('testuser');
    expect(retrieved.role.value).toBe('admin');
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
    expect(retrieved).toBeTruthy();
    expect(retrieved.username.value).toBe('anotheruser');
    expect(retrieved.role.value).toBe('viewer');
  });

  test('should find user by username case-insensitively', async () => {
    const retrieved = await repository.findByUsername(Username.create('ANOTHERUSER'));
    expect(retrieved).toBeTruthy();
    expect(retrieved.username.value).toBe('anotheruser');
  });

  test('should return null when user not found by ID', async () => {
    const nonExistentId = UserId.generate();
    const result = await repository.findById(nonExistentId);
    expect(result).toBe(null);
  });

  test('should return null when user not found by username', async () => {
    const result = await repository.findByUsername(Username.create('nonexistent'));
    expect(result).toBe(null);
  });

  test('should update existing user', async () => {
    const users = await repository.findAll();
    const user = users.find((u) => u.username.value === 'testuser');
    expect(user).toBeTruthy();

    user.updateRole(Role.viewer());
    await repository.save(user);

    const updated = await repository.findById(user.id);
    expect(updated).toBeTruthy();
    expect(updated.role.value).toBe('viewer');
  });

  test('should get correct user count', async () => {
    const count = await repository.count();
    expect(count).toBe(2); // testuser and anotheruser
  });

  test('should delete a user', async () => {
    const users = await repository.findAll();
    const user = users.find((u) => u.username.value === 'anotheruser');
    expect(user).toBeTruthy();

    await repository.delete(user.id);

    const deleted = await repository.findById(user.id);
    expect(deleted).toBe(null);

    const newCount = await repository.count();
    expect(newCount).toBe(1);
  });

  test('should hash password correctly', async () => {
    const password = 'mySecurePassword123';
    const hash = await repository.hashPassword(password);

    expect(hash).toBeTruthy();
    expect(hash.startsWith('$2')).toBeTruthy();
    expect(hash).not.toBe(password);
  });

  test('should verify correct password', async () => {
    const password = 'mySecurePassword123';
    const hash = await repository.hashPassword(password);

    const isValid = await repository.verifyPassword(password, hash);
    expect(isValid).toBe(true);
  });

  test('should reject incorrect password', async () => {
    const password = 'mySecurePassword123';
    const hash = await repository.hashPassword(password);

    const isValid = await repository.verifyPassword('wrongPassword', hash);
    expect(isValid).toBe(false);
  });

  test('should create valid YAML file structure', async () => {
    const content = await readFile(testFilePath, 'utf-8');

    expect(content.includes('users:')).toBeTruthy();
    expect(content.includes('id:')).toBeTruthy();
    expect(content.includes('username:')).toBeTruthy();
    expect(content.includes('passwordHash:')).toBeTruthy();
    expect(content.includes('role:')).toBeTruthy();
    expect(content.includes('createdAt:')).toBeTruthy();
    expect(content.includes('updatedAt:')).toBeTruthy();
  });

  test('should handle deleting non-existent user gracefully', async () => {
    const nonExistentId = UserId.generate();
    const countBefore = await repository.count();

    await repository.delete(nonExistentId);

    const countAfter = await repository.count();
    expect(countBefore).toBe(countAfter);
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
    expect(retrieved).toBeTruthy();
    expect(retrieved.username.value).toBe('nesteduser');
  });
});
