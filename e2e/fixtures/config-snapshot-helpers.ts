/**
 * Shared test utilities for Config Snapshot E2E tests.
 *
 * Provides helper functions for:
 * - Creating and cleaning up test data via API
 * - Common assertion helpers
 * - Test data factories
 */

const API_BASE_URL = process.env.E2E_API_URL || 'http://localhost:5001';

// ============================================================
// Type definitions matching API schemas
// ============================================================

export interface ConfigSnapshotFile {
  path: string;
  hash: string;
  size: number;
}

export interface ConfigSnapshotItem {
  id: string;
  serverName: string;
  createdAt: string;
  description: string;
  files: ConfigSnapshotFile[];
  scheduleId?: string;
}

export interface ConfigSnapshotListResponse {
  snapshots: ConfigSnapshotItem[];
  total: number;
}

export interface ConfigSnapshotRestoreResponse {
  restored: ConfigSnapshotItem;
  safetySnapshot?: ConfigSnapshotItem;
}

export interface SnapshotDiffResponse {
  baseSnapshotId: string;
  compareSnapshotId: string;
  changes: FileDiff[];
  summary: {
    added: number;
    modified: number;
    deleted: number;
  };
  hasChanges: boolean;
}

export interface FileDiff {
  path: string;
  status: 'added' | 'modified' | 'deleted';
  oldContent?: string;
  newContent?: string;
  oldHash?: string;
  newHash?: string;
}

export interface ConfigSnapshotScheduleItem {
  id: string;
  serverName: string;
  name: string;
  cronExpression: string;
  retentionCount: number;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  lastRunAt?: string;
}

export interface ConfigSnapshotScheduleListResponse {
  schedules: ConfigSnapshotScheduleItem[];
}

// ============================================================
// API helper functions
// ============================================================

/**
 * Create a config snapshot for a given server via API.
 * Returns the created snapshot or null if server not found.
 */
export async function createConfigSnapshotViaApi(
  serverName: string,
  description?: string
): Promise<ConfigSnapshotItem | null> {
  const response = await fetch(
    `${API_BASE_URL}/api/servers/${encodeURIComponent(serverName)}/config-snapshots`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description }),
    }
  );

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`Failed to create snapshot: ${response.status} ${await response.text()}`);
  }

  return response.json() as Promise<ConfigSnapshotItem>;
}

/**
 * List config snapshots for a server via API.
 */
export async function listConfigSnapshotsViaApi(
  serverName: string,
  limit = 20,
  offset = 0
): Promise<ConfigSnapshotListResponse> {
  const params = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
  });
  const response = await fetch(
    `${API_BASE_URL}/api/servers/${encodeURIComponent(serverName)}/config-snapshots?${params}`,
    { method: 'GET' }
  );

  if (!response.ok) {
    throw new Error(`Failed to list snapshots: ${response.status}`);
  }

  return response.json() as Promise<ConfigSnapshotListResponse>;
}

/**
 * Get a specific config snapshot by ID via API.
 */
export async function getConfigSnapshotViaApi(
  serverName: string,
  snapshotId: string
): Promise<ConfigSnapshotItem | null> {
  const response = await fetch(
    `${API_BASE_URL}/api/servers/${encodeURIComponent(serverName)}/config-snapshots/${snapshotId}`,
    { method: 'GET' }
  );

  if (response.status === 404) return null;

  if (!response.ok) {
    throw new Error(`Failed to get snapshot: ${response.status}`);
  }

  return response.json() as Promise<ConfigSnapshotItem>;
}

/**
 * Delete a config snapshot via API.
 * Returns true on success, false if not found.
 */
export async function deleteConfigSnapshotViaApi(
  serverName: string,
  snapshotId: string
): Promise<boolean> {
  const response = await fetch(
    `${API_BASE_URL}/api/servers/${encodeURIComponent(serverName)}/config-snapshots/${snapshotId}`,
    { method: 'DELETE' }
  );

  if (response.status === 404) return false;
  if (response.status === 204) return true;

  throw new Error(`Failed to delete snapshot: ${response.status}`);
}

/**
 * Restore a config snapshot via API.
 */
export async function restoreConfigSnapshotViaApi(
  serverName: string,
  snapshotId: string,
  options: { createSnapshotBeforeRestore?: boolean; force?: boolean } = {}
): Promise<ConfigSnapshotRestoreResponse> {
  const response = await fetch(
    `${API_BASE_URL}/api/servers/${encodeURIComponent(serverName)}/config-snapshots/${snapshotId}/restore`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        createSnapshotBeforeRestore: options.createSnapshotBeforeRestore ?? true,
        force: options.force ?? false,
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to restore snapshot: ${response.status} ${await response.text()}`);
  }

  return response.json() as Promise<ConfigSnapshotRestoreResponse>;
}

/**
 * Get diff between two snapshots via API.
 */
export async function diffConfigSnapshotsViaApi(
  id1: string,
  id2: string
): Promise<SnapshotDiffResponse> {
  const response = await fetch(
    `${API_BASE_URL}/api/config-snapshots/${id1}/diff/${id2}`,
    { method: 'GET' }
  );

  if (!response.ok) {
    throw new Error(`Failed to get diff: ${response.status}`);
  }

  return response.json() as Promise<SnapshotDiffResponse>;
}

/**
 * Create a config snapshot schedule via API.
 */
export async function createScheduleViaApi(options: {
  serverName: string;
  name: string;
  cronExpression: string;
  retentionCount?: number;
  enabled?: boolean;
}): Promise<ConfigSnapshotScheduleItem> {
  const response = await fetch(`${API_BASE_URL}/api/config-snapshot-schedules`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      serverName: options.serverName,
      name: options.name,
      cronExpression: options.cronExpression,
      retentionCount: options.retentionCount ?? 10,
      enabled: options.enabled ?? true,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to create schedule: ${response.status} ${text}`);
  }

  return response.json() as Promise<ConfigSnapshotScheduleItem>;
}

/**
 * List all config snapshot schedules via API.
 */
export async function listSchedulesViaApi(
  serverName?: string
): Promise<ConfigSnapshotScheduleListResponse> {
  const params = serverName
    ? `?serverName=${encodeURIComponent(serverName)}`
    : '';
  const response = await fetch(
    `${API_BASE_URL}/api/config-snapshot-schedules${params}`,
    { method: 'GET' }
  );

  if (!response.ok) {
    throw new Error(`Failed to list schedules: ${response.status}`);
  }

  return response.json() as Promise<ConfigSnapshotScheduleListResponse>;
}

/**
 * Toggle (enable/disable) a schedule via API.
 */
export async function toggleScheduleViaApi(
  scheduleId: string,
  enabled: boolean
): Promise<ConfigSnapshotScheduleItem> {
  const response = await fetch(
    `${API_BASE_URL}/api/config-snapshot-schedules/${scheduleId}/toggle`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled }),
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to toggle schedule: ${response.status}`);
  }

  return response.json() as Promise<ConfigSnapshotScheduleItem>;
}

/**
 * Delete a schedule via API.
 * Returns true on success, false if not found.
 */
export async function deleteScheduleViaApi(scheduleId: string): Promise<boolean> {
  const response = await fetch(
    `${API_BASE_URL}/api/config-snapshot-schedules/${scheduleId}`,
    { method: 'DELETE' }
  );

  if (response.status === 404) return false;
  if (response.status === 204) return true;

  throw new Error(`Failed to delete schedule: ${response.status}`);
}

// ============================================================
// Server utilities
// ============================================================

/**
 * Get the first available server name from the API.
 * Returns null if no servers are configured.
 */
export async function getFirstServerName(): Promise<string | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/servers`);
    if (!response.ok) return null;
    const body = await response.json() as { servers: Array<{ name: string }> };
    return body.servers[0]?.name ?? null;
  } catch {
    return null;
  }
}

/**
 * Check if the API is reachable.
 */
export async function isApiReachable(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/health`, {
      signal: AbortSignal.timeout(5000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Cleanup helper: delete all snapshots created during a test for a given server.
 * Silently ignores failures (best-effort cleanup).
 */
export async function cleanupSnapshots(
  serverName: string,
  snapshotIds: string[]
): Promise<void> {
  for (const id of snapshotIds) {
    try {
      await deleteConfigSnapshotViaApi(serverName, id);
    } catch {
      // Ignore cleanup errors
    }
  }
}

/**
 * Cleanup helper: delete all schedules created during a test.
 * Silently ignores failures (best-effort cleanup).
 */
export async function cleanupSchedules(scheduleIds: string[]): Promise<void> {
  for (const id of scheduleIds) {
    try {
      await deleteScheduleViaApi(id);
    } catch {
      // Ignore cleanup errors
    }
  }
}

// ============================================================
// Assertion helpers
// ============================================================

/**
 * Assert that a snapshot has the expected structure.
 */
export function assertSnapshotStructure(snapshot: unknown): void {
  const s = snapshot as Record<string, unknown>;
  if (typeof s.id !== 'string') throw new Error('snapshot.id must be a string');
  if (typeof s.serverName !== 'string') throw new Error('snapshot.serverName must be a string');
  if (typeof s.createdAt !== 'string') throw new Error('snapshot.createdAt must be a string');
  if (typeof s.description !== 'string') throw new Error('snapshot.description must be a string');
  if (!Array.isArray(s.files)) throw new Error('snapshot.files must be an array');

  // Validate ISO date format
  const date = new Date(s.createdAt as string);
  if (isNaN(date.getTime())) throw new Error('snapshot.createdAt must be a valid ISO date');
}

/**
 * Assert that a schedule has the expected structure.
 */
export function assertScheduleStructure(schedule: unknown): void {
  const s = schedule as Record<string, unknown>;
  if (typeof s.id !== 'string') throw new Error('schedule.id must be a string');
  if (typeof s.serverName !== 'string') throw new Error('schedule.serverName must be a string');
  if (typeof s.name !== 'string') throw new Error('schedule.name must be a string');
  if (typeof s.cronExpression !== 'string') throw new Error('schedule.cronExpression must be a string');
  if (typeof s.retentionCount !== 'number') throw new Error('schedule.retentionCount must be a number');
  if (typeof s.enabled !== 'boolean') throw new Error('schedule.enabled must be a boolean');
}
