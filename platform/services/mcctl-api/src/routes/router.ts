import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import { getRouterDetailInfo, getAvahiStatus } from '@minecraft-docker/shared';
import {
  RouterStatusResponseSchema,
  ErrorResponseSchema,
  type RouterDetail,
} from '../schemas/router.js';

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
      const info = getRouterDetailInfo();

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
        })),
      };

      const avahi = {
        name: 'avahi-daemon',
        status: getAvahiStatus(),
        type: 'system',
      };

      return reply.send({ router, avahi });
    } catch (error) {
      fastify.log.error(error, 'Failed to get router status');
      return reply.code(500).send({
        error: 'InternalServerError',
        message: 'Failed to get router status',
      });
    }
  });
};

export default fp(routerPlugin, {
  name: 'router-routes',
  fastify: '5.x',
});

export { routerPlugin };
