import { FastifyInstance, FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import type { WorldBackupError } from '@minecraft-docker/shared';
import { config } from '../config/index.js';
import { createWorldBackupPort, backupErrorStatus, shortHash } from '../lib/world-backup.js';
import {
  BackupStatusResponseSchema,
  BackupPushRequestSchema,
  BackupPushResponseSchema,
  BackupHistoryResponseSchema,
  BackupRestoreRequestSchema,
  BackupRestoreResponseSchema,
  ErrorResponseSchema,
  type BackupPushRequest,
  type BackupRestoreRequest,
} from '../schemas/backup.js';

interface BackupPushRoute {
  Body: BackupPushRequest;
}

interface BackupRestoreRoute {
  Body: BackupRestoreRequest;
}

const errorResponses = {
  400: ErrorResponseSchema,
  404: ErrorResponseSchema,
  409: ErrorResponseSchema,
  500: ErrorResponseSchema,
  503: ErrorResponseSchema,
};

/**
 * Backup management routes plugin (ADR-0001 "Backup Port", #732).
 * All work goes through IWorldBackupPort; there is no script lookup.
 */
const backupPlugin: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  const backup = createWorldBackupPort(config.mcctlRoot);

  const sendError = (reply: FastifyReply, error: WorldBackupError) => {
    const { status, error: name } = backupErrorStatus(error.code);
    if (status >= 500) fastify.log.error({ code: error.code }, error.message);
    return reply.code(status).send({ error: name, message: error.message });
  };

  fastify.get('/api/backup/status', {
    schema: {
      description: 'Get backup configuration status',
      tags: ['backup'],
      response: { 200: BackupStatusResponseSchema, 500: ErrorResponseSchema },
    },
  }, async (_request, reply) => {
    const r = await backup.status();
    if (!r.ok) return sendError(reply, r.error);
    const { configured, repository, branch, lastBackup } = r.value;
    return reply.send({ configured, repository, branch, lastBackup: lastBackup?.date.toISOString() });
  });

  fastify.post<BackupPushRoute>('/api/backup/push', {
    schema: {
      description: 'Push worlds backup to GitHub',
      tags: ['backup'],
      body: BackupPushRequestSchema,
      response: { 200: BackupPushResponseSchema, ...errorResponses },
    },
  }, async (request: FastifyRequest<BackupPushRoute>, reply: FastifyReply) => {
    const { message, allowMissing } = request.body ?? {};
    const r = await backup.push({ message, allowMissing: allowMissing === true });
    if (!r.ok) return sendError(reply, r.error);
    for (const w of [...r.value.warnings, ...r.value.skipped]) fastify.log.warn(`backup: ${w}`);
    return reply.send({
      success: true,
      commitHash: shortHash(r.value.commit),
      message: r.value.changed ? 'Backup pushed successfully' : 'No changes to backup',
    });
  });

  fastify.get('/api/backup/history', {
    schema: {
      description: 'Get backup history (git commits)',
      tags: ['backup'],
      response: { 200: BackupHistoryResponseSchema, 400: ErrorResponseSchema, 500: ErrorResponseSchema },
    },
  }, async (_request, reply) => {
    const status = await backup.status();
    if (!status.ok) return sendError(reply, status.error);
    if (!status.value.configured) {
      return reply.code(400).send({ error: 'BadRequest', message: 'Backup not configured' });
    }
    const r = await backup.history(20);
    if (!r.ok) return sendError(reply, r.error);
    const commits = r.value.map((c) => ({
      hash: shortHash(c.hash)!,
      message: c.message,
      date: c.date.toISOString(),
      author: c.author,
    }));
    return reply.send({ commits, total: commits.length });
  });

  fastify.post<BackupRestoreRoute>('/api/backup/restore', {
    schema: {
      description: 'Restore worlds from a backup commit (all servers must be stopped)',
      tags: ['backup'],
      body: BackupRestoreRequestSchema,
      response: { 200: BackupRestoreResponseSchema, ...errorResponses },
    },
  }, async (request: FastifyRequest<BackupRestoreRoute>, reply: FastifyReply) => {
    const { commitHash } = request.body;
    const r = await backup.restore(commitHash);
    if (!r.ok) return sendError(reply, r.error);
    for (const s of r.value.skipped) fastify.log.warn(`restore skipped ${s}`);
    return reply.send({ success: true, message: `Restored to commit ${commitHash}` });
  });
};

export default fp(backupPlugin, {
  name: 'backup-routes',
  fastify: '5.x',
});

export { backupPlugin };
