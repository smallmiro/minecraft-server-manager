import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import {
  useServerUsers,
  useGrantAccess,
  useUpdatePermission,
  useRevokeAccess,
  useSearchUsers,
} from '../useUserServers';

// Mock fetch globally
const mockFetch = vi.fn();

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe('useUserServers hooks', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  describe('useServerUsers', () => {
    it('should fetch users for a server', async () => {
      const mockResponse = {
        users: [
          {
            id: 'us-1',
            userId: 'user-1',
            serverId: 'server-1',
            permission: 'admin',
            user: { id: 'user-1', name: 'Admin', email: 'admin@test.com' },
          },
        ],
        total: 1,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const { result } = renderHook(
        () => useServerUsers('server-1'),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.data).toBeDefined();
      });

      expect(result.current.data?.users).toHaveLength(1);
      expect(result.current.data?.users[0].permission).toBe('admin');
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/user-servers?serverId=server-1',
        expect.any(Object)
      );
    });

    it('should not fetch when serverId is empty', () => {
      renderHook(
        () => useServerUsers(''),
        { wrapper: createWrapper() }
      );

      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('useGrantAccess', () => {
    it('should grant access to a user', async () => {
      const mockResponse = {
        id: 'us-new',
        userId: 'user-1',
        serverId: 'server-1',
        permission: 'view',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const { result } = renderHook(
        () => useGrantAccess(),
        { wrapper: createWrapper() }
      );

      result.current.mutate({
        userId: 'user-1',
        serverId: 'server-1',
        permission: 'view',
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/user-servers',
        expect.objectContaining({ method: 'POST' })
      );
    });
  });

  describe('useUpdatePermission', () => {
    it('should update permission level', async () => {
      const mockResponse = {
        id: 'us-1',
        userId: 'user-1',
        serverId: 'server-1',
        permission: 'manage',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const { result } = renderHook(
        () => useUpdatePermission(),
        { wrapper: createWrapper() }
      );

      result.current.mutate({ id: 'us-1', permission: 'manage' });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/user-servers/us-1',
        expect.objectContaining({ method: 'PATCH' })
      );
    });
  });

  describe('useRevokeAccess', () => {
    it('should revoke access', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(undefined),
      });

      const { result } = renderHook(
        () => useRevokeAccess(),
        { wrapper: createWrapper() }
      );

      result.current.mutate('us-1');

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/user-servers/us-1',
        expect.objectContaining({ method: 'DELETE' })
      );
    });
  });

  describe('useSearchUsers', () => {
    it('should search users when query has 2+ characters', async () => {
      const mockResponse = {
        users: [
          { id: 'u-1', name: 'John', email: 'john@test.com', image: null },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const { result } = renderHook(
        () => useSearchUsers('jo'),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.data).toBeDefined();
      });

      expect(result.current.data?.users).toHaveLength(1);
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/users?q=jo',
        expect.any(Object)
      );
    });

    it('should not search when query is less than 2 characters', () => {
      renderHook(
        () => useSearchUsers('j'),
        { wrapper: createWrapper() }
      );

      expect(mockFetch).not.toHaveBeenCalled();
    });
  });
});
