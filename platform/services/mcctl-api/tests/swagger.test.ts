import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';

describe('Swagger Documentation', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp({ logger: false });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Swagger UI', () => {
    it('should serve Swagger UI at /docs', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/docs/',
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('text/html');
    });

    it('should serve Swagger UI static assets', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/docs/static/index.html',
      });

      // Should either return the static file or redirect
      expect([200, 302]).toContain(response.statusCode);
    });
  });

  describe('OpenAPI Specification', () => {
    it('should serve OpenAPI JSON spec at /docs/json', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/docs/json',
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('application/json');

      const spec = JSON.parse(response.body);
      expect(spec.openapi).toBe('3.1.0');
      expect(spec.info.title).toBe('mcctl-api');
      expect(spec.info.version).toBe('0.1.0');
    });

    it('should include API info in the spec', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/docs/json',
      });

      const spec = JSON.parse(response.body);
      expect(spec.info.description).toContain('Minecraft');
      expect(spec.info.license.name).toBe('Apache-2.0');
      expect(spec.info.contact.name).toBe('smallmiro');
    });

    it('should include security schemes', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/docs/json',
      });

      const spec = JSON.parse(response.body);
      expect(spec.components.securitySchemes).toBeDefined();
      expect(spec.components.securitySchemes.apiKey).toBeDefined();
      expect(spec.components.securitySchemes.apiKey.type).toBe('apiKey');
      expect(spec.components.securitySchemes.apiKey.in).toBe('header');
    });

    it('should include defined tags', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/docs/json',
      });

      const spec = JSON.parse(response.body);
      expect(spec.tags).toBeDefined();
      expect(spec.tags.length).toBeGreaterThan(0);

      const tagNames = spec.tags.map((t: { name: string }) => t.name);
      expect(tagNames).toContain('health');
      expect(tagNames).toContain('servers');
    });

    it('should include external documentation link', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/docs/json',
      });

      const spec = JSON.parse(response.body);
      expect(spec.externalDocs).toBeDefined();
      expect(spec.externalDocs.url).toContain('readthedocs');
    });
  });

  describe('YAML Specification', () => {
    it('should serve OpenAPI YAML spec at /docs/yaml', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/docs/yaml',
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('yaml');
      expect(response.body).toContain('openapi:');
    });
  });
});
