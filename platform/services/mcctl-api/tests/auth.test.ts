import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import authPlugin, { hashPassword } from '../src/plugins/auth';
import type { AuthConfig } from '../src/config/index';

describe('Authentication Plugin', () => {
  describe('disabled mode', () => {
    let app: FastifyInstance;

    beforeAll(async () => {
      app = Fastify({ logger: false });

      await app.register(authPlugin, {
        config: { mode: 'disabled' },
      });

      app.get('/test', async () => ({ message: 'success' }));
      app.get('/health', async () => ({ status: 'ok' }));

      await app.ready();
    });

    afterAll(async () => {
      await app.close();
    });

    it('should allow all requests without authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/test',
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual({ message: 'success' });
    });
  });

  describe('api-key mode', () => {
    let app: FastifyInstance;
    const API_KEY = 'test-api-key-12345';

    beforeAll(async () => {
      app = Fastify({ logger: false });

      await app.register(authPlugin, {
        config: {
          mode: 'api-key',
          apiKey: API_KEY,
        },
      });

      app.get('/test', async () => ({ message: 'success' }));
      app.get('/health', async () => ({ status: 'ok' }));

      await app.ready();
    });

    afterAll(async () => {
      await app.close();
    });

    it('should reject requests without API key', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/test',
      });

      expect(response.statusCode).toBe(401);
      expect(JSON.parse(response.body).error).toBe('AuthenticationError');
    });

    it('should reject requests with invalid API key', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/test',
        headers: {
          'x-api-key': 'wrong-key',
        },
      });

      expect(response.statusCode).toBe(401);
      expect(JSON.parse(response.body).message).toBe('Invalid API key');
    });

    it('should accept requests with valid API key', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/test',
        headers: {
          'x-api-key': API_KEY,
        },
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual({ message: 'success' });
    });

    it('should bypass authentication for health endpoint', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health',
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual({ status: 'ok' });
    });
  });

  describe('ip-whitelist mode', () => {
    let app: FastifyInstance;

    beforeAll(async () => {
      app = Fastify({
        logger: false,
        trustProxy: true,
      });

      await app.register(authPlugin, {
        config: {
          mode: 'ip-whitelist',
          ipWhitelist: ['127.0.0.1', '192.168.1.0/24', '10.0.0.0/8'],
        },
      });

      app.get('/test', async () => ({ message: 'success' }));
      app.get('/health', async () => ({ status: 'ok' }));

      await app.ready();
    });

    afterAll(async () => {
      await app.close();
    });

    it('should accept requests from whitelisted IP', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/test',
        remoteAddress: '127.0.0.1',
      });

      expect(response.statusCode).toBe(200);
    });

    it('should accept requests from whitelisted CIDR range', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/test',
        headers: {
          'x-forwarded-for': '192.168.1.100',
        },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should reject requests from non-whitelisted IP', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/test',
        headers: {
          'x-forwarded-for': '203.0.113.50',
        },
      });

      expect(response.statusCode).toBe(403);
      expect(JSON.parse(response.body).message).toBe('IP address not allowed');
    });

    it('should bypass authentication for health endpoint', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health',
        headers: {
          'x-forwarded-for': '203.0.113.50',
        },
      });

      expect(response.statusCode).toBe(200);
    });
  });

  describe('basic mode', () => {
    let app: FastifyInstance;
    let passwordHash: string;
    const username = 'admin';
    const password = 'secret123';

    beforeAll(async () => {
      passwordHash = await hashPassword(password);

      app = Fastify({ logger: false });

      await app.register(authPlugin, {
        config: {
          mode: 'basic',
          users: [{ username, passwordHash }],
        },
      });

      app.get('/test', async () => ({ message: 'success' }));
      app.get('/health', async () => ({ status: 'ok' }));

      await app.ready();
    });

    afterAll(async () => {
      await app.close();
    });

    it('should reject requests without Authorization header', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/test',
      });

      expect(response.statusCode).toBe(401);
    });

    it('should reject requests with invalid credentials', async () => {
      const credentials = Buffer.from('admin:wrongpassword').toString('base64');

      const response = await app.inject({
        method: 'GET',
        url: '/test',
        headers: {
          authorization: `Basic ${credentials}`,
        },
      });

      expect(response.statusCode).toBe(401);
      expect(JSON.parse(response.body).message).toBe('Invalid credentials');
    });

    it('should reject requests with unknown user', async () => {
      const credentials = Buffer.from('unknown:password').toString('base64');

      const response = await app.inject({
        method: 'GET',
        url: '/test',
        headers: {
          authorization: `Basic ${credentials}`,
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should accept requests with valid credentials', async () => {
      const credentials = Buffer.from(`${username}:${password}`).toString('base64');

      const response = await app.inject({
        method: 'GET',
        url: '/test',
        headers: {
          authorization: `Basic ${credentials}`,
        },
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual({ message: 'success' });
    });

    it('should bypass authentication for health endpoint', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health',
      });

      expect(response.statusCode).toBe(200);
    });
  });

  describe('combined mode', () => {
    let app: FastifyInstance;
    const API_KEY = 'combined-api-key';

    beforeAll(async () => {
      app = Fastify({
        logger: false,
        trustProxy: true,
      });

      await app.register(authPlugin, {
        config: {
          mode: 'combined',
          apiKey: API_KEY,
          ipWhitelist: ['127.0.0.1', '192.168.1.0/24'],
        },
      });

      app.get('/test', async () => ({ message: 'success' }));
      app.get('/health', async () => ({ status: 'ok' }));

      await app.ready();
    });

    afterAll(async () => {
      await app.close();
    });

    it('should reject requests with valid API key but wrong IP', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/test',
        headers: {
          'x-api-key': API_KEY,
          'x-forwarded-for': '203.0.113.50',
        },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should reject requests with valid IP but wrong API key', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/test',
        headers: {
          'x-api-key': 'wrong-key',
          'x-forwarded-for': '192.168.1.100',
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should reject requests with valid IP but no API key', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/test',
        headers: {
          'x-forwarded-for': '192.168.1.100',
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should accept requests with valid API key AND valid IP', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/test',
        headers: {
          'x-api-key': API_KEY,
          'x-forwarded-for': '192.168.1.100',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual({ message: 'success' });
    });

    it('should bypass authentication for health endpoint', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health',
        headers: {
          'x-forwarded-for': '203.0.113.50',
        },
      });

      expect(response.statusCode).toBe(200);
    });
  });

  describe('config validation', () => {
    it('should throw error for api-key mode without apiKey', async () => {
      const app = Fastify({ logger: false });

      await expect(
        app.register(authPlugin, {
          config: { mode: 'api-key' } as AuthConfig,
        })
      ).rejects.toThrow('API key is required');

      await app.close();
    });

    it('should throw error for ip-whitelist mode without ipWhitelist', async () => {
      const app = Fastify({ logger: false });

      await expect(
        app.register(authPlugin, {
          config: { mode: 'ip-whitelist' } as AuthConfig,
        })
      ).rejects.toThrow('IP whitelist is required');

      await app.close();
    });

    it('should throw error for basic mode without users', async () => {
      const app = Fastify({ logger: false });

      await expect(
        app.register(authPlugin, {
          config: { mode: 'basic' } as AuthConfig,
        })
      ).rejects.toThrow('Users are required');

      await app.close();
    });

    it('should throw error for combined mode without apiKey', async () => {
      const app = Fastify({ logger: false });

      await expect(
        app.register(authPlugin, {
          config: {
            mode: 'combined',
            ipWhitelist: ['127.0.0.1'],
          } as AuthConfig,
        })
      ).rejects.toThrow('API key is required');

      await app.close();
    });

    it('should throw error for combined mode without ipWhitelist', async () => {
      const app = Fastify({ logger: false });

      await expect(
        app.register(authPlugin, {
          config: {
            mode: 'combined',
            apiKey: 'test-key',
          } as AuthConfig,
        })
      ).rejects.toThrow('IP whitelist is required');

      await app.close();
    });
  });

  describe('custom exclude paths', () => {
    let app: FastifyInstance;
    const API_KEY = 'test-api-key';

    beforeAll(async () => {
      app = Fastify({ logger: false });

      await app.register(authPlugin, {
        config: {
          mode: 'api-key',
          apiKey: API_KEY,
          excludePaths: ['/public', '/public/', '/docs'],
        },
      });

      app.get('/public', async () => ({ public: true }));
      app.get('/docs', async () => ({ docs: true }));
      app.get('/private', async () => ({ private: true }));

      await app.ready();
    });

    afterAll(async () => {
      await app.close();
    });

    it('should bypass authentication for excluded paths', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/public',
      });

      expect(response.statusCode).toBe(200);
    });

    it('should bypass authentication for docs path', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/docs',
      });

      expect(response.statusCode).toBe(200);
    });

    it('should require authentication for non-excluded paths', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/private',
      });

      expect(response.statusCode).toBe(401);
    });

    it('should require auth for paths not in custom excludePaths', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health',
      });

      // /health is NOT in the custom excludePaths, so it requires auth
      // Returns 401 (not 404) because auth hook runs before route matching
      expect(response.statusCode).toBe(401);
    });
  });

  describe('hashPassword utility', () => {
    it('should generate valid bcrypt hash', async () => {
      const password = 'testPassword123';
      const hash = await hashPassword(password);

      expect(hash).toMatch(/^\$2[aby]\$.{56}$/);
    });

    it('should generate different hashes for same password', async () => {
      const password = 'testPassword123';
      const hash1 = await hashPassword(password);
      const hash2 = await hashPassword(password);

      expect(hash1).not.toBe(hash2);
    });
  });
});
