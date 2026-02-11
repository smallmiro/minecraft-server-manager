import { FastifyInstance, FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import { serverExists, AuditActionEnum } from '@minecraft-docker/shared';
import { writeAuditLog } from '../../services/audit-log-service.js';
import {
  HostnameResponseSchema,
  UpdateCustomHostnamesRequestSchema,
  UpdateHostnamesResponseSchema,
  type UpdateCustomHostnamesRequest,
} from '../../schemas/hostname.js';
import { ErrorResponseSchema, ServerNameParamsSchema, type ServerNameParams } from '../../schemas/server.js';
import { config } from '../../config/index.js';
import { createHostnameService } from '../../services/HostnameService.js';

// ============================================================
// Types
// ============================================================

interface GetHostnamesRoute {
  Params: ServerNameParams;
}

interface UpdateHostnamesRoute {
  Params: ServerNameParams;
  Body: UpdateCustomHostnamesRequest;
}

// ============================================================
// Plugin Definition
// ============================================================

/**
 * Server hostname routes plugin
 * Provides REST API for hostname/domain management
 */
const hostnamesPlugin: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  const hostnameService = createHostnameService(config.platformPath);

  /**
   * GET /api/servers/:name/hostnames
   * Get server hostnames with system/custom classification
   */
  fastify.get<GetHostnamesRoute>('/api/servers/:name/hostnames', {
    schema: {
      description: 'Get server hostnames with system/custom classification',
      tags: ['servers', 'hostnames'],
      params: ServerNameParamsSchema,
      response: {
        200: HostnameResponseSchema,
        404: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
  }, async (request: FastifyRequest<GetHostnamesRoute>, reply: FastifyReply) => {
    const { name } = request.params;

    try {
      if (!serverExists(name)) {
        return reply.code(404).send({
          error: 'NotFound',
          message: `Server '${name}' not found`,
        });
      }

      if (!hostnameService.composeExists(name)) {
        return reply.code(404).send({
          error: 'NotFound',
          message: `Docker compose file for server '${name}' not found`,
        });
      }

      const data = hostnameService.getHostnames(name);

      return reply.send({
        serverName: data.serverName,
        hostnames: data.hostnames,
        systemHostnames: data.systemHostnames,
        customHostnames: data.customHostnames,
      });
    } catch (error) {
      fastify.log.error(error, 'Failed to get server hostnames');
      return reply.code(500).send({
        error: 'InternalServerError',
        message: 'Failed to get server hostnames',
      });
    }
  });

  /**
   * PUT /api/servers/:name/hostnames
   * Update custom hostnames (replaces all custom hostnames)
   */
  fastify.put<UpdateHostnamesRoute>('/api/servers/:name/hostnames', {
    schema: {
      description: 'Update custom hostnames for a server (replaces all custom hostnames)',
      tags: ['servers', 'hostnames'],
      params: ServerNameParamsSchema,
      body: UpdateCustomHostnamesRequestSchema,
      response: {
        200: UpdateHostnamesResponseSchema,
        400: ErrorResponseSchema,
        404: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
  }, async (request: FastifyRequest<UpdateHostnamesRoute>, reply: FastifyReply) => {
    const { name } = request.params;
    const { customHostnames } = request.body;

    try {
      if (!serverExists(name)) {
        return reply.code(404).send({
          error: 'NotFound',
          message: `Server '${name}' not found`,
        });
      }

      if (!hostnameService.composeExists(name)) {
        return reply.code(404).send({
          error: 'NotFound',
          message: `Docker compose file for server '${name}' not found`,
        });
      }

      // Read previous hostnames for audit trail
      const previousData = hostnameService.getHostnames(name);
      const previousCustom = previousData.customHostnames;

      const data = hostnameService.updateCustomHostnames(name, customHostnames);

      await writeAuditLog({
        action: AuditActionEnum.SERVER_HOSTNAME_UPDATE,
        actor: 'api:console',
        targetType: 'server',
        targetName: name,
        details: {
          previous: previousCustom,
          updated: data.customHostnames,
        },
        status: 'success',
      });

      fastify.log.info({
        server: name,
        customHostnames: data.customHostnames,
      }, 'Server hostnames updated');

      return reply.send({
        success: true,
        serverName: data.serverName,
        hostnames: data.hostnames,
        systemHostnames: data.systemHostnames,
        customHostnames: data.customHostnames,
        recreateRequired: true,
      });
    } catch (error) {
      if (error instanceof Error && (
        error.message.includes('Duplicate') ||
        error.message.includes('Invalid') ||
        error.message.includes('Cannot use') ||
        error.message.includes('must be between')
      )) {
        await writeAuditLog({
          action: AuditActionEnum.SERVER_HOSTNAME_UPDATE,
          actor: 'api:console',
          targetType: 'server',
          targetName: name,
          details: { customHostnames },
          status: 'failure',
          errorMessage: error.message,
        });
        return reply.code(400).send({
          error: 'BadRequest',
          message: error.message,
        });
      }

      await writeAuditLog({
        action: AuditActionEnum.SERVER_HOSTNAME_UPDATE,
        actor: 'api:console',
        targetType: 'server',
        targetName: name,
        details: { customHostnames },
        status: 'failure',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      });
      fastify.log.error(error, 'Failed to update server hostnames');
      return reply.code(500).send({
        error: 'InternalServerError',
        message: 'Failed to update server hostnames',
      });
    }
  });
};

// ============================================================
// Export
// ============================================================

export default fp(hostnamesPlugin, {
  name: 'server-hostname-routes',
  fastify: '5.x',
});

export { hostnamesPlugin };
