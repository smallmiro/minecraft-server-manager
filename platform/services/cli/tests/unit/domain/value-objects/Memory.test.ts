import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import { Memory } from '../../../../src/domain/value-objects/Memory.js';

describe('Memory Value Object', () => {
  describe('valid memory formats', () => {
    it('should accept gigabytes', () => {
      const memory = Memory.create('4G');
      assert.strictEqual(memory.value, '4G');
      assert.strictEqual(memory.gigabytes, 4);
    });

    it('should accept megabytes', () => {
      const memory = Memory.create('512M');
      assert.strictEqual(memory.value, '512M');
      assert.strictEqual(memory.megabytes, 512);
    });

    it('should accept lowercase units', () => {
      const memory = Memory.create('4g');
      assert.strictEqual(memory.value, '4G');
    });

    it('should trim whitespace', () => {
      const memory = Memory.create('  4G  ');
      assert.strictEqual(memory.value, '4G');
    });

    it('should normalize megabytes to gigabytes when appropriate', () => {
      const memory = Memory.create('2048M');
      assert.strictEqual(memory.value, '2G');
    });
  });

  describe('invalid memory formats', () => {
    it('should reject empty string', () => {
      assert.throws(() => Memory.create(''), /Invalid memory format/);
    });

    it('should reject invalid format', () => {
      assert.throws(() => Memory.create('4'), /Invalid memory format/);
      assert.throws(() => Memory.create('4GB'), /Invalid memory format/);
      assert.throws(() => Memory.create('four gigs'), /Invalid memory format/);
    });

    it('should reject zero', () => {
      assert.throws(() => Memory.create('0G'), /greater than 0/);
    });

    it('should reject less than 512M', () => {
      assert.throws(() => Memory.create('256M'), /at least 512M/);
    });

    it('should reject more than 64G', () => {
      assert.throws(() => Memory.create('65G'), /cannot exceed 64G/);
    });
  });

  describe('static factory methods', () => {
    it('should create from gigabytes', () => {
      const memory = Memory.fromGigabytes(8);
      assert.strictEqual(memory.value, '8G');
    });

    it('should create from megabytes', () => {
      const memory = Memory.fromMegabytes(1024);
      assert.strictEqual(memory.value, '1G');
    });

    it('should create default (4G)', () => {
      const memory = Memory.default();
      assert.strictEqual(memory.value, '4G');
    });

    it('should create minimum (2G)', () => {
      const memory = Memory.minimum();
      assert.strictEqual(memory.value, '2G');
    });

    it('should create for mods (6G)', () => {
      const memory = Memory.forMods();
      assert.strictEqual(memory.value, '6G');
    });
  });

  describe('comparison', () => {
    it('should compare memory correctly', () => {
      const small = Memory.create('2G');
      const large = Memory.create('8G');

      assert.ok(small.isLessThan(large));
      assert.ok(large.isGreaterThan(small));
    });
  });

  describe('equality', () => {
    it('should be equal for same value', () => {
      const m1 = Memory.create('4G');
      const m2 = Memory.create('4G');
      assert.ok(m1.equals(m2));
    });

    it('should be equal for equivalent values', () => {
      const m1 = Memory.create('2G');
      const m2 = Memory.create('2048M');
      assert.ok(m1.equals(m2));
    });
  });
});
