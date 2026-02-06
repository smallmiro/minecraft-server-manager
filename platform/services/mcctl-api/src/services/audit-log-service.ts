import { join } from 'path';
import {
  SqliteAuditLogRepository,
  AuditLog,
  AuditActionEnum,
  type AuditLogData,
  type AuditLogQueryOptions,
} from '@minecraft-docker/shared';
import { config } from '../config/index.js';
import type {
  AuditLogEntry,
  AuditLogBrief,
  AuditLogListQuery,
  AuditLogListResponse,
  AuditLogStatsResponse,
  AuditLogDetailResponse,
  AuditLogPurgeResponse,
} from '../schemas/audit-log.js';

/**
 * Singleton instance of the audit log repository
 */
let repository: SqliteAuditLogRepository | null = null;

/**
 * Event listeners for new audit log entries (SSE support)
 */
type AuditLogListener = (log: AuditLogEntry) => void;
const listeners = new Set<AuditLogListener>();

/**
 * Get or create the audit log repository singleton
 */
export function getAuditLogRepository(): SqliteAuditLogRepository {
  if (!repository) {
    const dbPath = join(config.mcctlRoot, 'audit.db');
    repository = new SqliteAuditLogRepository(dbPath);
  }
  return repository;
}

/**
 * Convert AuditLog entity to API response entry
 */
function toEntry(log: AuditLog): AuditLogEntry {
  const json = log.toJSON();
  return {
    id: json.id,
    action: json.action,
    actor: json.actor,
    targetType: json.targetType,
    targetName: json.targetName,
    details: json.details,
    status: json.status,
    errorMessage: json.errorMessage ?? null,
    timestamp: json.timestamp,
  };
}

/**
 * Convert AuditLog entity to brief entry
 */
function toBrief(log: AuditLog): AuditLogBrief {
  const json = log.toJSON();
  return {
    id: json.id,
    action: json.action,
    targetName: json.targetName,
    timestamp: json.timestamp,
  };
}

/**
 * Parse sort parameter
 */
function parseSortOrder(sort?: string): 'asc' | 'desc' {
  if (sort === 'timestamp:asc') return 'asc';
  return 'desc';
}

/**
 * Build query options from request query parameters
 */
function buildQueryOptions(query: AuditLogListQuery): AuditLogQueryOptions {
  const options: AuditLogQueryOptions = {};

  if (query.action) {
    // Take first action for now (port interface only supports single action)
    const firstAction = query.action.split(',')[0]?.trim();
    if (firstAction && Object.values(AuditActionEnum).includes(firstAction as AuditActionEnum)) {
      options.action = firstAction as AuditActionEnum;
    }
  }

  if (query.actor) {
    options.actor = query.actor;
  }

  if (query.targetType) {
    options.targetType = query.targetType;
  }

  if (query.targetName) {
    options.targetName = query.targetName;
  }

  if (query.status === 'success' || query.status === 'failure') {
    options.status = query.status;
  }

  if (query.from) {
    options.from = new Date(query.from);
  }

  if (query.to) {
    options.to = new Date(query.to);
  }

  options.limit = query.limit ?? 50;
  options.offset = query.offset ?? 0;

  return options;
}

// ============================================================
// Service Functions
// ============================================================

/**
 * Get audit logs list with filtering and pagination
 */
export async function getAuditLogs(query: AuditLogListQuery): Promise<AuditLogListResponse> {
  const repo = getAuditLogRepository();
  const options = buildQueryOptions(query);

  // Get logs and total count
  const [logs, total] = await Promise.all([
    repo.findAll(options),
    repo.count(options),
  ]);

  // If sort is ascending, reverse the default DESC results
  const sortOrder = parseSortOrder(query.sort);
  const sortedLogs = sortOrder === 'asc' ? [...logs].reverse() : logs;

  return {
    logs: sortedLogs.map(toEntry),
    total,
    limit: options.limit ?? 50,
    offset: options.offset ?? 0,
    filters: {
      action: query.action ?? null,
      actor: query.actor ?? null,
      targetType: query.targetType ?? null,
      targetName: query.targetName ?? null,
      status: query.status ?? null,
      from: query.from ?? null,
      to: query.to ?? null,
    },
  };
}

/**
 * Get audit log statistics
 */
export async function getAuditLogStats(): Promise<AuditLogStatsResponse> {
  const repo = getAuditLogRepository();

  // Get total count
  const total = await repo.count();

  // Get counts by action
  const byAction: Record<string, number> = {};
  for (const action of Object.values(AuditActionEnum)) {
    const count = await repo.count({ action });
    if (count > 0) {
      byAction[action] = count;
    }
  }

  // Get counts by status
  const [successCount, failureCount] = await Promise.all([
    repo.count({ status: 'success' }),
    repo.count({ status: 'failure' }),
  ]);

  // Get all logs for actor aggregation (limited to recent)
  const recentLogs = await repo.findAll({ limit: 1000 });

  // Aggregate by actor
  const byActor: Record<string, number> = {};
  for (const log of recentLogs) {
    const actor = log.actor;
    byActor[actor] = (byActor[actor] ?? 0) + 1;
  }

  // Get recent activity (last 10)
  const recentActivity = await repo.findAll({ limit: 10 });

  // Get oldest and newest entries
  const allLogs = await repo.findAll({ limit: 1 });
  const oldestLogs = await repo.findAll({});
  const newestEntry = allLogs.length > 0 ? allLogs[0]!.timestamp.toISOString() : null;
  const oldestEntry = oldestLogs.length > 0 ? oldestLogs[oldestLogs.length - 1]!.timestamp.toISOString() : null;

  return {
    total,
    byAction,
    byStatus: {
      success: successCount,
      failure: failureCount,
    },
    byActor,
    recentActivity: recentActivity.map(toEntry),
    oldestEntry,
    newestEntry,
  };
}

/**
 * Get single audit log with related logs
 */
export async function getAuditLogById(id: string): Promise<AuditLogDetailResponse | null> {
  const repo = getAuditLogRepository();

  // Find the log by ID
  const allLogs = await repo.findAll({});
  const log = allLogs.find(l => l.id === id);

  if (!log) {
    return null;
  }

  // Get related logs (same target, same actor)
  const [sameTarget, sameActor] = await Promise.all([
    repo.findByTarget(log.targetType, log.targetName),
    repo.findByActor(log.actor),
  ]);

  return {
    log: toEntry(log),
    relatedLogs: {
      sameTarget: sameTarget
        .filter(l => l.id !== id)
        .slice(0, 10)
        .map(toBrief),
      sameActor: sameActor
        .filter(l => l.id !== id)
        .slice(0, 10)
        .map(toBrief),
    },
  };
}

/**
 * Purge audit logs older than a given date
 */
export async function purgeAuditLogs(
  before: string,
  dryRun: boolean = false
): Promise<AuditLogPurgeResponse> {
  const repo = getAuditLogRepository();
  const beforeDate = new Date(before);

  if (dryRun) {
    // Count logs that would be deleted
    const count = await repo.count({ to: beforeDate });
    return {
      deleted: count,
      dryRun: true,
      message: `${count} audit log entries would be deleted before ${before}`,
    };
  }

  // Actually delete
  const deleted = await repo.deleteOlderThan(beforeDate);

  return {
    deleted,
    dryRun: false,
    message: `${deleted} audit log entries deleted before ${before}`,
  };
}

// ============================================================
// SSE Support
// ============================================================

/**
 * Subscribe to new audit log events
 */
export function subscribeAuditLogs(listener: AuditLogListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Notify all listeners of a new audit log entry
 * Called by routes that create audit log entries
 */
export function notifyNewAuditLog(entry: AuditLogEntry): void {
  for (const listener of listeners) {
    try {
      listener(entry);
    } catch {
      // Ignore listener errors
    }
  }
}

/**
 * Write an audit log entry and notify SSE listeners
 */
export async function writeAuditLog(data: AuditLogData): Promise<void> {
  const repo = getAuditLogRepository();
  await repo.log(data);

  // Notify SSE listeners
  const log = AuditLog.create(data);
  const json = log.toJSON();
  notifyNewAuditLog({
    id: json.id,
    action: json.action,
    actor: json.actor,
    targetType: json.targetType,
    targetName: json.targetName,
    details: json.details,
    status: json.status,
    errorMessage: json.errorMessage ?? null,
    timestamp: json.timestamp,
  });
}

/**
 * Close the repository (for graceful shutdown)
 */
export function closeAuditLogRepository(): void {
  if (repository) {
    repository.close();
    repository = null;
  }
}
