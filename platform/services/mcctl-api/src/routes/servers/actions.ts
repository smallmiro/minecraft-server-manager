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
import { AuditActionEnum, EXISTING_SERVER_NAME_PATTERN, ServerName, autoBackupOnStop } from '@minecraft-docker/shared';

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

/**
 * How long close waits for running auto-backups. The backup's finally
 * re-enables auto-save (save-on) on servers it flushed; process.exit after
 * app.close() must not cut that off.
 */
export const AUTO_BACKUP_CLOSE_WAIT_MS = 120_000;

async function handleServerAction(
  request: FastifyRequest<{ Params: ServerNameParams }>,
  reply: FastifyReply,
  action: ServerAction,
  backups: Set<Promise<unknown>>
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
    const running = autoBackupOnStop(createWorldBackupPort(config.mcctlRoot), serverName).then((auto) => {
      if (auto.status === 'done') log.info({ server: serverName, commit: auto.outcome.commit }, 'Auto-backup on stop complete');
      else if (auto.status === 'failed') log.warn({ server: serverName, error: auto.error }, 'Auto-backup on stop failed');
    });
    backups.add(running);
    void running.finally(() => backups.delete(running));
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
  // Auto-backups started by a stop; close waits for them (bounded)
  const backups = new Set<Promise<unknown>>();
  fastify.addHook('onClose', async () => {
    if (backups.size === 0) return;
    fastify.log.info({ count: backups.size }, 'Waiting for auto-backups on stop to finish');
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<'timeout'>((resolve) => {
      timer = setTimeout(() => resolve('timeout'), AUTO_BACKUP_CLOSE_WAIT_MS);
    });
    const result = await Promise.race([Promise.allSettled([...backups]), timeout]);
    clearTimeout(timer);
    if (result === 'timeout') fastify.log.warn('Auto-backup on stop still running at shutdown; giving up waiting');
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
