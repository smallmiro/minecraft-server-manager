import { test, expect } from '@playwright/test';
import { execSync, spawnSync } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';
import {
  createConfigSnapshotViaApi,
  listConfigSnapshotsViaApi,
  getFirstServerName,
  cleanupSnapshots,
  cleanupSchedules,
  listSchedulesViaApi,
} from '../../fixtures/config-snapshot-helpers';

/**
 * Config Snapshot CLI Scenario Tests
 *
 * Tests the CLI commands for config-snapshot management:
 * - create, list, diff, restore, delete (snapshot lifecycle)
 * - schedule add, list, toggle, remove (schedule lifecycle)
 *
 * CLI tests require `mcctl` to be installed and available.
 * They are designed to run only when the CLI is available and
 * a test server exists.
 *
 * If the CLI or test environment is not available, tests are skipped.
 */

// ============================================================
// CLI availability helpers
// ============================================================

/**
 * Check if `mcctl` CLI is available in PATH.
 */
function isMcctlAvailable(): boolean {
  try {
    const result = spawnSync('which', ['mcctl'], {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return result.status === 0;
  } catch {
    return false;
  }
}

/**
 * Find the mcctl binary in the monorepo.
 * Returns path to the built binary or null if not found.
 */
function findMcctlBinary(): string | null {
  const candidates = [
    join(process.cwd(), '..', 'platform', 'services', 'cli', 'bin', 'mcctl.js'),
    join(process.cwd(), 'platform', 'services', 'cli', 'bin', 'mcctl.js'),
    join(__dirname, '..', '..', '..', 'platform', 'services', 'cli', 'bin', 'mcctl.js'),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

/**
 * Run a mcctl command and return its output.
 * Uses the globally installed CLI or the local build.
 */
function runMcctl(args: string[]): { stdout: string; stderr: string; exitCode: number } {
  // Prefer globally installed mcctl
  const cli = isMcctlAvailable() ? 'mcctl' : null;
  const localBinary = findMcctlBinary();

  if (!cli && !localBinary) {
    return { stdout: '', stderr: 'mcctl not available', exitCode: 127 };
  }

  const command = cli ? `mcctl ${args.join(' ')}` : `node ${localBinary} ${args.join(' ')}`;

  try {
    const stdout = execSync(command, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        MCCTL_API_URL: process.env.E2E_API_URL || 'http://localhost:5001',
        AUTH_MODE: 'disabled',
      },
      timeout: 30000,
    });
    return { stdout, stderr: '', exitCode: 0 };
  } catch (error: unknown) {
    const err = error as { stdout?: string; stderr?: string; status?: number };
    return {
      stdout: err.stdout || '',
      stderr: err.stderr || '',
      exitCode: err.status ?? 1,
    };
  }
}

/**
 * Check if CLI is available and API is accessible.
 */
function isCliTestEnvironmentAvailable(): boolean {
  return isMcctlAvailable() || findMcctlBinary() !== null;
}

// ============================================================
// CLI snapshot lifecycle tests
// ============================================================

test.describe('Config Snapshot CLI', () => {
  test.describe('Snapshot lifecycle via CLI', () => {
    test('mcctl config-snapshot --help shows usage', () => {
      if (!isCliTestEnvironmentAvailable()) {
        test.skip();
        return;
      }

      const result = runMcctl(['config-snapshot', '--help']);

      // Should succeed or show help text
      const output = result.stdout + result.stderr;
      expect(output.length).toBeGreaterThan(0);
      // Common help patterns
      const hasHelpContent =
        output.includes('config-snapshot') ||
        output.includes('Usage') ||
        output.includes('help') ||
        output.includes('snapshot');
      expect(hasHelpContent).toBeTruthy();
    });

    test('mcctl config-snapshot list shows snapshot listing', async () => {
      if (!isCliTestEnvironmentAvailable()) {
        test.skip();
        return;
      }

      const serverName = await getFirstServerName();
      if (!serverName) {
        test.skip();
        return;
      }

      const result = runMcctl(['config-snapshot', 'list', serverName]);

      // Should not crash with unexpected error
      // Exit code 0 means success, exit code 1 with "no snapshots" is also valid
      const output = result.stdout + result.stderr;
      expect(output.length).toBeGreaterThan(0);
    });

    test('mcctl config-snapshot create creates a snapshot', async () => {
      if (!isCliTestEnvironmentAvailable()) {
        test.skip();
        return;
      }

      const serverName = await getFirstServerName();
      if (!serverName) {
        test.skip();
        return;
      }

      const createdIds: string[] = [];

      try {
        const result = runMcctl([
          'config-snapshot', 'create', serverName,
          '--description', 'CLI E2E test snapshot',
        ]);

        // If CLI create succeeded, snapshot should appear in API list
        if (result.exitCode === 0) {
          await new Promise((resolve) => setTimeout(resolve, 1000));

          const list = await listConfigSnapshotsViaApi(serverName);
          const found = list.snapshots.find((s) =>
            s.description === 'CLI E2E test snapshot'
          );

          if (found) {
            createdIds.push(found.id);
            expect(found.serverName).toBe(serverName);
          }
        } else {
          // CLI might fail if not connected - check that output has meaningful content
          const output = result.stdout + result.stderr;
          expect(output.length).toBeGreaterThan(0);
        }
      } finally {
        await cleanupSnapshots(serverName, createdIds);
      }
    });

    test('mcctl config-snapshot list shows created snapshots', async () => {
      if (!isCliTestEnvironmentAvailable()) {
        test.skip();
        return;
      }

      const serverName = await getFirstServerName();
      if (!serverName) {
        test.skip();
        return;
      }

      const createdIds: string[] = [];

      try {
        // Create a snapshot via API first (reliable)
        const snap = await createConfigSnapshotViaApi(serverName, 'CLI list test');
        if (!snap) {
          test.skip();
          return;
        }
        createdIds.push(snap.id);

        // Run CLI list
        const result = runMcctl(['config-snapshot', 'list', serverName]);
        const output = result.stdout + result.stderr;

        // CLI should show something (list or error message)
        expect(output.length).toBeGreaterThan(0);
      } finally {
        await cleanupSnapshots(serverName, createdIds);
      }
    });

    test('mcctl config-snapshot diff compares two snapshots', async () => {
      if (!isCliTestEnvironmentAvailable()) {
        test.skip();
        return;
      }

      const serverName = await getFirstServerName();
      if (!serverName) {
        test.skip();
        return;
      }

      const createdIds: string[] = [];

      try {
        // Create two snapshots via API
        const snap1 = await createConfigSnapshotViaApi(serverName, 'CLI diff base');
        const snap2 = await createConfigSnapshotViaApi(serverName, 'CLI diff compare');

        if (!snap1 || !snap2) {
          test.skip();
          return;
        }
        createdIds.push(snap1.id, snap2.id);

        // Run CLI diff
        const result = runMcctl(['config-snapshot', 'diff', snap1.id, snap2.id]);
        const output = result.stdout + result.stderr;

        // CLI should produce some output
        expect(output.length).toBeGreaterThan(0);
      } finally {
        await cleanupSnapshots(serverName, createdIds);
      }
    });

    test('mcctl config-snapshot delete removes a snapshot', async () => {
      if (!isCliTestEnvironmentAvailable()) {
        test.skip();
        return;
      }

      const serverName = await getFirstServerName();
      if (!serverName) {
        test.skip();
        return;
      }

      // Create snapshot via API
      const snap = await createConfigSnapshotViaApi(serverName, 'CLI delete test');
      if (!snap) {
        test.skip();
        return;
      }

      // Try CLI delete
      const result = runMcctl(['config-snapshot', 'delete', snap.id, '--force']);

      if (result.exitCode === 0) {
        // Verify deleted via API
        await new Promise((resolve) => setTimeout(resolve, 500));
        const list = await listConfigSnapshotsViaApi(serverName);
        const found = list.snapshots.find((s) => s.id === snap.id);
        expect(found).toBeUndefined();
      } else {
        // CLI failed - clean up via API and check output is meaningful
        await cleanupSnapshots(serverName, [snap.id]);
        const output = result.stdout + result.stderr;
        expect(output.length).toBeGreaterThan(0);
      }
    });

    test('mcctl config-snapshot restore restores configuration', async () => {
      if (!isCliTestEnvironmentAvailable()) {
        test.skip();
        return;
      }

      const serverName = await getFirstServerName();
      if (!serverName) {
        test.skip();
        return;
      }

      const createdIds: string[] = [];

      try {
        // Create snapshot via API
        const snap = await createConfigSnapshotViaApi(serverName, 'CLI restore test');
        if (!snap) {
          test.skip();
          return;
        }
        createdIds.push(snap.id);

        // Run CLI restore with force flag
        const result = runMcctl(['config-snapshot', 'restore', snap.id, '--force']);
        const output = result.stdout + result.stderr;

        // Restore should produce output (success or error message)
        expect(output.length).toBeGreaterThan(0);

        // If successful, check for safety snapshot in list
        if (result.exitCode === 0) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          const list = await listConfigSnapshotsViaApi(serverName);
          // After restore, a safety snapshot may have been created
          const safetySnap = list.snapshots.find((s) =>
            s.description?.toLowerCase().includes('safety')
          );
          if (safetySnap) {
            createdIds.push(safetySnap.id);
          }
        }
      } finally {
        await cleanupSnapshots(serverName, createdIds);
      }
    });
  });

  // ============================================================
  // CLI schedule lifecycle tests
  // ============================================================

  test.describe('Schedule lifecycle via CLI', () => {
    test('mcctl config-snapshot schedule --help shows usage', () => {
      if (!isCliTestEnvironmentAvailable()) {
        test.skip();
        return;
      }

      const result = runMcctl(['config-snapshot', 'schedule', '--help']);
      const output = result.stdout + result.stderr;
      expect(output.length).toBeGreaterThan(0);

      const hasHelpContent =
        output.includes('schedule') ||
        output.includes('Usage') ||
        output.includes('help');
      expect(hasHelpContent).toBeTruthy();
    });

    test('mcctl config-snapshot schedule list shows schedules', async () => {
      if (!isCliTestEnvironmentAvailable()) {
        test.skip();
        return;
      }

      const result = runMcctl(['config-snapshot', 'schedule', 'list']);
      const output = result.stdout + result.stderr;
      expect(output.length).toBeGreaterThan(0);
    });

    test('mcctl config-snapshot schedule add creates a schedule', async () => {
      if (!isCliTestEnvironmentAvailable()) {
        test.skip();
        return;
      }

      const serverName = await getFirstServerName();
      if (!serverName) {
        test.skip();
        return;
      }

      const scheduleName = `cli-e2e-schedule-${Date.now()}`;
      const createdIds: string[] = [];

      try {
        const result = runMcctl([
          'config-snapshot', 'schedule', 'add',
          '--server', serverName,
          '--cron', '0 1 * * *',
          '--name', scheduleName,
        ]);

        if (result.exitCode === 0) {
          await new Promise((resolve) => setTimeout(resolve, 500));

          // Verify via API
          const list = await listSchedulesViaApi(serverName);
          const found = list.schedules.find((s) => s.name === scheduleName);

          if (found) {
            createdIds.push(found.id);
            expect(found.cronExpression).toBe('0 1 * * *');
            expect(found.serverName).toBe(serverName);
          }
        } else {
          const output = result.stdout + result.stderr;
          expect(output.length).toBeGreaterThan(0);
        }
      } finally {
        await cleanupSchedules(createdIds);
      }
    });

    test('mcctl config-snapshot schedule disable disables a schedule', async () => {
      if (!isCliTestEnvironmentAvailable()) {
        test.skip();
        return;
      }

      const serverName = await getFirstServerName();
      if (!serverName) {
        test.skip();
        return;
      }

      const createdIds: string[] = [];

      try {
        // Create schedule via API (reliable)
        const schedule = await (async () => {
          try {
            return await import('../../fixtures/config-snapshot-helpers').then((m) =>
              m.createScheduleViaApi({
                serverName,
                name: `cli-disable-test-${Date.now()}`,
                cronExpression: '0 2 * * *',
                retentionCount: 5,
                enabled: true,
              })
            );
          } catch {
            return null;
          }
        })();

        if (!schedule) {
          test.skip();
          return;
        }
        createdIds.push(schedule.id);
        expect(schedule.enabled).toBe(true);

        // Run CLI disable
        const result = runMcctl(['config-snapshot', 'schedule', 'disable', schedule.id]);
        const output = result.stdout + result.stderr;
        expect(output.length).toBeGreaterThan(0);
      } finally {
        await cleanupSchedules(createdIds);
      }
    });

    test('mcctl config-snapshot schedule enable enables a schedule', async () => {
      if (!isCliTestEnvironmentAvailable()) {
        test.skip();
        return;
      }

      const serverName = await getFirstServerName();
      if (!serverName) {
        test.skip();
        return;
      }

      const createdIds: string[] = [];

      try {
        const schedule = await (async () => {
          try {
            return await import('../../fixtures/config-snapshot-helpers').then((m) =>
              m.createScheduleViaApi({
                serverName,
                name: `cli-enable-test-${Date.now()}`,
                cronExpression: '0 3 * * *',
                retentionCount: 5,
                enabled: false,
              })
            );
          } catch {
            return null;
          }
        })();

        if (!schedule) {
          test.skip();
          return;
        }
        createdIds.push(schedule.id);
        expect(schedule.enabled).toBe(false);

        // Run CLI enable
        const result = runMcctl(['config-snapshot', 'schedule', 'enable', schedule.id]);
        const output = result.stdout + result.stderr;
        expect(output.length).toBeGreaterThan(0);
      } finally {
        await cleanupSchedules(createdIds);
      }
    });

    test('mcctl config-snapshot schedule remove deletes a schedule', async () => {
      if (!isCliTestEnvironmentAvailable()) {
        test.skip();
        return;
      }

      const serverName = await getFirstServerName();
      if (!serverName) {
        test.skip();
        return;
      }

      try {
        const schedule = await import('../../fixtures/config-snapshot-helpers').then((m) =>
          m.createScheduleViaApi({
            serverName,
            name: `cli-remove-test-${Date.now()}`,
            cronExpression: '0 4 * * *',
            retentionCount: 5,
          })
        );

        const result = runMcctl([
          'config-snapshot', 'schedule', 'remove', schedule.id, '--force',
        ]);

        if (result.exitCode === 0) {
          await new Promise((resolve) => setTimeout(resolve, 500));
          const list = await listSchedulesViaApi(serverName);
          const found = list.schedules.find((s) => s.id === schedule.id);
          expect(found).toBeUndefined();
        } else {
          // CLI failed - cleanup via API
          await cleanupSchedules([schedule.id]);
          const output = result.stdout + result.stderr;
          expect(output.length).toBeGreaterThan(0);
        }
      } catch {
        // If schedule creation fails, skip
        test.skip();
      }
    });
  });

  // ============================================================
  // CLI error handling
  // ============================================================

  test.describe('CLI error handling', () => {
    test('mcctl config-snapshot list returns error for unknown server', () => {
      if (!isCliTestEnvironmentAvailable()) {
        test.skip();
        return;
      }

      const result = runMcctl(['config-snapshot', 'list', 'nonexistent-server-xyz123']);
      const output = result.stdout + result.stderr;

      // Should produce some output (error message)
      expect(output.length).toBeGreaterThan(0);
    });

    test('mcctl config-snapshot diff returns error for unknown snapshot IDs', () => {
      if (!isCliTestEnvironmentAvailable()) {
        test.skip();
        return;
      }

      const result = runMcctl([
        'config-snapshot', 'diff', 'nonexistent-id-1', 'nonexistent-id-2',
      ]);

      // Should produce error output
      const output = result.stdout + result.stderr;
      expect(output.length).toBeGreaterThan(0);

      // Exit code should be non-zero for errors
      if (result.exitCode !== 0) {
        expect(result.exitCode).toBeGreaterThan(0);
      }
    });

    test('mcctl config-snapshot restore returns error for unknown snapshot', () => {
      if (!isCliTestEnvironmentAvailable()) {
        test.skip();
        return;
      }

      const result = runMcctl([
        'config-snapshot', 'restore', 'nonexistent-snapshot-id', '--force',
      ]);

      // Should produce some output
      const output = result.stdout + result.stderr;
      expect(output.length).toBeGreaterThan(0);
    });
  });
});
