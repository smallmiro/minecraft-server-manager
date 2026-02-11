import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { usePlayitStatus, useStartPlayit, useStopPlayit } from '../usePlayit';
import * as useApi from '../useApi';
import { createElement } from 'react';
import type { ReactNode } from 'react';

// Mock useApi
vi.mock('../useApi', () => ({
  apiFetch: vi.fn(),
}));

describe('usePlayit hooks', () => {
  let queryClient: QueryClient;

  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    vi.clearAllMocks();
  });

  describe('usePlayitStatus', () => {
    const mockStatus = {
      enabled: true,
      agentRunning: true,
      secretKeyConfigured: true,
      containerStatus: 'running' as const,
      uptime: '2h 30m',
      uptimeSeconds: 9000,
      servers: [
        { serverName: 'survival', playitDomain: 'aa.example.com', lanHostname: 'survival.192.168.1.5.nip.io' },
        { serverName: 'creative', playitDomain: null, lanHostname: 'creative.192.168.1.5.nip.io' },
      ],
    };

    it('should fetch playit status', async () => {
      vi.mocked(useApi.apiFetch).mockResolvedValue(mockStatus);

      const { result } = renderHook(() => usePlayitStatus(), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toEqual(mockStatus);
      expect(useApi.apiFetch).toHaveBeenCalledWith('/api/playit/status');
    });

    it('should handle fetch error', async () => {
      const error = new Error('Failed to fetch');
      vi.mocked(useApi.apiFetch).mockRejectedValue(error);

      const { result } = renderHook(() => usePlayitStatus(), { wrapper });

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(result.current.error).toEqual(error);
    });

    it('should be loading initially', () => {
      vi.mocked(useApi.apiFetch).mockResolvedValue(mockStatus);

      const { result } = renderHook(() => usePlayitStatus(), { wrapper });

      expect(result.current.isLoading).toBe(true);
    });
  });

  describe('useStartPlayit', () => {
    it('should start playit agent', async () => {
      const mockResponse = { success: true, message: 'playit-agent started' };
      vi.mocked(useApi.apiFetch).mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useStartPlayit(), { wrapper });

      result.current.mutate();

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toEqual(mockResponse);
      expect(useApi.apiFetch).toHaveBeenCalledWith('/api/playit/start', { method: 'POST' });
    });

    it('should invalidate playit-status query on success', async () => {
      const mockResponse = { success: true, message: 'playit-agent started' };
      vi.mocked(useApi.apiFetch).mockResolvedValue(mockResponse);

      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(() => useStartPlayit(), { wrapper });

      result.current.mutate();

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['playit-status'] });
    });

    it('should handle start error', async () => {
      const error = new Error('Failed to start');
      vi.mocked(useApi.apiFetch).mockRejectedValue(error);

      const { result } = renderHook(() => useStartPlayit(), { wrapper });

      result.current.mutate();

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(result.current.error).toEqual(error);
    });
  });

  describe('useStopPlayit', () => {
    it('should stop playit agent', async () => {
      const mockResponse = { success: true, message: 'playit-agent stopped' };
      vi.mocked(useApi.apiFetch).mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useStopPlayit(), { wrapper });

      result.current.mutate();

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toEqual(mockResponse);
      expect(useApi.apiFetch).toHaveBeenCalledWith('/api/playit/stop', { method: 'POST' });
    });

    it('should invalidate playit-status query on success', async () => {
      const mockResponse = { success: true, message: 'playit-agent stopped' };
      vi.mocked(useApi.apiFetch).mockResolvedValue(mockResponse);

      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(() => useStopPlayit(), { wrapper });

      result.current.mutate();

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['playit-status'] });
    });
  });
});
