/**
 * Authentication Routes
 *
 * Handles user authentication for the mcctl-console.
 * Validates credentials against users.yaml file.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { join } from 'node:path';
import { YamlUserRepository, Username } from '@minecraft-docker/shared';

/**
 * Login request body schema
 */
interface LoginBody {
  username: string;
  password: string;
}

/**
 * Register authentication routes
 */
export default async function authRoutes(app: FastifyInstance): Promise<void> {
  /**
   * POST /api/auth/login
   *
   * Authenticate user with username and password.
   * Returns user info on success, 401 on failure.
   */
  app.post<{ Body: LoginBody }>(
    '/api/auth/login',
    {
      schema: {
        description: 'Authenticate user with credentials',
        tags: ['auth'],
        body: {
          type: 'object',
          required: ['username', 'password'],
          properties: {
            username: { type: 'string', description: 'Username' },
            password: { type: 'string', description: 'Password' },
          },
        },
        response: {
          200: {
            description: 'Authentication successful',
            type: 'object',
            properties: {
              id: { type: 'string' },
              username: { type: 'string' },
              role: { type: 'string' },
              name: { type: 'string' },
            },
          },
          401: {
            description: 'Authentication failed',
            type: 'object',
            properties: {
              error: { type: 'string' },
              message: { type: 'string' },
            },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Body: LoginBody }>,
      reply: FastifyReply
    ) => {
      const { username, password } = request.body;

      if (!username || !password) {
        return reply.status(401).send({
          error: 'Unauthorized',
          message: 'Username and password are required',
        });
      }

      try {
        // Get users.yaml path from MCCTL_ROOT
        const mcctlRoot = process.env['MCCTL_ROOT'] || process.cwd();
        const usersPath = join(mcctlRoot, 'users.yaml');

        const userRepo = new YamlUserRepository(usersPath);

        // Find user by username
        const usernameVO = Username.create(username);
        const user = await userRepo.findByUsername(usernameVO);

        if (!user) {
          app.log.warn({ username }, 'Login failed: user not found');
          return reply.status(401).send({
            error: 'Unauthorized',
            message: 'Invalid username or password',
          });
        }

        // Verify password
        const isValid = await userRepo.verifyPassword(password, user.passwordHash);

        if (!isValid) {
          app.log.warn({ username }, 'Login failed: invalid password');
          return reply.status(401).send({
            error: 'Unauthorized',
            message: 'Invalid username or password',
          });
        }

        app.log.info({ username, role: user.role }, 'Login successful');

        // Return user info (without password hash)
        return reply.send({
          id: user.id,
          username: user.username.value,
          role: user.role,
          name: user.username.value, // Use username as display name
        });
      } catch (error) {
        app.log.error(error, 'Login error');
        return reply.status(500).send({
          error: 'Internal Server Error',
          message: 'Authentication service error',
        });
      }
    }
  );

  /**
   * GET /api/auth/me
   *
   * Get current user info (requires authentication via X-User header from BFF proxy).
   */
  app.get(
    '/api/auth/me',
    {
      schema: {
        description: 'Get current authenticated user info',
        tags: ['auth'],
        response: {
          200: {
            description: 'User info',
            type: 'object',
            properties: {
              username: { type: 'string' },
              role: { type: 'string' },
            },
          },
          401: {
            description: 'Not authenticated',
            type: 'object',
            properties: {
              error: { type: 'string' },
              message: { type: 'string' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const username = request.headers['x-user'] as string | undefined;
      const role = request.headers['x-role'] as string | undefined;

      if (!username) {
        return reply.status(401).send({
          error: 'Unauthorized',
          message: 'Not authenticated',
        });
      }

      return reply.send({
        username,
        role: role || 'user',
      });
    }
  );
}
