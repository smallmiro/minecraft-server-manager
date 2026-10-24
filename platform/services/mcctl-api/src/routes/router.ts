import { FastifyInstance, FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import {
  getRouterDetailInfoAsync,
  getAvahiStatus,
  getPlayitAgentStatus,
  DockerComposeRuntimeAdapter,
  AuditActionEnum,
  parseRouterLogLine,
} from '@minecraft-docker/shared';
import { writeAuditLog } from '../services/audit-log-service.js';
import { config, childProcessEnv } from '../config/index.js';
import {
  RouterLogsStreamQuerySchema,
  RouterStatusStreamQuerySchema,
  RouterStatusResponseSchema,
  RouterRestartResponseSchema,
  ErrorResponseSchema,
  type RouterDetail,
  type RouterStatusResponse,
} from '../schemas/router.js';
import { type PlayitSummary } from '../schemas/playit.js';

/**
 * Build the `{ router, avahi, playit }` payload shared by GET /api/router/status
 * and the status SSE stream, so both produce the identical shape.
 */
export async function buildRouterStatusPayload(log: { warn: (obj: unknown, msg?: string) => void }): Promise<RouterStatusResponse> {
    const info = await getRouterDetailInfoAsync();

    const router: RouterDetail = {
      name: info.name,
      status: info.status,
      health: info.health,
      port: info.port,
      uptime: info.uptime,
      uptimeSeconds: info.uptimeSeconds,
      mode: info.mode,
      routes: info.routes.map((route) => ({
        hostname: route.hostname,
        target: route.target,
        serverStatus: route.serverStatus,
        serverType: route.serverType,
        serverVersion: route.serverVersion,
        autoScaleUp: route.autoScaleUp,
        autoScaleDown: route.autoScaleDown,
        discoveredByRouter: route.discoveredByRouter,
      })),
      image: info.image,
      autoScale: info.autoScale,
      resolver: info.resolver,
    };

    const avahi = {
      name: 'avahi-daemon',
      status: getAvahiStatus(),
      type: 'system',
    };

    // Get playit status summary
    let playit: PlayitSummary | undefined;
    try {
      const playitStatus = await getPlayitAgentStatus();
      playit = {
        enabled: playitStatus.enabled,
        agentRunning: playitStatus.agentRunning,
        secretKeyConfigured: playitStatus.secretKeyConfigured,
      };
    } catch (error) {
      // If playit status fails, omit it from response
      log.warn(error, 'Failed to get playit status for router endpoint');
    }

  return { router, avahi, playit };
}

const ROUTER_CONTAINER = 'mc-router';
const SSE_HEARTBEAT_MS = 30000;
const LOG_TAIL_DEFAULT = 100;
const LOG_TAIL_MAX = 500;

/** Clamp ?tail= to 1..500; non-numeric falls back to the default. */
export function clampLogTail(value: unknown): number {
  if (value === '' || value === undefined || value === null) return LOG_TAIL_DEFAULT;
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return LOG_TAIL_DEFAULT;
  return Math.min(LOG_TAIL_MAX, Math.max(1, Math.trunc(n)));
}

/**
 * Stable change-detection key for a status payload. `uptimeSeconds` ticks every
 * poll and is left out; the displayed `uptime` string stays in, because clients
 * stop polling while the stream is live and would otherwise show a frozen uptime.
 */
export function routerStatusChangeKey(payload: RouterStatusResponse): string {
  const { uptimeSeconds: _uptimeSeconds, ...router } = payload.router;
  return JSON.stringify({ ...payload, router });
}

interface RouterStatusSubscriber {
  onPayload(payload: RouterStatusResponse): void;
  onError(): void;
}

/**
 * One status poll per interval shared by every stream connection, so N open
 * tabs cost one docker/avahi/playit round per interval instead of N.
 */
class RouterStatusPoller {
  private readonly subscribers = new Set<RouterStatusSubscriber>();
  private timer: ReturnType<typeof setInterval> | undefined;
  private inFlight = false;
  private last: RouterStatusResponse | undefined;

  constructor(
    private readonly interval: number,
    private readonly load: () => Promise<RouterStatusResponse>,
    private readonly onFailure: (error: unknown) => void,
    private readonly onIdle: () => void
  ) {}

  subscribe(subscriber: RouterStatusSubscriber): () => void {
    this.subscribers.add(subscriber);
    if (this.last) subscriber.onPayload(this.last);
    if (!this.timer) {
      void this.poll();
      this.timer = setInterval(() => void this.poll(), this.interval);
    }
    return () => {
      this.subscribers.delete(subscriber);
      if (this.subscribers.size === 0) {
        clearInterval(this.timer);
        this.timer = undefined;
        this.onIdle();
      }
    };
  }

  private async poll(): Promise<void> {
    if (this.inFlight) return;
    this.inFlight = true;
    try {
      this.last = await this.load();
      for (const subscriber of this.subscribers) subscriber.onPayload(this.last);
    } catch (error) {
      this.last = undefined;
      this.onFailure(error);
      for (const subscriber of this.subscribers) subscriber.onError();
    } finally {
      this.inFlight = false;
    }
  }
}

const sseHeaders = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache',
  'Connection': 'keep-alive',
  'Access-Control-Allow-Origin': '*',
};

/**
 * Router routes plugin
 * Provides REST API for mc-router status
 */
const routerPlugin: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  const pollers = new Map<number, RouterStatusPoller>();
  const pollerFor = (interval: number): RouterStatusPoller => {
    let poller = pollers.get(interval);
    if (!poller) {
      poller = new RouterStatusPoller(
        interval,
        () => buildRouterStatusPayload(fastify.log),
        (error) => fastify.log.warn(error, 'Failed to poll router status for stream'),
        () => pollers.delete(interval)
      );
      pollers.set(interval, poller);
    }
    return poller;
  };

  /**
   * GET /api/router/status
   * Get mc-router status and routes
   */
  fastify.get('/api/router/status', {
    schema: {
      description: 'Get mc-router status including all routes',
      tags: ['router'],
      response: {
        200: RouterStatusResponseSchema,
        500: ErrorResponseSchema,
      },
    },
  }, async (_request, reply) => {
    try {
      return reply.send(await buildRouterStatusPayload(fastify.log));
    } catch (error) {
      fastify.log.error(error, 'Failed to get router status');
      return reply.code(500).send({
        error: 'InternalServerError',
        message: 'Failed to get router status',
      });
    }
  });

  /**
   * GET /api/router/status/stream
   * SSE: emits `router-status` (same payload as GET /status) on first connect and
   * whenever it changes, ignoring uptime ticks.
   */
  fastify.get<{ Querystring: { interval?: number } }>('/api/router/status/stream', {
    schema: {
      description: 'Real-time mc-router status stream (SSE). Emits router-status events only when the status changes',
      tags: ['router'],
      querystring: RouterStatusStreamQuerySchema,
      response: {
        200: { type: 'string', description: 'SSE event stream' },
      },
    },
  }, async (request: FastifyRequest<{ Querystring: { interval?: number } }>, reply: FastifyReply) => {
    const { interval = 5000 } = request.query;

    reply.raw.writeHead(200, sseHeaders);

    let closed = false;
    let lastKey: string | undefined;

    const unsubscribe = pollerFor(interval).subscribe({
      onPayload(payload) {
        if (closed) return;
        const key = routerStatusChangeKey(payload);
        if (key === lastKey) return;
        lastKey = key;
        reply.raw.write(`event: router-status\ndata: ${JSON.stringify(payload)}\n\n`);
      },
      onError() {
        if (closed) return;
        // Clients fall back to polling GET /status; resend the next good payload even if unchanged.
        lastKey = undefined;
        reply.raw.write(`event: router-status-error\ndata: ${JSON.stringify({ timestamp: new Date().toISOString() })}\n\n`);
      },
    });
    const heartbeat = setInterval(() => {
      reply.raw.write(': heartbeat\n\n');
    }, SSE_HEARTBEAT_MS);

    request.raw.on('close', () => {
      closed = true;
      unsubscribe();
      clearInterval(heartbeat);
      reply.raw.end();
    });

    return;
  });

  /**
   * GET /api/router/logs/stream
   * SSE: follows `docker logs -f mc-router`, emitting one `router-log` event per line.
   */
  fastify.get<{ Querystring: { tail?: string } }>('/api/router/logs/stream', {
    schema: {
      description: 'Real-time mc-router log stream (SSE). Each log line is parsed into a router-log event',
      tags: ['router'],
      querystring: RouterLogsStreamQuerySchema,
      response: {
        200: { type: 'string', description: 'SSE event stream' },
      },
    },
  }, async (request: FastifyRequest<{ Querystring: { tail?: string } }>, reply: FastifyReply) => {
    const tail = clampLogTail(request.query.tail);

    reply.raw.writeHead(200, sseHeaders);
    reply.raw.write(`event: connected\ndata: ${JSON.stringify({ timestamp: new Date().toISOString() })}\n\n`);

    const controller = new AbortController();
    let finished = false;
    let pending = '';

    const emitLine = (line: string) => {
      if (finished || line.length === 0) return;
      reply.raw.write(`event: router-log\ndata: ${JSON.stringify(parseRouterLogLine(line))}\n\n`);
    };

    const onChunk = (chunk: string) => {
      pending += chunk;
      const parts = pending.split('\n');
      pending = parts.pop() ?? '';
      for (const part of parts) emitLine(part.replace(/\r$/, ''));
    };

    const heartbeat = setInterval(() => {
      reply.raw.write(': heartbeat\n\n');
    }, SSE_HEARTBEAT_MS);

    const finish = (payload?: { code: number | null; error?: string }) => {
      if (finished) return;
      if (payload) {
        emitLine(pending.replace(/\r$/, ''));
        pending = '';
        reply.raw.write(`event: end\ndata: ${JSON.stringify(payload)}\n\n`);
      }
      finished = true;
      clearInterval(heartbeat);
      controller.abort();
      reply.raw.end();
    };

    // Client disconnect: abort kills the docker logs child (spawn's `signal`)
    request.raw.on('close', () => finish());

    const runtime = new DockerComposeRuntimeAdapter({
      root: config.mcctlRoot,
      env: () => childProcessEnv(),
    });
    void runtime
      .followLogs(ROUTER_CONTAINER, onChunk, controller.signal, {
        tail,
        onExit: (code, error) => finish({ code, ...(error ? { error: error.message } : {}) }),
      })
      .catch((error: unknown) => {
        fastify.log.error(error, 'Router log stream failed');
        finish({ code: null, error: error instanceof Error ? error.message : 'Unknown error' });
      });

    return;
  });

  /**
   * POST /api/router/restart
   * Restart the mc-router container (compose service `router`).
   * Authentication is enforced by the global auth plugin.
   */
  fastify.post('/api/router/restart', {
    schema: {
      description: 'Restart the mc-router container',
      tags: ['router'],
      response: {
        200: RouterRestartResponseSchema,
        500: ErrorResponseSchema,
      },
    },
  }, async (_request, reply) => {
    const audit = (status: 'success' | 'failure', errorMessage: string | null) =>
      writeAuditLog({
        action: AuditActionEnum.ROUTER_RESTART,
        actor: 'api:console',
        targetType: 'service',
        targetName: 'mc-router',
        status,
        details: null,
        errorMessage,
      });

    try {
      const runtime = new DockerComposeRuntimeAdapter({
        root: config.mcctlRoot,
        env: () => childProcessEnv(),
      });
      // The compose service is `router` (container_name mc-router)
      const result = await runtime.restart('router');

      if (!result.success) {
        const errorMsg = result.error || 'Failed to restart mc-router';
        await audit('failure', errorMsg);
        return reply.code(500).send({ error: 'InternalServerError', message: errorMsg });
      }

      await audit('success', null);
      return reply.send({ success: true, message: 'mc-router restarted' });
    } catch (error) {
      fastify.log.error(error, 'Failed to restart mc-router');
      await audit('failure', error instanceof Error ? error.message : 'Unknown error');
      return reply.code(500).send({
        error: 'InternalServerError',
        message: 'Failed to restart mc-router',
      });
    }
  });
};

export default fp(routerPlugin, {
  name: 'router-routes',
  fastify: '5.x',
});

export { routerPlugin };
