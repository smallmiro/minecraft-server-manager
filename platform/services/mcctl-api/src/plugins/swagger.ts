import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';

// ============================================================
// Types
// ============================================================

export interface SwaggerPluginOptions {
  title?: string;
  description?: string;
  version?: string;
  routePrefix?: string;
}

// ============================================================
// Plugin Implementation
// ============================================================

const swaggerPlugin: FastifyPluginAsync<SwaggerPluginOptions> = async (
  fastify: FastifyInstance,
  opts: SwaggerPluginOptions
) => {
  const {
    title = 'mcctl-api',
    description = 'REST API for managing Docker Minecraft servers',
    version = '0.1.0',
    routePrefix = '/docs',
  } = opts;

  // Register Swagger (OpenAPI spec generation)
  await fastify.register(swagger, {
    openapi: {
      openapi: '3.1.0',
      info: {
        title,
        description,
        version,
        license: {
          name: 'Apache-2.0',
          url: 'https://www.apache.org/licenses/LICENSE-2.0.html',
        },
        contact: {
          name: 'smallmiro',
          url: 'https://github.com/smallmiro/minecraft-server-manager',
        },
      },
      externalDocs: {
        url: 'https://minecraft-server-manager.readthedocs.io/',
        description: 'Full documentation',
      },
      servers: [
        {
          url: '/',
          description: 'Current server (relative)',
        },
        {
          url: 'http://localhost:5000',
          description: 'Local development server',
        },
        {
          url: 'http://192.168.20.37:5000',
          description: 'LAN server',
        },
      ],
      tags: [
        { name: 'health', description: 'Health check endpoints' },
        { name: 'servers', description: 'Minecraft server management' },
        { name: 'console', description: 'RCON console access' },
        { name: 'worlds', description: 'World management' },
        { name: 'players', description: 'Player management' },
        { name: 'config-snapshots', description: 'Config snapshot management' },
        { name: 'config-snapshot-schedules', description: 'Config snapshot schedule management' },
      ],
      components: {
        securitySchemes: {
          apiKey: {
            type: 'apiKey',
            name: 'X-API-Key',
            in: 'header',
            description: 'API key for authentication',
          },
          basicAuth: {
            type: 'http',
            scheme: 'basic',
            description: 'Basic HTTP authentication',
          },
        },
      },
      security: [{ apiKey: [] }],
    },
  });

  // Register Swagger UI
  await fastify.register(swaggerUi, {
    routePrefix,
    uiConfig: {
      docExpansion: 'list',
      deepLinking: true,
      displayRequestDuration: true,
      filter: true,
      showExtensions: true,
      showCommonExtensions: true,
      syntaxHighlight: {
        activate: true,
        theme: 'monokai',
      },
    },
    uiHooks: {
      onRequest: function (_request, _reply, next) {
        next();
      },
      preHandler: function (_request, _reply, next) {
        next();
      },
    },
    staticCSP: false,
    transformStaticCSP: (header) => header,
    transformSpecification: (swaggerObject) => swaggerObject,
    transformSpecificationClone: true,
  });

  fastify.log.info(`Swagger UI available at ${routePrefix}`);
  fastify.log.info(`OpenAPI spec available at ${routePrefix}/json`);
};

// ============================================================
// Common Schemas
// ============================================================

/**
 * Common response schemas for reuse across routes
 */
export const commonSchemas = {
  // Error response schema
  errorResponse: {
    type: 'object',
    properties: {
      error: { type: 'string', description: 'Error type' },
      message: { type: 'string', description: 'Error message' },
    },
    required: ['error', 'message'],
  },

  // Health check response schema
  healthResponse: {
    type: 'object',
    properties: {
      status: { type: 'string', enum: ['ok'], description: 'Health status' },
      timestamp: { type: 'string', format: 'date-time', description: 'ISO 8601 timestamp' },
    },
    required: ['status', 'timestamp'],
  },

  // Common parameters
  serverNameParam: {
    type: 'string',
    description: 'Server name (without mc- prefix)',
    pattern: '^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$',
    examples: ['survival', 'creative', 'modded'],
  },

  worldNameParam: {
    type: 'string',
    description: 'World name',
    pattern: '^[a-zA-Z0-9][a-zA-Z0-9_-]*$',
    examples: ['world', 'survival_world', 'creative-world'],
  },

  playerNameParam: {
    type: 'string',
    description: 'Minecraft player name',
    pattern: '^[a-zA-Z0-9_]{3,16}$',
    examples: ['Notch', 'Steve', 'Alex'],
  },
};

/**
 * Common route options for consistent error responses
 */
export const commonRouteOptions = {
  // 401 Unauthorized
  unauthorizedResponse: {
    description: 'Authentication required',
    content: {
      'application/json': {
        schema: commonSchemas.errorResponse,
        example: {
          error: 'AuthenticationError',
          message: 'Missing X-API-Key header',
        },
      },
    },
  },

  // 403 Forbidden
  forbiddenResponse: {
    description: 'Access denied',
    content: {
      'application/json': {
        schema: commonSchemas.errorResponse,
        example: {
          error: 'AuthenticationError',
          message: 'IP address not allowed',
        },
      },
    },
  },

  // 404 Not Found
  notFoundResponse: {
    description: 'Resource not found',
    content: {
      'application/json': {
        schema: commonSchemas.errorResponse,
        example: {
          error: 'NotFound',
          message: 'Server not found',
        },
      },
    },
  },

  // 500 Internal Server Error
  internalErrorResponse: {
    description: 'Internal server error',
    content: {
      'application/json': {
        schema: commonSchemas.errorResponse,
        example: {
          error: 'InternalError',
          message: 'An unexpected error occurred',
        },
      },
    },
  },
};

// ============================================================
// Export
// ============================================================

export default fp(swaggerPlugin, {
  name: 'swagger',
  fastify: '5.x',
  dependencies: [], // No dependencies, should be registered early
});

export { swaggerPlugin };
