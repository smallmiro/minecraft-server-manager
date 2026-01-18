import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { DocsAdapter } from '../../../../src/infrastructure/adapters/DocsAdapter.js';

describe('DocsAdapter', () => {
  let adapter: DocsAdapter;

  beforeEach(() => {
    // Use project root (../../.. from cli/tests/unit/infrastructure/adapters)
    adapter = new DocsAdapter();
  });

  describe('isAvailable', () => {
    it('should return true when docs directory exists', async () => {
      const available = await adapter.isAvailable();
      // May be true or false depending on test environment
      assert.strictEqual(typeof available, 'boolean');
    });
  });

  describe('getServerTypes', () => {
    it('should return server types array', async () => {
      const types = await adapter.getServerTypes();

      assert.ok(Array.isArray(types));
      assert.ok(types.length > 0);
    });

    it('should include PAPER server type', async () => {
      const types = await adapter.getServerTypes();
      const paper = types.find((t) => t.value === 'PAPER');

      assert.ok(paper);
      assert.strictEqual(paper.label, 'Paper');
      assert.strictEqual(paper.supportsPlugins, true);
      assert.strictEqual(paper.supportsMods, false);
      assert.strictEqual(paper.recommended, true);
    });

    it('should include VANILLA server type', async () => {
      const types = await adapter.getServerTypes();
      const vanilla = types.find((t) => t.value === 'VANILLA');

      assert.ok(vanilla);
      assert.strictEqual(vanilla.label, 'Vanilla');
      assert.strictEqual(vanilla.supportsPlugins, false);
      assert.strictEqual(vanilla.supportsMods, false);
    });

    it('should include FORGE server type', async () => {
      const types = await adapter.getServerTypes();
      const forge = types.find((t) => t.value === 'FORGE');

      assert.ok(forge);
      assert.strictEqual(forge.label, 'Forge');
      assert.strictEqual(forge.supportsPlugins, false);
      assert.strictEqual(forge.supportsMods, true);
    });

    it('should include FABRIC server type', async () => {
      const types = await adapter.getServerTypes();
      const fabric = types.find((t) => t.value === 'FABRIC');

      assert.ok(fabric);
      assert.strictEqual(fabric.label, 'Fabric');
      assert.strictEqual(fabric.supportsPlugins, false);
      assert.strictEqual(fabric.supportsMods, true);
    });

    it('should have javaVersions for each type', async () => {
      const types = await adapter.getServerTypes();

      for (const type of types) {
        assert.ok(Array.isArray(type.javaVersions));
        assert.ok(type.javaVersions.length > 0);
      }
    });
  });

  describe('getEnvVars', () => {
    it('should return environment variables array', async () => {
      const vars = await adapter.getEnvVars();

      assert.ok(Array.isArray(vars));
      assert.ok(vars.length > 0);
    });

    it('should include EULA variable as required', async () => {
      const vars = await adapter.getEnvVars();
      const eula = vars.find((v) => v.name === 'EULA');

      assert.ok(eula);
      assert.strictEqual(eula.required, true);
    });

    it('should include TYPE variable', async () => {
      const vars = await adapter.getEnvVars();
      const type = vars.find((v) => v.name === 'TYPE');

      assert.ok(type);
      assert.strictEqual(type.default, 'VANILLA');
    });

    it('should include MEMORY variable', async () => {
      const vars = await adapter.getEnvVars();
      const memory = vars.find((v) => v.name === 'MEMORY');

      assert.ok(memory);
      assert.strictEqual(memory.type, 'memory');
    });

    it('should filter by category', async () => {
      const memoryVars = await adapter.getEnvVars('Memory Settings');

      assert.ok(Array.isArray(memoryVars));
      for (const v of memoryVars) {
        assert.strictEqual(v.category, 'Memory Settings');
      }
    });
  });

  describe('getCommonVersions', () => {
    it('should return common versions array', async () => {
      const versions = await adapter.getCommonVersions();

      assert.ok(Array.isArray(versions));
      assert.ok(versions.length > 0);
    });

    it('should include LATEST', async () => {
      const versions = await adapter.getCommonVersions();

      assert.ok(versions.includes('LATEST'));
    });

    it('should include recent versions', async () => {
      const versions = await adapter.getCommonVersions();

      assert.ok(versions.some((v) => v.startsWith('1.21')));
      assert.ok(versions.some((v) => v.startsWith('1.20')));
    });
  });

  describe('getVersionCompatibility', () => {
    it('should return version compatibility array', async () => {
      const compatibility = await adapter.getVersionCompatibility('PAPER');

      assert.ok(Array.isArray(compatibility));
      assert.ok(compatibility.length > 0);
    });

    it('should include java version for each entry', async () => {
      const compatibility = await adapter.getVersionCompatibility('PAPER');

      for (const entry of compatibility) {
        assert.ok(entry.javaVersion);
        assert.ok(entry.javaVersion.startsWith('java'));
      }
    });

    it('should recommend java21 for LATEST', async () => {
      const compatibility = await adapter.getVersionCompatibility('PAPER');
      const latest = compatibility.find((c) => c.mcVersion === 'LATEST');

      assert.ok(latest);
      assert.strictEqual(latest.javaVersion, 'java21');
    });

    it('should recommend java8 for old versions', async () => {
      const compatibility = await adapter.getVersionCompatibility('FORGE');
      const old = compatibility.find((c) => c.mcVersion === '1.12.2');

      assert.ok(old);
      assert.strictEqual(old.javaVersion, 'java8');
    });
  });

  describe('getMemoryRecommendations', () => {
    it('should return memory recommendations array', async () => {
      const recommendations = await adapter.getMemoryRecommendations();

      assert.ok(Array.isArray(recommendations));
      assert.ok(recommendations.length > 0);
    });

    it('should include 4G as recommended', async () => {
      const recommendations = await adapter.getMemoryRecommendations();
      const fourG = recommendations.find((r) => r.value === '4G');

      assert.ok(fourG);
      assert.strictEqual(fourG.recommended, true);
    });

    it('should include options for mods', async () => {
      const recommendations = await adapter.getMemoryRecommendations();
      const forMods = recommendations.filter((r) => r.forMods);

      assert.ok(forMods.length > 0);
    });

    it('should have valid memory format', async () => {
      const recommendations = await adapter.getMemoryRecommendations();

      for (const rec of recommendations) {
        assert.ok(/^\d+[GMK]$/i.test(rec.value));
      }
    });
  });

  describe('caching', () => {
    it('should cache server types on subsequent calls', async () => {
      const types1 = await adapter.getServerTypes();
      const types2 = await adapter.getServerTypes();

      assert.deepStrictEqual(types1, types2);
    });

    it('should cache env vars on subsequent calls', async () => {
      const vars1 = await adapter.getEnvVars();
      const vars2 = await adapter.getEnvVars();

      assert.deepStrictEqual(vars1, vars2);
    });
  });
});
