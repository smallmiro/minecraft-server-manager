import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useRouterStatus } from '../useMcctl';
import type { RouterStatusResponse } from '@/ports/api/IMcctlApiClient';

class MockEventSource {
  static instances: MockEventSource[] = [];
  url: string;
  readyState = 0;
  onopen: (() => void) | null = null;
  onerror: (() => void) | null = null;
  listeners = new Map<string, Array<(e: MessageEvent) => void>>();
  close = vi.fn(() => {
    this.readyState = 2;
  });

  constructor(url: string) {
    this.url = url;
    MockEventSource.instances.push(this);
  }

  addEventListener(name: string, cb: (e: MessageEvent) => void) {
    this.listeners.set(name, [...(this.listeners.get(name) ?? []), cb]);
  }

  removeEventListener() {}

  open() {
    this.readyState = 1;
    this.onopen?.();
  }

  emit(name: string, data: unknown) {
    for (const cb of this.listeners.get(name) ?? []) cb({ data: JSON.stringify(data) } as MessageEvent);
  }

  fail() {
    this.onerror?.();
  }
}

const status = (port: number): RouterStatusResponse => ({
  router: { name: 'mc-router', status: 'running', health: 'healthy', port, routes: [] },
});

const mockFetch = vi.fn();

function setup() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
  return { queryClient, wrapper };
}

const refetchInterval = (queryClient: QueryClient) =>
  (queryClient.getQueryCache().find({ queryKey: ['router-status'] })?.observers[0] as any)?.options.refetchInterval;

describe('useRouterStatus (SSE with polling fallback)', () => {
  beforeEach(() => {
    MockEventSource.instances = [];
    vi.stubGlobal('EventSource', MockEventSource);
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve(status(25565)) });
    global.fetch = mockFetch;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('still returns the React Query result for the initial REST fetch', async () => {
    const { wrapper } = setup();
    const { result } = renderHook(() => useRouterStatus(), { wrapper });
    await waitFor(() => expect(result.current.data?.router.port).toBe(25565));
    expect(mockFetch.mock.calls[0][0]).toBe('/api/router/status');
  });

  it('subscribes to the router status stream and writes events into the query cache', async () => {
    const { wrapper, queryClient } = setup();
    const { result } = renderHook(() => useRouterStatus(), { wrapper });
    await waitFor(() => expect(result.current.data).toBeDefined());

    expect(MockEventSource.instances).toHaveLength(1);
    expect(MockEventSource.instances[0].url).toBe('/api/sse/router/status/stream');

    act(() => {
      MockEventSource.instances[0].open();
      MockEventSource.instances[0].emit('router-status', status(25599));
    });

    expect(queryClient.getQueryData(['router-status'])).toEqual(status(25599));
    await waitFor(() => expect(result.current.data?.router.port).toBe(25599));
  });

  it('polls every 30s until the stream is connected, stops while connected, resumes after an error', async () => {
    const { wrapper, queryClient } = setup();
    const { result } = renderHook(() => useRouterStatus(), { wrapper });
    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(refetchInterval(queryClient)).toBe(30000);

    act(() => MockEventSource.instances[0].open());
    await waitFor(() => expect(refetchInterval(queryClient)).toBe(false));

    act(() => MockEventSource.instances[0].fail());
    await waitFor(() => expect(refetchInterval(queryClient)).toBe(30000));

    act(() => MockEventSource.instances[0].open());
    await waitFor(() => expect(refetchInterval(queryClient)).toBe(false));
  });

  it('polls while the server reports failed status polls, and stops again on the next status', async () => {
    const { wrapper, queryClient } = setup();
    const { result } = renderHook(() => useRouterStatus(), { wrapper });
    await waitFor(() => expect(result.current.data).toBeDefined());
    act(() => MockEventSource.instances[0].open());
    await waitFor(() => expect(refetchInterval(queryClient)).toBe(false));

    // The connection stays open, but the server could not read the status
    act(() => MockEventSource.instances[0].emit('router-status-error', { timestamp: 'x' }));
    await waitFor(() => expect(refetchInterval(queryClient)).toBe(30000));

    act(() => MockEventSource.instances[0].emit('router-status', status(25565)));
    await waitFor(() => expect(refetchInterval(queryClient)).toBe(false));
  });

  it('keeps the last data when a fallback refetch fails', async () => {
    const { wrapper } = setup();
    const { result } = renderHook(() => useRouterStatus(), { wrapper });
    await waitFor(() => expect(result.current.data).toBeDefined());

    mockFetch.mockResolvedValue({ ok: false, status: 500, statusText: 'boom', json: () => Promise.resolve({}) });
    await act(async () => {
      await result.current.refetch();
    });
    expect(result.current.data?.router.port).toBe(25565);
  });

  it('opens a single EventSource for several consumers and closes it after the last unmount', async () => {
    const { wrapper } = setup();
    const first = renderHook(() => useRouterStatus(), { wrapper });
    const second = renderHook(() => useRouterStatus(), { wrapper });
    await waitFor(() => expect(first.result.current.data).toBeDefined());

    expect(MockEventSource.instances).toHaveLength(1);

    first.unmount();
    expect(MockEventSource.instances[0].close).not.toHaveBeenCalled();

    second.unmount();
    expect(MockEventSource.instances[0].close).toHaveBeenCalledTimes(1);
  });

  it('reconnects with a fresh EventSource when a consumer mounts after everything closed', async () => {
    const { wrapper } = setup();
    renderHook(() => useRouterStatus(), { wrapper }).unmount();
    renderHook(() => useRouterStatus(), { wrapper });
    expect(MockEventSource.instances).toHaveLength(2);
  });

  it('falls back to polling when EventSource is not supported', async () => {
    vi.stubGlobal('EventSource', undefined);
    const { wrapper, queryClient } = setup();
    const { result } = renderHook(() => useRouterStatus(), { wrapper });
    await waitFor(() => expect(result.current.data?.router.port).toBe(25565));
    expect(refetchInterval(queryClient)).toBe(30000);
  });
});
