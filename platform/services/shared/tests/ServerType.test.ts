import { test, describe } from 'node:test';
import assert from 'node:assert';
import { ServerType, ServerTypeEnum } from '../src/domain/value-objects/ServerType.js';

describe('ServerType', () => {
  describe('enum values', () => {
    test('should have MODRINTH type', () => {
      assert.strictEqual(ServerTypeEnum.MODRINTH, 'MODRINTH');
    });

    test('should have AUTO_CURSEFORGE type', () => {
      assert.strictEqual(ServerTypeEnum.AUTO_CURSEFORGE, 'AUTO_CURSEFORGE');
    });
  });

  describe('create', () => {
    test('should create MODRINTH server type', () => {
      const serverType = ServerType.create('MODRINTH');
      assert.strictEqual(serverType.value, ServerTypeEnum.MODRINTH);
    });

    test('should create AUTO_CURSEFORGE server type', () => {
      const serverType = ServerType.create('AUTO_CURSEFORGE');
      assert.strictEqual(serverType.value, ServerTypeEnum.AUTO_CURSEFORGE);
    });
  });

  describe('info', () => {
    test('MODRINTH should have isModpack true', () => {
      const serverType = ServerType.create('MODRINTH');
      const info = serverType.info;

      assert.strictEqual(info.isModpack, true);
      assert.strictEqual(info.supportsPlugins, false);
      assert.strictEqual(info.supportsMods, true);
      assert.strictEqual(info.recommended, false);
    });

    test('AUTO_CURSEFORGE should have isModpack true', () => {
      const serverType = ServerType.create('AUTO_CURSEFORGE');
      const info = serverType.info;

      assert.strictEqual(info.isModpack, true);
      assert.strictEqual(info.supportsPlugins, false);
      assert.strictEqual(info.supportsMods, true);
      assert.strictEqual(info.recommended, false);
    });

    test('existing types should have isModpack false', () => {
      const existingTypes = [
        ServerTypeEnum.PAPER,
        ServerTypeEnum.VANILLA,
        ServerTypeEnum.FORGE,
        ServerTypeEnum.NEOFORGE,
        ServerTypeEnum.FABRIC,
        ServerTypeEnum.SPIGOT,
        ServerTypeEnum.BUKKIT,
        ServerTypeEnum.PURPUR,
        ServerTypeEnum.QUILT,
      ];

      for (const type of existingTypes) {
        const serverType = ServerType.fromEnum(type);
        assert.strictEqual(
          serverType.info.isModpack,
          false,
          `${type} should have isModpack: false`
        );
      }
    });
  });

  describe('isModpack getter', () => {
    test('should return true for MODRINTH', () => {
      const serverType = ServerType.create('MODRINTH');
      assert.strictEqual(serverType.isModpack, true);
    });

    test('should return true for AUTO_CURSEFORGE', () => {
      const serverType = ServerType.create('AUTO_CURSEFORGE');
      assert.strictEqual(serverType.isModpack, true);
    });

    test('should return false for PAPER', () => {
      const serverType = ServerType.create('PAPER');
      assert.strictEqual(serverType.isModpack, false);
    });
  });

  describe('getAll', () => {
    test('should include MODRINTH and AUTO_CURSEFORGE', () => {
      const allTypes = ServerType.getAll();
      const typeValues = allTypes.map((t) => t.value);

      assert.ok(typeValues.includes(ServerTypeEnum.MODRINTH));
      assert.ok(typeValues.includes(ServerTypeEnum.AUTO_CURSEFORGE));
    });

    test('should have 14 total server types', () => {
      const allTypes = ServerType.getAll();
      assert.strictEqual(allTypes.length, 14);
    });

    test('all types should have isModpack property', () => {
      const allTypes = ServerType.getAll();
      for (const type of allTypes) {
        assert.ok(
          'isModpack' in type,
          `${type.value} should have isModpack property`
        );
        assert.strictEqual(
          typeof type.isModpack,
          'boolean',
          `${type.value} isModpack should be boolean`
        );
      }
    });

    test('should include LEAF, FOLIA, PUFFERFISH', () => {
      const allTypes = ServerType.getAll();
      const typeValues = allTypes.map((t) => t.value);

      assert.ok(typeValues.includes(ServerTypeEnum.LEAF), 'LEAF should be included');
      assert.ok(typeValues.includes(ServerTypeEnum.FOLIA), 'FOLIA should be included');
      assert.ok(typeValues.includes(ServerTypeEnum.PUFFERFISH), 'PUFFERFISH should be included');
    });
  });

  describe('new server types: LEAF, FOLIA, PUFFERFISH', () => {
    describe('enum values', () => {
      test('should have LEAF type', () => {
        assert.strictEqual(ServerTypeEnum.LEAF, 'LEAF');
      });

      test('should have FOLIA type', () => {
        assert.strictEqual(ServerTypeEnum.FOLIA, 'FOLIA');
      });

      test('should have PUFFERFISH type', () => {
        assert.strictEqual(ServerTypeEnum.PUFFERFISH, 'PUFFERFISH');
      });
    });

    describe('create', () => {
      test('should create LEAF server type', () => {
        const serverType = ServerType.create('LEAF');
        assert.strictEqual(serverType.value, ServerTypeEnum.LEAF);
      });

      test('should create FOLIA server type', () => {
        const serverType = ServerType.create('FOLIA');
        assert.strictEqual(serverType.value, ServerTypeEnum.FOLIA);
      });

      test('should create PUFFERFISH server type', () => {
        const serverType = ServerType.create('PUFFERFISH');
        assert.strictEqual(serverType.value, ServerTypeEnum.PUFFERFISH);
      });

      test('should create server types case-insensitively', () => {
        assert.strictEqual(ServerType.create('leaf').value, ServerTypeEnum.LEAF);
        assert.strictEqual(ServerType.create('folia').value, ServerTypeEnum.FOLIA);
        assert.strictEqual(ServerType.create('pufferfish').value, ServerTypeEnum.PUFFERFISH);
      });
    });

    describe('info', () => {
      test('LEAF should support plugins but not mods', () => {
        const serverType = ServerType.create('LEAF');
        const info = serverType.info;

        assert.strictEqual(info.supportsPlugins, true);
        assert.strictEqual(info.supportsMods, false);
        assert.strictEqual(info.isModpack, false);
        assert.strictEqual(info.recommended, false);
      });

      test('FOLIA should support plugins but not mods', () => {
        const serverType = ServerType.create('FOLIA');
        const info = serverType.info;

        assert.strictEqual(info.supportsPlugins, true);
        assert.strictEqual(info.supportsMods, false);
        assert.strictEqual(info.isModpack, false);
        assert.strictEqual(info.recommended, false);
      });

      test('PUFFERFISH should support plugins but not mods', () => {
        const serverType = ServerType.create('PUFFERFISH');
        const info = serverType.info;

        assert.strictEqual(info.supportsPlugins, true);
        assert.strictEqual(info.supportsMods, false);
        assert.strictEqual(info.isModpack, false);
        assert.strictEqual(info.recommended, false);
      });

      test('LEAF should have correct label', () => {
        const serverType = ServerType.create('LEAF');
        assert.strictEqual(serverType.label, 'Leaf');
      });

      test('FOLIA should have correct label', () => {
        const serverType = ServerType.create('FOLIA');
        assert.strictEqual(serverType.label, 'Folia');
      });

      test('PUFFERFISH should have correct label', () => {
        const serverType = ServerType.create('PUFFERFISH');
        assert.strictEqual(serverType.label, 'Pufferfish');
      });
    });

    describe('isModpack getter', () => {
      test('LEAF should return false for isModpack', () => {
        assert.strictEqual(ServerType.create('LEAF').isModpack, false);
      });

      test('FOLIA should return false for isModpack', () => {
        assert.strictEqual(ServerType.create('FOLIA').isModpack, false);
      });

      test('PUFFERFISH should return false for isModpack', () => {
        assert.strictEqual(ServerType.create('PUFFERFISH').isModpack, false);
      });
    });
  });
});
