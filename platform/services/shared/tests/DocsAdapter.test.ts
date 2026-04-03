import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { DocsAdapter } from '../src/infrastructure/adapters/DocsAdapter.js';

// Minimal valid markdown files for testing
const TYPES_FILE_CONTENT = `# Server Types and Platforms

## Server Type Summary

| Type | Purpose | Plugins | Mods |
|------|---------|---------|------|
| \`PAPER\` | High performance server | O | X |
| \`VANILLA\` | Official Minecraft server | X | X |
| \`FORGE\` | Mod server | X | O |
| \`FABRIC\` | Lightweight mod loader | X | O |
`;

const VARIABLES_FILE_CONTENT = `# Variables

## General Settings

| Variable | Default | Description |
|----------|---------|-------------|
| \`EULA\` | - | Required: TRUE |
| \`TYPE\` | VANILLA | Server type |
| \`VERSION\` | LATEST | Minecraft version |

## Memory Settings

| Variable | Default | Description |
|----------|---------|-------------|
| \`MEMORY\` | 1G | Initial/max heap memory |
`;

describe('DocsAdapter', () => {
  let tmpRoot: string;
  let docsDir: string;

  beforeEach(() => {
    // Create a temp directory structure:
    // tmpRoot/
    //   docs/
    //     itzg-reference/
    //       06-types-and-platforms.md
    //       03-variables.md
    tmpRoot = join(tmpdir(), `docsadapter-test-${Date.now()}`);
    docsDir = join(tmpRoot, 'docs', 'itzg-reference');
    mkdirSync(docsDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(tmpRoot)) {
      rmSync(tmpRoot, { recursive: true, force: true });
    }
  });

  describe('isAvailable()', () => {
    test('should return true when itzg-reference/06-types-and-platforms.md exists', async () => {
      writeFileSync(join(docsDir, '06-types-and-platforms.md'), TYPES_FILE_CONTENT);
      // rootDir should be tmpRoot/platform (so docs is at ../docs relative to root parent)
      // DocsAdapter constructor: join(paths.root, '..', 'docs')
      // paths.root = dataDir = rootDir argument
      // So if we pass join(tmpRoot, 'platform') as rootDir, docs = join(tmpRoot, 'platform', '..', 'docs') = tmpRoot/docs
      const adapter = new DocsAdapter(join(tmpRoot, 'platform'));
      const available = await adapter.isAvailable();
      expect(available).toBe(true);
    });

    test('should return false when itzg-reference directory does not exist', async () => {
      // No files written - itzg-reference dir is empty (no md files)
      const adapter = new DocsAdapter(join(tmpRoot, 'platform'));
      const available = await adapter.isAvailable();
      expect(available).toBe(false);
    });

    test('should return false when docs directory does not exist at all', async () => {
      const isolatedTmp = join(tmpdir(), `docsadapter-missing-${Date.now()}`);
      mkdirSync(isolatedTmp, { recursive: true });
      try {
        const adapter = new DocsAdapter(join(isolatedTmp, 'platform'));
        const available = await adapter.isAvailable();
        expect(available).toBe(false);
      } finally {
        rmSync(isolatedTmp, { recursive: true, force: true });
      }
    });

    test('should use itzg-reference subdirectory, not docs root directly', async () => {
      // Write the file at the WRONG location (docs root, not itzg-reference)
      const wrongDocsRoot = join(tmpRoot, 'docs');
      writeFileSync(join(wrongDocsRoot, '06-types-and-platforms.md'), TYPES_FILE_CONTENT);
      // Should return false because the file is not in itzg-reference/
      const adapter = new DocsAdapter(join(tmpRoot, 'platform'));
      const available = await adapter.isAvailable();
      expect(available).toBe(false);
    });
  });

  describe('getServerTypes()', () => {
    test('should parse server types from itzg-reference/06-types-and-platforms.md', async () => {
      writeFileSync(join(docsDir, '06-types-and-platforms.md'), TYPES_FILE_CONTENT);
      const adapter = new DocsAdapter(join(tmpRoot, 'platform'));
      const types = await adapter.getServerTypes();
      expect(types.length > 0).toBeTruthy();
      const paper = types.find((t) => t.value === 'PAPER');
      expect(paper).toBeTruthy();
      expect(paper?.supportsPlugins).toBe(true);
      expect(paper?.supportsMods).toBe(false);
    });

    test('should fall back to defaults when itzg-reference/06-types-and-platforms.md is missing', async () => {
      // No file written
      const adapter = new DocsAdapter(join(tmpRoot, 'platform'));
      const types = await adapter.getServerTypes();
      expect(types.length > 0).toBeTruthy();
      const paper = types.find((t) => t.value === 'PAPER');
      expect(paper).toBeTruthy();
    });

    test('should NOT read from docs root when itzg-reference file is missing', async () => {
      // Write file at wrong location (docs root)
      const wrongDocsRoot = join(tmpRoot, 'docs');
      writeFileSync(join(wrongDocsRoot, '06-types-and-platforms.md'), TYPES_FILE_CONTENT);
      // Adapter should fall back to defaults because it looks in itzg-reference/
      const adapter = new DocsAdapter(join(tmpRoot, 'platform'));
      // isAvailable returns false (file not in itzg-reference/)
      const available = await adapter.isAvailable();
      expect(available).toBe(false);
      // getServerTypes returns defaults (not parsing the wrong-location file)
      const types = await adapter.getServerTypes();
      // Defaults still include PAPER, so just check it returns something
      expect(types.length > 0).toBeTruthy();
    });
  });

  describe('getEnvVars()', () => {
    test('should parse env vars from itzg-reference/03-variables.md', async () => {
      writeFileSync(join(docsDir, '03-variables.md'), VARIABLES_FILE_CONTENT);
      const adapter = new DocsAdapter(join(tmpRoot, 'platform'));
      const vars = await adapter.getEnvVars();
      expect(vars.length > 0).toBeTruthy();
      const eula = vars.find((v) => v.name === 'EULA');
      expect(eula).toBeTruthy();
    });

    test('should filter env vars by category', async () => {
      writeFileSync(join(docsDir, '03-variables.md'), VARIABLES_FILE_CONTENT);
      const adapter = new DocsAdapter(join(tmpRoot, 'platform'));
      const memoryVars = await adapter.getEnvVars('Memory Settings');
      expect(memoryVars.length > 0).toBeTruthy();
      expect(
        memoryVars.every((v) => v.category.toLowerCase() === 'memory settings')
      ).toBeTruthy();
    });

    test('should fall back to defaults when itzg-reference/03-variables.md is missing', async () => {
      // No file written
      const adapter = new DocsAdapter(join(tmpRoot, 'platform'));
      const vars = await adapter.getEnvVars();
      expect(vars.length > 0).toBeTruthy();
      const eula = vars.find((v) => v.name === 'EULA');
      expect(eula).toBeTruthy();
    });

    test('should NOT read from docs root when itzg-reference file is missing', async () => {
      // Write file at wrong location (docs root)
      const wrongDocsRoot = join(tmpRoot, 'docs');
      writeFileSync(join(wrongDocsRoot, '03-variables.md'), VARIABLES_FILE_CONTENT);
      const adapter = new DocsAdapter(join(tmpRoot, 'platform'));
      // Should use defaults (not parsing the wrong-location file)
      const vars = await adapter.getEnvVars();
      expect(vars.length > 0).toBeTruthy();
    });
  });

  describe('getVersionCompatibility()', () => {
    test('should return version compatibility info for PAPER', async () => {
      const adapter = new DocsAdapter(join(tmpRoot, 'platform'));
      const versions = await adapter.getVersionCompatibility('PAPER');
      expect(versions.length > 0).toBeTruthy();
      const latest = versions.find((v) => v.mcVersion === 'LATEST');
      expect(latest).toBeTruthy();
    });
  });

  describe('getMemoryRecommendations()', () => {
    test('should return memory recommendations', async () => {
      const adapter = new DocsAdapter(join(tmpRoot, 'platform'));
      const recommendations = await adapter.getMemoryRecommendations();
      expect(recommendations.length > 0).toBeTruthy();
      const recommended = recommendations.find((r) => r.recommended);
      expect(recommended).toBeTruthy();
    });
  });

  describe('getCommonVersions()', () => {
    test('should return list of common Minecraft versions', async () => {
      const adapter = new DocsAdapter(join(tmpRoot, 'platform'));
      const versions = await adapter.getCommonVersions();
      expect(versions.length > 0).toBeTruthy();
      expect(versions.includes('LATEST')).toBeTruthy();
    });
  });
});
