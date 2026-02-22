import { FastifyInstance, FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import { AuditActionEnum } from '@minecraft-docker/shared';
import {
  ServerNameParamsSchema,
  ServerSnapshotParamsSchema,
  ListSnapshotsQuerySchema,
  CreateSnapshotRequestSchema,
  RestoreSnapshotRequestSchema,
  ListSnapshotsResponseSchema,
  ConfigSnapshotSchema,
  RestoreSnapshotResponseSchema,
  ErrorResponseSchema,
  type ServerNameParams,
  type ServerSnapshotParams,
  type ListSnapshotsQuery,
  type CreateSnapshotRequest,
  type RestoreSnapshotRequest,
} from '../../schemas/config-snapshot.js';
import {
  createSnapshot,
  listSnapshots,
  getSnapshotById,
  deleteSnapshot,
  restoreSnapshot,
  checkServerExists,
  isServerRunning,
} from '../../services/config-snapshot-service.js';
import { writeAuditLog } from '../../services/audit-log-service.js';

// Route generic interfaces
interface ListRoute {
  Params: ServerNameParams;
  Querystring: ListSnapshotsQuery;
}

interface CreateRoute {
  Params: ServerNameParams;
  Body: CreateSnapshotRequest;
}

interface DetailRoute {
  Params: ServerSnapshotParams;
}

interface RestoreRoute {
  Params: ServerSnapshotParams;
  Body: RestoreSnapshotRequest;
}

/**
 * Config snapshot routes plugin (under /api/servers/:name/config-snapshots)
 */
const configSnapshotsPlugin: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  /**
   * GET /api/servers/:name/config-snapshots
   * List config snapshots for a server
   */
  fastify.get<ListRoute>('/api/servers/:name/config-snapshots', {
    schema: {
      description: 'List config snapshots for a server',
      tags: ['config-snapshots'],
      params: ServerNameParamsSchema,
      querystring: ListSnapshotsQuerySchema,
      response: {
        200: ListSnapshotsResponseSchema,
        404: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
  }, async (request: FastifyRequest<ListRoute>, reply: FastifyReply) => {
    const { name } = request.params;
    const { limit = 20, offset = 0 } = request.query;

    try {
      const exists = await checkServerExists(name);
      if (!exists) {
        return reply.code(404).send({
          error: 'NotFound',
          message: `Server '${name}' not found`,
        });
      }

      const data = await listSnapshots(name, limit, offset);
      return reply.send({
        snapshots: data.snapshots.map((s) => s.toJSON()),
        total: data.total,
      });
    } catch (error) {
      fastify.log.error(error, 'Failed to list config snapshots');
      return reply.code(500).send({
        error: 'InternalServerError',
        message: 'Failed to list config snapshots',
      });
    }
  });

  /**
   * POST /api/servers/:name/config-snapshots
   * Create a new config snapshot
   */
  fastify.post<CreateRoute>('/api/servers/:name/config-snapshots', {
    schema: {
      description: 'Create a new config snapshot for a server',
      tags: ['config-snapshots'],
      params: ServerNameParamsSchema,
      body: CreateSnapshotRequestSchema,
      response: {
        201: ConfigSnapshotSchema,
        404: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
  }, async (request: FastifyRequest<CreateRoute>, reply: FastifyReply) => {
    const { name } = request.params;
    const { description } = request.body ?? {};

    try {
      const exists = await checkServerExists(name);
      if (!exists) {
        return reply.code(404).send({
          error: 'NotFound',
          message: `Server '${name}' not found`,
        });
      }

      const snapshot = await createSnapshot(name, description);

      await writeAuditLog({
        action: AuditActionEnum.CONFIG_SNAPSHOT_CREATE,
        actor: 'api:console',
        targetType: 'server',
        targetName: name,
        details: { snapshotId: snapshot.id, description: description ?? '', fileCount: snapshot.files.length },
        status: 'success',
      });

      return reply.code(201).send(snapshot.toJSON());
    } catch (error) {
      await writeAuditLog({
        action: AuditActionEnum.CONFIG_SNAPSHOT_CREATE,
        actor: 'api:console',
        targetType: 'server',
        targetName: name,
        details: { description: description ?? '' },
        status: 'failure',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      });
      fastify.log.error(error, 'Failed to create config snapshot');
      return reply.code(500).send({
        error: 'InternalServerError',
        message: 'Failed to create config snapshot',
      });
    }
  });

  /**
   * GET /api/servers/:name/config-snapshots/:id
   * Get a config snapshot by ID
   */
  fastify.get<DetailRoute>('/api/servers/:name/config-snapshots/:id', {
    schema: {
      description: 'Get config snapshot details',
      tags: ['config-snapshots'],
      params: ServerSnapshotParamsSchema,
      response: {
        200: ConfigSnapshotSchema,
        404: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
  }, async (request: FastifyRequest<DetailRoute>, reply: FastifyReply) => {
    const { name, id } = request.params;

    try {
      const snapshot = await getSnapshotById(id);

      if (!snapshot) {
        return reply.code(404).send({
          error: 'NotFound',
          message: `Config snapshot '${id}' not found`,
        });
      }

      // Verify the snapshot belongs to the requested server
      if (snapshot.serverName.value !== name) {
        return reply.code(404).send({
          error: 'NotFound',
          message: `Config snapshot '${id}' not found for server '${name}'`,
        });
      }

      return reply.send(snapshot.toJSON());
    } catch (error) {
      fastify.log.error(error, 'Failed to get config snapshot');
      return reply.code(500).send({
        error: 'InternalServerError',
        message: 'Failed to get config snapshot',
      });
    }
  });

  /**
   * DELETE /api/servers/:name/config-snapshots/:id
   * Delete a config snapshot
   */
  fastify.delete<DetailRoute>('/api/servers/:name/config-snapshots/:id', {
    schema: {
      description: 'Delete a config snapshot',
      tags: ['config-snapshots'],
      params: ServerSnapshotParamsSchema,
      response: {
        204: Type.Null(),
        404: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
  }, async (request: FastifyRequest<DetailRoute>, reply: FastifyReply) => {
    const { name, id } = request.params;

    try {
      const snapshot = await getSnapshotById(id);

      if (!snapshot) {
        return reply.code(404).send({
          error: 'NotFound',
          message: `Config snapshot '${id}' not found`,
        });
      }

      // Verify the snapshot belongs to the requested server
      if (snapshot.serverName.value !== name) {
        return reply.code(404).send({
          error: 'NotFound',
          message: `Config snapshot '${id}' not found for server '${name}'`,
        });
      }

      await deleteSnapshot(id);

      await writeAuditLog({
        action: AuditActionEnum.CONFIG_SNAPSHOT_DELETE,
        actor: 'api:console',
        targetType: 'server',
        targetName: name,
        details: { snapshotId: id },
        status: 'success',
      });

      return reply.code(204).send();
    } catch (error) {
      await writeAuditLog({
        action: AuditActionEnum.CONFIG_SNAPSHOT_DELETE,
        actor: 'api:console',
        targetType: 'server',
        targetName: name,
        details: { snapshotId: id },
        status: 'failure',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      });
      fastify.log.error(error, 'Failed to delete config snapshot');
      return reply.code(500).send({
        error: 'InternalServerError',
        message: 'Failed to delete config snapshot',
      });
    }
  });

  /**
   * POST /api/servers/:name/config-snapshots/:id/restore
   * Restore server configuration from a snapshot
   */
  fastify.post<RestoreRoute>('/api/servers/:name/config-snapshots/:id/restore', {
    schema: {
      description: 'Restore server configuration from a snapshot',
      tags: ['config-snapshots'],
      params: ServerSnapshotParamsSchema,
      body: RestoreSnapshotRequestSchema,
      response: {
        200: RestoreSnapshotResponseSchema,
        404: ErrorResponseSchema,
        409: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
  }, async (request: FastifyRequest<RestoreRoute>, reply: FastifyReply) => {
    const { name, id } = request.params;
    const { createSnapshotBeforeRestore = true, force = false } = request.body ?? {};

    try {
      const snapshot = await getSnapshotById(id);

      if (!snapshot) {
        return reply.code(404).send({
          error: 'NotFound',
          message: `Config snapshot '${id}' not found`,
        });
      }

      // Verify the snapshot belongs to the requested server
      if (snapshot.serverName.value !== name) {
        return reply.code(404).send({
          error: 'NotFound',
          message: `Config snapshot '${id}' not found for server '${name}'`,
        });
      }

      // Check if server is running (unless force is true)
      if (!force) {
        const running = await isServerRunning(name);
        if (running) {
          return reply.code(409).send({
            error: 'Conflict',
            message: `Server '${name}' is currently running. Stop the server first or use force=true to override.`,
          });
        }
      }

      // Create safety snapshot before restore if requested
      let safetySnapshot;
      if (createSnapshotBeforeRestore) {
        try {
          safetySnapshot = await createSnapshot(name, `Safety snapshot before restoring ${id}`);
        } catch (safetyError) {
          fastify.log.warn(safetyError, 'Failed to create safety snapshot before restore');
          // Continue with restore even if safety snapshot fails
        }
      }

      // Perform restore
      await restoreSnapshot(id, force);

      await writeAuditLog({
        action: AuditActionEnum.CONFIG_SNAPSHOT_RESTORE,
        actor: 'api:console',
        targetType: 'server',
        targetName: name,
        details: {
          snapshotId: id,
          force,
          safetySnapshotId: safetySnapshot?.id,
        },
        status: 'success',
      });

      const response: Record<string, unknown> = {
        restored: snapshot.toJSON(),
      };
      if (safetySnapshot) {
        response['safetySnapshot'] = safetySnapshot.toJSON();
      }

      return reply.send(response);
    } catch (error) {
      await writeAuditLog({
        action: AuditActionEnum.CONFIG_SNAPSHOT_RESTORE,
        actor: 'api:console',
        targetType: 'server',
        targetName: name,
        details: { snapshotId: id, force },
        status: 'failure',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      });
      fastify.log.error(error, 'Failed to restore config snapshot');
      return reply.code(500).send({
        error: 'InternalServerError',
        message: 'Failed to restore config snapshot',
      });
    }
  });
};

// Import Type for 204 response
import { Type } from '@sinclair/typebox';

export default fp(configSnapshotsPlugin, {
  name: 'config-snapshots-routes',
  fastify: '5.x',
});

export { configSnapshotsPlugin };
