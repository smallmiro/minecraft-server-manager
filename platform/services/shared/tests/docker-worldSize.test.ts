import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import { rm, mkdir, writeFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  getWorldDirectorySize,
  formatBytes,
} from '../src/docker/index.js';

describe('getWorldDirectorySize', () => {
  let testDir: string;
  let worldsDir: string;

  before(async () => {
    // Create temporary test directory structure
    testDir = join(tmpdir(), `world-size-test-${Date.now()}`);
    worldsDir = join(testDir, 'worlds');
    await mkdir(worldsDir, { recursive: true });
  });

  after(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  test('should return 0 for non-existent world', async () => {
    const size = await getWorldDirectorySize('nonexistent', worldsDir);
    assert.strictEqual(size, 0);
  });

  test('should calculate size of world directory', async () => {
    // Create a test world with some files
    const testWorldDir = join(worldsDir, 'testworld');
    await mkdir(testWorldDir, { recursive: true });

    // Create some test files with known sizes
    const testData1 = 'A'.repeat(1024); // 1KB
    const testData2 = 'B'.repeat(2048); // 2KB

    await writeFile(join(testWorldDir, 'level.dat'), testData1);
    await writeFile(join(testWorldDir, 'session.lock'), testData2);

    const size = await getWorldDirectorySize('testworld', worldsDir);

    // Should be approximately 3KB (1024 + 2048 bytes)
    assert.ok(size >= 3072, `Expected size >= 3072 bytes, got ${size}`);
  });

  test('should calculate size recursively including subdirectories', async () => {
    // Create a test world with nested directories (like region/)
    const testWorldDir = join(worldsDir, 'worldwithregions');
    const regionDir = join(testWorldDir, 'region');
    await mkdir(regionDir, { recursive: true });

    // Create files in root and subdirectory
    const testData1 = 'A'.repeat(1000);
    const testData2 = 'B'.repeat(2000);

    await writeFile(join(testWorldDir, 'level.dat'), testData1);
    await writeFile(join(regionDir, 'r.0.0.mca'), testData2);

    const size = await getWorldDirectorySize('worldwithregions', worldsDir);

    // Should be at least 3000 bytes (1000 + 2000)
    assert.ok(size >= 3000, `Expected size >= 3000 bytes, got ${size}`);
  });
});

describe('formatBytes', () => {
  test('should format 0 bytes', () => {
    assert.strictEqual(formatBytes(0), '0 B');
  });

  test('should format bytes', () => {
    assert.strictEqual(formatBytes(500), '500.0 B');
  });

  test('should format kilobytes', () => {
    assert.strictEqual(formatBytes(1024), '1.0 KB');
    assert.strictEqual(formatBytes(1536), '1.5 KB');
  });

  test('should format megabytes', () => {
    assert.strictEqual(formatBytes(1048576), '1.0 MB');
    assert.strictEqual(formatBytes(1572864), '1.5 MB');
  });

  test('should format gigabytes', () => {
    assert.strictEqual(formatBytes(1073741824), '1.0 GB');
    assert.strictEqual(formatBytes(1610612736), '1.5 GB');
  });

  test('should format terabytes', () => {
    assert.strictEqual(formatBytes(1099511627776), '1.0 TB');
  });
});
