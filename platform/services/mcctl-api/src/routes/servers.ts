import { FastifyInstance, FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import {
  getAllServers,
  getServerInfoFromConfig,
  getServerDetailedInfo,
  getContainerLogs,
  containerExists,
  serverExists,
  getContainerStatus,
  getContainerHealth,
  stopContainer,
  getServerPlayitDomain,
  getOnlinePlayers,
  WorldManagementUseCase,
  WorldInfoUseCase,
  PrismarineWorldDataReader,
  RconCliAdapter,
  ApiPromptAdapter,
  ShellAdapter,
  WorldRepository,
  ServerRepository,
  Paths,
  ModSourceFactory,
  buildModpackCompatibilityMatrix,
  isModpackCompatible,
} from '@minecraft-docker/shared';
import '@minecraft-docker/mod-source-modrinth';
import {
  ServerListResponseSchema,
  ServerDetailResponseSchema,
  ExecCommandResponseSchema,
  ExecCommandRequestSchema,
  LogsResponseSchema,
  LogsQuerySchema,
  StatusQuerySchema,
  StatusResponseSchema,
  ErrorResponseSchema,
  ServerNameParamsSchema,
  CreateServerRequestSchema,
  CreateServerQuerySchema,
  CreateServerResponseSchema,
  DeleteServerResponseSchema,
  DeleteServerQuerySchema,
  type ServerSummary,
  type ServerDetail,
  type ServerNameParams,
  type ExecCommandRequest,
  type LogsQuery,
  type StatusQuery,
  type CreateServerRequest,
  type CreateServerQuery,
  type DeleteServerQuery,
} from '../schemas/server.js';
import { PlayerLocationsResponseSchema } from '../schemas/world-info.js';
import { config } from '../config/index.js';
import { resolveScriptPath } from '../lib/script-resolver.js';
import { writeAuditLog } from '../services/audit-log-service.js';
import { AuditActionEnum } from '@minecraft-docker/shared';
import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);

/**
 * Map Docker container status to SSE-compatible status
 * Frontend expects: 'running' | 'stopped' | 'created' | 'exited' | 'unknown'
 */
function mapContainerStatus(dockerStatus: string): 'running' | 'stopped' | 'created' | 'exited' | 'unknown' {
  switch (dockerStatus) {
    case 'running':
      return 'running';
    case 'exited':
      return 'exited';
    case 'created':
      return 'created';
    case 'paused':
    case 'dead':
    case 'not_found':
    case 'not_created':
      return 'stopped';
    case 'restarting':
    default:
      return 'unknown';
  }
}

/**
 * Map Docker health status to SSE-compatible health
 * Frontend expects: 'healthy' | 'unhealthy' | 'starting' | 'none' | 'unknown'
 */
function mapHealthStatus(dockerHealth: string): 'healthy' | 'unhealthy' | 'starting' | 'none' | 'unknown' {
  switch (dockerHealth) {
    case 'healthy':
      return 'healthy';
    case 'unhealthy':
      return 'unhealthy';
    case 'starting':
      return 'starting';
    case 'none':
      return 'none';
    default:
      return 'unknown';
  }
}

// Route generic interfaces for type-safe request handling
interface ServerNameRoute {
  Params: ServerNameParams;
}

interface CreateServerRoute {
  Body: CreateServerRequest;
  Querystring: CreateServerQuery;
}

interface DeleteServerRoute {
  Params: ServerNameParams;
  Querystring: DeleteServerQuery;
}

interface LogsRoute {
  Params: ServerNameParams;
  Querystring: LogsQuery;
}

interface ExecRoute {
  Params: ServerNameParams;
  Body: ExecCommandRequest;
}

interface StatusRoute {
  Params: ServerNameParams;
  Querystring: StatusQuery;
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
   * GET /api/servers-status
   * Get real-time status for all servers (supports SSE streaming with follow=true)
   */
  fastify.get<{ Querystring: StatusQuery }>('/api/servers-status', {
    schema: {
      description: 'Get all servers status (supports SSE streaming)',
      tags: ['servers'],
      querystring: StatusQuerySchema,
      response: {
        200: {
          type: 'array',
          items: StatusResponseSchema,
        },
        500: ErrorResponseSchema,
      },
    },
  }, async (request: FastifyRequest<{ Querystring: StatusQuery }>, reply: FastifyReply) => {
    const { follow = false, interval = 5000 } = request.query;

    // SSE streaming mode
    if (follow) {
      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
      });

      // Send status update for all servers
      const sendAllStatuses = () => {
        const serverNames = getAllServers();
        for (const name of serverNames) {
          const containerName = `mc-${name}`;
          const dockerStatus = getContainerStatus(containerName);
          const dockerHealth = getContainerHealth(containerName);
          const status = mapContainerStatus(dockerStatus);
          const health = mapHealthStatus(dockerHealth);

          reply.raw.write(`event: server-status\n`);
          reply.raw.write(`data: ${JSON.stringify({
            serverName: name,
            status,
            health,
            timestamp: new Date().toISOString(),
          })}\n\n`);
        }
      };

      // Send initial status immediately
      sendAllStatuses();

      // Poll for status updates at the specified interval
      const polling = setInterval(sendAllStatuses, interval);

      // Heartbeat to keep connection alive (every 30 seconds)
      const heartbeat = setInterval(() => {
        reply.raw.write(': heartbeat\n\n');
      }, 30000);

      // Cleanup on client disconnect
      request.raw.on('close', () => {
        clearInterval(polling);
        clearInterval(heartbeat);
        reply.raw.end();
      });

      return;
    }

    // Standard JSON response (non-streaming)
    try {
      const serverNames = getAllServers();
      const statuses = serverNames.map((name) => {
        const containerName = `mc-${name}`;
        const dockerStatus = getContainerStatus(containerName);
        const dockerHealth = getContainerHealth(containerName);
        return {
          serverName: name,
          status: mapContainerStatus(dockerStatus),
          health: mapHealthStatus(dockerHealth),
          timestamp: new Date().toISOString(),
        };
      });

      return reply.send(statuses);
    } catch (error) {
      fastify.log.error(error, 'Failed to get all server statuses');
      return reply.code(500).send({
        error: 'InternalServerError',
        message: 'Failed to get all server statuses',
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

      // Get playit domain for this server
      const playitDomain = getServerPlayitDomain(name);

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
        playitDomain,
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
   * GET /api/servers/:name/status
   * Get real-time server status (supports SSE streaming with follow=true)
   */
  fastify.get<StatusRoute>('/api/servers/:name/status', {
    schema: {
      description: 'Get server status (supports SSE streaming)',
      tags: ['servers'],
      params: ServerNameParamsSchema,
      querystring: StatusQuerySchema,
      response: {
        200: StatusResponseSchema,
        404: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
  }, async (request: FastifyRequest<StatusRoute>, reply: FastifyReply) => {
    const { name } = request.params;
    const { follow = false, interval = 5000 } = request.query;
    const containerName = `mc-${name}`;

    // Check if server exists first (before SSE mode check)
    if (!serverExists(name)) {
      return reply.code(404).send({
        error: 'NotFound',
        message: `Server '${name}' not found`,
      });
    }

    // SSE streaming mode
    if (follow) {
      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
      });

      // Send status update
      const sendStatus = () => {
        const dockerStatus = getContainerStatus(containerName);
        const dockerHealth = getContainerHealth(containerName);
        const status = mapContainerStatus(dockerStatus);
        const health = mapHealthStatus(dockerHealth);

        reply.raw.write(`event: server-status\n`);
        reply.raw.write(`data: ${JSON.stringify({
          serverName: name,
          status,
          health,
          timestamp: new Date().toISOString(),
        })}\n\n`);
      };

      // Send initial status immediately
      sendStatus();

      // Poll for status updates at the specified interval
      const polling = setInterval(sendStatus, interval);

      // Heartbeat to keep connection alive (every 30 seconds)
      const heartbeat = setInterval(() => {
        reply.raw.write(': heartbeat\n\n');
      }, 30000);

      // Cleanup on client disconnect
      request.raw.on('close', () => {
        clearInterval(polling);
        clearInterval(heartbeat);
        reply.raw.end();
      });

      return;
    }

    // Standard JSON response (non-streaming)
    try {
      const dockerStatus = getContainerStatus(containerName);
      const dockerHealth = getContainerHealth(containerName);
      const status = mapContainerStatus(dockerStatus);
      const health = mapHealthStatus(dockerHealth);

      return reply.send({
        serverName: name,
        status,
        health,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      fastify.log.error(error, 'Failed to get server status');
      return reply.code(500).send({
        error: 'InternalServerError',
        message: 'Failed to get server status',
      });
    }
  });

  /**
   * GET /api/servers/:name/logs
   * GET /api/servers/:name/players/live
   * Live player locations via RCON (supports SSE with follow=true). (#525)
   * Gracefully returns an empty list when the server is offline.
   */
  fastify.get<{ Params: ServerNameParams; Querystring: StatusQuery }>(
    '/api/servers/:name/players/live',
    {
      schema: {
        tags: ['servers'],
        summary: 'Get live player locations',
        description: 'Returns online player positions via RCON. Empty when the server is stopped.',
        params: ServerNameParamsSchema,
        querystring: StatusQuerySchema,
        response: {
          200: PlayerLocationsResponseSchema,
          404: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { name } = request.params;
      const { follow = false, interval = 5000 } = request.query;

      if (!serverExists(name)) {
        return reply.code(404).send({
          error: 'NotFound',
          message: `Server '${name}' not found`,
        });
      }

      const container = `mc-${name}`;
      const useCase = new WorldInfoUseCase(
        new WorldRepository(new Paths()),
        new PrismarineWorldDataReader(),
        new RconCliAdapter()
      );

      const resolveLive = async () => {
        try {
          const list = await getOnlinePlayers(container);
          if (!list || list.players.length === 0) return [];
          return await useCase.getLivePlayerLocations(container, list.players);
        } catch {
          return [];
        }
      };

      // SSE streaming mode
      if (follow) {
        reply.raw.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'Access-Control-Allow-Origin': '*',
        });

        const sendPlayers = async () => {
          const players = await resolveLive();
          reply.raw.write(`event: players-live\n`);
          reply.raw.write(`data: ${JSON.stringify({ players })}\n\n`);
        };

        await sendPlayers();
        const polling = setInterval(() => {
          void sendPlayers();
        }, interval);
        const heartbeat = setInterval(() => {
          reply.raw.write(': heartbeat\n\n');
        }, 30000);

        request.raw.on('close', () => {
          clearInterval(polling);
          clearInterval(heartbeat);
          reply.raw.end();
        });
        return;
      }

      // Standard JSON response
      const players = await resolveLive();
      return reply.send({ players });
    }
  );

  /**
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
            reply.raw.write(`data: ${JSON.stringify({ type: 'server-log', data: { log: line } })}\n\n`);
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
              reply.raw.write(`data: ${JSON.stringify({ type: 'server-log', data: { log: line } })}\n\n`);
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
          reply.raw.write(`data: ${JSON.stringify({ type: 'connection-closed', data: { timestamp: new Date().toISOString() } })}\n\n`);
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

  /**
   * POST /api/servers
   * Create a new server (supports SSE streaming with follow=true)
   */
  fastify.post<CreateServerRoute>('/api/servers', {
    schema: {
      description: 'Create a new Minecraft server (supports SSE streaming)',
      tags: ['servers'],
      body: CreateServerRequestSchema,
      querystring: CreateServerQuerySchema,
      response: {
        201: CreateServerResponseSchema,
        400: ErrorResponseSchema,
        409: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
  }, async (request: FastifyRequest<CreateServerRoute>, reply: FastifyReply) => {
    const { name, type, version, memory, seed, worldUrl, worldName, autoStart, sudoPassword, modpack, modpackVersion, modLoader, excludeFiles } = request.body;
    const { follow = false } = request.query;

    // Check if server already exists (before SSE mode check)
    if (serverExists(name)) {
      return reply.code(409).send({
        error: 'Conflict',
        message: `Server '${name}' already exists`,
      });
    }

    // Validate modpack requirement for MODRINTH and AUTO_CURSEFORGE types
    if ((type === 'MODRINTH' || type === 'AUTO_CURSEFORGE') && !modpack) {
      return reply.code(400).send({
        error: 'BadRequest',
        message: `Modpack slug is required for ${type} server type`,
      });
    }

    // Validate modpack loader/Minecraft-version compatibility for MODRINTH.
    // An incompatible (loader, version) pair makes itzg fail with
    // "No files available", so reject it up-front with a 400.
    // Only enforced when both a loader and an explicit version are supplied;
    // if the modpack metadata can't be fetched we fail open (do not block).
    if (type === 'MODRINTH' && modpack && modLoader && version) {
      try {
        const source = ModSourceFactory.get('modrinth');
        const versions = await source.getVersions(modpack);
        if (versions && versions.length > 0) {
          const matrix = buildModpackCompatibilityMatrix(versions);
          if (!isModpackCompatible(matrix, modLoader, version)) {
            const supported = matrix.byLoader[modLoader.toLowerCase()]?.gameVersions ?? [];
            const hint = supported.length > 0
              ? ` Loader '${modLoader}' supports: ${supported.join(', ')}.`
              : ` Loader '${modLoader}' is not available for modpack '${modpack}'.`;
            return reply.code(400).send({
              error: 'BadRequest',
              message:
                `Modpack '${modpack}' has no '${modLoader}' release for Minecraft ${version}.${hint}`,
            });
          }
        }
      } catch (error) {
        // Fail open: a transient metadata-fetch failure should not block creation.
        fastify.log.warn(error, 'Modpack compatibility check skipped (metadata fetch failed)');
      }
    }

    // World options are mutually exclusive (seed / worldUrl / worldName).
    // Enforce here so clients get a 400 instead of a 500 from the bash guard.
    // NOTE: must run before the SSE branch below, where HTTP status can no
    // longer be set once the event stream headers are written.
    const worldOptionCount = [seed, worldUrl, worldName].filter(Boolean).length;
    if (worldOptionCount > 1) {
      return reply.code(400).send({
        error: 'BadRequest',
        message:
          'World options (seed, worldUrl, worldName) are mutually exclusive — provide at most one',
      });
    }

    // When attaching an existing world, verify it exists and is unmapped.
    if (worldName) {
      try {
        const paths = new Paths();
        const worldUseCase = new WorldManagementUseCase(
          new ApiPromptAdapter({ confirmValue: true }),
          new ShellAdapter({ paths }),
          new WorldRepository(paths),
          new ServerRepository(paths)
        );
        const worlds = await worldUseCase.listWorlds();
        const target = worlds.find((w) => w.name === worldName);
        if (!target) {
          return reply.code(400).send({
            error: 'BadRequest',
            message: `World '${worldName}' not found`,
          });
        }
        if (target.servers.length > 0 || target.isLocked) {
          return reply.code(409).send({
            error: 'Conflict',
            message: `World '${worldName}' is already in use by another server`,
          });
        }
      } catch (error) {
        fastify.log.error(error, 'Failed to validate worldName');
        return reply.code(500).send({
          error: 'InternalServerError',
          message: 'Failed to validate world selection',
        });
      }
    }

    // Build create-server.sh command arguments
    const args: string[] = [name];

    if (type) {
      args.push('-t', type);
    }
    if (version) {
      args.push('-v', version);
    }
    if (memory) {
      args.push('--memory', memory);
    }
    if (seed) {
      args.push('-s', seed);
    }
    if (worldUrl) {
      args.push('-u', worldUrl);
    }
    if (worldName) {
      args.push('-w', worldName);
    }
    if (modpack) {
      args.push('--modpack', modpack);
    }
    if (modpackVersion) {
      args.push('--modpack-version', modpackVersion);
    }
    if (modLoader) {
      args.push('--mod-loader', modLoader);
    }
    if (excludeFiles && excludeFiles.length > 0) {
      args.push('--exclude-files', excludeFiles.join(','));
    }
    if (autoStart === false) {
      args.push('--no-start');
    }

    // Resolve create-server.sh: prefer the version-matched script bundled with
    // mcctl-api, fall back to the deployed platform copy, then the global mcctl CLI.
    // The deployed copy under <platformPath>/scripts is not refreshed by
    // 'mcctl update' and can be stale (missing newer options like --memory/--modpack).
    const platformPath = config.platformPath;
    const resolvedScript = resolveScriptPath('create-server.sh', platformPath);

    let command: string;
    let commandArgs: string[];
    if (resolvedScript) {
      command = 'bash';
      commandArgs = [resolvedScript.scriptPath, ...args];
    } else {
      // Use mcctl CLI if script not found
      command = 'mcctl';
      commandArgs = ['create', ...args];
    }
    const scriptsDir = resolvedScript?.scriptsDir;

    // SSE streaming mode
    if (follow) {
      const { spawn } = await import('node:child_process');

      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
      });

      // Send initial status
      reply.raw.write(`data: ${JSON.stringify({
        type: 'server-create',
        data: { status: 'initializing', message: 'Initializing server creation...' },
      })}\n\n`);

      // Spawn create-server.sh with spawn for real-time output
      const createProcess = spawn(command, commandArgs, {
        cwd: platformPath,
        env: {
          ...process.env,
          MCCTL_ROOT: platformPath,
          ...(scriptsDir ? { MCCTL_SCRIPTS: scriptsDir } : {}),
          ...(sudoPassword ? { MCCTL_SUDO_PASSWORD: sudoPassword } : {}),
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let hasError = false;
      let stderrOutput = '';

      // Track creation stages based on output patterns
      const sendStageEvent = (status: string, message: string) => {
        reply.raw.write(`data: ${JSON.stringify({
          type: 'server-create',
          data: { status, message },
        })}\n\n`);
      };

      const sendLogEvent = (log: string) => {
        reply.raw.write(`data: ${JSON.stringify({
          type: 'server-create-log',
          data: { log },
        })}\n\n`);
      };

      // Process stdout for progress tracking
      createProcess.stdout?.on('data', (data) => {
        const output = data.toString();
        sendLogEvent(output);

        // Detect stages based on script output patterns
        if (output.includes('Creating server directory')) {
          sendStageEvent('creating', 'Creating server directory...');
        } else if (output.includes('Writing docker-compose') || output.includes('Writing config')) {
          sendStageEvent('configuring', 'Configuring server...');
        } else if (output.includes('Starting container') || output.includes('docker compose up')) {
          sendStageEvent('starting', 'Starting container...');
        }
      });

      // Process stderr
      createProcess.stderr?.on('data', (data) => {
        const output = data.toString();
        stderrOutput += output;
        sendLogEvent(output);

        // Check for errors
        if (output.toLowerCase().includes('error') || output.toLowerCase().includes('failed')) {
          hasError = true;
        }
      });

      // Heartbeat to keep connection alive
      const heartbeat = setInterval(() => {
        reply.raw.write(': heartbeat\n\n');
      }, 30000);

      // Handle process completion
      createProcess.on('close', async (code) => {
        clearInterval(heartbeat);

        if (code === 0 && !hasError) {
          await writeAuditLog({
            action: AuditActionEnum.SERVER_CREATE,
            actor: 'api:console',
            targetType: 'server',
            targetName: name,
            status: 'success',
            details: {
              type: type ?? null,
              version: version ?? null,
              memory: memory ?? null,
              modpack: modpack ?? null,
              modpackVersion: modpackVersion ?? null,
              modLoader: modLoader ?? null,
              excludeFiles: excludeFiles && excludeFiles.length > 0 ? excludeFiles.join(',') : null,
            },
            errorMessage: null,
          });

          reply.raw.write(`data: ${JSON.stringify({
            type: 'server-create',
            data: {
              status: 'completed',
              message: 'Server created successfully',
              server: {
                name,
                container: `mc-${name}`,
                status: autoStart !== false ? 'starting' : 'created',
              },
            },
          })}\n\n`);
        } else {
          const errorDetail = stderrOutput.trim();
          const errorMessage = errorDetail
            ? `Server creation failed: ${errorDetail}`
            : `Server creation failed with exit code ${code}`;

          await writeAuditLog({
            action: AuditActionEnum.SERVER_CREATE,
            actor: 'api:console',
            targetType: 'server',
            targetName: name,
            status: 'failure',
            details: null,
            errorMessage,
          });

          reply.raw.write(`data: ${JSON.stringify({
            type: 'server-create',
            data: {
              status: 'error',
              message: errorMessage,
              exitCode: code,
              stderr: errorDetail || undefined,
            },
          })}\n\n`);
        }

        reply.raw.end();
      });

      // Cleanup on client disconnect
      request.raw.on('close', () => {
        clearInterval(heartbeat);
        createProcess.kill();
        reply.raw.end();
      });

      return;
    }

    // Standard JSON response (non-streaming)
    try {
      const { stdout, stderr } = await execPromise(`${command} ${commandArgs.map(a => `"${a}"`).join(' ')}`, {
        cwd: platformPath,
        timeout: 120000, // 2 minute timeout for server creation
        env: {
          ...process.env,
          MCCTL_ROOT: platformPath,
          ...(scriptsDir ? { MCCTL_SCRIPTS: scriptsDir } : {}),
          ...(sudoPassword ? { MCCTL_SUDO_PASSWORD: sudoPassword } : {}),
        },
      });

      fastify.log.info({ stdout, stderr }, 'Server created');

      await writeAuditLog({
        action: AuditActionEnum.SERVER_CREATE,
        actor: 'api:console',
        targetType: 'server',
        targetName: name,
        status: 'success',
        details: {
          type: type ?? null,
          version: version ?? null,
          memory: memory ?? null,
          modpack: modpack ?? null,
          modpackVersion: modpackVersion ?? null,
          modLoader: modLoader ?? null,
          excludeFiles: excludeFiles && excludeFiles.length > 0 ? excludeFiles.join(',') : null,
        },
        errorMessage: null,
      });

      return reply.code(201).send({
        success: true,
        server: {
          name,
          container: `mc-${name}`,
          status: autoStart !== false ? 'starting' : 'created',
        },
      });
    } catch (error) {
      const execError = error as { stderr?: string; stdout?: string; message?: string; code?: number };
      fastify.log.error(error, 'Failed to create server');
      // Include stderr and stdout for better error diagnosis
      // Script errors (e.g., "Template directory not found") appear in stdout
      const errorDetail = execError.stderr?.trim() || execError.stdout?.trim() || '';
      const errorMessage = errorDetail
        ? `Failed to create server: ${errorDetail}`
        : (execError.message || 'Failed to create server');

      await writeAuditLog({
        action: AuditActionEnum.SERVER_CREATE,
        actor: 'api:console',
        targetType: 'server',
        targetName: name,
        status: 'failure',
        details: null,
        errorMessage,
      });

      return reply.code(500).send({
        error: 'InternalServerError',
        message: errorMessage,
      });
    }
  });

  /**
   * DELETE /api/servers/:name
   * Delete a server
   */
  fastify.delete<DeleteServerRoute>('/api/servers/:name', {
    schema: {
      description: 'Delete a Minecraft server',
      tags: ['servers'],
      params: ServerNameParamsSchema,
      querystring: DeleteServerQuerySchema,
      response: {
        200: DeleteServerResponseSchema,
        404: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
  }, async (request: FastifyRequest<DeleteServerRoute>, reply: FastifyReply) => {
    const { name } = request.params;
    const { force } = request.query;
    const containerName = `mc-${name}`;

    try {
      // Check if server exists
      if (!serverExists(name)) {
        return reply.code(404).send({
          error: 'NotFound',
          message: `Server '${name}' not found`,
        });
      }

      // Check if running and stop if needed
      const status = getContainerStatus(containerName);
      if (status === 'running') {
        if (!force) {
          // Stop the server first
          stopContainer(containerName);
        }
      }

      // Resolve delete-server.sh: prefer the bundled (version-matched) script,
      // fall back to the deployed platform copy, then the global mcctl CLI.
      const platformPath = config.platformPath;
      const resolvedScript = resolveScriptPath('delete-server.sh', platformPath);

      // Build command
      let command: string;
      if (resolvedScript) {
        command = `bash "${resolvedScript.scriptPath}" "${name}" --force`;
      } else {
        // Use mcctl CLI if script not found
        command = `mcctl delete "${name}" --force`;
      }

      const { stdout, stderr } = await execPromise(command, {
        cwd: platformPath,
        timeout: 60000, // 1 minute timeout
        env: {
          ...process.env,
          MCCTL_ROOT: platformPath,
          ...(resolvedScript ? { MCCTL_SCRIPTS: resolvedScript.scriptsDir } : {}),
        },
      });

      fastify.log.info({ stdout, stderr }, 'Server deleted');

      await writeAuditLog({
        action: AuditActionEnum.SERVER_DELETE,
        actor: 'api:console',
        targetType: 'server',
        targetName: name,
        status: 'success',
        details: { force: force ?? false },
        errorMessage: null,
      });

      return reply.send({
        success: true,
        server: name,
        message: 'Server deleted successfully',
      });
    } catch (error) {
      const execError = error as { stderr?: string; message?: string };
      fastify.log.error(error, 'Failed to delete server');
      const errorMessage = execError.stderr || execError.message || 'Failed to delete server';

      await writeAuditLog({
        action: AuditActionEnum.SERVER_DELETE,
        actor: 'api:console',
        targetType: 'server',
        targetName: name,
        status: 'failure',
        details: null,
        errorMessage,
      });

      return reply.code(500).send({
        error: 'InternalServerError',
        message: errorMessage,
      });
    }
  });
};

export default fp(serversPlugin, {
  name: 'servers-routes',
  fastify: '5.x',
});

export { serversPlugin };
