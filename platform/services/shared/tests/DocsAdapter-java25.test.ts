import { describe, test, expect } from 'vitest';
import { DocsAdapter } from '../src/infrastructure/adapters/DocsAdapter.js';

// Use a fake root dir so docs/ doesn't exist, forcing use of default data
const FAKE_ROOT = '/tmp/nonexistent-dir-for-java25-testing';

describe('DocsAdapter - Java 25 support', () => {
  describe('getServerTypes - all types include java25', () => {
    test('FORGE javaVersions should include java25', async () => {
      const adapter = new DocsAdapter(FAKE_ROOT);
      const types = await adapter.getServerTypes();
      const forge = types.find((t) => t.value === 'FORGE');
      expect(forge).toBeTruthy();
      expect(forge!.javaVersions.includes('java25')).toBeTruthy();
    });

    test('FABRIC javaVersions should include java25', async () => {
      const adapter = new DocsAdapter(FAKE_ROOT);
      const types = await adapter.getServerTypes();
      const fabric = types.find((t) => t.value === 'FABRIC');
      expect(fabric).toBeTruthy();
      expect(fabric!.javaVersions.includes('java25')).toBeTruthy();
    });

    test('QUILT javaVersions should include java25', async () => {
      const adapter = new DocsAdapter(FAKE_ROOT);
      const types = await adapter.getServerTypes();
      const quilt = types.find((t) => t.value === 'QUILT');
      expect(quilt).toBeTruthy();
      expect(quilt!.javaVersions.includes('java25')).toBeTruthy();
    });

    test('PAPER javaVersions should include java25', async () => {
      const adapter = new DocsAdapter(FAKE_ROOT);
      const types = await adapter.getServerTypes();
      const paper = types.find((t) => t.value === 'PAPER');
      expect(paper).toBeTruthy();
      expect(paper!.javaVersions.includes('java25')).toBeTruthy();
    });

    test('VANILLA javaVersions should include java25', async () => {
      const adapter = new DocsAdapter(FAKE_ROOT);
      const types = await adapter.getServerTypes();
      const vanilla = types.find((t) => t.value === 'VANILLA');
      expect(vanilla).toBeTruthy();
      expect(vanilla!.javaVersions.includes('java25')).toBeTruthy();
    });

    test('SPIGOT javaVersions should include java25', async () => {
      const adapter = new DocsAdapter(FAKE_ROOT);
      const types = await adapter.getServerTypes();
      const spigot = types.find((t) => t.value === 'SPIGOT');
      expect(spigot).toBeTruthy();
      expect(spigot!.javaVersions.includes('java25')).toBeTruthy();
    });

    test('BUKKIT javaVersions should include java25', async () => {
      const adapter = new DocsAdapter(FAKE_ROOT);
      const types = await adapter.getServerTypes();
      const bukkit = types.find((t) => t.value === 'BUKKIT');
      expect(bukkit).toBeTruthy();
      expect(bukkit!.javaVersions.includes('java25')).toBeTruthy();
    });

    test('PURPUR javaVersions should include java25', async () => {
      const adapter = new DocsAdapter(FAKE_ROOT);
      const types = await adapter.getServerTypes();
      const purpur = types.find((t) => t.value === 'PURPUR');
      expect(purpur).toBeTruthy();
      expect(purpur!.javaVersions.includes('java25')).toBeTruthy();
    });

    test('MODRINTH javaVersions should include java25', async () => {
      const adapter = new DocsAdapter(FAKE_ROOT);
      const types = await adapter.getServerTypes();
      const modrinth = types.find((t) => t.value === 'MODRINTH');
      expect(modrinth).toBeTruthy();
      expect(modrinth!.javaVersions.includes('java25')).toBeTruthy();
    });

    test('AUTO_CURSEFORGE javaVersions should include java25', async () => {
      const adapter = new DocsAdapter(FAKE_ROOT);
      const types = await adapter.getServerTypes();
      const cf = types.find((t) => t.value === 'AUTO_CURSEFORGE');
      expect(cf).toBeTruthy();
      expect(cf!.javaVersions.includes('java25')).toBeTruthy();
    });
  });

  describe('getVersionCompatibility - LATEST maps to java25', () => {
    test('LATEST version should map to java25', async () => {
      const adapter = new DocsAdapter(FAKE_ROOT);
      const versions = await adapter.getVersionCompatibility('PAPER');
      const latestEntry = versions.find((v) => v.mcVersion === 'LATEST');
      expect(latestEntry).toBeTruthy();
      expect(latestEntry!.javaVersion).toBe('java25');
    });

    test('MC 1.21 version should map to java21', async () => {
      const adapter = new DocsAdapter(FAKE_ROOT);
      const versions = await adapter.getVersionCompatibility('PAPER');
      const v121 = versions.find((v) => v.mcVersion === '1.21');
      if (v121) {
        expect(v121.javaVersion).toBe('java21');
      }
    });

    test('MC 1.21.4 version should map to java21', async () => {
      const adapter = new DocsAdapter(FAKE_ROOT);
      const versions = await adapter.getVersionCompatibility('PAPER');
      const v = versions.find((v) => v.mcVersion === '1.21.4');
      if (v) {
        expect(v.javaVersion).toBe('java21');
      }
    });

    test('MC 1.20.1 version should map to java17', async () => {
      const adapter = new DocsAdapter(FAKE_ROOT);
      const versions = await adapter.getVersionCompatibility('PAPER');
      const v = versions.find((v) => v.mcVersion === '1.20.1');
      if (v) {
        expect(v.javaVersion).toBe('java17');
      }
    });
  });

  describe('java version ordering in defaults', () => {
    test('PAPER should have java25 as first option', async () => {
      const adapter = new DocsAdapter(FAKE_ROOT);
      const types = await adapter.getServerTypes();
      const paper = types.find((t) => t.value === 'PAPER');
      expect(paper).toBeTruthy();
      expect(paper!.javaVersions[0]).toBe('java25');
    });

    test('FORGE should have java8 as first option (legacy mod support)', async () => {
      const adapter = new DocsAdapter(FAKE_ROOT);
      const types = await adapter.getServerTypes();
      const forge = types.find((t) => t.value === 'FORGE');
      expect(forge).toBeTruthy();
      expect(forge!.javaVersions[0]).toBe('java8');
    });

    test('FABRIC should have java17 as first option', async () => {
      const adapter = new DocsAdapter(FAKE_ROOT);
      const types = await adapter.getServerTypes();
      const fabric = types.find((t) => t.value === 'FABRIC');
      expect(fabric).toBeTruthy();
      expect(fabric!.javaVersions[0]).toBe('java17');
    });
  });
});
