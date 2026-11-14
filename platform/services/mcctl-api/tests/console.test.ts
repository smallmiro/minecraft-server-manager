import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { FakeServerConsole } from './fake-console.js';

describe('Console Routes', () => {
  let app: FastifyInstance;
  // The route runs RCON through fastify.container.serverConsole() (#875)
  let serverConsole: FakeServerConsole;

  beforeAll(async () => {
    app = await buildApp({ logger: false, container: { serverConsole: () => serverConsole } });
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    serverConsole = new FakeServerConsole();
  });

  describe('POST /servers/:id/console/exec', () => {
    it('should execute RCON command and return output', async () => {
      serverConsole.reply = async () => ({ exitCode: 0, stdout: 'Hello, World!', stderr: '' });

      const response = await app.inject({
        method: 'POST',
        url: '/servers/myserver/console/exec',
        payload: {
          command: 'say Hello, World!',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ output: 'Hello, World!', exitCode: 0 });
    });

    it('should return 400 if command is missing', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/servers/myserver/console/exec',
        payload: {},
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('error');
    });

    it('should return 400 if command is empty', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/servers/myserver/console/exec',
        payload: {
          command: '',
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('error');
    });

    it('should handle RCON execution errors', async () => {
      serverConsole.reply = async () => ({ exitCode: 1, stdout: '', stderr: 'Connection refused' });

      const response = await app.inject({
        method: 'POST',
        url: '/servers/offline-server/console/exec',
        payload: {
          command: 'list',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ output: 'Connection refused', exitCode: 1 });
    });

    it('should normalize server name with mc- prefix', async () => {
      await app.inject({
        method: 'POST',
        url: '/servers/testserver/console/exec',
        payload: {
          command: 'list',
        },
      });

      expect(serverConsole.calls[0].name).toBe('mc-testserver');
    });

    // rcon-cli parses flags anywhere in its argv: '--host=x' would redirect the RCON
    // connection (#728). The adapter puts it after rcon-cli's '--'; the route passes it as one argument.
    it('passes a command starting with - as one argument', async () => {
      await app.inject({
        method: 'POST',
        url: '/servers/testserver/console/exec',
        payload: { command: '--host=evil.example' },
      });

      expect(serverConsole.calls[0].args).toEqual(['--host=evil.example']);
    });

    it('should not double-prefix server name that already has mc-', async () => {
      await app.inject({
        method: 'POST',
        url: '/servers/mc-testserver/console/exec',
        payload: {
          command: 'list',
        },
      });

      expect(serverConsole.calls[0].name).toBe('mc-testserver');
    });
  });
});
