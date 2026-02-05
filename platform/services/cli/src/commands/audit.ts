import { Paths, log, colors, AuditActionEnum, type AuditLog } from '@minecraft-docker/shared';
import { getContainer } from '../infrastructure/di/container.js';
import * as p from '@clack/prompts';

export interface AuditCommandOptions {
  subcommand?: string; // list | purge | stats
  limit?: number;
  action?: string;
  target?: string;
  actor?: string;
  status?: 'success' | 'failure';
  from?: string;
  to?: string;
  days?: number;
  before?: string;
  dryRun?: boolean;
  force?: boolean;
  sudoPassword?: string;
}

/**
 * Audit log management command
 */
export async function auditCommand(options: AuditCommandOptions): Promise<number> {
  const paths = new Paths();

  if (!paths.isInitialized()) {
    log.error('Platform not initialized. Run: mcctl init');
    return 1;
  }

  const container = getContainer({ sudoPassword: options.sudoPassword });
  const auditLogPort = container.auditLogPort;

  // Route to subcommand
  switch (options.subcommand) {
    case 'list':
      return await listAuditLogs(auditLogPort, options);
    case 'purge':
      return await purgeAuditLogs(auditLogPort, options);
    case 'stats':
      return await showAuditStats(auditLogPort, options);
    default:
      log.error('Usage: mcctl audit <list|purge|stats> [options]');
      return 1;
  }
}

/**
 * List audit logs with filtering
 */
async function listAuditLogs(
  auditLogPort: any,
  options: AuditCommandOptions
): Promise<number> {
  try {
    // Build query options
    const queryOptions: any = {
      limit: options.limit || 50,
    };

    if (options.action) {
      queryOptions.action = options.action as AuditActionEnum;
    }
    if (options.actor) {
      queryOptions.actor = options.actor;
    }
    if (options.target) {
      queryOptions.targetName = options.target;
    }
    if (options.status) {
      queryOptions.status = options.status;
    }
    if (options.from) {
      queryOptions.from = new Date(options.from);
    }
    if (options.to) {
      queryOptions.to = new Date(options.to);
    }

    const logs = await auditLogPort.findAll(queryOptions);

    if (logs.length === 0) {
      console.log(colors.dim('\nNo audit logs found.\n'));
      return 0;
    }

    // Display in table format
    console.log(colors.bold(`\nAudit Logs (${logs.length} entries):\n`));

    const table = logs.map((log: AuditLog) => {
      const statusColor = log.status === 'success' ? colors.green : colors.red;
      return {
        timestamp: new Date(log.timestamp).toLocaleString(),
        action: log.action,
        actor: log.actor,
        target: `${log.targetType}:${log.targetName}`,
        status: statusColor(log.status),
      };
    });

    // Simple table formatting
    for (const row of table) {
      console.log(
        `${colors.dim(row.timestamp)} ${colors.cyan(row.action.padEnd(25))} ` +
        `${colors.yellow(row.actor.padEnd(15))} ${row.target.padEnd(20)} ${row.status}`
      );
    }

    console.log('');
    return 0;
  } catch (error) {
    log.error(`Failed to list audit logs: ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }
}

/**
 * Purge old audit logs
 */
async function purgeAuditLogs(
  auditLogPort: any,
  options: AuditCommandOptions
): Promise<number> {
  try {
    let cutoffDate: Date;

    if (options.before) {
      cutoffDate = new Date(options.before);
    } else if (options.days) {
      cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - options.days);
    } else {
      // Default: 90 days
      cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 90);
    }

    // Count logs to be deleted
    const logsToDelete = await auditLogPort.findAll({
      to: cutoffDate,
    });

    if (logsToDelete.length === 0) {
      console.log(colors.dim('\nNo audit logs to purge.\n'));
      return 0;
    }

    if (options.dryRun) {
      console.log(colors.yellow(`\n[DRY RUN] Would delete ${logsToDelete.length} audit logs older than ${cutoffDate.toISOString()}\n`));
      return 0;
    }

    // Confirm deletion unless --force
    if (!options.force) {
      const confirmed = await p.confirm({
        message: `Delete ${logsToDelete.length} audit logs older than ${cutoffDate.toLocaleDateString()}?`,
        initialValue: false,
      });

      if (p.isCancel(confirmed) || !confirmed) {
        console.log(colors.dim('\nPurge cancelled.\n'));
        return 0;
      }
    }

    const deletedCount = await auditLogPort.deleteOlderThan(cutoffDate);

    // Log the purge action
    await auditLogPort.log({
      action: AuditActionEnum.AUDIT_PURGE,
      actor: 'cli:local',
      targetType: 'audit',
      targetName: 'logs',
      status: 'success',
      details: { deletedCount, cutoffDate: cutoffDate.toISOString() },
      errorMessage: null,
    });

    console.log(colors.green(`\n✓ Deleted ${deletedCount} audit logs\n`));
    return 0;
  } catch (error) {
    log.error(`Failed to purge audit logs: ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }
}

/**
 * Show audit statistics
 */
async function showAuditStats(
  auditLogPort: any,
  options: AuditCommandOptions
): Promise<number> {
  try {
    const allLogs = await auditLogPort.findAll();

    if (allLogs.length === 0) {
      console.log(colors.dim('\nNo audit logs found.\n'));
      return 0;
    }

    // Count by action
    const actionCounts: Record<string, number> = {};
    const statusCounts: Record<string, number> = { success: 0, failure: 0 };
    const actorCounts: Record<string, number> = {};

    for (const log of allLogs) {
      actionCounts[log.action] = (actionCounts[log.action] || 0) + 1;
      statusCounts[log.status] = (statusCounts[log.status] || 0) + 1;
      actorCounts[log.actor] = (actorCounts[log.actor] || 0) + 1;
    }

    console.log(colors.bold('\nAudit Log Statistics:\n'));
    console.log(`Total Logs: ${colors.cyan(String(allLogs.length))}`);
    console.log(`Success: ${colors.green(String(statusCounts.success))}`);
    console.log(`Failure: ${colors.red(String(statusCounts.failure))}`);

    console.log(colors.bold('\n\nBy Action:\n'));
    for (const [action, count] of Object.entries(actionCounts).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${action.padEnd(30)} ${colors.cyan(String(count))}`);
    }

    console.log(colors.bold('\n\nBy Actor:\n'));
    for (const [actor, count] of Object.entries(actorCounts).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${actor.padEnd(20)} ${colors.cyan(String(count))}`);
    }

    console.log('');
    return 0;
  } catch (error) {
    log.error(`Failed to show audit stats: ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }
}
