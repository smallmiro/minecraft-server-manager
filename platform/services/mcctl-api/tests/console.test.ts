import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';

// Mock node:child_process module for rcon.ts
vi.mock('node:child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:child_process')>();
  return {
    ...actual,
    spawn: vi.fn(),
  };
});

import { spawn } from 'node:child_process';

describe('Console Routes', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp({ logger: false });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /servers/:id/console/exec', () => {
    it('should execute RCON command and return output', async () => {
      // Mock successful RCON execution
      const mockSpawn = spawn as unknown as ReturnType<typeof vi.fn>;
      mockSpawn.mockImplementation(() => {
        const mockProcess = {
          stdout: {
            on: vi.fn((event, callback) => {
              if (event === 'data') {
                callback(Buffer.from('Hello, World!'));
              }
            }),
          },
          stderr: {
            on: vi.fn(),
          },
          on: vi.fn((event, callback) => {
            if (event === 'close') {
              setTimeout(() => callback(0), 10);
            }
          }),
        };
        return mockProcess;
      });

      const response = await app.inject({
        method: 'POST',
        url: '/servers/myserver/console/exec',
        payload: {
          command: 'say Hello, World!',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('output');
      expect(body).toHaveProperty('exitCode');
      expect(body.exitCode).toBe(0);
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
      const mockSpawn = spawn as unknown as ReturnType<typeof vi.fn>;
      mockSpawn.mockImplementation(() => {
        const mockProcess = {
          stdout: {
            on: vi.fn(),
          },
          stderr: {
            on: vi.fn((event, callback) => {
              if (event === 'data') {
                callback(Buffer.from('Connection refused'));
              }
            }),
          },
          on: vi.fn((event, callback) => {
            if (event === 'close') {
              setTimeout(() => callback(1), 10);
            }
          }),
        };
        return mockProcess;
      });

      const response = await app.inject({
        method: 'POST',
        url: '/servers/offline-server/console/exec',
        payload: {
          command: 'list',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.exitCode).toBe(1);
    });

    it('should normalize server name with mc- prefix', async () => {
      const mockSpawn = spawn as unknown as ReturnType<typeof vi.fn>;
      mockSpawn.mockImplementation((cmd: string, args: string[]) => {
        // Verify container name has mc- prefix
        expect(args).toContain('mc-testserver');

        const mockProcess = {
          stdout: {
            on: vi.fn((event, callback) => {
              if (event === 'data') {
                callback(Buffer.from('OK'));
              }
            }),
          },
          stderr: {
            on: vi.fn(),
          },
          on: vi.fn((event, callback) => {
            if (event === 'close') {
              setTimeout(() => callback(0), 10);
            }
          }),
        };
        return mockProcess;
      });

      await app.inject({
        method: 'POST',
        url: '/servers/testserver/console/exec',
        payload: {
          command: 'list',
        },
      });
    });

    it('should not double-prefix server name that already has mc-', async () => {
      const mockSpawn = spawn as unknown as ReturnType<typeof vi.fn>;
      mockSpawn.mockImplementation((cmd: string, args: string[]) => {
        // Verify container name is NOT mc-mc-testserver
        expect(args).toContain('mc-testserver');
        expect(args).not.toContain('mc-mc-testserver');

        const mockProcess = {
          stdout: {
            on: vi.fn((event, callback) => {
              if (event === 'data') {
                callback(Buffer.from('OK'));
              }
            }),
          },
          stderr: {
            on: vi.fn(),
          },
          on: vi.fn((event, callback) => {
            if (event === 'close') {
              setTimeout(() => callback(0), 10);
            }
          }),
        };
        return mockProcess;
      });

      await app.inject({
        method: 'POST',
        url: '/servers/mc-testserver/console/exec',
        payload: {
          command: 'list',
        },
      });
    });
  });
});
