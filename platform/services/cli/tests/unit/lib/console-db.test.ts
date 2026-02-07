import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { ConsoleDatabase } from '../../../src/lib/console-db.js';

const TEST_DB_DIR = join(import.meta.dirname, '../../.test-data');
const TEST_DB_PATH = join(TEST_DB_DIR, 'test-console.db');

describe('ConsoleDatabase', () => {
  let consoleDb: ConsoleDatabase;

  beforeEach(() => {
    // Ensure test directory exists
    if (!existsSync(TEST_DB_DIR)) {
      mkdirSync(TEST_DB_DIR, { recursive: true });
    }
    // Remove old test DB
    if (existsSync(TEST_DB_PATH)) {
      rmSync(TEST_DB_PATH);
    }
    consoleDb = new ConsoleDatabase(TEST_DB_PATH);
  });

  afterEach(() => {
    consoleDb.close();
    if (existsSync(TEST_DB_PATH)) {
      rmSync(TEST_DB_PATH);
    }
    // Clean up WAL/SHM files
    for (const suffix of ['-wal', '-shm']) {
      const f = TEST_DB_PATH + suffix;
      if (existsSync(f)) rmSync(f);
    }
  });

  describe('ensureSchema', () => {
    it('should create all Better Auth tables', () => {
      consoleDb.ensureSchema();

      const db = new Database(TEST_DB_PATH, { readonly: true });
      const tables = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
        .all() as { name: string }[];
      db.close();

      const tableNames = tables.map((t) => t.name);
      expect(tableNames).toContain('users');
      expect(tableNames).toContain('accounts');
      expect(tableNames).toContain('sessions');
      expect(tableNames).toContain('verifications');
      expect(tableNames).toContain('user_servers');
    });

    it('should be idempotent (safe to call multiple times)', () => {
      consoleDb.ensureSchema();
      consoleDb.ensureSchema();

      const db = new Database(TEST_DB_PATH, { readonly: true });
      const tables = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table'")
        .all() as { name: string }[];
      db.close();

      expect(tables.length).toBeGreaterThanOrEqual(5);
    });
  });

  describe('createUser', () => {
    beforeEach(() => {
      consoleDb.ensureSchema();
    });

    it('should create user in both users and accounts tables', () => {
      const user = consoleDb.createUser({
        email: 'admin@test.com',
        name: 'Admin User',
        password: 'Test1234',
        role: 'admin',
      });

      expect(user.id).toBeDefined();
      expect(user.email).toBe('admin@test.com');
      expect(user.name).toBe('Admin User');
      expect(user.role).toBe('admin');
      expect(user.emailVerified).toBe(true);

      // Verify accounts table has the credential record
      const db = new Database(TEST_DB_PATH, { readonly: true });
      const account = db
        .prepare("SELECT * FROM accounts WHERE user_id = ? AND provider_id = 'credential'")
        .get(user.id) as any;
      db.close();

      expect(account).toBeDefined();
      expect(account.account_id).toBe(user.id);
      expect(account.provider_id).toBe('credential');
      expect(account.password).toBeDefined();
      expect(account.password).not.toBe('Test1234'); // Should be hashed
    });

    it('should default role to user', () => {
      const user = consoleDb.createUser({
        email: 'user@test.com',
        name: 'Regular User',
        password: 'Test1234',
      });

      expect(user.role).toBe('user');
    });

    it('should throw on duplicate email', () => {
      consoleDb.createUser({
        email: 'dup@test.com',
        name: 'User 1',
        password: 'Test1234',
      });

      expect(() =>
        consoleDb.createUser({
          email: 'dup@test.com',
          name: 'User 2',
          password: 'Test5678',
        })
      ).toThrow();
    });

    it('should store timestamps as epoch seconds', () => {
      const before = Math.floor(Date.now() / 1000);
      const user = consoleDb.createUser({
        email: 'ts@test.com',
        name: 'TS User',
        password: 'Test1234',
      });
      const after = Math.floor(Date.now() / 1000);

      const db = new Database(TEST_DB_PATH, { readonly: true });
      const row = db.prepare('SELECT created_at, updated_at FROM users WHERE id = ?').get(user.id) as any;
      db.close();

      expect(row.created_at).toBeGreaterThanOrEqual(before);
      expect(row.created_at).toBeLessThanOrEqual(after);
      expect(row.updated_at).toBeGreaterThanOrEqual(before);
      expect(row.updated_at).toBeLessThanOrEqual(after);
    });
  });

  describe('findUserByEmail', () => {
    beforeEach(() => {
      consoleDb.ensureSchema();
    });

    it('should find existing user by email', () => {
      consoleDb.createUser({
        email: 'find@test.com',
        name: 'Find Me',
        password: 'Test1234',
        role: 'admin',
      });

      const user = consoleDb.findUserByEmail('find@test.com');
      expect(user).not.toBeNull();
      expect(user!.email).toBe('find@test.com');
      expect(user!.name).toBe('Find Me');
      expect(user!.role).toBe('admin');
    });

    it('should return null for non-existent user', () => {
      const user = consoleDb.findUserByEmail('nonexistent@test.com');
      expect(user).toBeNull();
    });
  });

  describe('findAllUsers', () => {
    beforeEach(() => {
      consoleDb.ensureSchema();
    });

    it('should return all users', () => {
      consoleDb.createUser({ email: 'a@test.com', name: 'A', password: 'Test1234' });
      consoleDb.createUser({ email: 'b@test.com', name: 'B', password: 'Test1234' });

      const users = consoleDb.findAllUsers();
      expect(users).toHaveLength(2);
    });

    it('should return empty array when no users', () => {
      const users = consoleDb.findAllUsers();
      expect(users).toHaveLength(0);
    });
  });

  describe('deleteUser', () => {
    beforeEach(() => {
      consoleDb.ensureSchema();
    });

    it('should delete user and cascade to accounts', () => {
      const user = consoleDb.createUser({
        email: 'del@test.com',
        name: 'Delete Me',
        password: 'Test1234',
      });

      consoleDb.deleteUser(user.id);

      expect(consoleDb.findUserByEmail('del@test.com')).toBeNull();

      // Verify accounts also deleted
      const db = new Database(TEST_DB_PATH, { readonly: true });
      const account = db.prepare('SELECT * FROM accounts WHERE user_id = ?').get(user.id);
      db.close();

      expect(account).toBeUndefined();
    });
  });

  describe('updateUserRole', () => {
    beforeEach(() => {
      consoleDb.ensureSchema();
    });

    it('should update user role', () => {
      const user = consoleDb.createUser({
        email: 'role@test.com',
        name: 'Role User',
        password: 'Test1234',
        role: 'user',
      });

      consoleDb.updateUserRole(user.id, 'admin');

      const updated = consoleDb.findUserByEmail('role@test.com');
      expect(updated!.role).toBe('admin');
    });
  });

  describe('updatePassword', () => {
    beforeEach(() => {
      consoleDb.ensureSchema();
    });

    it('should update password in accounts table', () => {
      const user = consoleDb.createUser({
        email: 'pw@test.com',
        name: 'PW User',
        password: 'OldPass1234',
      });

      const db1 = new Database(TEST_DB_PATH, { readonly: true });
      const oldAccount = db1
        .prepare("SELECT password FROM accounts WHERE user_id = ? AND provider_id = 'credential'")
        .get(user.id) as any;
      db1.close();

      consoleDb.updatePassword(user.id, 'NewPass5678');

      const db2 = new Database(TEST_DB_PATH, { readonly: true });
      const newAccount = db2
        .prepare("SELECT password FROM accounts WHERE user_id = ? AND provider_id = 'credential'")
        .get(user.id) as any;
      db2.close();

      expect(newAccount.password).not.toBe(oldAccount.password);
      expect(newAccount.password).not.toBe('NewPass5678'); // Should be hashed
    });
  });

  describe('verifyPassword', () => {
    beforeEach(() => {
      consoleDb.ensureSchema();
    });

    it('should verify correct password', () => {
      const user = consoleDb.createUser({
        email: 'verify@test.com',
        name: 'Verify User',
        password: 'CorrectPass123',
      });

      const result = consoleDb.verifyPassword(user.id, 'CorrectPass123');
      expect(result).toBe(true);
    });

    it('should reject incorrect password', () => {
      const user = consoleDb.createUser({
        email: 'reject@test.com',
        name: 'Reject User',
        password: 'CorrectPass123',
      });

      const result = consoleDb.verifyPassword(user.id, 'WrongPass456');
      expect(result).toBe(false);
    });
  });

  describe('directory creation', () => {
    it('should create parent directory if not exists', () => {
      const nestedPath = join(TEST_DB_DIR, 'nested', 'deep', 'test.db');
      const db = new ConsoleDatabase(nestedPath);
      db.ensureSchema();
      db.close();

      expect(existsSync(nestedPath)).toBe(true);

      // Cleanup
      rmSync(join(TEST_DB_DIR, 'nested'), { recursive: true });
    });
  });
});
