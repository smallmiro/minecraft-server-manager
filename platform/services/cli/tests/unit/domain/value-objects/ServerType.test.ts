import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import { ServerType, ServerTypeEnum } from '@minecraft-docker/shared';

describe('ServerType Value Object', () => {
  describe('valid types', () => {
    it('should accept PAPER type', () => {
      const type = ServerType.create('PAPER');
      assert.strictEqual(type.value, ServerTypeEnum.PAPER);
    });

    it('should accept lowercase input', () => {
      const type = ServerType.create('paper');
      assert.strictEqual(type.value, ServerTypeEnum.PAPER);
    });

    it('should accept VANILLA type', () => {
      const type = ServerType.create('VANILLA');
      assert.strictEqual(type.value, ServerTypeEnum.VANILLA);
    });

    it('should accept FORGE type', () => {
      const type = ServerType.create('FORGE');
      assert.strictEqual(type.value, ServerTypeEnum.FORGE);
    });

    it('should accept FABRIC type', () => {
      const type = ServerType.create('FABRIC');
      assert.strictEqual(type.value, ServerTypeEnum.FABRIC);
    });

    it('should trim whitespace', () => {
      const type = ServerType.create('  PAPER  ');
      assert.strictEqual(type.value, ServerTypeEnum.PAPER);
    });
  });

  describe('invalid types', () => {
    it('should reject unknown type', () => {
      assert.throws(() => ServerType.create('UNKNOWN'), /Invalid server type/);
    });

    it('should reject empty string', () => {
      assert.throws(() => ServerType.create(''), /Invalid server type/);
    });
  });

  describe('server type info', () => {
    it('should have label for PAPER', () => {
      const type = ServerType.create('PAPER');
      assert.strictEqual(type.label, 'Paper');
    });

    it('should have description', () => {
      const type = ServerType.create('PAPER');
      assert.ok(type.description.includes('performance'));
    });

    it('should indicate plugin support', () => {
      const paper = ServerType.create('PAPER');
      const vanilla = ServerType.create('VANILLA');
      assert.strictEqual(paper.supportsPlugins, true);
      assert.strictEqual(vanilla.supportsPlugins, false);
    });

    it('should indicate mod support', () => {
      const forge = ServerType.create('FORGE');
      const paper = ServerType.create('PAPER');
      assert.strictEqual(forge.supportsMods, true);
      assert.strictEqual(paper.supportsMods, false);
    });
  });

  describe('static methods', () => {
    it('should get all types', () => {
      const allTypes = ServerType.getAll();
      assert.ok(allTypes.length >= 4);
      assert.ok(allTypes.some(t => t.value === ServerTypeEnum.PAPER));
      assert.ok(allTypes.some(t => t.value === ServerTypeEnum.VANILLA));
    });

    it('should get recommended type', () => {
      const recommended = ServerType.getRecommended();
      assert.strictEqual(recommended.value, ServerTypeEnum.PAPER);
    });

    it('should create from enum', () => {
      const type = ServerType.fromEnum(ServerTypeEnum.FORGE);
      assert.strictEqual(type.value, ServerTypeEnum.FORGE);
    });
  });

  describe('equality', () => {
    it('should be equal for same type', () => {
      const type1 = ServerType.create('PAPER');
      const type2 = ServerType.create('paper');
      assert.ok(type1.equals(type2));
    });

    it('should not be equal for different types', () => {
      const type1 = ServerType.create('PAPER');
      const type2 = ServerType.create('FORGE');
      assert.ok(!type1.equals(type2));
    });
  });
});
