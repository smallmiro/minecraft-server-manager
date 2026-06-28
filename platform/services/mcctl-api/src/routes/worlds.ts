import { FastifyInstance, FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import { join, basename } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';
import { createWriteStream } from 'fs';
import { rm } from 'fs/promises';
import { pipeline } from 'stream/promises';
import {
  WorldManagementUseCase,
  WorldInfoUseCase,
  PrismarineWorldDataReader,
  RconCliAdapter,
  ApiPromptAdapter,
  ShellAdapter,
  WorldRepository,
  ServerRepository,
  Paths,
  AuditActionEnum,
  BlueMapCliRenderer,
  BlueMapMarkerWriter,
  WorldStatsUseCase,
  AnvilBlockScanner,
  AnalysisCancelledError,
} from '@minecraft-docker/shared';
import { writeAuditLog } from '../services/audit-log-service.js';
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
  UploadWorldQuerySchema,
  type WorldNameParams,
  type CreateWorldRequest,
  type AssignWorldRequest,
  type DeleteWorldQuery,
  type ReleaseWorldQuery,
  type UploadWorldQuery,
} from '../schemas/world.js';
import {
  WorldInfoResponseSchema,
  PlayerLocationsResponseSchema,
} from '../schemas/world-info.js';
import {
  MapWorldNameParamsSchema,
  MapRenderRequestSchema,
  MapRenderQuerySchema,
  MapRenderResultSchema,
  MapStatusResponseSchema,
  MapErrorResponseSchema,
  type MapWorldNameParams,
  type MapRenderRequest,
  type MapRenderQuery,
} from '../schemas/world-map.js';
import { MapMarkersResponseSchema } from '../schemas/world-structures.js';
import {
  BlockStatsResponseSchema,
  StatsAnalyzeQuerySchema,
  type StatsAnalyzeQuery,
} from '../schemas/world-stats.js';
import { mkdir, readFile as readFileAsync, writeFile, rename } from 'fs/promises';
import { config } from '../config/index.js';
import { resolveScriptPath } from '../lib/script-resolver.js';
import { resolve as resolvePath, sep, extname } from 'node:path';
import { existsSync, statSync, createReadStream } from 'node:fs';
import { createGunzip } from 'node:zlib';
import { stat as statAsync, readdir } from 'node:fs/promises';

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

interface UploadWorldRoute {
  Querystring: UploadWorldQuery;
}

interface MapRenderRoute {
  Params: MapWorldNameParams;
  Body: MapRenderRequest;
  Querystring: MapRenderQuery;
}

interface MapServeRoute {
  Params: MapWorldNameParams & { '*': string };
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
 * Create WorldInfoUseCase instance with API adapters (#525).
 * Read-only: world metadata, offline player locations, live RCON locations.
 */
function createWorldInfoUseCase(): WorldInfoUseCase {
  const paths = new Paths();
  const worldRepo = new WorldRepository(paths);
  const dataReader = new PrismarineWorldDataReader();
  const rcon = new RconCliAdapter();
  return new WorldInfoUseCase(worldRepo, dataReader, rcon);
}

/** Base directory for rendered web maps (kept out of worlds/ for lean backups). */
function getMapsDir(): string {
  return join(config.platformPath, 'maps');
}

/** Cached block-stats result file for a world (#531). */
function getStatsPath(name: string): string {
  return join(config.platformPath, 'stats', `${name}.json`);
}

/** Create the world block-stats use case (#531). */
function createWorldStatsUseCase(): WorldStatsUseCase {
  const paths = new Paths();
  return new WorldStatsUseCase(new WorldRepository(paths), new AnvilBlockScanner());
}

/** Default block-stats analysis timeout (10 minutes). */
const STATS_ANALYZE_TIMEOUT_MS =
  Number(process.env['STATS_ANALYZE_TIMEOUT_MS']) || 10 * 60 * 1000;

/** Absolute webroot for a world's rendered map. */
function getWebroot(name: string): string {
  return join(getMapsDir(), name, 'web');
}

/**
 * Create the BlueMap-backed map renderer (#529).
 * Returns null when render-map.sh cannot be resolved.
 *
 * The script needs MCCTL_ROOT/MCCTL_SCRIPTS so it resolves the deployed data
 * dir (not the bundled package dir), plus MCCTL_DOCKER for the renderer image
 * build context.
 */
function createMapRenderer(): BlueMapCliRenderer | null {
  const resolved = resolveScriptPath('render-map.sh', config.platformPath);
  if (!resolved) return null;
  const dockerDir = join(resolved.scriptsDir, '..', 'docker');
  return new BlueMapCliRenderer(resolved.scriptPath, undefined, {
    cwd: config.platformPath,
    env: {
      ...process.env,
      MCCTL_ROOT: config.platformPath,
      MCCTL_SCRIPTS: resolved.scriptsDir,
      MCCTL_DOCKER: dockerDir,
    },
  });
}

/** Minimal content-type map for BlueMap's static webapp assets. */
const MAP_CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.wasm': 'application/wasm',
  '.prbm': 'application/octet-stream',
};

/**
 * Default max upload size for world zip files: 1 GB
 */
const WORLD_UPLOAD_MAX_SIZE = Number(process.env['WORLD_UPLOAD_MAX_SIZE']) || 1024 * 1024 * 1024;

/**
 * Worlds routes plugin
 * Provides REST API for Minecraft world management
 *
 * Note: @fastify/multipart is registered globally by server-files-routes (via fp()),
 * so we do NOT re-register it here. The per-request file-size limit for the upload
 * endpoint is passed directly to request.parts().
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
          servers: world.servers,
          dimensions: world.dimensions,
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
          servers: world.servers,
          dimensions: world.dimensions,
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
   * GET /api/worlds/:name/info
   * Get parsed world metadata (level.dat) + on-disk structure (#525)
   */
  fastify.get<WorldNameRoute>('/api/worlds/:name/info', {
    schema: {
      tags: ['worlds'],
      summary: 'Get world info',
      description: 'Returns parsed level.dat metadata, dimension presence, size and region count',
      params: WorldNameParamsSchema,
      response: {
        200: WorldInfoResponseSchema,
        404: WorldErrorResponseSchema,
        500: WorldErrorResponseSchema,
      },
    },
  }, async (request: FastifyRequest<WorldNameRoute>, reply: FastifyReply) => {
    const { name } = request.params;
    try {
      const useCase = createWorldInfoUseCase();
      const info = await useCase.getWorldInfo(name);
      return reply.send({ info });
    } catch (error) {
      if (error instanceof Error && /not found/i.test(error.message)) {
        return reply.code(404).send({
          error: 'NotFound',
          message: `World '${name}' not found`,
        });
      }
      fastify.log.error(error, 'Failed to get world info');
      return reply.code(500).send({
        error: 'InternalServerError',
        message: 'Failed to get world info',
      });
    }
  });

  /**
   * GET /api/worlds/:name/players
   * Get offline player locations from playerdata (#525)
   */
  fastify.get<WorldNameRoute>('/api/worlds/:name/players', {
    schema: {
      tags: ['worlds'],
      summary: 'Get offline player locations',
      description: 'Returns last-known player locations parsed from playerdata/*.dat',
      params: WorldNameParamsSchema,
      response: {
        200: PlayerLocationsResponseSchema,
        404: WorldErrorResponseSchema,
        500: WorldErrorResponseSchema,
      },
    },
  }, async (request: FastifyRequest<WorldNameRoute>, reply: FastifyReply) => {
    const { name } = request.params;
    try {
      const useCase = createWorldInfoUseCase();
      const players = await useCase.getPlayerLocations(name);
      return reply.send({ players });
    } catch (error) {
      if (error instanceof Error && /not found/i.test(error.message)) {
        return reply.code(404).send({
          error: 'NotFound',
          message: `World '${name}' not found`,
        });
      }
      fastify.log.error(error, 'Failed to get player locations');
      return reply.code(500).send({
        error: 'InternalServerError',
        message: 'Failed to get player locations',
      });
    }
  });

  /**
   * GET /api/worlds/:name/map/status
   * Whether a rendered web map exists for the world, and which dimensions. (#529)
   */
  fastify.get<{ Params: MapWorldNameParams }>('/api/worlds/:name/map/status', {
    schema: {
      tags: ['worlds'],
      summary: 'Get world map render status',
      description: 'Returns whether a BlueMap web map has been rendered and which dimensions exist',
      params: MapWorldNameParamsSchema,
      response: {
        200: MapStatusResponseSchema,
        500: MapErrorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const { name } = request.params;
    try {
      const webroot = getWebroot(name);
      const indexFile = join(webroot, 'index.html');
      if (!existsSync(indexFile)) {
        return reply.send({ rendered: false, maps: [] });
      }
      const mapsRoot = join(webroot, 'maps');
      let maps: string[] = [];
      if (existsSync(mapsRoot)) {
        const entries = await readdir(mapsRoot, { withFileTypes: true });
        maps = entries.filter((e) => e.isDirectory()).map((e) => e.name);
      }
      const lastModified = (await statAsync(indexFile)).mtime.toISOString();
      return reply.send({ rendered: true, maps, lastModified });
    } catch (error) {
      fastify.log.error(error, 'Failed to get map status');
      return reply.code(500).send({
        error: 'InternalServerError',
        message: 'Failed to get map status',
      });
    }
  });

  /**
   * POST /api/worlds/:name/map/render
   * Trigger an offline BlueMap render. With ?follow=true, streams progress as
   * SSE; otherwise renders synchronously and returns the result JSON. (#529)
   */
  fastify.post<MapRenderRoute>('/api/worlds/:name/map/render', {
    schema: {
      tags: ['worlds'],
      summary: 'Render world map',
      description: 'Renders a static BlueMap web map for the world (optionally SSE progress)',
      params: MapWorldNameParamsSchema,
      body: MapRenderRequestSchema,
      querystring: MapRenderQuerySchema,
      response: {
        200: MapRenderResultSchema,
        404: MapErrorResponseSchema,
        500: MapErrorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const { name } = request.params;
    const { dimensions, force } = request.body ?? {};
    const { follow = false } = request.query;

    if (!existsSync(join(new Paths().worlds, name))) {
      return reply.code(404).send({
        error: 'NotFound',
        message: `World '${name}' not found`,
      });
    }

    const renderer = createMapRenderer();
    if (!renderer) {
      return reply.code(500).send({
        error: 'InternalServerError',
        message: 'render-map.sh script not found',
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

      const write = (event: string, data: unknown) => {
        try {
          reply.raw.write(`event: ${event}\n`);
          reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
        } catch {
          // Socket closed — ignore.
        }
      };

      try {
        const result = await renderer.renderWorld(name, { dimensions, force }, (p) => {
          write('progress', p);
        });
        write('done', result);
        await writeAuditLog({
          action: AuditActionEnum.WORLD_MAP_RENDER,
          actor: 'api:console',
          targetType: 'world',
          targetName: name,
          details: { dimensions: result.maps, force: Boolean(force) },
          status: 'success',
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Render failed';
        write('error', { message });
        await writeAuditLog({
          action: AuditActionEnum.WORLD_MAP_RENDER,
          actor: 'api:console',
          targetType: 'world',
          targetName: name,
          details: { dimensions, force: Boolean(force) },
          status: 'failure',
          errorMessage: message,
        });
      } finally {
        reply.raw.end();
      }
      return;
    }

    // Synchronous mode
    try {
      const result = await renderer.renderWorld(name, { dimensions, force });
      await writeAuditLog({
        action: AuditActionEnum.WORLD_MAP_RENDER,
        actor: 'api:console',
        targetType: 'world',
        targetName: name,
        details: { dimensions: result.maps, force: Boolean(force) },
        status: 'success',
      });
      return reply.send(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to render world map';
      fastify.log.error(error, 'Failed to render world map');
      await writeAuditLog({
        action: AuditActionEnum.WORLD_MAP_RENDER,
        actor: 'api:console',
        targetType: 'world',
        targetName: name,
        details: { dimensions, force: Boolean(force) },
        status: 'failure',
        errorMessage: message,
      });
      return reply.code(500).send({
        error: 'InternalServerError',
        message,
      });
    }
  });

  /**
   * GET /api/worlds/:name/map/web/*
   * Serve the rendered BlueMap webapp (iframe target + tiles/assets).
   * Path-traversal safe: the resolved file must stay within the world webroot.
   * (#529)
   */
  fastify.get<MapServeRoute>('/api/worlds/:name/map/web/*', {
    schema: {
      tags: ['worlds'],
      summary: 'Serve rendered map files',
      description: 'Static file serving for a rendered BlueMap webroot (path-traversal protected)',
      params: MapWorldNameParamsSchema,
    },
  }, async (request, reply) => {
    const { name } = request.params;
    const webroot = getWebroot(name);
    const relRaw = request.params['*'] || 'index.html';
    const rel = relRaw === '' ? 'index.html' : relRaw;

    const target = resolvePath(webroot, rel);
    // Defense in depth: the resolved path must be the webroot itself or inside it.
    if (target !== webroot && !target.startsWith(webroot + sep)) {
      return reply.code(403).send({ error: 'Forbidden', message: 'Invalid path' });
    }

    const isFile = (p: string) => existsSync(p) && statSync(p).isFile();
    // Content-type is derived from the REQUESTED (uncompressed) name.
    const contentType = MAP_CONTENT_TYPES[extname(target).toLowerCase()] || 'application/octet-stream';

    if (isFile(target)) {
      reply.header('Content-Type', contentType);
      return reply.send(createReadStream(target));
    }

    // BlueMap stores map data gzip-compressed (`<file>.gz`, e.g. textures.json,
    // hires `*.prbm`) but the webapp requests the uncompressed name. Transparently
    // decompress the `.gz` and serve plain bytes (no Content-Encoding, so the
    // console BFF proxy hop forwards it unchanged). (#540)
    const gz = `${target}.gz`;
    if (isFile(gz)) {
      reply.header('Content-Type', contentType);
      return reply.send(createReadStream(gz).pipe(createGunzip()));
    }

    return reply.code(404).send({ error: 'NotFound', message: 'File not found' });
  });

  /**
   * POST /api/worlds/:name/map/markers
   * Extract structures and write them as BlueMap markers into the rendered
   * webroot (live/markers.json per dimension). Requires the map to be rendered
   * first. No tile re-render is needed. (#530)
   */
  fastify.post<{ Params: MapWorldNameParams }>('/api/worlds/:name/map/markers', {
    schema: {
      tags: ['worlds'],
      summary: 'Write structure markers to the map',
      description: 'Extracts structures and writes BlueMap marker-sets into the rendered webroot',
      params: MapWorldNameParamsSchema,
      response: {
        200: MapMarkersResponseSchema,
        404: MapErrorResponseSchema,
        409: MapErrorResponseSchema,
        500: MapErrorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const { name } = request.params;

    if (!existsSync(join(new Paths().worlds, name))) {
      return reply.code(404).send({ error: 'NotFound', message: `World '${name}' not found` });
    }

    const webroot = getWebroot(name);
    if (!existsSync(join(webroot, 'index.html'))) {
      return reply.code(409).send({
        error: 'Conflict',
        message: 'Map not rendered yet — render the map before writing markers',
      });
    }

    try {
      const useCase = createWorldInfoUseCase();
      const structures = await useCase.getStructures(name);
      const counts = await new BlueMapMarkerWriter().writeMarkers(webroot, structures);
      // Report what was actually written (only rendered dimensions), not the
      // raw all-dimension structure count.
      const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
      return reply.send({ counts, total });
    } catch (error) {
      if (error instanceof Error && /not found/i.test(error.message)) {
        return reply.code(404).send({ error: 'NotFound', message: `World '${name}' not found` });
      }
      fastify.log.error(error, 'Failed to write map markers');
      return reply.code(500).send({ error: 'InternalServerError', message: 'Failed to write map markers' });
    }
  });

  /**
   * GET /api/worlds/:name/stats
   * Last cached block-stats analysis result. 404 when never analyzed. (#531)
   */
  fastify.get<{ Params: MapWorldNameParams }>('/api/worlds/:name/stats', {
    schema: {
      tags: ['worlds'],
      summary: 'Get cached world block stats',
      description: 'Returns the last cached ore/block statistics analysis for the world',
      params: MapWorldNameParamsSchema,
      response: {
        200: BlockStatsResponseSchema,
        404: MapErrorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const { name } = request.params;
    try {
      const raw = await readFileAsync(getStatsPath(name), 'utf-8');
      return reply.send(JSON.parse(raw));
    } catch {
      return reply.code(404).send({
        error: 'NotFound',
        message: `No analysis found for '${name}' — run an analysis first`,
      });
    }
  });

  /**
   * POST /api/worlds/:name/stats/analyze
   * Run a full region block scan. With ?follow=true streams progress as SSE
   * (progress/done/cancelled/error); otherwise runs synchronously. The result
   * is cached to stats/<world>.json. Cancellable by disconnecting; times out
   * after STATS_ANALYZE_TIMEOUT_MS. (#531)
   */
  fastify.post<{ Params: MapWorldNameParams; Querystring: StatsAnalyzeQuery }>(
    '/api/worlds/:name/stats/analyze', {
    schema: {
      tags: ['worlds'],
      summary: 'Analyze world block stats',
      description: 'Full region scan for ore/block statistics (heavy; optionally SSE progress)',
      params: MapWorldNameParamsSchema,
      querystring: StatsAnalyzeQuerySchema,
      response: {
        200: BlockStatsResponseSchema,
        404: MapErrorResponseSchema,
        500: MapErrorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const { name } = request.params;
    const { follow = false } = request.query;

    if (!existsSync(join(new Paths().worlds, name))) {
      return reply.code(404).send({ error: 'NotFound', message: `World '${name}' not found` });
    }

    const useCase = createWorldStatsUseCase();

    // Atomic write: stage to a temp file then rename, so a concurrent GET (or
    // a second analyze) never reads a half-written stats file.
    const persist = async (result: unknown) => {
      const file = getStatsPath(name);
      await mkdir(join(config.platformPath, 'stats'), { recursive: true });
      const tmp = `${file}.${process.pid}.tmp`;
      await writeFile(tmp, JSON.stringify(result), 'utf-8');
      await rename(tmp, file);
    };

    const controller = new AbortController();
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, STATS_ANALYZE_TIMEOUT_MS);
    // Cancel the scan if the client disconnects (both SSE and sync modes).
    request.raw.on('close', () => controller.abort());

    // SSE streaming mode
    if (follow) {
      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
      });

      const write = (event: string, data: unknown) => {
        try {
          reply.raw.write(`event: ${event}\n`);
          reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
        } catch {
          // socket closed — ignore
        }
      };

      try {
        const result = await useCase.analyze(name, {
          signal: controller.signal,
          onProgress: (p) => write('progress', p),
        });
        await persist(result);
        write('done', result);
      } catch (error) {
        if (error instanceof AnalysisCancelledError && timedOut) {
          write('error', { message: `Analysis timed out after ${STATS_ANALYZE_TIMEOUT_MS}ms` });
        } else if (error instanceof AnalysisCancelledError) {
          write('cancelled', { message: 'Analysis cancelled' });
        } else {
          write('error', {
            message: error instanceof Error ? error.message : 'Analysis failed',
          });
        }
      } finally {
        clearTimeout(timeout);
        reply.raw.end();
      }
      return;
    }

    // Synchronous mode
    try {
      const result = await useCase.analyze(name, { signal: controller.signal });
      await persist(result);
      return reply.send(result);
    } catch (error) {
      if (error instanceof AnalysisCancelledError) {
        return reply.code(500).send({
          error: timedOut ? 'GatewayTimeout' : 'Cancelled',
          message: timedOut ? 'Analysis timed out' : 'Analysis cancelled',
        });
      }
      fastify.log.error(error, 'Failed to analyze world stats');
      return reply.code(500).send({
        error: 'InternalServerError',
        message: error instanceof Error ? error.message : 'Failed to analyze world stats',
      });
    } finally {
      clearTimeout(timeout);
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
        await writeAuditLog({
          action: AuditActionEnum.WORLD_CREATE,
          actor: 'api:console',
          targetType: 'world',
          targetName: name,
          details: { seed, serverName },
          status: 'failure',
          errorMessage: result.error || 'Failed to create world',
        });
        return reply.code(400).send({
          error: 'BadRequest',
          message: result.error || 'Failed to create world',
        });
      }

      await writeAuditLog({
        action: AuditActionEnum.WORLD_CREATE,
        actor: 'api:console',
        targetType: 'world',
        targetName: result.worldName!,
        details: { seed: result.seed, serverName: result.serverName, started: result.started },
        status: 'success',
      });

      return reply.code(201).send({
        success: true,
        worldName: result.worldName,
        seed: result.seed,
        serverName: result.serverName,
        started: result.started,
      });
    } catch (error) {
      await writeAuditLog({
        action: AuditActionEnum.WORLD_CREATE,
        actor: 'api:console',
        targetType: 'world',
        targetName: name,
        details: { seed, serverName },
        status: 'failure',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      });
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
        await writeAuditLog({
          action: AuditActionEnum.WORLD_ASSIGN,
          actor: 'api:console',
          targetType: 'world',
          targetName: name,
          details: { serverName },
          status: 'failure',
          errorMessage: result.error || 'Failed to assign world',
        });
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

      await writeAuditLog({
        action: AuditActionEnum.WORLD_ASSIGN,
        actor: 'api:console',
        targetType: 'world',
        targetName: result.worldName!,
        details: { serverName: result.serverName },
        status: 'success',
      });

      return reply.send({
        success: true,
        worldName: result.worldName,
        serverName: result.serverName,
      });
    } catch (error) {
      await writeAuditLog({
        action: AuditActionEnum.WORLD_ASSIGN,
        actor: 'api:console',
        targetType: 'world',
        targetName: name,
        details: { serverName },
        status: 'failure',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      });
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
        await writeAuditLog({
          action: AuditActionEnum.WORLD_RELEASE,
          actor: 'api:console',
          targetType: 'world',
          targetName: name,
          details: { force },
          status: 'failure',
          errorMessage: result.error || 'Failed to release world',
        });
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

      await writeAuditLog({
        action: AuditActionEnum.WORLD_RELEASE,
        actor: 'api:console',
        targetType: 'world',
        targetName: result.worldName!,
        details: { previousServer: result.previousServer, force },
        status: 'success',
      });

      return reply.send({
        success: true,
        worldName: result.worldName,
        previousServer: result.previousServer,
      });
    } catch (error) {
      await writeAuditLog({
        action: AuditActionEnum.WORLD_RELEASE,
        actor: 'api:console',
        targetType: 'world',
        targetName: name,
        details: { force },
        status: 'failure',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      });
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
        await writeAuditLog({
          action: AuditActionEnum.WORLD_DELETE,
          actor: 'api:console',
          targetType: 'world',
          targetName: name,
          details: { force },
          status: 'failure',
          errorMessage: result.error || 'Failed to delete world',
        });
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

      await writeAuditLog({
        action: AuditActionEnum.WORLD_DELETE,
        actor: 'api:console',
        targetType: 'world',
        targetName: result.worldName!,
        details: { size: result.size, force },
        status: 'success',
      });

      return reply.send({
        success: true,
        worldName: result.worldName,
        size: result.size,
      });
    } catch (error) {
      await writeAuditLog({
        action: AuditActionEnum.WORLD_DELETE,
        actor: 'api:console',
        targetType: 'world',
        targetName: name,
        details: { force },
        status: 'failure',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      });
      fastify.log.error(error, 'Failed to delete world');
      return reply.code(500).send({
        error: 'InternalServerError',
        message: 'Failed to delete world',
      });
    }
  });
  /**
   * POST /api/worlds/upload
   * Import a world from a zip file upload (multipart/form-data)
   *
   * Query parameters:
   *   - name: world name (required, pattern: ^[a-zA-Z0-9_-]+$)
   *   - seed: optional seed (ignored by import; stored for reference only)
   *
   * The request body must be multipart/form-data containing exactly one .zip file part.
   */
  fastify.post<UploadWorldRoute>('/api/worlds/upload', {
    schema: {
      tags: ['worlds'],
      summary: 'Import world from zip',
      description:
        'Imports a Minecraft world by uploading a .zip archive (multipart/form-data). ' +
        'The zip must contain a level.dat file. World name is provided as a query parameter.',
      consumes: ['multipart/form-data'],
      querystring: UploadWorldQuerySchema,
      response: {
        201: CreateWorldResponseSchema,
        400: WorldErrorResponseSchema,
        409: WorldErrorResponseSchema,
        413: WorldErrorResponseSchema,
        500: WorldErrorResponseSchema,
      },
    },
  }, async (request: FastifyRequest<UploadWorldRoute>, reply: FastifyReply) => {
    const { name } = request.query;

    // 1. Pre-check for duplicate world name
    try {
      const checkUseCase = createWorldUseCase(); // listWorlds doesn't use the prompt adapter
      const existing = (await checkUseCase.listWorlds()).find((w) => w.name === name);
      if (existing) {
        return reply.code(409).send({
          error: 'Conflict',
          message: `World '${name}' already exists`,
        });
      }
    } catch (error) {
      fastify.log.error(error, 'Failed to check for duplicate world');
      return reply.code(500).send({
        error: 'InternalServerError',
        message: 'Failed to check world existence',
      });
    }

    // 2. Stream the uploaded zip to a temp file
    const tempZip = join(tmpdir(), `mcctl-world-upload-${randomUUID()}.zip`);
    let uploadedFilename = '';

    try {
      // Pass per-request file-size limit (the global multipart registration uses a
      // smaller limit for server file uploads; world zips can be up to 1 GB).
      const parts = request.parts({ limits: { fileSize: WORLD_UPLOAD_MAX_SIZE } });
      let foundFile = false;

      for await (const part of parts) {
        if (part.type !== 'file') continue;

        // Check file extension
        const originalName = part.filename ?? '';
        if (!originalName.toLowerCase().endsWith('.zip')) {
          // Drain the stream to avoid backpressure issues
          part.file.resume();
          // Drain remaining parts
          for await (const _remaining of parts) { /* consume */ }
          return reply.code(400).send({
            error: 'BadRequest',
            message: 'Only .zip files are accepted',
          });
        }

        uploadedFilename = basename(originalName);
        foundFile = true;

        // Stream to temp file
        await pipeline(part.file, createWriteStream(tempZip));

        if (part.file.truncated) {
          await rm(tempZip, { force: true });
          // Drain remaining parts so the connection terminates cleanly.
          try {
            for await (const _remaining of parts) { /* consume */ }
          } catch {
            /* ignore */
          }
          return reply.code(413).send({
            error: 'PayloadTooLarge',
            message: `Uploaded file exceeds the ${WORLD_UPLOAD_MAX_SIZE / 1024 / 1024}MB size limit`,
          });
        }

        // Only process the first file part
        break;
      }

      if (!foundFile) {
        return reply.code(400).send({
          error: 'BadRequest',
          message: 'A .zip file is required (no file part found in the request)',
        });
      }
    } catch (error) {
      await rm(tempZip, { force: true });
      fastify.log.error(error, 'Failed to receive uploaded zip');
      return reply.code(500).send({
        error: 'InternalServerError',
        message: 'Failed to receive uploaded file',
      });
    }

    // 3. Import the world from the temp zip
    try {
      const useCase = createWorldUseCase({ worldName: name });
      const result = await useCase.importWorldFromZip({ zipPath: tempZip, worldName: name });

      if (!result.success) {
        await writeAuditLog({
          action: AuditActionEnum.WORLD_CREATE,
          actor: 'api:console',
          targetType: 'world',
          targetName: name,
          details: { source: 'upload', filename: uploadedFilename },
          status: 'failure',
          errorMessage: result.error ?? 'Import failed',
        });
        // Keep the duplicate-world status consistent with the pre-check (409),
        // even when the collision is only detected during import (TOCTOU).
        if (result.error?.includes('already exists')) {
          return reply.code(409).send({
            error: 'Conflict',
            message: result.error,
          });
        }
        return reply.code(400).send({
          error: 'BadRequest',
          message: result.error ?? 'Failed to import world from zip',
        });
      }

      await writeAuditLog({
        action: AuditActionEnum.WORLD_CREATE,
        actor: 'api:console',
        targetType: 'world',
        targetName: result.worldName,
        details: { source: 'upload', filename: uploadedFilename },
        status: 'success',
      });

      return reply.code(201).send({
        success: true,
        worldName: result.worldName,
      });
    } catch (error) {
      await writeAuditLog({
        action: AuditActionEnum.WORLD_CREATE,
        actor: 'api:console',
        targetType: 'world',
        targetName: name,
        details: { source: 'upload', filename: uploadedFilename },
        status: 'failure',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      });
      fastify.log.error(error, 'Failed to import world from zip');
      return reply.code(500).send({
        error: 'InternalServerError',
        message: 'Failed to import world',
      });
    } finally {
      // Always clean up temp zip
      await rm(tempZip, { force: true });
    }
  });
};

export default fp(worldsPlugin, {
  name: 'worlds-routes',
  fastify: '5.x',
});

export { worldsPlugin };
