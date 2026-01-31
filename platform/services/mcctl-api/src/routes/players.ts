import { FastifyInstance, FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import { containerExists, getContainerStatus } from '@minecraft-docker/shared';
import {
  PlayerInfoSchema,
  OnlinePlayersResponseSchema,
  PlayerListResponseSchema,
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
import { ServerNameParamsSchema, type ServerNameParams } from '../schemas/server.js';
import { execRconCommand, parsePlayerList } from '../lib/rcon.js';

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

/**
 * Player management routes plugin
 */
const playersPlugin: FastifyPluginAsync = async (fastify: FastifyInstance) => {

  // Helper to check server running
  const checkServerRunning = (name: string, reply: FastifyReply): boolean => {
    const containerName = `mc-${name}`;
    if (!containerExists(containerName)) {
      reply.code(404).send({ error: 'NotFound', message: `Server '${name}' not found` });
      return false;
    }
    const status = getContainerStatus(containerName);
    if (status !== 'running') {
      reply.code(400).send({ error: 'BadRequest', message: `Server '${name}' is not running` });
      return false;
    }
    return true;
  };

  /**
   * GET /api/servers/:name/players
   * List online players
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
      response: { 200: PlayerListResponseSchema, 400: ErrorResponseSchema, 404: ErrorResponseSchema, 500: ErrorResponseSchema },
    },
  }, async (request: FastifyRequest<ServerRoute>, reply: FastifyReply) => {
    const { name } = request.params;
    if (!checkServerRunning(name, reply)) return;

    try {
      const result = await execRconCommand(name, 'whitelist list');
      // Parse: "There are N whitelisted players: player1, player2"
      const match = result.match(/:\s*(.*)$/);
      const players = match && match[1] ? match[1].split(',').map(p => p.trim()).filter(Boolean) : [];
      return reply.send({ players, total: players.length });
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
    if (!checkServerRunning(name, reply)) return;

    try {
      const result = await execRconCommand(name, `whitelist add ${player}`);
      return reply.send({ success: true, message: result || `Added ${player} to whitelist` });
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
    if (!checkServerRunning(name, reply)) return;

    try {
      const result = await execRconCommand(name, `whitelist remove ${player}`);
      return reply.send({ success: true, message: result || `Removed ${player} from whitelist` });
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
      response: { 200: PlayerListResponseSchema, 400: ErrorResponseSchema, 404: ErrorResponseSchema, 500: ErrorResponseSchema },
    },
  }, async (request: FastifyRequest<ServerRoute>, reply: FastifyReply) => {
    const { name } = request.params;
    if (!checkServerRunning(name, reply)) return;

    try {
      const result = await execRconCommand(name, 'banlist players');
      // Parse: "There are N bans: player1, player2" or "There are no bans"
      const match = result.match(/:\s*(.*)$/);
      const players = match && match[1] ? match[1].split(',').map(p => p.trim()).filter(Boolean) : [];
      return reply.send({ players, total: players.length });
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
    if (!checkServerRunning(name, reply)) return;

    try {
      const cmd = reason ? `ban ${player} ${reason}` : `ban ${player}`;
      const result = await execRconCommand(name, cmd);
      return reply.send({ success: true, message: result || `Banned ${player}` });
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
    if (!checkServerRunning(name, reply)) return;

    try {
      const result = await execRconCommand(name, `pardon ${player}`);
      return reply.send({ success: true, message: result || `Unbanned ${player}` });
    } catch (error) {
      fastify.log.error(error, 'Failed to unban player');
      return reply.code(500).send({ error: 'InternalServerError', message: 'Failed to unban player' });
    }
  });

  // ==================== KICK ====================

  /**
   * POST /api/servers/:name/kick
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
   */
  fastify.get<ServerRoute>('/api/servers/:name/ops', {
    schema: {
      description: 'Get server operators list',
      tags: ['players'],
      params: ServerNameParamsSchema,
      response: { 200: PlayerListResponseSchema, 400: ErrorResponseSchema, 404: ErrorResponseSchema, 500: ErrorResponseSchema },
    },
  }, async (request: FastifyRequest<ServerRoute>, reply: FastifyReply) => {
    const { name } = request.params;
    if (!checkServerRunning(name, reply)) return;

    try {
      const result = await execRconCommand(name, 'op list');
      // Parse: "There are N ops: player1, player2"
      const match = result.match(/:\s*(.*)$/);
      const players = match && match[1] ? match[1].split(',').map(p => p.trim()).filter(Boolean) : [];
      return reply.send({ players, total: players.length });
    } catch (error) {
      fastify.log.error(error, 'Failed to get ops list');
      return reply.code(500).send({ error: 'InternalServerError', message: 'Failed to get ops list' });
    }
  });

  /**
   * POST /api/servers/:name/ops
   */
  fastify.post<AddPlayerRoute>('/api/servers/:name/ops', {
    schema: {
      description: 'Add player as operator',
      tags: ['players'],
      params: ServerNameParamsSchema,
      body: AddPlayerRequestSchema,
      response: { 200: PlayerActionResponseSchema, 400: ErrorResponseSchema, 404: ErrorResponseSchema, 500: ErrorResponseSchema },
    },
  }, async (request: FastifyRequest<AddPlayerRoute>, reply: FastifyReply) => {
    const { name } = request.params;
    const { player } = request.body;
    if (!checkServerRunning(name, reply)) return;

    try {
      const result = await execRconCommand(name, `op ${player}`);
      return reply.send({ success: true, message: result || `Made ${player} an operator` });
    } catch (error) {
      fastify.log.error(error, 'Failed to add operator');
      return reply.code(500).send({ error: 'InternalServerError', message: 'Failed to add operator' });
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
    if (!checkServerRunning(name, reply)) return;

    try {
      const result = await execRconCommand(name, `deop ${player}`);
      return reply.send({ success: true, message: result || `Removed operator status from ${player}` });
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
