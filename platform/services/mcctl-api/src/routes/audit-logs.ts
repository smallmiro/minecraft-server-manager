import { FastifyInstance, FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import {
  AuditLogListQuerySchema,
  AuditLogIdParamsSchema,
  AuditLogPurgeRequestSchema,
  AuditLogListResponseSchema,
  AuditLogStatsResponseSchema,
  AuditLogDetailResponseSchema,
  AuditLogPurgeResponseSchema,
  ErrorResponseSchema,
  type AuditLogListQuery,
  type AuditLogIdParams,
  type AuditLogPurgeRequest,
} from '../schemas/audit-log.js';
import {
  getAuditLogs,
  getAuditLogStats,
  getAuditLogById,
  purgeAuditLogs,
  writeAuditLog,
  subscribeAuditLogs,
  getAuditLogRepository,
} from '../services/audit-log-service.js';
import { AuditActionEnum } from '@minecraft-docker/shared';

// Route generic interfaces
interface ListRoute {
  Querystring: AuditLogListQuery;
}

interface DetailRoute {
  Params: AuditLogIdParams;
}

interface PurgeRoute {
  Body: AuditLogPurgeRequest;
}

/**
 * Audit log routes plugin
 * Provides REST API for audit log management
 */
const auditLogsPlugin: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  /**
   * GET /api/audit-logs
   * List audit logs with filtering and pagination
   */
  fastify.get<ListRoute>('/api/audit-logs', {
    schema: {
      description: 'List audit logs with filtering and pagination',
      tags: ['audit-logs'],
      querystring: AuditLogListQuerySchema,
      response: {
        200: AuditLogListResponseSchema,
        500: ErrorResponseSchema,
      },
    },
  }, async (request: FastifyRequest<ListRoute>, reply: FastifyReply) => {
    try {
      const data = await getAuditLogs(request.query);
      return reply.send(data);
    } catch (error) {
      fastify.log.error(error, 'Failed to list audit logs');
      return reply.code(500).send({
        error: 'InternalServerError',
        message: 'Failed to list audit logs',
      });
    }
  });

  /**
   * GET /api/audit-logs/stats
   * Get audit log statistics
   */
  fastify.get('/api/audit-logs/stats', {
    schema: {
      description: 'Get audit log statistics',
      tags: ['audit-logs'],
      response: {
        200: AuditLogStatsResponseSchema,
        500: ErrorResponseSchema,
      },
    },
  }, async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const data = await getAuditLogStats();
      return reply.send(data);
    } catch (error) {
      fastify.log.error(error, 'Failed to get audit log stats');
      return reply.code(500).send({
        error: 'InternalServerError',
        message: 'Failed to get audit log statistics',
      });
    }
  });

  /**
   * GET /api/audit-logs/stream
   * Server-Sent Events stream for real-time audit log updates
   */
  fastify.get('/api/audit-logs/stream', {
    schema: {
      description: 'Real-time audit log stream (SSE)',
      tags: ['audit-logs'],
      response: {
        200: { type: 'string', description: 'SSE event stream' },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    // Set SSE headers
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });

    // Send initial connected event
    reply.raw.write(`event: connected\ndata: ${JSON.stringify({ timestamp: new Date().toISOString() })}\n\n`);

    // Subscribe to new audit log events
    const unsubscribe = subscribeAuditLogs((log) => {
      reply.raw.write(`event: audit-log\ndata: ${JSON.stringify(log)}\n\n`);
    });

    // Heartbeat to keep connection alive (every 30 seconds)
    const heartbeat = setInterval(() => {
      reply.raw.write(`event: heartbeat\ndata: ${JSON.stringify({ timestamp: new Date().toISOString() })}\n\n`);
    }, 30000);

    // Cleanup on client disconnect
    request.raw.on('close', () => {
      clearInterval(heartbeat);
      unsubscribe();
      reply.raw.end();
    });

    // Don't return - keep connection open for SSE
    return;
  });

  /**
   * GET /api/audit-logs/:id
   * Get single audit log entry with related logs
   */
  fastify.get<DetailRoute>('/api/audit-logs/:id', {
    schema: {
      description: 'Get single audit log entry with related logs',
      tags: ['audit-logs'],
      params: AuditLogIdParamsSchema,
      response: {
        200: AuditLogDetailResponseSchema,
        404: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
  }, async (request: FastifyRequest<DetailRoute>, reply: FastifyReply) => {
    const { id } = request.params;

    try {
      const data = await getAuditLogById(id);

      if (!data) {
        return reply.code(404).send({
          error: 'NotFound',
          message: `Audit log entry '${id}' not found`,
        });
      }

      return reply.send(data);
    } catch (error) {
      fastify.log.error(error, 'Failed to get audit log detail');
      return reply.code(500).send({
        error: 'InternalServerError',
        message: 'Failed to get audit log detail',
      });
    }
  });

  /**
   * DELETE /api/audit-logs
   * Purge old audit log entries (admin only)
   */
  fastify.delete<PurgeRoute>('/api/audit-logs', {
    schema: {
      description: 'Purge old audit log entries (admin only)',
      tags: ['audit-logs'],
      body: AuditLogPurgeRequestSchema,
      response: {
        200: AuditLogPurgeResponseSchema,
        400: ErrorResponseSchema,
        403: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
  }, async (request: FastifyRequest<PurgeRoute>, reply: FastifyReply) => {
    try {
      // Check admin role from headers (set by BFF or API key auth)
      const role = request.headers['x-role'] as string | undefined;
      if (role && role !== 'admin') {
        return reply.code(403).send({
          error: 'Forbidden',
          message: 'Admin access required for audit log purge',
        });
      }

      const { before, dryRun = false } = request.body;

      // Validate date
      const beforeDate = new Date(before);
      if (isNaN(beforeDate.getTime())) {
        return reply.code(400).send({
          error: 'BadRequest',
          message: 'Invalid date format for "before" parameter',
        });
      }

      const data = await purgeAuditLogs(before, dryRun);

      if (!dryRun && data.deleted > 0) {
        await writeAuditLog({
          action: AuditActionEnum.AUDIT_PURGE,
          actor: 'api:console',
          targetType: 'system',
          targetName: 'audit-logs',
          details: { before, deleted: data.deleted },
          status: 'success',
        });
      }

      return reply.send(data);
    } catch (error) {
      await writeAuditLog({
        action: AuditActionEnum.AUDIT_PURGE,
        actor: 'api:console',
        targetType: 'system',
        targetName: 'audit-logs',
        details: { before, dryRun },
        status: 'failure',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      });
      fastify.log.error(error, 'Failed to purge audit logs');
      return reply.code(500).send({
        error: 'InternalServerError',
        message: 'Failed to purge audit logs',
      });
    }
  });
};

export default fp(auditLogsPlugin, {
  name: 'audit-logs-routes',
  fastify: '5.x',
});

export { auditLogsPlugin };
