import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import {
  getRouterDetailInfoAsync,
  getAvahiStatus,
  getPlayitAgentStatus,
  DockerComposeRuntimeAdapter,
  AuditActionEnum,
} from '@minecraft-docker/shared';
import { writeAuditLog } from '../services/audit-log-service.js';
import { config, childProcessEnv } from '../config/index.js';
import {
  RouterStatusResponseSchema,
  RouterRestartResponseSchema,
  ErrorResponseSchema,
  type RouterDetail,
} from '../schemas/router.js';
import { type PlayitSummary } from '../schemas/playit.js';

/**
 * Router routes plugin
 * Provides REST API for mc-router status
 */
const routerPlugin: FastifyPluginAsync = async (fastify: FastifyInstance) => {
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
        fastify.log.warn(error, 'Failed to get playit status for router endpoint');
      }

      return reply.send({ router, avahi, playit });
    } catch (error) {
      fastify.log.error(error, 'Failed to get router status');
      return reply.code(500).send({
        error: 'InternalServerError',
        message: 'Failed to get router status',
      });
    }
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
