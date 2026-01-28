import { FastifyInstance, FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import {
  getAllServers,
  getServerInfoFromConfig,
  getServerDetailedInfo,
  getContainerLogs,
  containerExists,
  serverExists,
} from '@minecraft-docker/shared';
import {
  ServerListResponseSchema,
  ServerDetailResponseSchema,
  ExecCommandResponseSchema,
  ExecCommandRequestSchema,
  LogsResponseSchema,
  LogsQuerySchema,
  ErrorResponseSchema,
  ServerNameParamsSchema,
  type ServerSummary,
  type ServerDetail,
  type ServerNameParams,
  type ExecCommandRequest,
  type LogsQuery,
} from '../schemas/server.js';

// Route generic interfaces for type-safe request handling
interface ServerNameRoute {
  Params: ServerNameParams;
}

interface LogsRoute {
  Params: ServerNameParams;
  Querystring: LogsQuery;
}

interface ExecRoute {
  Params: ServerNameParams;
  Body: ExecCommandRequest;
}

/**
 * Server routes plugin
 * Provides REST API for Minecraft server management
 */
const serversPlugin: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  /**
   * GET /api/servers
   * List all Minecraft servers
   */
  fastify.get('/api/servers', {
    schema: {
      response: {
        200: ServerListResponseSchema,
        500: ErrorResponseSchema,
      },
    },
  }, async (_request, reply) => {
    try {
      // Get all servers (both configured and running containers)
      const serverNames = getAllServers();
      const servers: ServerSummary[] = serverNames.map((serverName) => {
        const info = getServerInfoFromConfig(serverName);
        return {
          name: info.name,
          container: info.container,
          status: info.status,
          health: info.health,
          hostname: info.hostname,
        };
      });

      return reply.send({
        servers,
        total: servers.length,
      });
    } catch (error) {
      fastify.log.error(error, 'Failed to list servers');
      return reply.code(500).send({
        error: 'InternalServerError',
        message: 'Failed to list servers',
      });
    }
  });

  /**
   * GET /api/servers/:name
   * Get detailed server information
   */
  fastify.get<ServerNameRoute>('/api/servers/:name', {
    schema: {
      params: ServerNameParamsSchema,
      response: {
        200: ServerDetailResponseSchema,
        404: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
  }, async (request: FastifyRequest<ServerNameRoute>, reply: FastifyReply) => {
    const { name } = request.params;

    try {
      // Check if server exists (either as container or config)
      if (!serverExists(name)) {
        return reply.code(404).send({
          error: 'NotFound',
          message: `Server '${name}' not found`,
        });
      }

      const info = await getServerDetailedInfo(name);

      const server: ServerDetail = {
        name: info.name,
        container: info.container,
        status: info.status,
        health: info.health,
        hostname: info.hostname,
        type: info.type,
        version: info.version,
        memory: info.memory,
        uptime: info.uptime,
        uptimeSeconds: info.uptimeSeconds,
        players: info.players,
        stats: info.stats,
        worldName: info.worldName,
        worldSize: info.worldSize,
      };

      return reply.send({ server });
    } catch (error) {
      fastify.log.error(error, 'Failed to get server details');
      return reply.code(500).send({
        error: 'InternalServerError',
        message: 'Failed to get server details',
      });
    }
  });

  /**
   * GET /api/servers/:name/logs
   * Get server logs (supports SSE streaming with follow=true)
   */
  fastify.get<LogsRoute>('/api/servers/:name/logs', {
    schema: {
      params: ServerNameParamsSchema,
      querystring: LogsQuerySchema,
      response: {
        200: LogsResponseSchema,
        404: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
  }, async (request: FastifyRequest<LogsRoute>, reply: FastifyReply) => {
    const { name } = request.params;
    const { lines = 100, follow = false } = request.query as LogsQuery & { follow?: boolean };
    const containerName = `mc-${name}`;

    try {
      if (!containerExists(containerName)) {
        return reply.code(404).send({
          error: 'NotFound',
          message: `Server '${name}' not found`,
        });
      }

      // SSE streaming mode
      if (follow) {
        const { spawn } = await import('node:child_process');

        reply.raw.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'Access-Control-Allow-Origin': '*',
        });

        // Send initial logs
        const initialLogs = getContainerLogs(containerName, lines);
        for (const line of initialLogs.split('\n')) {
          if (line) {
            reply.raw.write(`data: ${JSON.stringify({ log: line })}\n\n`);
          }
        }

        // Follow new logs with docker logs -f
        const dockerLogs = spawn('docker', ['logs', '-f', '--tail', '0', containerName], {
          stdio: ['ignore', 'pipe', 'pipe'],
        });

        const sendLine = (data: Buffer) => {
          const lines = data.toString().split('\n');
          for (const line of lines) {
            if (line.trim()) {
              reply.raw.write(`data: ${JSON.stringify({ log: line })}\n\n`);
            }
          }
        };

        dockerLogs.stdout?.on('data', sendLine);
        dockerLogs.stderr?.on('data', sendLine);

        // Heartbeat to keep connection alive
        const heartbeat = setInterval(() => {
          reply.raw.write(': heartbeat\n\n');
        }, 30000);

        // Cleanup on client disconnect
        request.raw.on('close', () => {
          clearInterval(heartbeat);
          dockerLogs.kill();
          reply.raw.end();
        });

        dockerLogs.on('close', () => {
          clearInterval(heartbeat);
          reply.raw.write(`data: ${JSON.stringify({ event: 'closed' })}\n\n`);
          reply.raw.end();
        });

        return;
      }

      // Standard JSON response (non-streaming)
      const logs = getContainerLogs(containerName, lines);

      return reply.send({
        logs,
        lines: logs.split('\n').filter(Boolean).length,
      });
    } catch (error) {
      fastify.log.error(error, 'Failed to get server logs');
      return reply.code(500).send({
        error: 'InternalServerError',
        message: 'Failed to get server logs',
      });
    }
  });

  /**
   * POST /api/servers/:name/exec
   * Execute RCON command
   */
  fastify.post<ExecRoute>('/api/servers/:name/exec', {
    schema: {
      params: ServerNameParamsSchema,
      body: ExecCommandRequestSchema,
      response: {
        200: ExecCommandResponseSchema,
        404: ErrorResponseSchema,
        400: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
  }, async (request: FastifyRequest<ExecRoute>, reply: FastifyReply) => {
    const { name } = request.params;
    const { command } = request.body;
    const containerName = `mc-${name}`;

    try {
      if (!containerExists(containerName)) {
        return reply.code(404).send({
          error: 'NotFound',
          message: `Server '${name}' not found`,
        });
      }

      // Import and use execRcon dynamically to avoid circular dependency
      const { spawn } = await import('node:child_process');

      const output = await new Promise<string>((resolve) => {
        const child = spawn('docker', ['exec', containerName, 'rcon-cli', command], {
          stdio: ['pipe', 'pipe', 'pipe'],
        });
        let stdout = '';
        child.stdout?.on('data', (data) => { stdout += data.toString(); });
        child.on('close', () => { resolve(stdout.trim()); });
        child.on('error', () => { resolve(''); });
      });

      return reply.send({
        success: true,
        output: output || '',
      });
    } catch (error) {
      fastify.log.error(error, 'Failed to execute command');
      return reply.code(500).send({
        error: 'InternalServerError',
        message: 'Failed to execute command',
      });
    }
  });
};

export default fp(serversPlugin, {
  name: 'servers-routes',
  fastify: '5.x',
});

export { serversPlugin };
