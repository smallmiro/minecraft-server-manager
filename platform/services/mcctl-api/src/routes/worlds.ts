import { FastifyInstance, FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import {
  WorldManagementUseCase,
  ApiPromptAdapter,
  ShellAdapter,
  WorldRepository,
  ServerRepository,
  Paths,
} from '@minecraft-docker/shared';
import {
  WorldListResponseSchema,
  WorldDetailResponseSchema,
  CreateWorldResponseSchema,
  AssignWorldResponseSchema,
  ReleaseWorldResponseSchema,
  DeleteWorldResponseSchema,
  WorldErrorResponseSchema,
  WorldNameParamsSchema,
  CreateWorldRequestSchema,
  AssignWorldRequestSchema,
  DeleteWorldQuerySchema,
  ReleaseWorldQuerySchema,
  type WorldNameParams,
  type CreateWorldRequest,
  type AssignWorldRequest,
  type DeleteWorldQuery,
  type ReleaseWorldQuery,
} from '../schemas/world.js';

// Route generic interfaces for type-safe request handling
interface WorldNameRoute {
  Params: WorldNameParams;
}

interface CreateWorldRoute {
  Body: CreateWorldRequest;
}

interface AssignWorldRoute {
  Params: WorldNameParams;
  Body: AssignWorldRequest;
}

interface ReleaseWorldRoute {
  Params: WorldNameParams;
  Querystring: ReleaseWorldQuery;
}

interface DeleteWorldRoute {
  Params: WorldNameParams;
  Querystring: DeleteWorldQuery;
}

/**
 * Create WorldManagementUseCase instance with API adapters
 */
function createWorldUseCase(options?: {
  serverName?: string;
  worldName?: string;
  worldSeed?: string;
  confirmValue?: boolean;
}): WorldManagementUseCase {
  const paths = new Paths();
  const prompt = new ApiPromptAdapter({
    serverName: options?.serverName,
    worldName: options?.worldName,
    worldSeed: options?.worldSeed,
    confirmValue: options?.confirmValue ?? true,
  });
  const shell = new ShellAdapter({ paths });
  const worldRepo = new WorldRepository(paths);
  const serverRepo = new ServerRepository(paths);

  return new WorldManagementUseCase(prompt, shell, worldRepo, serverRepo);
}

/**
 * Worlds routes plugin
 * Provides REST API for Minecraft world management
 */
const worldsPlugin: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  /**
   * GET /api/worlds
   * List all worlds with lock status
   */
  fastify.get('/api/worlds', {
    schema: {
      tags: ['worlds'],
      summary: 'List all worlds',
      description: 'Returns a list of all available worlds with their lock status',
      response: {
        200: WorldListResponseSchema,
        500: WorldErrorResponseSchema,
      },
    },
  }, async (_request, reply) => {
    try {
      const useCase = createWorldUseCase();
      const worlds = await useCase.listWorlds();

      return reply.send({
        worlds: worlds.map((world) => ({
          name: world.name,
          path: world.path,
          isLocked: world.isLocked,
          lockedBy: world.lockedBy,
          size: world.size,
          lastModified: world.lastModified?.toISOString(),
        })),
        total: worlds.length,
      });
    } catch (error) {
      fastify.log.error(error, 'Failed to list worlds');
      return reply.code(500).send({
        error: 'InternalServerError',
        message: 'Failed to list worlds',
      });
    }
  });

  /**
   * GET /api/worlds/:name
   * Get world details
   */
  fastify.get<WorldNameRoute>('/api/worlds/:name', {
    schema: {
      tags: ['worlds'],
      summary: 'Get world details',
      description: 'Returns detailed information about a specific world',
      params: WorldNameParamsSchema,
      response: {
        200: WorldDetailResponseSchema,
        404: WorldErrorResponseSchema,
        500: WorldErrorResponseSchema,
      },
    },
  }, async (request: FastifyRequest<WorldNameRoute>, reply: FastifyReply) => {
    const { name } = request.params;

    try {
      const useCase = createWorldUseCase();
      const worlds = await useCase.listWorlds();
      const world = worlds.find((w) => w.name === name);

      if (!world) {
        return reply.code(404).send({
          error: 'NotFound',
          message: `World '${name}' not found`,
        });
      }

      return reply.send({
        world: {
          name: world.name,
          path: world.path,
          isLocked: world.isLocked,
          lockedBy: world.lockedBy,
          size: world.size,
          lastModified: world.lastModified?.toISOString(),
        },
      });
    } catch (error) {
      fastify.log.error(error, 'Failed to get world details');
      return reply.code(500).send({
        error: 'InternalServerError',
        message: 'Failed to get world details',
      });
    }
  });

  /**
   * POST /api/worlds
   * Create a new world
   */
  fastify.post<CreateWorldRoute>('/api/worlds', {
    schema: {
      tags: ['worlds'],
      summary: 'Create a new world',
      description: 'Creates a new world with optional seed and server assignment',
      body: CreateWorldRequestSchema,
      response: {
        201: CreateWorldResponseSchema,
        400: WorldErrorResponseSchema,
        500: WorldErrorResponseSchema,
      },
    },
  }, async (request: FastifyRequest<CreateWorldRoute>, reply: FastifyReply) => {
    const { name, seed, serverName, autoStart } = request.body;

    try {
      const useCase = createWorldUseCase({
        serverName,
        worldName: name,
        worldSeed: seed,
      });

      const result = await useCase.createWorld({
        name,
        seed,
        serverName,
        autoStart: autoStart ?? false,
      });

      if (!result.success) {
        return reply.code(400).send({
          error: 'BadRequest',
          message: result.error || 'Failed to create world',
        });
      }

      return reply.code(201).send({
        success: true,
        worldName: result.worldName,
        seed: result.seed,
        serverName: result.serverName,
        started: result.started,
      });
    } catch (error) {
      fastify.log.error(error, 'Failed to create world');
      return reply.code(500).send({
        error: 'InternalServerError',
        message: 'Failed to create world',
      });
    }
  });

  /**
   * POST /api/worlds/:name/assign
   * Assign world to a server
   */
  fastify.post<AssignWorldRoute>('/api/worlds/:name/assign', {
    schema: {
      tags: ['worlds'],
      summary: 'Assign world to server',
      description: 'Assigns a world to a specific server. The world must not be already locked.',
      params: WorldNameParamsSchema,
      body: AssignWorldRequestSchema,
      response: {
        200: AssignWorldResponseSchema,
        400: WorldErrorResponseSchema,
        404: WorldErrorResponseSchema,
        409: WorldErrorResponseSchema,
        500: WorldErrorResponseSchema,
      },
    },
  }, async (request: FastifyRequest<AssignWorldRoute>, reply: FastifyReply) => {
    const { name } = request.params;
    const { serverName } = request.body;

    try {
      const useCase = createWorldUseCase({
        serverName,
        worldName: name,
      });

      const result = await useCase.assignWorldByName(name, serverName);

      if (!result.success) {
        // Determine appropriate error code
        if (result.error?.includes('not found')) {
          return reply.code(404).send({
            error: 'NotFound',
            message: result.error,
          });
        }
        if (result.error?.includes('locked')) {
          return reply.code(409).send({
            error: 'Conflict',
            message: result.error,
          });
        }
        return reply.code(400).send({
          error: 'BadRequest',
          message: result.error || 'Failed to assign world',
        });
      }

      return reply.send({
        success: true,
        worldName: result.worldName,
        serverName: result.serverName,
      });
    } catch (error) {
      fastify.log.error(error, 'Failed to assign world');
      return reply.code(500).send({
        error: 'InternalServerError',
        message: 'Failed to assign world',
      });
    }
  });

  /**
   * POST /api/worlds/:name/release
   * Release world lock
   */
  fastify.post<ReleaseWorldRoute>('/api/worlds/:name/release', {
    schema: {
      tags: ['worlds'],
      summary: 'Release world lock',
      description: 'Releases the lock on a world. The world must be currently locked.',
      params: WorldNameParamsSchema,
      querystring: ReleaseWorldQuerySchema,
      response: {
        200: ReleaseWorldResponseSchema,
        400: WorldErrorResponseSchema,
        404: WorldErrorResponseSchema,
        500: WorldErrorResponseSchema,
      },
    },
  }, async (request: FastifyRequest<ReleaseWorldRoute>, reply: FastifyReply) => {
    const { name } = request.params;
    const { force } = request.query;

    try {
      const useCase = createWorldUseCase({
        worldName: name,
      });

      const result = await useCase.releaseWorldByName(name, force);

      if (!result.success) {
        if (result.error?.includes('not found')) {
          return reply.code(404).send({
            error: 'NotFound',
            message: result.error,
          });
        }
        return reply.code(400).send({
          error: 'BadRequest',
          message: result.error || 'Failed to release world',
        });
      }

      return reply.send({
        success: true,
        worldName: result.worldName,
        previousServer: result.previousServer,
      });
    } catch (error) {
      fastify.log.error(error, 'Failed to release world');
      return reply.code(500).send({
        error: 'InternalServerError',
        message: 'Failed to release world',
      });
    }
  });

  /**
   * DELETE /api/worlds/:name
   * Delete a world
   */
  fastify.delete<DeleteWorldRoute>('/api/worlds/:name', {
    schema: {
      tags: ['worlds'],
      summary: 'Delete a world',
      description: 'Deletes a world. Locked worlds cannot be deleted unless force=true.',
      params: WorldNameParamsSchema,
      querystring: DeleteWorldQuerySchema,
      response: {
        200: DeleteWorldResponseSchema,
        400: WorldErrorResponseSchema,
        404: WorldErrorResponseSchema,
        409: WorldErrorResponseSchema,
        500: WorldErrorResponseSchema,
      },
    },
  }, async (request: FastifyRequest<DeleteWorldRoute>, reply: FastifyReply) => {
    const { name } = request.params;
    const { force } = request.query;

    try {
      const useCase = createWorldUseCase({
        worldName: name,
        confirmValue: true, // Auto-confirm in API mode
      });

      const result = await useCase.deleteWorldByName(name, force);

      if (!result.success) {
        if (result.error?.includes('not found')) {
          return reply.code(404).send({
            error: 'NotFound',
            message: result.error,
          });
        }
        if (result.error?.includes('locked')) {
          return reply.code(409).send({
            error: 'Conflict',
            message: result.error,
          });
        }
        return reply.code(400).send({
          error: 'BadRequest',
          message: result.error || 'Failed to delete world',
        });
      }

      return reply.send({
        success: true,
        worldName: result.worldName,
        size: result.size,
      });
    } catch (error) {
      fastify.log.error(error, 'Failed to delete world');
      return reply.code(500).send({
        error: 'InternalServerError',
        message: 'Failed to delete world',
      });
    }
  });
};

export default fp(worldsPlugin, {
  name: 'worlds-routes',
  fastify: '5.x',
});

export { worldsPlugin };
