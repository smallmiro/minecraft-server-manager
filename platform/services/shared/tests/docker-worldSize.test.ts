import { describe, test, expect, beforeAll, afterAll } from 'vitest';
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

  beforeAll(async () => {
    // Create temporary test directory structure
    testDir = join(tmpdir(), `world-size-test-${Date.now()}`);
    worldsDir = join(testDir, 'worlds');
    await mkdir(worldsDir, { recursive: true });
  });

  afterAll(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  test('should return 0 for non-existent world', async () => {
    const size = await getWorldDirectorySize('nonexistent', worldsDir);
    expect(size).toBe(0);
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
    expect(size >= 3072, `Expected size >= 3072 bytes, got ${size}`).toBeTruthy();
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
    expect(size >= 3000, `Expected size >= 3000 bytes, got ${size}`).toBeTruthy();
  });
});

describe('formatBytes', () => {
  test('should format 0 bytes', () => {
    expect(formatBytes(0)).toBe('0 B');
  });

  test('should format bytes', () => {
    expect(formatBytes(500)).toBe('500.0 B');
  });

  test('should format kilobytes', () => {
    expect(formatBytes(1024)).toBe('1.0 KB');
    expect(formatBytes(1536)).toBe('1.5 KB');
  });

  test('should format megabytes', () => {
    expect(formatBytes(1048576)).toBe('1.0 MB');
    expect(formatBytes(1572864)).toBe('1.5 MB');
  });

  test('should format gigabytes', () => {
    expect(formatBytes(1073741824)).toBe('1.0 GB');
    expect(formatBytes(1610612736)).toBe('1.5 GB');
  });

  test('should format terabytes', () => {
    expect(formatBytes(1099511627776)).toBe('1.0 TB');
  });
});
