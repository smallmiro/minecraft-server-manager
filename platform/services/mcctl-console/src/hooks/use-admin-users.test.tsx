import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock adminClient
vi.mock('@/lib/auth-client', () => ({
  adminClient: {
    listUsers: vi.fn(),
  },
}));

import { useAdminUsers } from './use-admin-users';
import { adminClient } from '@/lib/auth-client';

const mockAdminClient = adminClient as unknown as {
  listUsers: ReturnType<typeof vi.fn>;
};

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  Wrapper.displayName = 'TestWrapper';
  return Wrapper;
};

describe('useAdminUsers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch users successfully', async () => {
    const mockUsers = [
      {
        id: '1',
        email: 'admin@example.com',
        name: 'Admin User',
        role: 'admin',
        banned: false,
        createdAt: new Date('2024-01-01'),
      },
      {
        id: '2',
        email: 'user@example.com',
        name: 'Regular User',
        role: 'user',
        banned: false,
        createdAt: new Date('2024-01-02'),
      },
    ];

    mockAdminClient.listUsers.mockResolvedValue({
      data: { users: mockUsers },
      error: null,
    });

    const { result } = renderHook(() => useAdminUsers(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockUsers);
    expect(mockAdminClient.listUsers).toHaveBeenCalledTimes(1);
  });

  it('should handle error when fetching users fails', async () => {
    mockAdminClient.listUsers.mockResolvedValue({
      data: null,
      error: {
        message: 'Unauthorized',
      },
    });

    const { result } = renderHook(() => useAdminUsers(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBeDefined();
    expect(mockAdminClient.listUsers).toHaveBeenCalledTimes(1);
  });

  it('should return empty array when no users exist', async () => {
    mockAdminClient.listUsers.mockResolvedValue({
      data: { users: [] },
      error: null,
    });

    const { result } = renderHook(() => useAdminUsers(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual([]);
  });
});
