import { FastifyInstance, FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import bcrypt from 'bcrypt';
import ipRangeCheck from 'ip-range-check';

// ============================================================
// Types
// ============================================================

export type AuthMode = 'disabled' | 'api-key' | 'ip-whitelist' | 'basic' | 'combined';

export interface AuthUser {
  username: string;
  passwordHash: string;
}

export interface AuthConfig {
  mode: AuthMode;
  apiKey?: string;
  ipWhitelist?: string[];
  users?: AuthUser[];
  excludePaths?: string[];
}

export interface AuthPluginOptions {
  config: AuthConfig;
}

// ============================================================
// Plugin Implementation
// ============================================================

const authPlugin: FastifyPluginAsync<AuthPluginOptions> = async (
  fastify: FastifyInstance,
  opts: AuthPluginOptions
) => {
  const { config } = opts;

  // Validate config based on mode
  validateAuthConfig(config);

  // Decorate fastify with auth utilities
  fastify.decorate('authConfig', config);
  fastify.decorate('isAuthenticated', false);

  // Default excluded paths
  const excludedPaths = new Set(config.excludePaths ?? ['/health', '/health/']);

  // Skip authentication if disabled
  if (config.mode === 'disabled') {
    fastify.log.warn('Authentication is DISABLED. This should only be used in development!');
    return;
  }

  // Add preHandler hook for authentication
  fastify.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    // Skip authentication for excluded paths
    if (excludedPaths.has(request.url)) {
      return;
    }

    // Normalize URL for path matching (remove query string)
    const urlPath = request.url.split('?')[0] ?? request.url;
    if (excludedPaths.has(urlPath)) {
      return;
    }

    try {
      await authenticate(request, reply, config, fastify);
    } catch (error) {
      if (error instanceof AuthError) {
        reply.code(error.statusCode).send({
          error: error.name,
          message: error.message,
        });
        return reply;
      }
      throw error;
    }
  });
};

// ============================================================
// Authentication Logic
// ============================================================

class AuthError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number = 401) {
    super(message);
    this.name = 'AuthenticationError';
    this.statusCode = statusCode;
  }
}

async function authenticate(
  request: FastifyRequest,
  _reply: FastifyReply,
  config: AuthConfig,
  fastify: FastifyInstance
): Promise<void> {
  switch (config.mode) {
    case 'api-key':
      await authenticateApiKey(request, config, fastify);
      break;
    case 'ip-whitelist':
      await authenticateIpWhitelist(request, config, fastify);
      break;
    case 'basic':
      await authenticateBasic(request, config, fastify);
      break;
    case 'combined':
      await authenticateCombined(request, config, fastify);
      break;
    default:
      throw new AuthError('Invalid authentication mode', 500);
  }
}

async function authenticateApiKey(
  request: FastifyRequest,
  config: AuthConfig,
  fastify: FastifyInstance
): Promise<void> {
  const apiKey = request.headers['x-api-key'];

  if (!apiKey) {
    throw new AuthError('Missing X-API-Key header');
  }

  if (apiKey !== config.apiKey) {
    fastify.log.warn({ ip: getClientIp(request) }, 'Invalid API key attempt');
    throw new AuthError('Invalid API key');
  }
}

async function authenticateIpWhitelist(
  request: FastifyRequest,
  config: AuthConfig,
  fastify: FastifyInstance
): Promise<void> {
  const clientIp = getClientIp(request);
  const whitelist = config.ipWhitelist ?? [];

  if (whitelist.length === 0) {
    throw new AuthError('IP whitelist is empty', 500);
  }

  const isAllowed = ipRangeCheck(clientIp, whitelist);

  if (!isAllowed) {
    fastify.log.warn({ ip: clientIp }, 'IP not in whitelist');
    throw new AuthError('IP address not allowed', 403);
  }
}

async function authenticateBasic(
  request: FastifyRequest,
  config: AuthConfig,
  fastify: FastifyInstance
): Promise<void> {
  const authHeader = request.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Basic ')) {
    throw new AuthError('Missing or invalid Authorization header');
  }

  const base64Credentials = authHeader.substring(6);
  const credentials = Buffer.from(base64Credentials, 'base64').toString('utf-8');
  const [username, password] = credentials.split(':');

  if (!username || !password) {
    throw new AuthError('Invalid credentials format');
  }

  const users = config.users ?? [];
  const user = users.find((u) => u.username === username);

  if (!user) {
    fastify.log.warn({ username, ip: getClientIp(request) }, 'Unknown user attempt');
    throw new AuthError('Invalid credentials');
  }

  const isValid = await bcrypt.compare(password, user.passwordHash);

  if (!isValid) {
    fastify.log.warn({ username, ip: getClientIp(request) }, 'Invalid password attempt');
    throw new AuthError('Invalid credentials');
  }
}

async function authenticateCombined(
  request: FastifyRequest,
  config: AuthConfig,
  fastify: FastifyInstance
): Promise<void> {
  // Both API key AND IP whitelist must pass
  await authenticateApiKey(request, config, fastify);
  await authenticateIpWhitelist(request, config, fastify);
}

// ============================================================
// Utilities
// ============================================================

function getClientIp(request: FastifyRequest): string {
  // Check for forwarded headers (reverse proxy scenarios)
  const xForwardedFor = request.headers['x-forwarded-for'];
  if (xForwardedFor) {
    const ips = Array.isArray(xForwardedFor) ? xForwardedFor[0] : xForwardedFor.split(',')[0];
    if (ips) {
      return ips.trim();
    }
  }

  const xRealIp = request.headers['x-real-ip'];
  if (xRealIp) {
    const ip = Array.isArray(xRealIp) ? xRealIp[0] : xRealIp;
    if (ip) {
      return ip;
    }
  }

  // Fallback to socket IP
  return request.ip;
}

function validateAuthConfig(config: AuthConfig): void {
  switch (config.mode) {
    case 'disabled':
      // No validation needed
      break;
    case 'api-key':
      if (!config.apiKey) {
        throw new Error('API key is required for api-key authentication mode');
      }
      break;
    case 'ip-whitelist':
      if (!config.ipWhitelist || config.ipWhitelist.length === 0) {
        throw new Error('IP whitelist is required for ip-whitelist authentication mode');
      }
      break;
    case 'basic':
      if (!config.users || config.users.length === 0) {
        throw new Error('Users are required for basic authentication mode');
      }
      break;
    case 'combined':
      if (!config.apiKey) {
        throw new Error('API key is required for combined authentication mode');
      }
      if (!config.ipWhitelist || config.ipWhitelist.length === 0) {
        throw new Error('IP whitelist is required for combined authentication mode');
      }
      break;
    default:
      throw new Error(`Unknown authentication mode: ${config.mode}`);
  }
}

// ============================================================
// Helper for generating password hashes
// ============================================================

export async function hashPassword(password: string, saltRounds: number = 10): Promise<string> {
  return bcrypt.hash(password, saltRounds);
}

// ============================================================
// Type Augmentation for Fastify
// ============================================================

declare module 'fastify' {
  interface FastifyInstance {
    authConfig: AuthConfig;
    isAuthenticated: boolean;
  }
}

// ============================================================
// Export
// ============================================================

export default fp(authPlugin, {
  name: 'auth',
  fastify: '5.x',
});

export { authPlugin, AuthError };
