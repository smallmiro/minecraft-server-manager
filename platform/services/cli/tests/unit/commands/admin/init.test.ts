import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { existsSync, rmSync, mkdirSync } from 'node:fs';
import { AdminConfigManager, type ApiAccessMode } from '../../../../dist/lib/admin-config.js';

describe('AdminConfigManager', () => {
  const testDir = join(process.cwd(), 'tests', '.tmp-admin-config');

  beforeEach(() => {
    // Clean up test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true });
    }
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    // Clean up
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true });
    }
  });

  describe('generateApiKey', () => {
    it('should generate API key with mctk_ prefix', () => {
      const apiKey = AdminConfigManager.generateApiKey();

      assert.ok(apiKey.startsWith('mctk_'), 'API key should start with mctk_');
      assert.ok(apiKey.length >= 25, 'API key should be at least 25 characters');
    });

    it('should generate unique API keys', () => {
      const key1 = AdminConfigManager.generateApiKey();
      const key2 = AdminConfigManager.generateApiKey();

      assert.notEqual(key1, key2, 'Each API key should be unique');
    });
  });

  describe('isValidApiKey', () => {
    it('should validate correct API key format', () => {
      const validKey = 'mctk_abcdefghij1234567890klmnopqrst';
      assert.equal(AdminConfigManager.isValidApiKey(validKey), true);
    });

    it('should reject API key without mctk_ prefix', () => {
      const invalidKey = 'abc_abcdefghij1234567890klmnopqrst';
      assert.equal(AdminConfigManager.isValidApiKey(invalidKey), false);
    });

    it('should reject API key with short random part', () => {
      const shortKey = 'mctk_abc';
      assert.equal(AdminConfigManager.isValidApiKey(shortKey), false);
    });
  });

  describe('isInitialized', () => {
    it('should return false when config file does not exist', () => {
      // Create manager with non-existent path
      const manager = new AdminConfigManager(testDir);

      // Override the path for testing
      const result = manager.isInitialized();
      assert.equal(result, false);
    });
  });

  describe('create', () => {
    it('should create configuration with internal access mode', async () => {
      const manager = new AdminConfigManager(testDir);

      const config = await manager.create({
        accessMode: 'internal' as ApiAccessMode,
      });

      assert.equal(config.api.access_mode, 'internal');
      assert.equal(config.api.api_key, null);
      assert.deepEqual(config.api.allowed_ips, []);
      assert.equal(config.console.enabled, true);
    });

    it('should create configuration with API key', async () => {
      const manager = new AdminConfigManager(testDir);
      const testApiKey = AdminConfigManager.generateApiKey();

      const config = await manager.create({
        accessMode: 'api-key' as ApiAccessMode,
        apiKey: testApiKey,
      });

      assert.equal(config.api.access_mode, 'api-key');
      assert.equal(config.api.api_key, testApiKey);
    });

    it('should create configuration with allowed IPs', async () => {
      const manager = new AdminConfigManager(testDir);
      const allowedIps = ['192.168.1.1', '10.0.0.0/8'];

      const config = await manager.create({
        accessMode: 'ip-whitelist' as ApiAccessMode,
        allowedIps,
      });

      assert.equal(config.api.access_mode, 'ip-whitelist');
      assert.deepEqual(config.api.allowed_ips, allowedIps);
    });

    it('should save configuration to file', async () => {
      const manager = new AdminConfigManager(testDir);

      await manager.create({
        accessMode: 'internal' as ApiAccessMode,
      });

      assert.ok(existsSync(manager.path), 'Config file should be created');
    });
  });

  describe('load', () => {
    it('should return null when config file does not exist', async () => {
      const manager = new AdminConfigManager(testDir);
      const config = await manager.load();

      assert.equal(config, null);
    });

    it('should load existing configuration', async () => {
      const manager = new AdminConfigManager(testDir);

      // Create config first
      await manager.create({
        accessMode: 'api-key' as ApiAccessMode,
        apiKey: 'mctk_testkey12345678901234567890',
        apiPort: 4001,
        consolePort: 4000,
      });

      // Load and verify
      const loaded = await manager.load();

      assert.ok(loaded, 'Config should be loaded');
      assert.equal(loaded!.api.access_mode, 'api-key');
      assert.equal(loaded!.api.api_key, 'mctk_testkey12345678901234567890');
      assert.equal(loaded!.api.port, 4001);
      assert.equal(loaded!.console.port, 4000);
    });
  });
});
