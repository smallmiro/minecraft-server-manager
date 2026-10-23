import { FastifyInstance, FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import { join } from 'path';
import { AuditActionEnum } from '@minecraft-docker/shared';
import { config } from '../config/index.js';
import { writeAuditLog } from '../services/audit-log-service.js';
import {
  PlatformSettingsService,
  PlatformNotInitializedError,
  PlatformSettingsStaleError,
  PlatformSettingsValidationError,
  PlatformSettingsWorldLocationError,
} from '../services/PlatformSettingsService.js';
import { createWorldUseCase } from '../lib/world-use-case.js';
import {
  PlatformSettingsResponseSchema,
  PlatformSettingsUpdateRequestSchema,
  PlatformSettingsUpdateResponseSchema,
  PlatformSettingsValidationErrorSchema,
  PlatformSettingsConflictSchema,
  PlatformSettingsErrorSchema,
  type PlatformSettingsUpdateRequest,
} from '../schemas/platform-settings.js';

interface UpdateRoute {
  Body: PlatformSettingsUpdateRequest;
}

const KEY_NAME_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

/** STRICT admin check: a missing X-Role header is rejected. */
function requireAdmin(request: FastifyRequest, reply: FastifyReply): boolean {
  if (request.headers['x-role'] === 'admin') return true;
  reply.code(403).send({ error: 'Forbidden', message: 'Administrator role required' });
  return false;
}

const platformSettingsPlugin: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // Created per request so the root paths always reflect current config.
  const service = () =>
    new PlatformSettingsService(
      config.mcctlRoot,
      join(config.mcctlRoot, 'ecosystem.config.cjs'),
      process.env,
      async (nextEnv) => {
        const refused = await createWorldUseCase().checkPlatformEnvChange(nextEnv);
        return refused ? { message: refused.message, servers: refused.servers } : null;
      },
    );

  /** GET /api/platform-settings */
  fastify.get('/api/platform-settings', {
    schema: {
      description: 'Get platform settings (.env) with classification and masked secrets (admin only)',
      tags: ['platform-settings'],
      response: {
        200: PlatformSettingsResponseSchema,
        403: PlatformSettingsErrorSchema,
        404: PlatformSettingsErrorSchema,
        500: PlatformSettingsErrorSchema,
      },
    },
  }, async (request, reply) => {
    if (!requireAdmin(request, reply)) return reply;
    reply.header('Cache-Control', 'no-store');
    try {
      return reply.send(await service().get());
    } catch (error) {
      if (error instanceof PlatformNotInitializedError) {
        return reply.code(404).send({ error: 'NotFound', message: error.message });
      }
      fastify.log.error({ err: error }, 'Failed to read platform settings');
      return reply.code(500).send({ error: 'InternalServerError', message: 'Failed to read platform settings' });
    }
  });

  /** PUT /api/platform-settings */
  fastify.put<UpdateRoute>('/api/platform-settings', {
    schema: {
      description: 'Update platform settings (.env). Secrets: omitted/blank = preserve, cleared only via remove. (admin only)',
      tags: ['platform-settings'],
      body: PlatformSettingsUpdateRequestSchema,
      response: {
        200: PlatformSettingsUpdateResponseSchema,
        400: PlatformSettingsValidationErrorSchema,
        403: PlatformSettingsErrorSchema,
        404: PlatformSettingsErrorSchema,
        409: PlatformSettingsConflictSchema,
        500: PlatformSettingsErrorSchema,
      },
    },
  }, async (request, reply) => {
    if (!requireAdmin(request, reply)) return reply;
    reply.header('Cache-Control', 'no-store');

    const { set, remove } = request.body;
    const user = request.headers['x-user'];
    // Audit details: key names and scopes only, never values.
    const audit = (status: 'success' | 'failure', details: Record<string, unknown>, errorMessage?: string) =>
      writeAuditLog({
        action: AuditActionEnum.PLATFORM_SETTINGS_UPDATE,
        actor: `api:${typeof user === 'string' && user ? user : 'console'}`,
        targetType: 'platform',
        targetName: '.env',
        details,
        status,
        ...(errorMessage ? { errorMessage } : {}),
      }).catch((e) => fastify.log.error({ err: e }, 'Failed to write audit log'));
    const requested = {
      changedKeys: Object.keys(set).filter((k) => KEY_NAME_RE.test(k)).slice(0, 100),
      removedKeys: remove.filter((k) => KEY_NAME_RE.test(k)).slice(0, 100),
    };

    try {
      const result = await service().update(request.body);
      await audit('success', {
        changedKeys: result.changedKeys,
        removedKeys: result.removedKeys,
        restartScopes: result.restartScopes,
      });
      return reply.send(result);
    } catch (error) {
      if (error instanceof PlatformSettingsValidationError) {
        await audit('failure', { ...requested, restartScopes: [], invalidKeys: error.errors.map((e) => e.key).filter((k) => KEY_NAME_RE.test(k)) }, 'Validation failed');
        return reply.code(400).send({ error: 'BadRequest', message: error.message, errors: error.errors });
      }
      if (error instanceof PlatformSettingsWorldLocationError) {
        await audit('failure', { ...requested, restartScopes: [] }, 'World location change refused');
        return reply.code(409).send({
          error: 'Conflict',
          message: error.message,
          currentRevision: error.currentRevision,
          servers: error.servers,
        });
      }
      if (error instanceof PlatformSettingsStaleError) {
        await audit('failure', { ...requested, restartScopes: [] }, 'Stale revision');
        return reply.code(409).send({ error: 'Conflict', message: error.message, currentRevision: error.currentRevision });
      }
      if (error instanceof PlatformNotInitializedError) {
        await audit('failure', { ...requested, restartScopes: [] }, error.message);
        return reply.code(404).send({ error: 'NotFound', message: error.message });
      }
      fastify.log.error({ err: error }, 'Failed to update platform settings');
      await audit('failure', { ...requested, restartScopes: [] }, 'I/O error');
      return reply.code(500).send({ error: 'InternalServerError', message: 'Failed to update platform settings' });
    }
  });
};

export default fp(platformSettingsPlugin, { name: 'platform-settings-routes' });
