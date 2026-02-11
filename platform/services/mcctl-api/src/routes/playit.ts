import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import {
  getPlayitAgentStatus as getPlayitStatus,
  startPlayitAgent as startAgent,
  stopPlayitAgent as stopAgent,
  getServerPlayitDomain,
  getAllServers,
  getServerInfoFromConfig,
} from '@minecraft-docker/shared';
import {
  PlayitAgentStatusSchema,
  PlayitActionResponseSchema,
  ErrorResponseSchema,
  type PlayitAgentStatus,
  type PlayitServerInfo,
} from '../schemas/playit.js';
import { writeAuditLog } from '../services/audit-log-service.js';
import { AuditActionEnum } from '@minecraft-docker/shared';

/**
 * Playit routes plugin
 * Provides REST API for playit.gg agent control and status
 */
const playitPlugin: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  /**
   * GET /api/playit/status
   * Get playit agent status and per-server external access info
   */
  fastify.get('/api/playit/status', {
    schema: {
      description: 'Get playit.gg agent status and server external access info',
      tags: ['playit'],
      response: {
        200: PlayitAgentStatusSchema,
        500: ErrorResponseSchema,
      },
    },
  }, async (_request, reply) => {
    try {
      // Get playit agent status
      const status = await getPlayitStatus();

      // Get all servers and their playit domains
      const serverNames = getAllServers();
      const servers: PlayitServerInfo[] = serverNames.map((serverName) => {
        const info = getServerInfoFromConfig(serverName);
        const playitDomain = getServerPlayitDomain(serverName);

        return {
          serverName,
          playitDomain,
          lanHostname: info.hostname,
        };
      });

      const response: PlayitAgentStatus = {
        ...status,
        servers,
      };

      return reply.send(response);
    } catch (error) {
      fastify.log.error(error, 'Failed to get playit status');
      return reply.code(500).send({
        error: 'InternalServerError',
        message: 'Failed to get playit status',
      });
    }
  });

  /**
   * POST /api/playit/start
   * Start playit-agent container
   */
  fastify.post('/api/playit/start', {
    schema: {
      description: 'Start playit.gg agent container',
      tags: ['playit'],
      response: {
        200: PlayitActionResponseSchema,
        500: ErrorResponseSchema,
      },
    },
  }, async (_request, reply) => {
    try {
      const success = await startAgent();

      if (!success) {
        await writeAuditLog({
          action: AuditActionEnum.PLAYIT_START,
          actor: 'api:console',
          targetType: 'service',
          targetName: 'playit',
          status: 'failure',
          details: null,
          errorMessage: 'Failed to start playit-agent',
        });

        return reply.code(500).send({
          error: 'InternalServerError',
          message: 'Failed to start playit-agent',
        });
      }

      await writeAuditLog({
        action: AuditActionEnum.PLAYIT_START,
        actor: 'api:console',
        targetType: 'service',
        targetName: 'playit',
        status: 'success',
        details: null,
        errorMessage: null,
      });

      return reply.send({
        success: true,
        message: 'playit-agent started',
      });
    } catch (error) {
      fastify.log.error(error, 'Failed to start playit agent');

      await writeAuditLog({
        action: AuditActionEnum.PLAYIT_START,
        actor: 'api:console',
        targetType: 'service',
        targetName: 'playit',
        status: 'failure',
        details: null,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      });

      return reply.code(500).send({
        error: 'InternalServerError',
        message: 'Failed to start playit agent',
      });
    }
  });

  /**
   * POST /api/playit/stop
   * Stop playit-agent container
   */
  fastify.post('/api/playit/stop', {
    schema: {
      description: 'Stop playit.gg agent container',
      tags: ['playit'],
      response: {
        200: PlayitActionResponseSchema,
        500: ErrorResponseSchema,
      },
    },
  }, async (_request, reply) => {
    try {
      const success = await stopAgent();

      if (!success) {
        await writeAuditLog({
          action: AuditActionEnum.PLAYIT_STOP,
          actor: 'api:console',
          targetType: 'service',
          targetName: 'playit',
          status: 'failure',
          details: null,
          errorMessage: 'Failed to stop playit-agent',
        });

        return reply.code(500).send({
          error: 'InternalServerError',
          message: 'Failed to stop playit-agent',
        });
      }

      await writeAuditLog({
        action: AuditActionEnum.PLAYIT_STOP,
        actor: 'api:console',
        targetType: 'service',
        targetName: 'playit',
        status: 'success',
        details: null,
        errorMessage: null,
      });

      return reply.send({
        success: true,
        message: 'playit-agent stopped',
      });
    } catch (error) {
      fastify.log.error(error, 'Failed to stop playit agent');

      await writeAuditLog({
        action: AuditActionEnum.PLAYIT_STOP,
        actor: 'api:console',
        targetType: 'service',
        targetName: 'playit',
        status: 'failure',
        details: null,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      });

      return reply.code(500).send({
        error: 'InternalServerError',
        message: 'Failed to stop playit agent',
      });
    }
  });
};

export default fp(playitPlugin, {
  name: 'playit-routes',
  fastify: '5.x',
});

export { playitPlugin };
