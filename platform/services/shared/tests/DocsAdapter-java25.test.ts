import { test, describe } from 'node:test';
import assert from 'node:assert';
import { DocsAdapter } from '../src/infrastructure/adapters/DocsAdapter.js';

// Use a fake root dir so docs/ doesn't exist, forcing use of default data
const FAKE_ROOT = '/tmp/nonexistent-dir-for-java25-testing';

describe('DocsAdapter - Java 25 support', () => {
  describe('getServerTypes - all types include java25', () => {
    test('FORGE javaVersions should include java25', async () => {
      const adapter = new DocsAdapter(FAKE_ROOT);
      const types = await adapter.getServerTypes();
      const forge = types.find((t) => t.value === 'FORGE');
      assert.ok(forge, 'FORGE type should exist');
      assert.ok(forge!.javaVersions.includes('java25'), 'FORGE should include java25');
    });

    test('FABRIC javaVersions should include java25', async () => {
      const adapter = new DocsAdapter(FAKE_ROOT);
      const types = await adapter.getServerTypes();
      const fabric = types.find((t) => t.value === 'FABRIC');
      assert.ok(fabric, 'FABRIC type should exist');
      assert.ok(fabric!.javaVersions.includes('java25'), 'FABRIC should include java25');
    });

    test('QUILT javaVersions should include java25', async () => {
      const adapter = new DocsAdapter(FAKE_ROOT);
      const types = await adapter.getServerTypes();
      const quilt = types.find((t) => t.value === 'QUILT');
      assert.ok(quilt, 'QUILT type should exist');
      assert.ok(quilt!.javaVersions.includes('java25'), 'QUILT should include java25');
    });

    test('PAPER javaVersions should include java25', async () => {
      const adapter = new DocsAdapter(FAKE_ROOT);
      const types = await adapter.getServerTypes();
      const paper = types.find((t) => t.value === 'PAPER');
      assert.ok(paper, 'PAPER type should exist');
      assert.ok(paper!.javaVersions.includes('java25'), 'PAPER should include java25');
    });

    test('VANILLA javaVersions should include java25', async () => {
      const adapter = new DocsAdapter(FAKE_ROOT);
      const types = await adapter.getServerTypes();
      const vanilla = types.find((t) => t.value === 'VANILLA');
      assert.ok(vanilla, 'VANILLA type should exist');
      assert.ok(vanilla!.javaVersions.includes('java25'), 'VANILLA should include java25');
    });

    test('SPIGOT javaVersions should include java25', async () => {
      const adapter = new DocsAdapter(FAKE_ROOT);
      const types = await adapter.getServerTypes();
      const spigot = types.find((t) => t.value === 'SPIGOT');
      assert.ok(spigot, 'SPIGOT type should exist');
      assert.ok(spigot!.javaVersions.includes('java25'), 'SPIGOT should include java25');
    });

    test('BUKKIT javaVersions should include java25', async () => {
      const adapter = new DocsAdapter(FAKE_ROOT);
      const types = await adapter.getServerTypes();
      const bukkit = types.find((t) => t.value === 'BUKKIT');
      assert.ok(bukkit, 'BUKKIT type should exist');
      assert.ok(bukkit!.javaVersions.includes('java25'), 'BUKKIT should include java25');
    });

    test('PURPUR javaVersions should include java25', async () => {
      const adapter = new DocsAdapter(FAKE_ROOT);
      const types = await adapter.getServerTypes();
      const purpur = types.find((t) => t.value === 'PURPUR');
      assert.ok(purpur, 'PURPUR type should exist');
      assert.ok(purpur!.javaVersions.includes('java25'), 'PURPUR should include java25');
    });

    test('MODRINTH javaVersions should include java25', async () => {
      const adapter = new DocsAdapter(FAKE_ROOT);
      const types = await adapter.getServerTypes();
      const modrinth = types.find((t) => t.value === 'MODRINTH');
      assert.ok(modrinth, 'MODRINTH type should exist');
      assert.ok(modrinth!.javaVersions.includes('java25'), 'MODRINTH should include java25');
    });

    test('AUTO_CURSEFORGE javaVersions should include java25', async () => {
      const adapter = new DocsAdapter(FAKE_ROOT);
      const types = await adapter.getServerTypes();
      const cf = types.find((t) => t.value === 'AUTO_CURSEFORGE');
      assert.ok(cf, 'AUTO_CURSEFORGE type should exist');
      assert.ok(cf!.javaVersions.includes('java25'), 'AUTO_CURSEFORGE should include java25');
    });
  });

  describe('getVersionCompatibility - LATEST maps to java25', () => {
    test('LATEST version should map to java25', async () => {
      const adapter = new DocsAdapter(FAKE_ROOT);
      const versions = await adapter.getVersionCompatibility('PAPER');
      const latestEntry = versions.find((v) => v.mcVersion === 'LATEST');
      assert.ok(latestEntry, 'LATEST version entry should exist');
      assert.strictEqual(
        latestEntry!.javaVersion,
        'java25',
        'LATEST should recommend java25'
      );
    });

    test('MC 1.21 version should map to java21', async () => {
      const adapter = new DocsAdapter(FAKE_ROOT);
      const versions = await adapter.getVersionCompatibility('PAPER');
      const v121 = versions.find((v) => v.mcVersion === '1.21');
      if (v121) {
        assert.strictEqual(v121.javaVersion, 'java21');
      }
    });

    test('MC 1.21.4 version should map to java21', async () => {
      const adapter = new DocsAdapter(FAKE_ROOT);
      const versions = await adapter.getVersionCompatibility('PAPER');
      const v = versions.find((v) => v.mcVersion === '1.21.4');
      if (v) {
        assert.strictEqual(v.javaVersion, 'java21');
      }
    });

    test('MC 1.20.1 version should map to java17', async () => {
      const adapter = new DocsAdapter(FAKE_ROOT);
      const versions = await adapter.getVersionCompatibility('PAPER');
      const v = versions.find((v) => v.mcVersion === '1.20.1');
      if (v) {
        assert.strictEqual(v.javaVersion, 'java17');
      }
    });
  });

  describe('java version ordering in defaults', () => {
    test('PAPER should have java25 as first option', async () => {
      const adapter = new DocsAdapter(FAKE_ROOT);
      const types = await adapter.getServerTypes();
      const paper = types.find((t) => t.value === 'PAPER');
      assert.ok(paper, 'PAPER type should exist');
      assert.strictEqual(paper!.javaVersions[0], 'java25', 'java25 should be first for PAPER');
    });

    test('FORGE should have java8 as first option (legacy mod support)', async () => {
      const adapter = new DocsAdapter(FAKE_ROOT);
      const types = await adapter.getServerTypes();
      const forge = types.find((t) => t.value === 'FORGE');
      assert.ok(forge, 'FORGE type should exist');
      assert.strictEqual(forge!.javaVersions[0], 'java8', 'java8 should be first for FORGE');
    });

    test('FABRIC should have java17 as first option', async () => {
      const adapter = new DocsAdapter(FAKE_ROOT);
      const types = await adapter.getServerTypes();
      const fabric = types.find((t) => t.value === 'FABRIC');
      assert.ok(fabric, 'FABRIC type should exist');
      assert.strictEqual(fabric!.javaVersions[0], 'java17', 'java17 should be first for FABRIC');
    });
  });
});
