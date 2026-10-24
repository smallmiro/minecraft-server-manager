import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import { useServers } from './useMcctl';

vi.mock('./useApi', () => ({
  apiFetch: vi.fn(),
}));

import { apiFetch } from './useApi';
const mockApiFetch = vi.mocked(apiFetch);

function setup() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
  return { queryClient, wrapper };
}

describe('useServers (#764)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApiFetch.mockResolvedValue({ servers: [], total: 0 });
  });

  it('fetches /api/servers under the plain key by default', async () => {
    const { queryClient, wrapper } = setup();
    const { result } = renderHook(() => useServers(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockApiFetch).toHaveBeenCalledWith('/api/servers');
    expect(queryClient.getQueryData(['servers'])).toBeDefined();
  });

  it('fetches ?include=summary under a distinct key', async () => {
    const { queryClient, wrapper } = setup();
    const { result } = renderHook(() => useServers({ include: 'summary' }), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockApiFetch).toHaveBeenCalledWith('/api/servers?include=summary');
    expect(queryClient.getQueryData(['servers', { include: 'summary' }])).toBeDefined();
    expect(queryClient.getQueryData(['servers'])).toBeUndefined();
  });

  it('is invalidated by the shared ["servers"] prefix but not by a single-server key', async () => {
    const { queryClient, wrapper } = setup();
    const { result } = renderHook(() => useServers({ include: 'summary' }), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const query = queryClient.getQueryCache().find({ queryKey: ['servers', { include: 'summary' }] })!;

    await queryClient.invalidateQueries({ queryKey: ['servers', 'survival'], exact: true });
    expect(query.state.isInvalidated).toBe(false);

    await queryClient.invalidateQueries({ queryKey: ['servers'] });
    expect(mockApiFetch).toHaveBeenCalledTimes(2);
  });
});
