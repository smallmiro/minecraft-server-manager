import { test, expect } from '@playwright/test';
import {
  createConfigSnapshotViaApi,
  listConfigSnapshotsViaApi,
  getConfigSnapshotViaApi,
  deleteConfigSnapshotViaApi,
  restoreConfigSnapshotViaApi,
  diffConfigSnapshotsViaApi,
  createScheduleViaApi,
  listSchedulesViaApi,
  toggleScheduleViaApi,
  deleteScheduleViaApi,
  getFirstServerName,
  isApiReachable,
  cleanupSnapshots,
  cleanupSchedules,
  assertSnapshotStructure,
  assertScheduleStructure,
} from '../../fixtures/config-snapshot-helpers';

const API_BASE_URL = process.env.E2E_API_URL || 'http://localhost:5001';

/**
 * Config Snapshot API Integration Tests
 *
 * Tests the REST API endpoints for:
 * - Snapshot CRUD (create, list, get, delete)
 * - Snapshot diff
 * - Snapshot restore
 * - Schedule CRUD (create, list, get, update, toggle, delete)
 *
 * These tests are designed to be idempotent and clean up after themselves.
 * They gracefully skip when the API or test server is not available.
 */
test.describe('Config Snapshot API', () => {
  // ============================================================
  // Snapshot CRUD
  // ============================================================

  test.describe('Snapshot CRUD', () => {
    test('GET /api/servers/:name/config-snapshots returns 404 for unknown server', async ({ request }) => {
      const response = await request.get(
        `${API_BASE_URL}/api/servers/nonexistent-server-xyz123/config-snapshots`
      );
      expect(response.status()).toBe(404);

      const body = await response.json();
      expect(body).toHaveProperty('error', 'NotFound');
      expect(body).toHaveProperty('message');
    });

    test('GET /api/servers/:name/config-snapshots returns list with correct structure', async ({ request }) => {
      const serverName = await getFirstServerName();
      if (!serverName) {
        test.skip();
        return;
      }

      const response = await request.get(
        `${API_BASE_URL}/api/servers/${serverName}/config-snapshots`
      );
      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(body).toHaveProperty('snapshots');
      expect(body).toHaveProperty('total');
      expect(Array.isArray(body.snapshots)).toBe(true);
      expect(typeof body.total).toBe('number');
      expect(body.total).toBeGreaterThanOrEqual(0);
    });

    test('GET /api/servers/:name/config-snapshots supports limit and offset', async ({ request }) => {
      const serverName = await getFirstServerName();
      if (!serverName) {
        test.skip();
        return;
      }

      const response = await request.get(
        `${API_BASE_URL}/api/servers/${serverName}/config-snapshots?limit=5&offset=0`
      );
      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(body.snapshots.length).toBeLessThanOrEqual(5);
    });

    test('POST /api/servers/:name/config-snapshots creates a snapshot', async ({ request }) => {
      const serverName = await getFirstServerName();
      if (!serverName) {
        test.skip();
        return;
      }

      const createdIds: string[] = [];

      try {
        const response = await request.post(
          `${API_BASE_URL}/api/servers/${serverName}/config-snapshots`,
          {
            data: { description: 'E2E test snapshot' },
          }
        );
        expect(response.status()).toBe(201);

        const body = await response.json();
        assertSnapshotStructure(body);
        expect(body.serverName).toBe(serverName);
        expect(body.description).toBe('E2E test snapshot');
        expect(Array.isArray(body.files)).toBe(true);

        createdIds.push(body.id);
      } finally {
        await cleanupSnapshots(serverName, createdIds);
      }
    });

    test('POST /api/servers/:name/config-snapshots returns 404 for unknown server', async ({ request }) => {
      const response = await request.post(
        `${API_BASE_URL}/api/servers/nonexistent-server-xyz123/config-snapshots`,
        { data: { description: 'should fail' } }
      );
      expect(response.status()).toBe(404);
    });

    test('GET /api/servers/:name/config-snapshots/:id returns snapshot detail', async () => {
      const serverName = await getFirstServerName();
      if (!serverName) {
        test.skip();
        return;
      }

      const createdIds: string[] = [];

      try {
        const created = await createConfigSnapshotViaApi(serverName, 'detail test');
        if (!created) {
          test.skip();
          return;
        }
        createdIds.push(created.id);

        const fetched = await getConfigSnapshotViaApi(serverName, created.id);
        expect(fetched).not.toBeNull();
        expect(fetched!.id).toBe(created.id);
        expect(fetched!.serverName).toBe(serverName);
        assertSnapshotStructure(fetched);
      } finally {
        await cleanupSnapshots(serverName, createdIds);
      }
    });

    test('GET /api/servers/:name/config-snapshots/:id returns 404 for unknown id', async ({ request }) => {
      const serverName = await getFirstServerName();
      if (!serverName) {
        test.skip();
        return;
      }

      const response = await request.get(
        `${API_BASE_URL}/api/servers/${serverName}/config-snapshots/nonexistent-snapshot-id`
      );
      expect(response.status()).toBe(404);
    });

    test('DELETE /api/servers/:name/config-snapshots/:id deletes a snapshot', async () => {
      const serverName = await getFirstServerName();
      if (!serverName) {
        test.skip();
        return;
      }

      const created = await createConfigSnapshotViaApi(serverName, 'delete test');
      if (!created) {
        test.skip();
        return;
      }

      const deleted = await deleteConfigSnapshotViaApi(serverName, created.id);
      expect(deleted).toBe(true);

      // Verify it's gone
      const fetched = await getConfigSnapshotViaApi(serverName, created.id);
      expect(fetched).toBeNull();
    });

    test('DELETE /api/servers/:name/config-snapshots/:id returns 404 for unknown id', async ({ request }) => {
      const serverName = await getFirstServerName();
      if (!serverName) {
        test.skip();
        return;
      }

      const response = await request.delete(
        `${API_BASE_URL}/api/servers/${serverName}/config-snapshots/nonexistent-snapshot-id`
      );
      expect(response.status()).toBe(404);
    });

    test('full CRUD lifecycle: create → list → get → delete', async () => {
      const serverName = await getFirstServerName();
      if (!serverName) {
        test.skip();
        return;
      }

      // Step 1: Create snapshot
      const created = await createConfigSnapshotViaApi(serverName, 'CRUD lifecycle test');
      if (!created) {
        test.skip();
        return;
      }

      try {
        assertSnapshotStructure(created);
        expect(created.description).toBe('CRUD lifecycle test');

        // Step 2: Verify it appears in list
        const list = await listConfigSnapshotsViaApi(serverName);
        const found = list.snapshots.find((s) => s.id === created.id);
        expect(found).toBeDefined();
        expect(list.total).toBeGreaterThan(0);

        // Step 3: Get individual snapshot
        const fetched = await getConfigSnapshotViaApi(serverName, created.id);
        expect(fetched).not.toBeNull();
        expect(fetched!.id).toBe(created.id);

        // Step 4: Delete snapshot
        const deleted = await deleteConfigSnapshotViaApi(serverName, created.id);
        expect(deleted).toBe(true);

        // Step 5: Verify it's gone from list
        const listAfter = await listConfigSnapshotsViaApi(serverName);
        const foundAfter = listAfter.snapshots.find((s) => s.id === created.id);
        expect(foundAfter).toBeUndefined();
      } catch (err) {
        // Ensure cleanup even if assertions fail
        await cleanupSnapshots(serverName, [created.id]);
        throw err;
      }
    });
  });

  // ============================================================
  // Snapshot Diff
  // ============================================================

  test.describe('Snapshot Diff', () => {
    test('GET /api/config-snapshots/:id1/diff/:id2 returns diff structure', async () => {
      const serverName = await getFirstServerName();
      if (!serverName) {
        test.skip();
        return;
      }

      const createdIds: string[] = [];

      try {
        // Create two snapshots to compare
        const snap1 = await createConfigSnapshotViaApi(serverName, 'diff base');
        if (!snap1) {
          test.skip();
          return;
        }
        createdIds.push(snap1.id);

        const snap2 = await createConfigSnapshotViaApi(serverName, 'diff compare');
        if (!snap2) {
          test.skip();
          return;
        }
        createdIds.push(snap2.id);

        const diff = await diffConfigSnapshotsViaApi(snap1.id, snap2.id);

        // Verify diff response structure
        expect(diff).toHaveProperty('baseSnapshotId', snap1.id);
        expect(diff).toHaveProperty('compareSnapshotId', snap2.id);
        expect(diff).toHaveProperty('changes');
        expect(diff).toHaveProperty('summary');
        expect(diff).toHaveProperty('hasChanges');
        expect(Array.isArray(diff.changes)).toBe(true);
        expect(typeof diff.hasChanges).toBe('boolean');
        expect(diff.summary).toHaveProperty('added');
        expect(diff.summary).toHaveProperty('modified');
        expect(diff.summary).toHaveProperty('deleted');
      } finally {
        await cleanupSnapshots(serverName, createdIds);
      }
    });

    test('GET /api/config-snapshots/:id1/diff/:id2 returns 404 for unknown snapshot', async ({ request }) => {
      const response = await request.get(
        `${API_BASE_URL}/api/config-snapshots/nonexistent-id-1/diff/nonexistent-id-2`
      );
      expect(response.status()).toBe(404);
    });

    test('diff between identical snapshots shows no changes', async () => {
      const serverName = await getFirstServerName();
      if (!serverName) {
        test.skip();
        return;
      }

      const createdIds: string[] = [];

      try {
        const snap1 = await createConfigSnapshotViaApi(serverName, 'identical base');
        if (!snap1) {
          test.skip();
          return;
        }
        createdIds.push(snap1.id);

        // Diff a snapshot with itself - should show no changes
        const diff = await diffConfigSnapshotsViaApi(snap1.id, snap1.id);
        expect(diff.hasChanges).toBe(false);
        expect(diff.changes).toHaveLength(0);
        expect(diff.summary.added).toBe(0);
        expect(diff.summary.modified).toBe(0);
        expect(diff.summary.deleted).toBe(0);
      } finally {
        await cleanupSnapshots(serverName, createdIds);
      }
    });

    test('each change entry has required fields', async () => {
      const serverName = await getFirstServerName();
      if (!serverName) {
        test.skip();
        return;
      }

      const createdIds: string[] = [];

      try {
        const snap1 = await createConfigSnapshotViaApi(serverName, 'change check base');
        const snap2 = await createConfigSnapshotViaApi(serverName, 'change check compare');
        if (!snap1 || !snap2) {
          test.skip();
          return;
        }
        createdIds.push(snap1.id, snap2.id);

        const diff = await diffConfigSnapshotsViaApi(snap1.id, snap2.id);

        for (const change of diff.changes) {
          expect(change).toHaveProperty('path');
          expect(change).toHaveProperty('status');
          expect(['added', 'modified', 'deleted']).toContain(change.status);
          expect(typeof change.path).toBe('string');
        }
      } finally {
        await cleanupSnapshots(serverName, createdIds);
      }
    });
  });

  // ============================================================
  // Snapshot Restore
  // ============================================================

  test.describe('Snapshot Restore', () => {
    test('POST /api/servers/:name/config-snapshots/:id/restore restores with safety snapshot', async () => {
      const serverName = await getFirstServerName();
      if (!serverName) {
        test.skip();
        return;
      }

      const createdIds: string[] = [];

      try {
        const snap = await createConfigSnapshotViaApi(serverName, 'restore base');
        if (!snap) {
          test.skip();
          return;
        }
        createdIds.push(snap.id);

        const result = await restoreConfigSnapshotViaApi(serverName, snap.id, {
          createSnapshotBeforeRestore: true,
          force: true,
        });

        expect(result).toHaveProperty('restored');
        assertSnapshotStructure(result.restored);
        expect(result.restored.id).toBe(snap.id);

        // Safety snapshot should be created
        if (result.safetySnapshot) {
          assertSnapshotStructure(result.safetySnapshot);
          createdIds.push(result.safetySnapshot.id);
        }
      } finally {
        await cleanupSnapshots(serverName, createdIds);
      }
    });

    test('POST /api/servers/:name/config-snapshots/:id/restore without safety snapshot', async () => {
      const serverName = await getFirstServerName();
      if (!serverName) {
        test.skip();
        return;
      }

      const createdIds: string[] = [];

      try {
        const snap = await createConfigSnapshotViaApi(serverName, 'restore no safety');
        if (!snap) {
          test.skip();
          return;
        }
        createdIds.push(snap.id);

        const result = await restoreConfigSnapshotViaApi(serverName, snap.id, {
          createSnapshotBeforeRestore: false,
          force: true,
        });

        expect(result).toHaveProperty('restored');
        expect(result.safetySnapshot).toBeUndefined();
      } finally {
        await cleanupSnapshots(serverName, createdIds);
      }
    });

    test('POST /api/servers/:name/config-snapshots/:id/restore returns 404 for unknown snapshot', async ({ request }) => {
      const serverName = await getFirstServerName();
      if (!serverName) {
        test.skip();
        return;
      }

      const response = await request.post(
        `${API_BASE_URL}/api/servers/${serverName}/config-snapshots/nonexistent-id/restore`,
        { data: { force: true } }
      );
      expect(response.status()).toBe(404);
    });

    test('POST /api/servers/:name/config-snapshots/:id/restore returns 404 for unknown server', async ({ request }) => {
      const response = await request.post(
        `${API_BASE_URL}/api/servers/nonexistent-server-xyz123/config-snapshots/some-id/restore`,
        { data: { force: true } }
      );
      expect(response.status()).toBe(404);
    });
  });

  // ============================================================
  // Schedule CRUD
  // ============================================================

  test.describe('Schedule CRUD', () => {
    test('GET /api/config-snapshot-schedules returns list with correct structure', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/api/config-snapshot-schedules`);
      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(body).toHaveProperty('schedules');
      expect(Array.isArray(body.schedules)).toBe(true);
    });

    test('POST /api/config-snapshot-schedules creates a schedule', async () => {
      const serverName = await getFirstServerName();
      if (!serverName) {
        test.skip();
        return;
      }

      const createdIds: string[] = [];

      try {
        const schedule = await createScheduleViaApi({
          serverName,
          name: `E2E test schedule ${Date.now()}`,
          cronExpression: '0 * * * *',
          retentionCount: 5,
          enabled: true,
        });

        assertScheduleStructure(schedule);
        expect(schedule.serverName).toBe(serverName);
        expect(schedule.cronExpression).toBe('0 * * * *');
        expect(schedule.retentionCount).toBe(5);
        expect(schedule.enabled).toBe(true);

        createdIds.push(schedule.id);
      } finally {
        await cleanupSchedules(createdIds);
      }
    });

    test('POST /api/config-snapshot-schedules validates cron expression', async ({ request }) => {
      const serverName = await getFirstServerName();
      if (!serverName) {
        test.skip();
        return;
      }

      const response = await request.post(`${API_BASE_URL}/api/config-snapshot-schedules`, {
        data: {
          serverName,
          name: 'invalid cron test',
          cronExpression: 'not-a-valid-cron',
          retentionCount: 5,
        },
      });

      // Should return 400 for invalid cron expression
      expect(response.status()).toBe(400);
    });

    test('GET /api/config-snapshot-schedules/:id returns schedule detail', async () => {
      const serverName = await getFirstServerName();
      if (!serverName) {
        test.skip();
        return;
      }

      const createdIds: string[] = [];

      try {
        const created = await createScheduleViaApi({
          serverName,
          name: `get detail schedule ${Date.now()}`,
          cronExpression: '30 6 * * *',
          retentionCount: 3,
        });
        createdIds.push(created.id);

        const list = await listSchedulesViaApi();
        const found = list.schedules.find((s) => s.id === created.id);
        expect(found).toBeDefined();
        assertScheduleStructure(found!);
      } finally {
        await cleanupSchedules(createdIds);
      }
    });

    test('GET /api/config-snapshot-schedules filters by serverName', async () => {
      const serverName = await getFirstServerName();
      if (!serverName) {
        test.skip();
        return;
      }

      const createdIds: string[] = [];

      try {
        const created = await createScheduleViaApi({
          serverName,
          name: `filter by server ${Date.now()}`,
          cronExpression: '0 12 * * *',
          retentionCount: 5,
        });
        createdIds.push(created.id);

        const filtered = await listSchedulesViaApi(serverName);
        expect(Array.isArray(filtered.schedules)).toBe(true);

        // All returned schedules should belong to the requested server
        for (const schedule of filtered.schedules) {
          expect(schedule.serverName).toBe(serverName);
        }
      } finally {
        await cleanupSchedules(createdIds);
      }
    });

    test('PATCH /api/config-snapshot-schedules/:id/toggle disables a schedule', async () => {
      const serverName = await getFirstServerName();
      if (!serverName) {
        test.skip();
        return;
      }

      const createdIds: string[] = [];

      try {
        const created = await createScheduleViaApi({
          serverName,
          name: `toggle disable ${Date.now()}`,
          cronExpression: '0 2 * * *',
          retentionCount: 5,
          enabled: true,
        });
        createdIds.push(created.id);
        expect(created.enabled).toBe(true);

        const disabled = await toggleScheduleViaApi(created.id, false);
        expect(disabled.enabled).toBe(false);
        expect(disabled.id).toBe(created.id);
      } finally {
        await cleanupSchedules(createdIds);
      }
    });

    test('PATCH /api/config-snapshot-schedules/:id/toggle enables a schedule', async () => {
      const serverName = await getFirstServerName();
      if (!serverName) {
        test.skip();
        return;
      }

      const createdIds: string[] = [];

      try {
        const created = await createScheduleViaApi({
          serverName,
          name: `toggle enable ${Date.now()}`,
          cronExpression: '0 3 * * *',
          retentionCount: 5,
          enabled: false,
        });
        createdIds.push(created.id);
        expect(created.enabled).toBe(false);

        const enabled = await toggleScheduleViaApi(created.id, true);
        expect(enabled.enabled).toBe(true);
      } finally {
        await cleanupSchedules(createdIds);
      }
    });

    test('PATCH /api/config-snapshot-schedules/:id/toggle returns 404 for unknown id', async ({ request }) => {
      const response = await request.patch(
        `${API_BASE_URL}/api/config-snapshot-schedules/nonexistent-schedule-id/toggle`,
        { data: { enabled: true } }
      );
      expect(response.status()).toBe(404);
    });

    test('DELETE /api/config-snapshot-schedules/:id deletes a schedule', async () => {
      const serverName = await getFirstServerName();
      if (!serverName) {
        test.skip();
        return;
      }

      const created = await createScheduleViaApi({
        serverName,
        name: `delete test ${Date.now()}`,
        cronExpression: '0 4 * * *',
        retentionCount: 5,
      });

      const deleted = await deleteScheduleViaApi(created.id);
      expect(deleted).toBe(true);

      // Verify it's gone from list
      const list = await listSchedulesViaApi();
      const found = list.schedules.find((s) => s.id === created.id);
      expect(found).toBeUndefined();
    });

    test('DELETE /api/config-snapshot-schedules/:id returns 404 for unknown id', async ({ request }) => {
      const response = await request.delete(
        `${API_BASE_URL}/api/config-snapshot-schedules/nonexistent-schedule-id`
      );
      expect(response.status()).toBe(404);
    });

    test('full schedule lifecycle: create → list → toggle → delete', async () => {
      const serverName = await getFirstServerName();
      if (!serverName) {
        test.skip();
        return;
      }

      // Step 1: Create schedule
      const created = await createScheduleViaApi({
        serverName,
        name: `full lifecycle ${Date.now()}`,
        cronExpression: '0 5 * * *',
        retentionCount: 7,
        enabled: true,
      });

      try {
        assertScheduleStructure(created);
        expect(created.enabled).toBe(true);

        // Step 2: Verify in list
        const list = await listSchedulesViaApi();
        const found = list.schedules.find((s) => s.id === created.id);
        expect(found).toBeDefined();

        // Step 3: Disable
        const disabled = await toggleScheduleViaApi(created.id, false);
        expect(disabled.enabled).toBe(false);

        // Step 4: Re-enable
        const enabled = await toggleScheduleViaApi(created.id, true);
        expect(enabled.enabled).toBe(true);

        // Step 5: Delete
        const deleted = await deleteScheduleViaApi(created.id);
        expect(deleted).toBe(true);

        // Step 6: Confirm deletion
        const listAfter = await listSchedulesViaApi();
        const foundAfter = listAfter.schedules.find((s) => s.id === created.id);
        expect(foundAfter).toBeUndefined();
      } catch (err) {
        // Ensure cleanup
        await cleanupSchedules([created.id]);
        throw err;
      }
    });
  });

  // ============================================================
  // Response schema validation
  // ============================================================

  test.describe('Response Schema Validation', () => {
    test('snapshot response matches OpenAPI schema fields', async () => {
      const serverName = await getFirstServerName();
      if (!serverName) {
        test.skip();
        return;
      }

      const createdIds: string[] = [];

      try {
        const snap = await createConfigSnapshotViaApi(serverName, 'schema validation');
        if (!snap) {
          test.skip();
          return;
        }
        createdIds.push(snap.id);

        // Validate all required fields are present and have correct types
        expect(typeof snap.id).toBe('string');
        expect(snap.id.length).toBeGreaterThan(0);
        expect(typeof snap.serverName).toBe('string');
        expect(typeof snap.description).toBe('string');
        expect(typeof snap.createdAt).toBe('string');
        expect(Array.isArray(snap.files)).toBe(true);

        // createdAt should be valid ISO 8601
        const date = new Date(snap.createdAt);
        expect(isNaN(date.getTime())).toBe(false);

        // Validate file entries if any
        for (const file of snap.files) {
          expect(typeof file.path).toBe('string');
          expect(typeof file.hash).toBe('string');
          expect(typeof file.size).toBe('number');
          expect(file.size).toBeGreaterThanOrEqual(0);
        }
      } finally {
        await cleanupSnapshots(serverName, createdIds);
      }
    });

    test('schedule response matches OpenAPI schema fields', async () => {
      const serverName = await getFirstServerName();
      if (!serverName) {
        test.skip();
        return;
      }

      const createdIds: string[] = [];

      try {
        const schedule = await createScheduleViaApi({
          serverName,
          name: `schema test ${Date.now()}`,
          cronExpression: '0 6 * * *',
          retentionCount: 10,
          enabled: true,
        });
        createdIds.push(schedule.id);

        expect(typeof schedule.id).toBe('string');
        expect(schedule.id.length).toBeGreaterThan(0);
        expect(typeof schedule.serverName).toBe('string');
        expect(typeof schedule.name).toBe('string');
        expect(typeof schedule.cronExpression).toBe('string');
        expect(typeof schedule.retentionCount).toBe('number');
        expect(typeof schedule.enabled).toBe('boolean');
        expect(typeof schedule.createdAt).toBe('string');
        expect(typeof schedule.updatedAt).toBe('string');
      } finally {
        await cleanupSchedules(createdIds);
      }
    });

    test('list response has consistent total count', async () => {
      const serverName = await getFirstServerName();
      if (!serverName) {
        test.skip();
        return;
      }

      const createdIds: string[] = [];

      try {
        // Create a snapshot so there is something to list
        const snap = await createConfigSnapshotViaApi(serverName, 'consistency check');
        if (!snap) {
          test.skip();
          return;
        }
        createdIds.push(snap.id);

        // Fetch twice to check consistency
        const list1 = await listConfigSnapshotsViaApi(serverName);
        const list2 = await listConfigSnapshotsViaApi(serverName);

        expect(list1.total).toBe(list2.total);
        expect(list1.snapshots.length).toBe(list2.snapshots.length);
      } finally {
        await cleanupSnapshots(serverName, createdIds);
      }
    });
  });

  // ============================================================
  // Content-Type validation
  // ============================================================

  test.describe('Content-Type Headers', () => {
    test('config-snapshots list endpoint returns JSON content-type', async ({ request }) => {
      const serverName = await getFirstServerName();
      if (!serverName) {
        test.skip();
        return;
      }

      const response = await request.get(
        `${API_BASE_URL}/api/servers/${serverName}/config-snapshots`
      );
      const contentType = response.headers()['content-type'];
      expect(contentType).toContain('application/json');
    });

    test('schedules list endpoint returns JSON content-type', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/api/config-snapshot-schedules`);
      const contentType = response.headers()['content-type'];
      expect(contentType).toContain('application/json');
    });
  });
});
