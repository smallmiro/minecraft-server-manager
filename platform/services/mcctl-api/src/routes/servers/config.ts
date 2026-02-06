import { FastifyInstance, FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import { join } from 'path';
import { existsSync, rmSync } from 'fs';
import { serverExists, getContainerStatus } from '@minecraft-docker/shared';
import {
  ServerConfigResponseSchema,
  UpdateServerConfigRequestSchema,
  UpdateServerConfigResponseSchema,
  WorldResetResponseSchema,
  type UpdateServerConfigRequest,
} from '../../schemas/config.js';
import { ErrorResponseSchema, ServerNameParamsSchema, type ServerNameParams } from '../../schemas/server.js';
import { config } from '../../config/index.js';
import { createConfigService } from '../../services/ConfigService.js';

// ============================================================
// Types
// ============================================================

interface GetConfigRoute {
  Params: ServerNameParams;
}

interface UpdateConfigRoute {
  Params: ServerNameParams;
  Body: UpdateServerConfigRequest;
}

interface WorldResetRoute {
  Params: ServerNameParams;
}

// ============================================================
// Plugin Definition
// ============================================================

/**
 * Server configuration routes plugin
 * Provides REST API for server configuration management
 */
const configPlugin: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  const configService = createConfigService(config.platformPath);

  /**
   * GET /api/servers/:name/config
   * Get server configuration
   */
  fastify.get<GetConfigRoute>('/api/servers/:name/config', {
    schema: {
      description: 'Get server configuration from config.env',
      tags: ['servers', 'config'],
      params: ServerNameParamsSchema,
      response: {
        200: ServerConfigResponseSchema,
        404: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
  }, async (request: FastifyRequest<GetConfigRoute>, reply: FastifyReply) => {
    const { name } = request.params;

    try {
      // Check if server exists
      if (!serverExists(name)) {
        return reply.code(404).send({
          error: 'NotFound',
          message: `Server '${name}' not found`,
        });
      }

      // Check if config exists
      if (!configService.configExists(name)) {
        return reply.code(404).send({
          error: 'NotFound',
          message: `Configuration for server '${name}' not found`,
        });
      }

      const serverConfig = configService.getConfig(name);

      return reply.send({
        config: serverConfig,
      });
    } catch (error) {
      fastify.log.error(error, 'Failed to get server configuration');
      return reply.code(500).send({
        error: 'InternalServerError',
        message: 'Failed to get server configuration',
      });
    }
  });

  /**
   * PATCH /api/servers/:name/config
   * Update server configuration
   */
  fastify.patch<UpdateConfigRoute>('/api/servers/:name/config', {
    schema: {
      description: 'Update server configuration in config.env',
      tags: ['servers', 'config'],
      params: ServerNameParamsSchema,
      body: UpdateServerConfigRequestSchema,
      response: {
        200: UpdateServerConfigResponseSchema,
        404: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
  }, async (request: FastifyRequest<UpdateConfigRoute>, reply: FastifyReply) => {
    const { name } = request.params;
    const updates = request.body;

    try {
      // Check if server exists
      if (!serverExists(name)) {
        return reply.code(404).send({
          error: 'NotFound',
          message: `Server '${name}' not found`,
        });
      }

      // Check if config exists
      if (!configService.configExists(name)) {
        return reply.code(404).send({
          error: 'NotFound',
          message: `Configuration for server '${name}' not found`,
        });
      }

      const result = configService.updateConfig(name, updates);

      fastify.log.info({
        server: name,
        changedFields: result.changedFields,
        restartRequired: result.restartRequired,
      }, 'Server configuration updated');

      return reply.send({
        success: true,
        config: result.config,
        restartRequired: result.restartRequired,
        changedFields: result.changedFields,
      });
    } catch (error) {
      fastify.log.error(error, 'Failed to update server configuration');
      return reply.code(500).send({
        error: 'InternalServerError',
        message: 'Failed to update server configuration',
      });
    }
  });

  /**
   * POST /api/servers/:name/world/reset
   * Reset server world data
   * Precondition: Server must be stopped
   */
  fastify.post<WorldResetRoute>('/api/servers/:name/world/reset', {
    schema: {
      description: 'Reset server world data (server must be stopped)',
      tags: ['servers', 'world'],
      params: ServerNameParamsSchema,
      response: {
        200: WorldResetResponseSchema,
        404: ErrorResponseSchema,
        409: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
  }, async (request: FastifyRequest<WorldResetRoute>, reply: FastifyReply) => {
    const { name } = request.params;
    const containerName = `mc-${name}`;

    try {
      // Check if server exists
      if (!serverExists(name)) {
        return reply.code(404).send({
          error: 'NotFound',
          message: `Server '${name}' not found`,
        });
      }

      // Check if server is running - must be stopped to reset world
      const status = getContainerStatus(containerName);
      if (status === 'running') {
        return reply.code(409).send({
          error: 'Conflict',
          message: 'Server must be stopped before resetting world. Please stop the server first.',
        });
      }

      // Get world name from configuration
      const worldName = configService.getWorldName(name);

      // Construct world path
      const worldPath = join(config.platformPath, 'worlds', worldName);

      if (!existsSync(worldPath)) {
        return reply.code(404).send({
          error: 'NotFound',
          message: `World '${worldName}' not found`,
        });
      }

      // Get .meta file path (to preserve)
      const metaPath = join(worldPath, '.meta');
      const hasMeta = existsSync(metaPath);

      // Read .meta content before deletion
      let metaContent: string | null = null;
      if (hasMeta) {
        const { readFileSync } = await import('fs');
        metaContent = readFileSync(metaPath, 'utf-8');
      }

      // Delete world directory contents (but not the directory itself)
      const { readdirSync } = await import('fs');
      const entries = readdirSync(worldPath, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.name === '.meta') {
          continue; // Skip .meta file
        }

        const entryPath = join(worldPath, entry.name);
        rmSync(entryPath, { recursive: true, force: true });
      }

      // Restore .meta if it existed
      if (hasMeta && metaContent) {
        const { writeFileSync } = await import('fs');
        writeFileSync(metaPath, metaContent, 'utf-8');
      }

      fastify.log.info({
        server: name,
        worldName,
        worldPath,
      }, 'World reset completed');

      return reply.send({
        success: true,
        message: 'World data has been reset. Start the server to generate a new world.',
        worldName,
      });
    } catch (error) {
      fastify.log.error(error, 'Failed to reset world');
      return reply.code(500).send({
        error: 'InternalServerError',
        message: 'Failed to reset world',
      });
    }
  });
};

// ============================================================
// Export
// ============================================================

export default fp(configPlugin, {
  name: 'server-config-routes',
  fastify: '5.x',
});

export { configPlugin };
