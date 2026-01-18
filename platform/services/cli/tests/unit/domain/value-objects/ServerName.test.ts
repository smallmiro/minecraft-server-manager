import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import { ServerName } from '../../../../src/domain/value-objects/ServerName.js';

describe('ServerName Value Object', () => {
  describe('valid names', () => {
    it('should accept valid lowercase name', () => {
      const name = ServerName.create('myserver');
      assert.strictEqual(name.value, 'myserver');
    });

    it('should convert to lowercase', () => {
      const name = ServerName.create('MyServer');
      assert.strictEqual(name.value, 'myserver');
    });

    it('should accept name with numbers', () => {
      const name = ServerName.create('server1');
      assert.strictEqual(name.value, 'server1');
    });

    it('should accept name with hyphens', () => {
      const name = ServerName.create('my-server');
      assert.strictEqual(name.value, 'my-server');
    });

    it('should trim whitespace', () => {
      const name = ServerName.create('  myserver  ');
      assert.strictEqual(name.value, 'myserver');
    });

    it('should accept minimum length (2 chars)', () => {
      const name = ServerName.create('ab');
      assert.strictEqual(name.value, 'ab');
    });
  });

  describe('invalid names', () => {
    it('should reject empty name', () => {
      assert.throws(() => ServerName.create(''), /cannot be empty/);
    });

    it('should reject single character', () => {
      assert.throws(() => ServerName.create('a'), /at least 2 characters/);
    });

    it('should reject name exceeding 32 characters', () => {
      const longName = 'a'.repeat(33);
      assert.throws(() => ServerName.create(longName), /cannot exceed 32/);
    });

    it('should reject name starting with number', () => {
      assert.throws(() => ServerName.create('1server'), /start with a letter/);
    });

    it('should reject name ending with hyphen', () => {
      assert.throws(() => ServerName.create('server-'), /end with a letter or number/);
    });

    it('should reject consecutive hyphens', () => {
      assert.throws(() => ServerName.create('my--server'), /consecutive hyphens/);
    });

    it('should reject special characters', () => {
      assert.throws(() => ServerName.create('my_server'), /lowercase letters, numbers, and hyphens/);
    });
  });

  describe('derived properties', () => {
    it('should generate container name with mc- prefix', () => {
      const name = ServerName.create('myserver');
      assert.strictEqual(name.containerName, 'mc-myserver');
    });

    it('should generate hostname with .local suffix', () => {
      const name = ServerName.create('myserver');
      assert.strictEqual(name.hostname, 'myserver.local');
    });
  });

  describe('equality', () => {
    it('should be equal for same value', () => {
      const name1 = ServerName.create('myserver');
      const name2 = ServerName.create('myserver');
      assert.ok(name1.equals(name2));
    });

    it('should not be equal for different values', () => {
      const name1 = ServerName.create('server1');
      const name2 = ServerName.create('server2');
      assert.ok(!name1.equals(name2));
    });
  });

  describe('immutability', () => {
    it('should be frozen', () => {
      const name = ServerName.create('myserver');
      assert.throws(() => {
        // @ts-expect-error - testing immutability
        name._value = 'hacked';
      });
    });
  });
});
