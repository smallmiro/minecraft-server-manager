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
  WorldInfoUseCase,
  PrismarineWorldDataReader,
  RconCliAdapter,
  WorldRepository,
  Paths,
  ConfigEnvWorldAssignmentAdapter,
  checkAssign,
  ModSourceFactory,
  buildModpackCompatibilityMatrix,
  isModpackCompatible,
  CreateServerUseCase,
  ServerStartError,
  ServerSpecError,
  WorldAssignmentError,
  ApiPromptAdapter,
  ShellAdapter,
  ServerRepository,
  FileServerSpecRepository,
  AvahiHostnameRegistrarAdapter,
  DockerComposeRuntimeAdapter,
  resolveHostIps,
  type CreateServerConfig,
  type CreateServerRunOptions,
  type ICreateServerUseCase,
} from '@minecraft-docker/shared';
import '@minecraft-docker/mod-source-modrinth';
import { EnvValueError } from '@minecraft-docker/shared/utils';
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
import { config, childProcessEnv } from '../config/index.js';
import { resolveScriptPath } from '../lib/script-resolver.js';
import { getContainerName } from '../lib/rcon.js';
import { worldFailure } from '../lib/world-use-case.js';
import { serverSpecFailure } from '../lib/server-spec.js';
import { writeAuditLog } from '../services/audit-log-service.js';
import { AuditActionEnum } from '@minecraft-docker/shared';
import { delay, runScript, startScriptGroup } from '../lib/script-process.js';

/**
 * Time limits for the create/delete scripts (#656). Scripts run in their own
 * process group (no shell: arguments carry user input, #720). A script past its
 * limit gets SIGTERM, then SIGKILL after killGraceMs, and the create/delete
 * queue moves on once it exits or killGraceMs after SIGKILL.
 * Mutable so tests can shorten them.
 */
/**
 * How POST /api/servers builds its CreateServerUseCase (#675, ADR-0003 §5):
 * TypeScript provisioning with the ServerSpec repository, avahi (the
 * request's sudo password as an adapter option, never an env var) and the
 * runtime. Tests replace createUseCase.
 */
export const serverProvision = {
  createUseCase(options: { sudoPassword?: string }): ICreateServerUseCase {
    const paths = new Paths(config.mcctlRoot);
    // Image pulls and modpack downloads can take a while on the first start.
    const runtime = new DockerComposeRuntimeAdapter({
      root: paths.root,
      env: () => childProcessEnv(),
      startTimeoutMs: lifecycleLimits.sseCreateTimeoutMs,
    });
    const assignments = new ConfigEnvWorldAssignmentAdapter(paths);
    return new CreateServerUseCase(
      new ApiPromptAdapter({}),
      new ShellAdapter({ paths }),
      new ServerRepository(paths),
      paths,
      undefined,
      undefined,
      undefined,
      assignments,
      {
        specRepo: new FileServerSpecRepository(paths, undefined, runtime),
        hostnames: new AvahiHostnameRegistrarAdapter({ sudoPassword: options.sudoPassword }),
        runtime,
        hostIps: () => resolveHostIps(paths),
      }
    );
  },
};

export const lifecycleLimits = {
  /** JSON create (no follow): how long the reply waits for the container start before answering with a warning. */
  createTimeoutMs: 120_000,
  /** Create (TypeScript provisioning): how long the queue waits for it, and the container start timeout. */
  sseCreateTimeoutMs: 30 * 60_000,
  /** Delete. */
  deleteTimeoutMs: 60_000,
  /** SIGTERM to SIGKILL, and SIGKILL to giving up on the exit. */
  killGraceMs: 10_000,
};


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
  // Server create and delete run one at a time (#656): a request queues behind
  // the running one, then does its own existence check, so concurrent clients
  // get the normal 201/200/404/409 answers instead of racing on servers/.
  // ponytail: in-process queue; a second API process would need a file lock.
  // The queue moves on when the task settles or after maxHoldMs, whichever is
  // first, so a script that never returns cannot block it for good.
  let lifecycleTail: Promise<unknown> = Promise.resolve();
  const runSerial = <T>(task: () => Promise<T>, maxHoldMs: () => number): Promise<T> => {
    const started = lifecycleTail.then(() => {
      const run = task();
      return { run, hold: Promise.race([run.catch(() => undefined), delay(maxHoldMs())]) };
    });
    lifecycleTail = started.then(({ hold }) => hold);
    return started.then(({ run }) => run);
  };

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

      const container = getContainerName(name);
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

        let polling: ReturnType<typeof setInterval> | undefined;
        let heartbeat: ReturnType<typeof setInterval> | undefined;
        const cleanup = () => {
          if (polling) clearInterval(polling);
          if (heartbeat) clearInterval(heartbeat);
        };

        const sendPlayers = async () => {
          try {
            const players = await resolveLive();
            reply.raw.write(`event: players-live\n`);
            reply.raw.write(`data: ${JSON.stringify({ players })}\n\n`);
          } catch {
            // Socket likely closed/errored — stop streaming.
            cleanup();
            reply.raw.end();
          }
        };

        await sendPlayers();
        polling = setInterval(() => {
          void sendPlayers();
        }, interval);
        heartbeat = setInterval(() => {
          try {
            reply.raw.write(': heartbeat\n\n');
          } catch {
            cleanup();
          }
        }, 30000);

        request.raw.on('close', () => {
          cleanup();
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
      description: 'Create a new Minecraft server (supports SSE streaming). Create and delete requests run one at a time; a request waits for the running one.',
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
  }, (request: FastifyRequest<CreateServerRoute>, reply: FastifyReply) => runSerial(async () => {
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

    // R1 for the world the new server will use (#670): worldName, else its
    // default world <name>, which a deleted server may have left to another.
    // Adopting a free worlds/<name> stays allowed.
    try {
      const paths = new Paths();
      if (worldName && !(await new WorldRepository(paths).exists(worldName))) {
        return reply.code(400).send({
          error: 'BadRequest',
          message: `World '${worldName}' not found`,
        });
      }
      const snapshot = await new ConfigEnvWorldAssignmentAdapter(paths).snapshot();
      const refused = checkAssign(snapshot, worldName ?? name, name, { newServer: true });
      if (refused) {
        const failure = worldFailure({ error: refused.message, errorCode: refused.code }, 'World is not available');
        return reply.code(failure.status).send(failure.body);
      }
    } catch (error) {
      fastify.log.error(error, 'Failed to validate the world assignment');
      return reply.code(500).send({
        error: 'InternalServerError',
        message: 'Failed to validate world selection',
      });
    }

    // TypeScript provisioning replaces create-server.sh (#675, ADR-0003 §5).
    const createConfig: CreateServerConfig = {
      name,
      type,
      version,
      memory,
      seed,
      worldUrl,
      worldName,
      autoStart,
      modpackSlug: modpack,
      modpackVersion,
      modLoader,
      modpackExcludeFiles: excludeFiles && excludeFiles.length > 0 ? excludeFiles : undefined,
    };
    const useCase = serverProvision.createUseCase({ sudoPassword });
    const auditDetails = {
      type: type ?? null,
      version: version ?? null,
      memory: memory ?? null,
      modpack: modpack ?? null,
      modpackVersion: modpackVersion ?? null,
      modLoader: modLoader ?? null,
      excludeFiles: excludeFiles && excludeFiles.length > 0 ? excludeFiles.join(',') : null,
    };
    const created = (warning?: string) => ({
      name,
      container: `mc-${name}`,
      status: autoStart !== false && !warning ? 'starting' : 'created',
    });
    const audit = (status: 'success' | 'failure', errorMessage: string | null) =>
      writeAuditLog({
        action: AuditActionEnum.SERVER_CREATE,
        actor: 'api:console',
        targetType: 'server',
        targetName: name,
        status,
        details: status === 'success' ? auditDetails : null,
        errorMessage,
      });

    /** Created, or created but not started (decision 1: success with a warning). */
    const provision = async (run: CreateServerRunOptions): Promise<{ warning?: string }> => {
      try {
        await useCase.executeWithConfig(createConfig, run);
        return {};
      } catch (error) {
        if (error instanceof ServerStartError) return { warning: error.message };
        throw error;
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
      // A client disconnect stops the events, not the provisioning.
      const send = (event: unknown) => {
        if (!reply.raw.writableEnded && !reply.raw.destroyed) reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
      };
      send({ type: 'server-create', data: { status: 'initializing', message: 'Initializing server creation...' } });
      const heartbeat = setInterval(() => {
        if (!reply.raw.writableEnded && !reply.raw.destroyed) reply.raw.write(': heartbeat\n\n');
      }, 30000);
      try {
        const { warning } = await provision({
          onProgress: (status, message) => send({ type: 'server-create', data: { status, message } }),
          onLog: (log) => send({ type: 'server-create-log', data: { log } }),
        });
        await audit('success', null);
        send({
          type: 'server-create',
          data: {
            status: 'completed',
            message: warning ? 'Server created, but it did not start' : 'Server created successfully',
            server: created(warning),
            ...(warning && { warning }),
          },
        });
      } catch (error) {
        const errorMessage = `Server creation failed: ${error instanceof Error ? error.message : String(error)}`;
        await audit('failure', errorMessage);
        send({ type: 'server-create', data: { status: 'error', message: errorMessage } });
      } finally {
        clearInterval(heartbeat);
        if (!reply.raw.writableEnded) reply.raw.end();
      }
      return;
    }

    // Standard JSON response (non-streaming). Its clients (the console BFF) give up
    // after a few minutes, so once the files are written the reply waits for the
    // container start at most createTimeoutMs. Past that it answers like a start
    // failure while compose up goes on; the queue then moves on, since the start
    // touches no servers/ file. ponytail: a delete of this server can then race its
    // start; hold the queue for the background start if that is ever seen.
    try {
      let starting = (): void => undefined;
      const startStage = new Promise<void>((resolve) => (starting = resolve));
      const result = provision({ onProgress: (stage) => stage === 'starting' && starting() });
      const outcome = await Promise.race([
        result,
        startStage.then(() => delay(lifecycleLimits.createTimeoutMs)).then(() => 'still-starting' as const),
      ]);
      let warning: string | undefined;
      if (outcome === 'still-starting') {
        warning =
          `Server '${name}' was created and its container is still starting in the background ` +
          '(the first start can take several minutes to pull the image or download mods). ' +
          `Check it with: mcctl status ${name}. If it does not come up, start it with: mcctl start ${name}`;
        result.then(
          (late) => fastify.log.info({ server: name, warning: late.warning }, 'Background server start finished'),
          (error: unknown) => fastify.log.error(error, 'Background server start failed')
        );
      } else {
        warning = outcome.warning;
      }
      await audit('success', null);
      return reply.code(201).send({ success: true, server: created(warning), ...(warning && { warning }) });
    } catch (error) {
      fastify.log.error(error, 'Failed to create server');
      const message = error instanceof Error ? error.message : String(error);
      const errorMessage = `Failed to create server: ${message}`;
      await audit('failure', errorMessage);
      if (error instanceof WorldAssignmentError) {
        const failure = worldFailure({ error: error.message, errorCode: error.code }, 'World is not available');
        return reply.code(failure.status).send(failure.body);
      }
      if (error instanceof ServerSpecError) {
        const failure = serverSpecFailure(error, errorMessage);
        return reply.code(failure.status).send(failure.body);
      }
      if (error instanceof EnvValueError) {
        return reply.code(400).send({ error: 'BadRequest', message: errorMessage });
      }
      return reply.code(500).send({ error: 'InternalServerError', message: errorMessage });
    }
  }, () => lifecycleLimits.sseCreateTimeoutMs));

  /**
   * DELETE /api/servers/:name
   * Delete a server
   */
  fastify.delete<DeleteServerRoute>('/api/servers/:name', {
    schema: {
      description: 'Delete a Minecraft server. Create and delete requests run one at a time; a request waits for the running one.',
      tags: ['servers'],
      params: ServerNameParamsSchema,
      querystring: DeleteServerQuerySchema,
      response: {
        200: DeleteServerResponseSchema,
        404: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
  }, (request: FastifyRequest<DeleteServerRoute>, reply: FastifyReply) => runSerial(async () => {
    const { name } = request.params;
    const { force, deleteWorld } = request.query;
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
      const mcctlRoot = config.mcctlRoot;
      const resolvedScript = resolveScriptPath('delete-server.sh', mcctlRoot);

      // Build command (the world is moved to worlds/ unless deleteWorld)
      const deleteArgs = [name, '--force', ...(deleteWorld ? ['--delete-world'] : [])];
      let command: string;
      let commandArgs: string[];
      if (resolvedScript) {
        command = 'bash';
        commandArgs = [resolvedScript.scriptPath, ...deleteArgs];
      } else {
        // Use mcctl CLI if script not found
        command = 'mcctl';
        commandArgs = ['delete', ...deleteArgs];
      }

      const { stdout, stderr } = await runScript(command, commandArgs, {
        cwd: mcctlRoot,
        env: childProcessEnv({
          MCCTL_ROOT: mcctlRoot,
          ...(resolvedScript ? { MCCTL_SCRIPTS: resolvedScript.scriptsDir } : {}),
        }),
      }, { timeoutMs: lifecycleLimits.deleteTimeoutMs, graceMs: lifecycleLimits.killGraceMs });

      fastify.log.info({ stdout, stderr }, 'Server deleted');

      await writeAuditLog({
        action: AuditActionEnum.SERVER_DELETE,
        actor: 'api:console',
        targetType: 'server',
        targetName: name,
        status: 'success',
        details: { force: force ?? false, deleteWorld: deleteWorld ?? false },
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
  }, () => lifecycleLimits.deleteTimeoutMs + 3 * lifecycleLimits.killGraceMs));
};

export default fp(serversPlugin, {
  name: 'servers-routes',
  fastify: '5.x',
});

export { serversPlugin };
