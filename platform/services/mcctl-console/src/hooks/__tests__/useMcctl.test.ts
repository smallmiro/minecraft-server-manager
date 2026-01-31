import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import {
  useServers,
  useServer,
  useCreateServer,
  useDeleteServer,
  useStartServer,
  useStopServer,
  useRestartServer,
  useExecCommand,
  useServerLogs,
  useWorlds,
  useWorld,
  useCreateWorld,
  useAssignWorld,
  useReleaseWorld,
  useDeleteWorld,
} from '../useMcctl';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Create a wrapper with QueryClient
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe('useMcctl hooks', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  describe('useServers', () => {
    it('should fetch servers list', async () => {
      const mockData = {
        servers: [{ name: 'test', container: 'mc-test', status: 'running', health: 'healthy', hostname: 'test.local' }],
        total: 1,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockData),
      });

      const { result } = renderHook(() => useServers(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockData);
    });

    it('should handle error state', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: () => Promise.resolve({ error: 'InternalServerError', message: 'Failed' }),
      });

      const { result } = renderHook(() => useServers(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });
    });
  });

  describe('useServer', () => {
    it('should fetch single server', async () => {
      const mockData = {
        server: {
          name: 'test',
          container: 'mc-test',
          status: 'running',
          health: 'healthy',
          hostname: 'test.local',
          type: 'PAPER',
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockData),
      });

      const { result } = renderHook(() => useServer('test'), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockData);
    });

    it('should not fetch when name is empty', async () => {
      const { result } = renderHook(() => useServer(''), { wrapper: createWrapper() });

      expect(result.current.fetchStatus).toBe('idle');
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('useCreateServer', () => {
    it('should create a new server', async () => {
      const mockResponse = {
        success: true,
        server: { name: 'newserver', container: 'mc-newserver', status: 'starting' },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const { result } = renderHook(() => useCreateServer(), { wrapper: createWrapper() });

      result.current.mutate({ name: 'newserver', type: 'PAPER', version: '1.21.1' });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockResponse);
    });
  });

  describe('useDeleteServer', () => {
    it('should delete a server', async () => {
      const mockResponse = { success: true, server: 'test', message: 'Deleted' };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const { result } = renderHook(() => useDeleteServer(), { wrapper: createWrapper() });

      result.current.mutate({ name: 'test', force: true });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/servers/test?force=true',
        expect.objectContaining({ method: 'DELETE' })
      );
    });
  });

  describe('useStartServer', () => {
    it('should start a server', async () => {
      const mockResponse = { success: true, server: 'test', action: 'start', timestamp: '2024-01-01' };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const { result } = renderHook(() => useStartServer(), { wrapper: createWrapper() });

      result.current.mutate('test');

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/servers/test/start',
        expect.objectContaining({ method: 'POST' })
      );
    });
  });

  describe('useStopServer', () => {
    it('should stop a server', async () => {
      const mockResponse = { success: true, server: 'test', action: 'stop', timestamp: '2024-01-01' };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const { result } = renderHook(() => useStopServer(), { wrapper: createWrapper() });

      result.current.mutate('test');

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });
    });
  });

  describe('useRestartServer', () => {
    it('should restart a server', async () => {
      const mockResponse = { success: true, server: 'test', action: 'restart', timestamp: '2024-01-01' };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const { result } = renderHook(() => useRestartServer(), { wrapper: createWrapper() });

      result.current.mutate('test');

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });
    });
  });

  describe('useExecCommand', () => {
    it('should execute RCON command', async () => {
      const mockResponse = { success: true, output: 'There are 0 players online' };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const { result } = renderHook(() => useExecCommand(), { wrapper: createWrapper() });

      result.current.mutate({ serverName: 'test', command: 'list' });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockResponse);
    });
  });

  describe('useServerLogs', () => {
    it('should fetch server logs', async () => {
      const mockResponse = { logs: 'Server started', lines: 1 };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const { result } = renderHook(() => useServerLogs('test', 50), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/servers/test/logs?lines=50',
        expect.any(Object)
      );
    });
  });

  describe('useWorlds', () => {
    it('should fetch worlds list', async () => {
      const mockData = {
        worlds: [{ name: 'world1', path: '/worlds/world1', isLocked: false }],
        total: 1,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockData),
      });

      const { result } = renderHook(() => useWorlds(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockData);
    });
  });

  describe('useWorld', () => {
    it('should fetch single world', async () => {
      const mockData = {
        world: { name: 'world1', path: '/worlds/world1', isLocked: true, lockedBy: 'server1' },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockData),
      });

      const { result } = renderHook(() => useWorld('world1'), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockData);
    });
  });

  describe('useCreateWorld', () => {
    it('should create a new world', async () => {
      const mockResponse = { success: true, worldName: 'newworld', seed: '12345' };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const { result } = renderHook(() => useCreateWorld(), { wrapper: createWrapper() });

      result.current.mutate({ name: 'newworld', seed: '12345' });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockResponse);
    });
  });

  describe('useAssignWorld', () => {
    it('should assign world to server', async () => {
      const mockResponse = { success: true, worldName: 'world1', serverName: 'server1' };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const { result } = renderHook(() => useAssignWorld(), { wrapper: createWrapper() });

      result.current.mutate({ worldName: 'world1', serverName: 'server1' });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockResponse);
    });
  });

  describe('useReleaseWorld', () => {
    it('should release world lock', async () => {
      const mockResponse = { success: true, worldName: 'world1', previousServer: 'server1' };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const { result } = renderHook(() => useReleaseWorld(), { wrapper: createWrapper() });

      result.current.mutate({ worldName: 'world1', force: false });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockResponse);
    });
  });

  describe('useDeleteWorld', () => {
    it('should delete a world', async () => {
      const mockResponse = { success: true, worldName: 'world1', size: '100MB' };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const { result } = renderHook(() => useDeleteWorld(), { wrapper: createWrapper() });

      result.current.mutate({ name: 'world1', force: true });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/worlds/world1?force=true',
        expect.objectContaining({ method: 'DELETE' })
      );
    });
  });
});
