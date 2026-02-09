import { FastifyInstance, FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import { containerExists, getContainerStatus, OpLevel } from '@minecraft-docker/shared';
import {
  PlayerInfoSchema,
  OnlinePlayersResponseSchema,
  PlayerListResponseSchema,
  WhitelistResponseSchema,
  BannedPlayersResponseSchema,
  AddPlayerRequestSchema,
  KickPlayerRequestSchema,
  PlayerActionResponseSchema,
  PlayerParamsSchema,
  UsernameParamsSchema,
  ErrorResponseSchema,
  type AddPlayerRequest,
  type KickPlayerRequest,
  type PlayerParams,
  type UsernameParams,
} from '../schemas/player.js';
import {
  OperatorsListResponseSchema,
  AddOperatorRequestSchema,
  UpdateOperatorLevelRequestSchema,
  OperatorActionResponseSchema,
  type AddOperatorRequest,
  type UpdateOperatorLevelRequest,
} from '../schemas/op.js';
import { ServerNameParamsSchema, type ServerNameParams } from '../schemas/server.js';
import { execRconCommand, parsePlayerList } from '../lib/rcon.js';
import { config } from '../config/index.js';
import { PlayerFileService } from '../services/PlayerFileService.js';
import { OpsJsonService } from '../services/OpsJsonService.js';

// Route interfaces
interface ServerRoute {
  Params: ServerNameParams;
}

interface PlayerRoute {
  Params: PlayerParams;
}

interface UsernameRoute {
  Params: UsernameParams;
}

interface AddPlayerRoute {
  Params: ServerNameParams;
  Body: AddPlayerRequest;
}

interface KickPlayerRoute {
  Params: ServerNameParams;
  Body: KickPlayerRequest;
}

interface AddOperatorRoute {
  Params: ServerNameParams;
  Body: AddOperatorRequest;
}

interface UpdateOperatorLevelRoute {
  Params: PlayerParams;
  Body: UpdateOperatorLevelRequest;
}

/**
 * Look up UUID from Mojang API. Returns empty string on failure.
 */
async function lookupUuid(playerName: string): Promise<string> {
  try {
    const response = await fetch(`https://api.mojang.com/users/profiles/minecraft/${encodeURIComponent(playerName)}`);
    if (!response.ok) return '';
    const data = await response.json() as { id: string; name: string };
    return data.id.replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, '$1-$2-$3-$4-$5');
  } catch {
    return '';
  }
}

/**
 * Player management routes plugin
 */
const playersPlugin: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  const playerFileService = new PlayerFileService(config.platformPath);
  const opsJsonService = new OpsJsonService(config.platformPath);

  // Helper to check server exists (container created)
  const checkServerExists = (name: string, reply: FastifyReply): boolean => {
    const containerName = `mc-${name}`;
    if (!containerExists(containerName)) {
      reply.code(404).send({ error: 'NotFound', message: `Server '${name}' not found` });
      return false;
    }
    return true;
  };

  // Helper to check if server is running
  const isServerRunning = (name: string): boolean => {
    const containerName = `mc-${name}`;
    if (!containerExists(containerName)) return false;
    return getContainerStatus(containerName) === 'running';
  };

  // Helper to check server is running (for commands that require it, like kick/online players)
  const checkServerRunning = (name: string, reply: FastifyReply): boolean => {
    if (!checkServerExists(name, reply)) return false;
    if (!isServerRunning(name)) {
      reply.code(400).send({ error: 'BadRequest', message: `Server '${name}' is not running` });
      return false;
    }
    return true;
  };

  /**
   * GET /api/servers/:name/players
   * List online players (requires running server)
   */
  fastify.get<ServerRoute>('/api/servers/:name/players', {
    schema: {
      description: 'List online players on a server',
      tags: ['players'],
      params: ServerNameParamsSchema,
      response: {
        200: OnlinePlayersResponseSchema,
        400: ErrorResponseSchema,
        404: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
  }, async (request: FastifyRequest<ServerRoute>, reply: FastifyReply) => {
    const { name } = request.params;
    if (!checkServerRunning(name, reply)) return;

    try {
      const result = await execRconCommand(name, 'list');
      const parsed = parsePlayerList(result);
      return reply.send(parsed);
    } catch (error) {
      fastify.log.error(error, 'Failed to get online players');
      return reply.code(500).send({ error: 'InternalServerError', message: 'Failed to get online players' });
    }
  });

  /**
   * GET /api/players/:username
   * Get player info from Mojang API
   */
  fastify.get<UsernameRoute>('/api/players/:username', {
    schema: {
      description: 'Get player info (UUID, skin) from Mojang API',
      tags: ['players'],
      params: UsernameParamsSchema,
      response: {
        200: PlayerInfoSchema,
        404: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
  }, async (request: FastifyRequest<UsernameRoute>, reply: FastifyReply) => {
    const { username } = request.params;

    try {
      // Fetch from Mojang API
      const response = await fetch(`https://api.mojang.com/users/profiles/minecraft/${username}`);

      if (response.status === 404) {
        return reply.code(404).send({ error: 'NotFound', message: `Player '${username}' not found` });
      }

      if (!response.ok) {
        throw new Error(`Mojang API returned ${response.status}`);
      }

      const data = await response.json() as { id: string; name: string };

      // Format UUID with dashes
      const uuid = data.id.replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, '$1-$2-$3-$4-$5');

      return reply.send({
        username: data.name,
        uuid,
        skinUrl: `https://crafatar.com/avatars/${data.id}?overlay`,
      });
    } catch (error) {
      fastify.log.error(error, 'Failed to get player info');
      return reply.code(500).send({ error: 'InternalServerError', message: 'Failed to get player info' });
    }
  });

  // ==================== WHITELIST ====================

  /**
   * GET /api/servers/:name/whitelist
   */
  fastify.get<ServerRoute>('/api/servers/:name/whitelist', {
    schema: {
      description: 'Get server whitelist',
      tags: ['players'],
      params: ServerNameParamsSchema,
      response: { 200: WhitelistResponseSchema, 400: ErrorResponseSchema, 404: ErrorResponseSchema, 500: ErrorResponseSchema },
    },
  }, async (request: FastifyRequest<ServerRoute>, reply: FastifyReply) => {
    const { name } = request.params;
    if (!checkServerExists(name, reply)) return;

    const running = isServerRunning(name);

    if (running) {
      try {
        const result = await execRconCommand(name, 'whitelist list');
        const match = result.match(/:\s*(.*)$/);
        const playerNames = match && match[1] ? match[1].split(',').map(p => p.trim()).filter(Boolean) : [];

        // RCON doesn't provide UUIDs, so we return empty uuids
        const players = playerNames.map(name => ({ name, uuid: '' }));
        return reply.send({ players, total: players.length, source: 'rcon' });
      } catch (error) {
        fastify.log.warn(error, 'RCON failed for whitelist, falling back to file');
      }
    }

    // Fallback: read from file
    try {
      const result = playerFileService.readWhitelist(name);
      return reply.send(result);
    } catch (error) {
      fastify.log.error(error, 'Failed to get whitelist');
      return reply.code(500).send({ error: 'InternalServerError', message: 'Failed to get whitelist' });
    }
  });

  /**
   * POST /api/servers/:name/whitelist
   */
  fastify.post<AddPlayerRoute>('/api/servers/:name/whitelist', {
    schema: {
      description: 'Add player to whitelist',
      tags: ['players'],
      params: ServerNameParamsSchema,
      body: AddPlayerRequestSchema,
      response: { 200: PlayerActionResponseSchema, 400: ErrorResponseSchema, 404: ErrorResponseSchema, 500: ErrorResponseSchema },
    },
  }, async (request: FastifyRequest<AddPlayerRoute>, reply: FastifyReply) => {
    const { name } = request.params;
    const { player } = request.body;
    if (!checkServerExists(name, reply)) return;

    const running = isServerRunning(name);

    if (running) {
      try {
        const result = await execRconCommand(name, `whitelist add ${player}`);
        return reply.send({ success: true, message: result || `Added ${player} to whitelist`, source: 'rcon' });
      } catch (error) {
        fastify.log.warn(error, 'RCON failed for whitelist add, falling back to file');
      }
    }

    // Offline: write to file with UUID lookup
    try {
      const uuid = await lookupUuid(player);
      playerFileService.addToWhitelist(name, player, uuid);
      return reply.send({
        success: true,
        message: `Added ${player} to whitelist (will apply on next server start)`,
        source: 'file',
      });
    } catch (error) {
      fastify.log.error(error, 'Failed to add to whitelist');
      return reply.code(500).send({ error: 'InternalServerError', message: 'Failed to add to whitelist' });
    }
  });

  /**
   * DELETE /api/servers/:name/whitelist/:player
   */
  fastify.delete<PlayerRoute>('/api/servers/:name/whitelist/:player', {
    schema: {
      description: 'Remove player from whitelist',
      tags: ['players'],
      params: PlayerParamsSchema,
      response: { 200: PlayerActionResponseSchema, 400: ErrorResponseSchema, 404: ErrorResponseSchema, 500: ErrorResponseSchema },
    },
  }, async (request: FastifyRequest<PlayerRoute>, reply: FastifyReply) => {
    const { name, player } = request.params;
    if (!checkServerExists(name, reply)) return;

    const running = isServerRunning(name);

    if (running) {
      try {
        const result = await execRconCommand(name, `whitelist remove ${player}`);
        return reply.send({ success: true, message: result || `Removed ${player} from whitelist`, source: 'rcon' });
      } catch (error) {
        fastify.log.warn(error, 'RCON failed for whitelist remove, falling back to file');
      }
    }

    try {
      playerFileService.removeFromWhitelist(name, player);
      return reply.send({
        success: true,
        message: `Removed ${player} from whitelist (will apply on next server start)`,
        source: 'file',
      });
    } catch (error) {
      fastify.log.error(error, 'Failed to remove from whitelist');
      return reply.code(500).send({ error: 'InternalServerError', message: 'Failed to remove from whitelist' });
    }
  });

  // ==================== BANS ====================

  /**
   * GET /api/servers/:name/bans
   */
  fastify.get<ServerRoute>('/api/servers/:name/bans', {
    schema: {
      description: 'Get banned players list',
      tags: ['players'],
      params: ServerNameParamsSchema,
      response: { 200: BannedPlayersResponseSchema, 400: ErrorResponseSchema, 404: ErrorResponseSchema, 500: ErrorResponseSchema },
    },
  }, async (request: FastifyRequest<ServerRoute>, reply: FastifyReply) => {
    const { name } = request.params;
    if (!checkServerExists(name, reply)) return;

    const running = isServerRunning(name);

    if (running) {
      try {
        const result = await execRconCommand(name, 'banlist players');
        const match = result.match(/:\s*(.*)$/);
        const playerNames = match && match[1] ? match[1].split(',').map(p => p.trim()).filter(Boolean) : [];

        // RCON doesn't provide full ban details, so we return minimal info
        const players = playerNames.map(name => ({
          name,
          uuid: '',
          reason: '',
          created: '',
          source: '',
          expires: 'forever',
        }));
        return reply.send({ players, total: players.length, source: 'file' });
      } catch (error) {
        fastify.log.warn(error, 'RCON failed for ban list, falling back to file');
      }
    }

    try {
      const result = playerFileService.readBannedPlayers(name);
      return reply.send(result);
    } catch (error) {
      fastify.log.error(error, 'Failed to get ban list');
      return reply.code(500).send({ error: 'InternalServerError', message: 'Failed to get ban list' });
    }
  });

  /**
   * POST /api/servers/:name/bans
   */
  fastify.post<AddPlayerRoute>('/api/servers/:name/bans', {
    schema: {
      description: 'Ban a player',
      tags: ['players'],
      params: ServerNameParamsSchema,
      body: AddPlayerRequestSchema,
      response: { 200: PlayerActionResponseSchema, 400: ErrorResponseSchema, 404: ErrorResponseSchema, 500: ErrorResponseSchema },
    },
  }, async (request: FastifyRequest<AddPlayerRoute>, reply: FastifyReply) => {
    const { name } = request.params;
    const { player, reason } = request.body;
    if (!checkServerExists(name, reply)) return;

    const running = isServerRunning(name);

    if (running) {
      try {
        const cmd = reason ? `ban ${player} ${reason}` : `ban ${player}`;
        const result = await execRconCommand(name, cmd);
        return reply.send({ success: true, message: result || `Banned ${player}`, source: 'rcon' });
      } catch (error) {
        fastify.log.warn(error, 'RCON failed for ban, falling back to file');
      }
    }

    try {
      const uuid = await lookupUuid(player);
      playerFileService.addToBannedPlayers(name, player, uuid, reason);
      return reply.send({
        success: true,
        message: `Banned ${player} (will apply on next server start)`,
        source: 'file',
      });
    } catch (error) {
      fastify.log.error(error, 'Failed to ban player');
      return reply.code(500).send({ error: 'InternalServerError', message: 'Failed to ban player' });
    }
  });

  /**
   * DELETE /api/servers/:name/bans/:player
   */
  fastify.delete<PlayerRoute>('/api/servers/:name/bans/:player', {
    schema: {
      description: 'Unban a player',
      tags: ['players'],
      params: PlayerParamsSchema,
      response: { 200: PlayerActionResponseSchema, 400: ErrorResponseSchema, 404: ErrorResponseSchema, 500: ErrorResponseSchema },
    },
  }, async (request: FastifyRequest<PlayerRoute>, reply: FastifyReply) => {
    const { name, player } = request.params;
    if (!checkServerExists(name, reply)) return;

    const running = isServerRunning(name);

    if (running) {
      try {
        const result = await execRconCommand(name, `pardon ${player}`);
        return reply.send({ success: true, message: result || `Unbanned ${player}`, source: 'rcon' });
      } catch (error) {
        fastify.log.warn(error, 'RCON failed for unban, falling back to file');
      }
    }

    try {
      playerFileService.removeFromBannedPlayers(name, player);
      return reply.send({
        success: true,
        message: `Unbanned ${player} (will apply on next server start)`,
        source: 'file',
      });
    } catch (error) {
      fastify.log.error(error, 'Failed to unban player');
      return reply.code(500).send({ error: 'InternalServerError', message: 'Failed to unban player' });
    }
  });

  // ==================== KICK ====================

  /**
   * POST /api/servers/:name/kick
   * Kick requires a running server (no offline fallback)
   */
  fastify.post<KickPlayerRoute>('/api/servers/:name/kick', {
    schema: {
      description: 'Kick a player from the server',
      tags: ['players'],
      params: ServerNameParamsSchema,
      body: KickPlayerRequestSchema,
      response: { 200: PlayerActionResponseSchema, 400: ErrorResponseSchema, 404: ErrorResponseSchema, 500: ErrorResponseSchema },
    },
  }, async (request: FastifyRequest<KickPlayerRoute>, reply: FastifyReply) => {
    const { name } = request.params;
    const { player, reason } = request.body;
    if (!checkServerRunning(name, reply)) return;

    try {
      const cmd = reason ? `kick ${player} ${reason}` : `kick ${player}`;
      const result = await execRconCommand(name, cmd);
      return reply.send({ success: true, message: result || `Kicked ${player}` });
    } catch (error) {
      fastify.log.error(error, 'Failed to kick player');
      return reply.code(500).send({ error: 'InternalServerError', message: 'Failed to kick player' });
    }
  });

  // ==================== OPERATORS ====================

  /**
   * GET /api/servers/:name/ops
   * Returns operators with level and role information
   */
  fastify.get<ServerRoute>('/api/servers/:name/ops', {
    schema: {
      description: 'Get server operators list with level and role information',
      tags: ['players'],
      params: ServerNameParamsSchema,
      response: { 200: OperatorsListResponseSchema, 400: ErrorResponseSchema, 404: ErrorResponseSchema, 500: ErrorResponseSchema },
    },
  }, async (request: FastifyRequest<ServerRoute>, reply: FastifyReply) => {
    const { name } = request.params;
    if (!checkServerExists(name, reply)) return;

    try {
      // Read from ops.json file
      const operators = opsJsonService.readOps(name);

      return reply.send({
        operators: operators.map(op => ({
          name: op.name,
          uuid: op.uuid,
          level: op.level.value,
          role: op.level.label,
          bypassesPlayerLimit: op.bypassesPlayerLimit,
        })),
        count: operators.length,
        source: 'file',
      });
    } catch (error) {
      fastify.log.error(error, 'Failed to get ops list');
      return reply.code(500).send({ error: 'InternalServerError', message: 'Failed to get ops list' });
    }
  });

  /**
   * POST /api/servers/:name/ops
   * Add operator with optional level (default: 4)
   */
  fastify.post<AddOperatorRoute>('/api/servers/:name/ops', {
    schema: {
      description: 'Add player as operator with specified level (default: 4)',
      tags: ['players'],
      params: ServerNameParamsSchema,
      body: AddOperatorRequestSchema,
      response: { 200: OperatorActionResponseSchema, 400: ErrorResponseSchema, 404: ErrorResponseSchema, 500: ErrorResponseSchema },
    },
  }, async (request: FastifyRequest<AddOperatorRoute>, reply: FastifyReply) => {
    const { name } = request.params;
    const { player, level = 4 } = request.body;
    if (!checkServerExists(name, reply)) return;

    try {
      // Lookup UUID
      const uuid = await lookupUuid(player);
      if (!uuid) {
        return reply.code(404).send({ error: 'NotFound', message: `Player '${player}' not found` });
      }

      // Add operator with level using OpsJsonService
      const opLevel = OpLevel.from(level);
      const operator = opsJsonService.addOperator(name, player, uuid, opLevel);

      return reply.send({
        success: true,
        operator: {
          name: operator.name,
          uuid: operator.uuid,
          level: operator.level.value,
          role: operator.level.label,
          bypassesPlayerLimit: operator.bypassesPlayerLimit,
        },
        source: 'file',
      });
    } catch (error) {
      fastify.log.error(error, 'Failed to add operator');
      return reply.code(500).send({ error: 'InternalServerError', message: 'Failed to add operator' });
    }
  });

  /**
   * PATCH /api/servers/:name/ops/:player
   * Update operator level
   */
  fastify.patch<UpdateOperatorLevelRoute>('/api/servers/:name/ops/:player', {
    schema: {
      description: 'Update operator level',
      tags: ['players'],
      params: PlayerParamsSchema,
      body: UpdateOperatorLevelRequestSchema,
      response: { 200: OperatorActionResponseSchema, 400: ErrorResponseSchema, 404: ErrorResponseSchema, 500: ErrorResponseSchema },
    },
  }, async (request: FastifyRequest<UpdateOperatorLevelRoute>, reply: FastifyReply) => {
    const { name, player } = request.params;
    const { level } = request.body;
    if (!checkServerExists(name, reply)) return;

    try {
      const opLevel = OpLevel.from(level);
      const operator = opsJsonService.updateOperatorLevel(name, player, opLevel);

      if (!operator) {
        return reply.code(404).send({ error: 'NotFound', message: `Operator '${player}' not found` });
      }

      return reply.send({
        success: true,
        operator: {
          name: operator.name,
          uuid: operator.uuid,
          level: operator.level.value,
          role: operator.level.label,
          bypassesPlayerLimit: operator.bypassesPlayerLimit,
        },
        source: 'file',
      });
    } catch (error) {
      fastify.log.error(error, 'Failed to update operator level');
      return reply.code(500).send({ error: 'InternalServerError', message: 'Failed to update operator level' });
    }
  });

  /**
   * DELETE /api/servers/:name/ops/:player
   */
  fastify.delete<PlayerRoute>('/api/servers/:name/ops/:player', {
    schema: {
      description: 'Remove player operator status',
      tags: ['players'],
      params: PlayerParamsSchema,
      response: { 200: PlayerActionResponseSchema, 400: ErrorResponseSchema, 404: ErrorResponseSchema, 500: ErrorResponseSchema },
    },
  }, async (request: FastifyRequest<PlayerRoute>, reply: FastifyReply) => {
    const { name, player } = request.params;
    if (!checkServerExists(name, reply)) return;

    try {
      const removed = opsJsonService.removeOperator(name, player);

      if (!removed) {
        return reply.code(404).send({ error: 'NotFound', message: `Operator '${player}' not found` });
      }

      return reply.send({
        success: true,
        message: `Removed operator status from ${player}`,
        source: 'file',
      });
    } catch (error) {
      fastify.log.error(error, 'Failed to remove operator');
      return reply.code(500).send({ error: 'InternalServerError', message: 'Failed to remove operator' });
    }
  });
};

export default fp(playersPlugin, {
  name: 'players-routes',
  fastify: '5.x',
});

export { playersPlugin };
