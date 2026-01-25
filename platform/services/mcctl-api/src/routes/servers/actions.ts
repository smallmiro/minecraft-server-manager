import { FastifyInstance, FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import {
  isValidServerName,
  sanitizeServerName,
  executeServerAction,
  ServerAction,
} from '../../utils/docker-compose.js';

// ============================================================
// Types
// ============================================================

interface ServerNameParams {
  name: string;
}

interface ActionResponse {
  success: boolean;
  server: string;
  action: ServerAction;
  timestamp: string;
  message?: string;
  error?: string;
}

// ============================================================
// Route Handlers
// ============================================================

async function handleServerAction(
  request: FastifyRequest<{ Params: ServerNameParams }>,
  reply: FastifyReply,
  action: ServerAction
): Promise<ActionResponse> {
  const serverName = sanitizeServerName(request.params.name);

  // Validate server name
  if (!isValidServerName(serverName)) {
    reply.code(400);
    return {
      success: false,
      server: serverName,
      action,
      timestamp: new Date().toISOString(),
      error: 'Invalid server name. Server name must start with a letter or number and contain only alphanumeric characters, hyphens, or underscores.',
    };
  }

  // Execute the action
  const result = await executeServerAction(serverName, action);

  if (!result.success) {
    reply.code(500);
    return {
      success: false,
      server: serverName,
      action,
      timestamp: new Date().toISOString(),
      error: result.error ?? 'Failed to execute action',
      message: result.stderr,
    };
  }

  return {
    success: true,
    server: serverName,
    action,
    timestamp: new Date().toISOString(),
    message: result.stdout,
  };
}

// ============================================================
// Plugin Definition
// ============================================================

const serverActionsPlugin: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // POST /api/servers/:name/start
  fastify.post<{ Params: ServerNameParams }>(
    '/api/servers/:name/start',
    async (request, reply) => {
      return handleServerAction(request, reply, 'start');
    }
  );

  // POST /api/servers/:name/stop
  fastify.post<{ Params: ServerNameParams }>(
    '/api/servers/:name/stop',
    async (request, reply) => {
      return handleServerAction(request, reply, 'stop');
    }
  );

  // POST /api/servers/:name/restart
  fastify.post<{ Params: ServerNameParams }>(
    '/api/servers/:name/restart',
    async (request, reply) => {
      return handleServerAction(request, reply, 'restart');
    }
  );
};

// ============================================================
// Export
// ============================================================

export default fp(serverActionsPlugin, {
  name: 'server-actions-routes',
  fastify: '5.x',
});

export { serverActionsPlugin };
