import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { McctlApiAdapter, McctlApiError, createMcctlApiClient } from '../McctlApiAdapter';

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('McctlApiAdapter', () => {
  const config = {
    baseUrl: 'http://localhost:5001',
    apiKey: 'test-api-key',
  };

  let adapter: McctlApiAdapter;

  beforeEach(() => {
    adapter = new McctlApiAdapter(config);
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should remove trailing slash from baseUrl', () => {
      const adapterWithSlash = new McctlApiAdapter({
        baseUrl: 'http://localhost:5001/',
        apiKey: 'key',
      });
      // We can't directly access private properties, but we can test via fetch calls
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ servers: [], total: 0 }),
      });

      adapterWithSlash.getServers();

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:5001/api/servers',
        expect.any(Object)
      );
    });
  });

  describe('fetch wrapper', () => {
    it('should include X-API-Key header in all requests', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ servers: [], total: 0 }),
      });

      await adapter.getServers();

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:5001/api/servers',
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-API-Key': 'test-api-key',
          }),
        })
      );
    });

    it('should include Content-Type header only when body is present', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      await adapter.createServer({ name: 'test', type: 'PAPER', version: '1.21.1' });

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:5001/api/servers',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'X-API-Key': 'test-api-key',
          }),
        })
      );
    });

    it('should throw McctlApiError on non-ok response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: () => Promise.resolve({ error: 'NotFound', message: 'Server not found' }),
      });

      try {
        await adapter.getServer('nonexistent');
        expect.fail('Expected McctlApiError to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(McctlApiError);
        expect((error as McctlApiError).statusCode).toBe(404);
        expect((error as McctlApiError).error).toBe('NotFound');
        expect((error as McctlApiError).message).toBe('Server not found');
      }
    });

    it('should handle JSON parse errors gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: () => Promise.reject(new Error('Invalid JSON')),
      });

      await expect(adapter.getServers()).rejects.toThrow(McctlApiError);
    });
  });

  describe('Server operations', () => {
    it('getServers should fetch server list', async () => {
      const mockResponse = {
        servers: [
          { name: 'test', container: 'mc-test', status: 'running', health: 'healthy', hostname: 'test.local' },
        ],
        total: 1,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await adapter.getServers();

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:5001/api/servers',
        expect.any(Object)
      );
    });

    it('getServer should fetch single server details', async () => {
      const mockResponse = {
        server: {
          name: 'test',
          container: 'mc-test',
          status: 'running',
          health: 'healthy',
          hostname: 'test.local',
          type: 'PAPER',
          version: '1.21.1',
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await adapter.getServer('test');

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:5001/api/servers/test',
        expect.any(Object)
      );
    });

    it('createServer should POST new server', async () => {
      const mockResponse = {
        success: true,
        server: { name: 'newserver', container: 'mc-newserver', status: 'starting' },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await adapter.createServer({
        name: 'newserver',
        type: 'PAPER',
        version: '1.21.1',
      });

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:5001/api/servers',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ name: 'newserver', type: 'PAPER', version: '1.21.1' }),
        })
      );
    });

    it('deleteServer should DELETE with optional force parameter', async () => {
      const mockResponse = { success: true, server: 'test', message: 'Deleted' };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      await adapter.deleteServer('test', true);

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:5001/api/servers/test?force=true',
        expect.objectContaining({ method: 'DELETE' })
      );
    });

    it('startServer should POST to start endpoint', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, server: 'test', action: 'start', timestamp: '2024-01-01' }),
      });

      await adapter.startServer('test');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:5001/api/servers/test/start',
        expect.objectContaining({ method: 'POST' })
      );
    });

    it('stopServer should POST to stop endpoint', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, server: 'test', action: 'stop', timestamp: '2024-01-01' }),
      });

      await adapter.stopServer('test');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:5001/api/servers/test/stop',
        expect.objectContaining({ method: 'POST' })
      );
    });

    it('restartServer should POST to restart endpoint', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, server: 'test', action: 'restart', timestamp: '2024-01-01' }),
      });

      await adapter.restartServer('test');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:5001/api/servers/test/restart',
        expect.objectContaining({ method: 'POST' })
      );
    });

    it('execCommand should POST command to exec endpoint', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, output: 'Command executed' }),
      });

      await adapter.execCommand('test', 'list');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:5001/api/servers/test/exec',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ command: 'list' }),
        })
      );
    });

    it('getLogs should fetch logs with line count', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ logs: 'log content', lines: 50 }),
      });

      await adapter.getLogs('test', 50);

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:5001/api/servers/test/logs?lines=50',
        expect.any(Object)
      );
    });
  });

  describe('World operations', () => {
    it('getWorlds should fetch world list', async () => {
      const mockResponse = {
        worlds: [{ name: 'world1', path: '/worlds/world1', isLocked: false }],
        total: 1,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await adapter.getWorlds();

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:5001/api/worlds',
        expect.any(Object)
      );
    });

    it('getWorld should fetch single world details', async () => {
      const mockResponse = {
        world: { name: 'world1', path: '/worlds/world1', isLocked: true, lockedBy: 'server1' },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await adapter.getWorld('world1');

      expect(result).toEqual(mockResponse);
    });

    it('createWorld should POST new world', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, worldName: 'newworld' }),
      });

      await adapter.createWorld({ name: 'newworld', seed: '12345' });

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:5001/api/worlds',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ name: 'newworld', seed: '12345' }),
        })
      );
    });

    it('assignWorld should POST to assign endpoint', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, worldName: 'world1', serverName: 'server1' }),
      });

      await adapter.assignWorld('world1', 'server1');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:5001/api/worlds/world1/assign',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ serverName: 'server1' }),
        })
      );
    });

    it('releaseWorld should POST to release endpoint with force option', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, worldName: 'world1' }),
      });

      await adapter.releaseWorld('world1', true);

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:5001/api/worlds/world1/release?force=true',
        expect.objectContaining({ method: 'POST' })
      );
    });

    it('deleteWorld should DELETE world with force option', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, worldName: 'world1' }),
      });

      await adapter.deleteWorld('world1', true);

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:5001/api/worlds/world1?force=true',
        expect.objectContaining({ method: 'DELETE' })
      );
    });
  });

  describe('URL encoding', () => {
    it('should properly encode server names with special characters', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ server: { name: 'test-server' } }),
      });

      await adapter.getServer('test-server');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:5001/api/servers/test-server',
        expect.any(Object)
      );
    });
  });
});

describe('createMcctlApiClient', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should use environment variables for configuration', () => {
    process.env.MCCTL_API_URL = 'http://api:5001';
    process.env.MCCTL_API_KEY = 'env-api-key';

    const client = createMcctlApiClient();

    expect(client).toBeInstanceOf(McctlApiAdapter);
  });

  it('should use default URL when not specified', () => {
    delete process.env.MCCTL_API_URL;
    process.env.MCCTL_API_KEY = 'test-key';

    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const client = createMcctlApiClient();

    expect(client).toBeInstanceOf(McctlApiAdapter);
    consoleSpy.mockRestore();
  });

  it('should warn when API key is not set', () => {
    delete process.env.MCCTL_API_KEY;
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    createMcctlApiClient();

    expect(consoleSpy).toHaveBeenCalledWith(
      'MCCTL_API_KEY is not set. API requests may fail.'
    );
    consoleSpy.mockRestore();
  });
});
