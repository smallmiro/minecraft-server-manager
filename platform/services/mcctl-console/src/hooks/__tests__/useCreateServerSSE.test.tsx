import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useCreateServerSSE } from '../useCreateServerSSE';
import type { CreateServerRequest } from '@/ports/api/IMcctlApiClient';

// Increase timeout for async tests
const ASYNC_TIMEOUT = 10000;

describe('useCreateServerSSE', () => {
  let queryClient: QueryClient;
  let wrapper: ({ children }: { children: ReactNode }) => JSX.Element;

  beforeEach(() => {
    // Mock global.fetch to avoid actual network requests
    global.fetch = vi.fn();
    // The hook uses useQueryClient(); provide one and a wrapper for renderHook.
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize with default state', () => {
    const { result } = renderHook(() => useCreateServerSSE(), { wrapper });

    expect(result.current.status).toBe('idle');
    expect(result.current.progress).toBe(0);
    expect(result.current.message).toBe('');
    expect(result.current.error).toBeNull();
    expect(result.current.isCreating).toBe(false);
  });

  it('should start server creation', async () => {
    const { result } = renderHook(() => useCreateServerSSE(), { wrapper });

    const serverData: CreateServerRequest = {
      name: 'test-server',
      type: 'PAPER',
      version: '1.21.1',
      memory: '4G',
    };

    // Mock fetch to return success
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    });

    act(() => {
      result.current.createServer(serverData);
    });

    await waitFor(() => {
      expect(result.current.status).toBe('initializing');
      expect(result.current.isCreating).toBe(true);
    }, { timeout: ASYNC_TIMEOUT });
  });

  it('should handle completion', async () => {
    const onSuccess = vi.fn();
    const { result } = renderHook(() => useCreateServerSSE({ onSuccess }), { wrapper });

    const serverData: CreateServerRequest = {
      name: 'test-server',
      type: 'PAPER',
      version: '1.21.1',
      memory: '4G',
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    });

    act(() => {
      result.current.createServer(serverData);
    });

    await waitFor(() => {
      expect(result.current.status).toBe('completed');
      expect(result.current.progress).toBe(100);
      expect(result.current.isCreating).toBe(false);
    }, { timeout: ASYNC_TIMEOUT });

    expect(onSuccess).toHaveBeenCalledWith('test-server');
  });

  it('should invalidate the servers query on completion so the list refreshes', async () => {
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const { result } = renderHook(() => useCreateServerSSE(), { wrapper });

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    });

    act(() => {
      result.current.createServer({
        name: 'test-server',
        type: 'PAPER',
        version: '1.21.1',
        memory: '4G',
      });
    });

    await waitFor(() => {
      expect(result.current.status).toBe('completed');
    }, { timeout: ASYNC_TIMEOUT });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['servers'] });
  });

  it('should handle network errors', async () => {
    const onError = vi.fn();
    const { result } = renderHook(() => useCreateServerSSE({ onError }), { wrapper });

    const serverData: CreateServerRequest = {
      name: 'test-server',
      type: 'PAPER',
      version: '1.21.1',
      memory: '4G',
    };

    // Mock fetch to fail
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

    act(() => {
      result.current.createServer(serverData);
    });

    await waitFor(() => {
      expect(result.current.status).toBe('error');
      expect(result.current.error).toContain('Network error');
      expect(result.current.isCreating).toBe(false);
    }, { timeout: ASYNC_TIMEOUT });

    expect(onError).toHaveBeenCalled();
  });

  it('should handle API errors', async () => {
    const onError = vi.fn();
    const { result } = renderHook(() => useCreateServerSSE({ onError }), { wrapper });

    const serverData: CreateServerRequest = {
      name: 'test-server',
      type: 'PAPER',
      version: '1.21.1',
      memory: '4G',
    };

    // Mock fetch to return error
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      statusText: 'Conflict',
      text: () => Promise.resolve('Server already exists'),
    });

    act(() => {
      result.current.createServer(serverData);
    });

    await waitFor(() => {
      expect(result.current.status).toBe('error');
      expect(result.current.error).toContain('Server already exists');
      expect(result.current.isCreating).toBe(false);
    }, { timeout: ASYNC_TIMEOUT });

    expect(onError).toHaveBeenCalled();
  });

  it('should reset state', async () => {
    const { result } = renderHook(() => useCreateServerSSE(), { wrapper });

    const serverData: CreateServerRequest = {
      name: 'test-server',
      type: 'PAPER',
      version: '1.21.1',
      memory: '4G',
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    });

    act(() => {
      result.current.createServer(serverData);
    });

    await waitFor(() => {
      expect(result.current.isCreating).toBe(true);
    }, { timeout: ASYNC_TIMEOUT });

    // Reset
    act(() => {
      result.current.reset();
    });

    expect(result.current.status).toBe('idle');
    expect(result.current.progress).toBe(0);
    expect(result.current.message).toBe('');
    expect(result.current.error).toBeNull();
    expect(result.current.isCreating).toBe(false);
  });

  it('should not allow multiple simultaneous creations', async () => {
    const { result } = renderHook(() => useCreateServerSSE(), { wrapper });

    const serverData: CreateServerRequest = {
      name: 'test-server',
      type: 'PAPER',
      version: '1.21.1',
      memory: '4G',
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    });

    act(() => {
      result.current.createServer(serverData);
    });

    await waitFor(() => {
      expect(result.current.isCreating).toBe(true);
    }, { timeout: ASYNC_TIMEOUT });

    // Try to create another server
    const anotherServerData: CreateServerRequest = {
      name: 'another-server',
      type: 'VANILLA',
      version: '1.20.4',
      memory: '2G',
    };

    act(() => {
      result.current.createServer(anotherServerData);
    });

    // Should still be creating the first server (fetch called only once)
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('should call onProgress callback', async () => {
    const onProgress = vi.fn();
    const { result } = renderHook(() => useCreateServerSSE({ onProgress }), { wrapper });

    const serverData: CreateServerRequest = {
      name: 'test-server',
      type: 'PAPER',
      version: '1.21.1',
      memory: '4G',
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    });

    act(() => {
      result.current.createServer(serverData);
    });

    await waitFor(() => {
      expect(result.current.status).toBe('completed');
    }, { timeout: ASYNC_TIMEOUT });

    // Should have been called for each status update
    expect(onProgress).toHaveBeenCalled();
    expect(onProgress).toHaveBeenCalledWith('initializing', expect.any(String), 0);
    expect(onProgress).toHaveBeenCalledWith('creating', expect.any(String), 25);
    expect(onProgress).toHaveBeenCalledWith('configuring', expect.any(String), 50);
    expect(onProgress).toHaveBeenCalledWith('starting', expect.any(String), 75);
    expect(onProgress).toHaveBeenCalledWith('completed', expect.any(String), 100);
  });
});
