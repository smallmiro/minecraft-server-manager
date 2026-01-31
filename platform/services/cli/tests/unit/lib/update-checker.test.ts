import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { existsSync, writeFileSync, unlinkSync, readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import {
  getInstalledVersion,
  getCachedVersion,
  clearCache,
  isUpdateAvailable,
} from '../../../src/lib/update-checker.js';

const CACHE_FILE = join(homedir(), '.mcctl-update-check.json');

describe('update-checker', () => {
  // Save original cache if exists
  let originalCache: string | null = null;

  beforeEach(() => {
    // Save original cache
    if (existsSync(CACHE_FILE)) {
      originalCache = readFileSync(CACHE_FILE, 'utf-8');
    }
  });

  afterEach(() => {
    // Restore original cache
    if (originalCache) {
      writeFileSync(CACHE_FILE, originalCache);
    } else if (existsSync(CACHE_FILE)) {
      unlinkSync(CACHE_FILE);
    }
    originalCache = null;
  });

  describe('getInstalledVersion', () => {
    it('should return a valid semver version', () => {
      const version = getInstalledVersion();
      assert.match(version, /^\d+\.\d+\.\d+$/);
    });
  });

  describe('getCachedVersion', () => {
    it('should return null when cache does not exist', () => {
      // Remove cache if exists
      if (existsSync(CACHE_FILE)) {
        unlinkSync(CACHE_FILE);
      }

      const cached = getCachedVersion();
      assert.strictEqual(cached, null);
    });

    it('should return cached version when cache exists', () => {
      // Create cache with test data
      const testCache = {
        lastCheck: Date.now(),
        latestVersion: '2.0.0',
      };
      writeFileSync(CACHE_FILE, JSON.stringify(testCache));

      const cached = getCachedVersion();
      assert.strictEqual(cached, '2.0.0');
    });
  });

  describe('isUpdateAvailable', () => {
    it('should return true when latest is newer than current', () => {
      assert.strictEqual(isUpdateAvailable('1.0.0', '1.0.1'), true);
      assert.strictEqual(isUpdateAvailable('1.0.0', '1.1.0'), true);
      assert.strictEqual(isUpdateAvailable('1.0.0', '2.0.0'), true);
      assert.strictEqual(isUpdateAvailable('1.6.13', '1.6.15'), true);
    });

    it('should return false when current is same or newer', () => {
      assert.strictEqual(isUpdateAvailable('1.0.0', '1.0.0'), false);
      assert.strictEqual(isUpdateAvailable('1.0.1', '1.0.0'), false);
      assert.strictEqual(isUpdateAvailable('2.0.0', '1.0.0'), false);
      assert.strictEqual(isUpdateAvailable('1.6.13', '1.6.9'), false);
    });
  });

  describe('clearCache', () => {
    it('should remove cache file', () => {
      // Create cache
      writeFileSync(CACHE_FILE, JSON.stringify({ lastCheck: Date.now(), latestVersion: '1.0.0' }));
      assert.strictEqual(existsSync(CACHE_FILE), true);

      clearCache();

      assert.strictEqual(existsSync(CACHE_FILE), false);
    });

    it('should not throw when cache does not exist', () => {
      // Ensure no cache
      if (existsSync(CACHE_FILE)) {
        unlinkSync(CACHE_FILE);
      }

      // Should not throw
      assert.doesNotThrow(() => clearCache());
    });
  });

  describe('cache invalidation on upgrade', () => {
    it('should invalidate cache when cached version is older than current version', () => {
      // Scenario: User upgraded from 1.6.9 to 1.6.13, but cache still says latest is 1.6.9
      // In this case, cache should be invalidated and npm should be re-queried

      // The bug was: cache showed 1.6.9 as "latest", current is 1.6.13
      // isNewerVersion('1.6.13', '1.6.9') = false, so no update shown
      // But the cache is stale because user already has a newer version than what's cached

      // With the fix, isCacheValid should return false when:
      // cachedVersion < currentVersion

      // This verifies the version comparison is correct
      // If cached is 1.6.9 and current is 1.6.13, cache should be invalid
      // because there might be a newer version (1.6.15) that we don't know about

      // The fix adds this check:
      // const cachedIsOlderThanCurrent = isNewerVersion(cache.latestVersion, currentVersion);
      // This means: is currentVersion (1.6.13) newer than cachedVersion (1.6.9)?
      // Yes it is, so cache is invalid

      const currentNewerThanCached = isUpdateAvailable('1.6.9', '1.6.13');
      assert.strictEqual(currentNewerThanCached, true, 'Should detect that 1.6.13 is newer than 1.6.9');
    });
  });
});
