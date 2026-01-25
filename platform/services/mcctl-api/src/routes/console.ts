import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import { execRcon } from '../lib/rcon.js';

// ============================================================
// Types
// ============================================================

interface ExecCommandBody {
  command: string;
}

interface ExecCommandParams {
  id: string;
}

interface ExecCommandResponse {
  output: string;
  exitCode: number;
}

interface ErrorResponse {
  error: string;
  message: string;
}

// ============================================================
// JSON Schema for validation
// ============================================================

const execCommandSchema = {
  body: {
    type: 'object',
    required: ['command'],
    properties: {
      command: {
        type: 'string',
        minLength: 1,
        description: 'RCON command to execute',
      },
    },
  },
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: {
        type: 'string',
        description: 'Server ID (name)',
      },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        output: { type: 'string' },
        exitCode: { type: 'number' },
      },
    },
    400: {
      type: 'object',
      properties: {
        error: { type: 'string' },
        message: { type: 'string' },
      },
    },
  },
};

// ============================================================
// Plugin Implementation
// ============================================================

const consoleRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  /**
   * POST /servers/:id/console/exec
   * Execute an RCON command on the specified server
   */
  fastify.post<{
    Body: ExecCommandBody;
    Params: ExecCommandParams;
    Reply: ExecCommandResponse | ErrorResponse;
  }>(
    '/servers/:id/console/exec',
    {
      schema: execCommandSchema,
    },
    async (request, reply) => {
      const { id: serverId } = request.params;
      const { command } = request.body;

      // Validation is handled by schema, but double-check for safety
      if (!command || command.trim().length === 0) {
        return reply.code(400).send({
          error: 'ValidationError',
          message: 'Command is required and cannot be empty',
        });
      }

      fastify.log.info({ serverId, command }, 'Executing RCON command');

      try {
        const result = await execRcon(serverId, command);

        return reply.send({
          output: result.output.trim(),
          exitCode: result.exitCode,
        });
      } catch (error) {
        fastify.log.error({ serverId, command, error }, 'RCON execution failed');

        return reply.code(500).send({
          error: 'RconExecutionError',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  );
};

// ============================================================
// Export
// ============================================================

export default fp(consoleRoutes, {
  name: 'console-routes',
  fastify: '5.x',
});

export { consoleRoutes };
