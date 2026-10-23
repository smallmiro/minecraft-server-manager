import { FastifyInstance, FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import {
  sanitizeServerName,
  executeServerAction,
  ServerAction,
} from '../../utils/docker-compose.js';
import { writeAuditLog } from '../../services/audit-log-service.js';
import { createWorldBackupPort } from '../../lib/world-backup.js';
import { config } from '../../config/index.js';
import {
  AuditActionEnum,
  AUTO_BACKUP_CLOSE_WAIT_MS,
  EXISTING_SERVER_NAME_PATTERN,
  ServerName,
  autoBackupOnStop,
} from '@minecraft-docker/shared';

/**
 * close lets auto-backups on stop finish for abortAfterMs, then aborts them so
 * each sends save-on to the servers it flushed, waiting up to waitMs in all
 * (#734 review). Tests shorten these.
 */
export const autoBackupCloseLimits = {
  abortAfterMs: AUTO_BACKUP_CLOSE_WAIT_MS - 30_000,
  waitMs: AUTO_BACKUP_CLOSE_WAIT_MS,
};

/** Auto-backups started by a stop, and the signal that aborts them at shutdown. */
interface AutoBackups {
  running: Set<Promise<unknown>>;
  shutdown: AbortController;
}

/** True when `p` settles within `ms`. */
async function settlesWithin(p: Promise<unknown>, ms: number): Promise<boolean> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<false>((resolve) => {
    timer = setTimeout(() => resolve(false), ms);
  });
  try {
    return await Promise.race([p.then(() => true), timeout]);
  } finally {
    clearTimeout(timer);
  }
}

// ============================================================
// Types
// ============================================================

interface ServerNameParams {
  name: string;
}

interface ActionResponse {
  success: boolean;
  server: string;
  action: ServerAction;
  timestamp: string;
  message?: string;
  error?: string;
}

// ============================================================
// Route Handlers
// ============================================================

/**
 * Map server action to audit action enum
 */
function toAuditAction(action: ServerAction): AuditActionEnum {
  switch (action) {
    case 'start': return AuditActionEnum.SERVER_START;
    case 'stop': return AuditActionEnum.SERVER_STOP;
    case 'restart': return AuditActionEnum.SERVER_RESTART;
  }
}

async function handleServerAction(
  request: FastifyRequest<{ Params: ServerNameParams }>,
  reply: FastifyReply,
  action: ServerAction,
  backups: AutoBackups
): Promise<ActionResponse> {
  const serverName = sanitizeServerName(request.params.name);

  // Existing servers keep names that predate the naming rule (#649):
  // reject only unsafe names, warn about the rest.
  if (!EXISTING_SERVER_NAME_PATTERN.test(serverName)) {
    reply.code(400);
    return {
      success: false,
      server: serverName,
      action,
      timestamp: new Date().toISOString(),
      error: 'Invalid server name. Server name must start with a letter or number and contain only alphanumeric characters, hyphens, or underscores.',
    };
  }
  const ruleViolation = ServerName.validate(serverName);
  if (ruleViolation) {
    request.log.warn({ server: serverName }, `Server name does not follow the naming rule: ${ruleViolation}`);
  }

  // Execute the action
  const result = await executeServerAction(serverName, action);

  if (!result.success) {
    await writeAuditLog({
      action: toAuditAction(action),
      actor: 'api:console',
      targetType: 'server',
      targetName: serverName,
      status: 'failure',
      details: null,
      errorMessage: result.error ?? 'Failed to execute action',
    });

    reply.code(500);
    return {
      success: false,
      server: serverName,
      action,
      timestamp: new Date().toISOString(),
      error: result.error ?? 'Failed to execute action',
      message: result.stderr,
    };
  }

  await writeAuditLog({
    action: toAuditAction(action),
    actor: 'api:console',
    targetType: 'server',
    targetName: serverName,
    status: 'success',
    details: null,
    errorMessage: null,
  });

  // BACKUP_AUTO_ON_STOP (#734, #732 B-Q9): in the background, so a backup that
  // waits for the lock or pushes a large world never holds the response; a
  // failure is logged and never fails the stop
  if (action === 'stop') {
    const log = request.log;
    const running = autoBackupOnStop(createWorldBackupPort(config.mcctlRoot), serverName, {
      signal: backups.shutdown.signal,
    }).then((auto) => {
      if (auto.status === 'done') log.info({ server: serverName, commit: auto.outcome.commit }, 'Auto-backup on stop complete');
      else if (auto.status === 'failed') log.warn({ server: serverName, error: auto.error }, 'Auto-backup on stop failed');
    });
    backups.running.add(running);
    void running.finally(() => backups.running.delete(running));
  }

  return {
    success: true,
    server: serverName,
    action,
    timestamp: new Date().toISOString(),
    message: result.stdout,
  };
}

// ============================================================
// Plugin Definition
// ============================================================

const serverActionsPlugin: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  const backups: AutoBackups = { running: new Set(), shutdown: new AbortController() };
  fastify.addHook('onClose', async () => {
    if (backups.running.size === 0) return;
    fastify.log.info({ count: backups.running.size }, 'Waiting for auto-backups on stop to finish');
    const settled = Promise.allSettled([...backups.running]);
    if (await settlesWithin(settled, autoBackupCloseLimits.abortAfterMs)) return;
    // Exiting mid-backup would leave auto-save off on the servers it flushed
    fastify.log.warn('Auto-backup on stop still running at shutdown; aborting it');
    backups.shutdown.abort();
    if (!(await settlesWithin(settled, autoBackupCloseLimits.waitMs - autoBackupCloseLimits.abortAfterMs))) {
      fastify.log.warn('Aborted auto-backup on stop did not finish; giving up waiting');
    }
  });

  // POST /api/servers/:name/start
  fastify.post<{ Params: ServerNameParams }>(
    '/api/servers/:name/start',
    async (request, reply) => {
      return handleServerAction(request, reply, 'start', backups);
    }
  );

  // POST /api/servers/:name/stop
  fastify.post<{ Params: ServerNameParams }>(
    '/api/servers/:name/stop',
    async (request, reply) => {
      return handleServerAction(request, reply, 'stop', backups);
    }
  );

  // POST /api/servers/:name/restart
  fastify.post<{ Params: ServerNameParams }>(
    '/api/servers/:name/restart',
    async (request, reply) => {
      return handleServerAction(request, reply, 'restart', backups);
    }
  );
};

// ============================================================
// Export
// ============================================================

export default fp(serverActionsPlugin, {
  name: 'server-actions-routes',
  fastify: '5.x',
});

export { serverActionsPlugin };
