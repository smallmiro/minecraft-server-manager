import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './useApi';

/**
 * User-server permission entry
 */
export interface UserServerEntry {
  id: string;
  userId: string;
  serverId: string;
  permission: 'view' | 'manage' | 'admin';
  createdAt: string;
  updatedAt: string;
  user?: {
    id: string;
    name: string;
    email: string;
    image?: string | null;
  };
}

/**
 * Response type for listing users with server access
 */
export interface UserServerListResponse {
  users: UserServerEntry[];
  total: number;
}

/**
 * Request body for granting access
 */
export interface GrantAccessRequest {
  userId: string;
  serverId: string;
  permission: 'view' | 'manage' | 'admin';
}

/**
 * Request body for updating permission
 */
export interface UpdatePermissionRequest {
  permission: 'view' | 'manage' | 'admin';
}

/**
 * User search result
 */
export interface UserSearchResult {
  id: string;
  name: string;
  email: string;
  image?: string | null;
}

/**
 * Response type for user search
 */
export interface UserSearchResponse {
  users: UserSearchResult[];
}

// ============================================================
// User-Server Permission Hooks
// ============================================================

/**
 * Hook to fetch users with access to a server
 * @param serverId - Server ID
 */
export function useServerUsers(serverId: string, options?: { enabled?: boolean }) {
  return useQuery<UserServerListResponse, Error>({
    queryKey: ['user-servers', serverId],
    queryFn: () =>
      apiFetch<UserServerListResponse>(
        `/api/user-servers?serverId=${encodeURIComponent(serverId)}`
      ),
    enabled: options?.enabled !== false && !!serverId,
  });
}

/**
 * Hook to grant access to a user for a server
 */
export function useGrantAccess() {
  const queryClient = useQueryClient();

  return useMutation<UserServerEntry, Error, GrantAccessRequest>({
    mutationFn: (data) =>
      apiFetch<UserServerEntry>('/api/user-servers', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: (_, variables) => {
      // Invalidate user-servers query for this server
      queryClient.invalidateQueries({ queryKey: ['user-servers', variables.serverId] });
      // Also invalidate the generic user-servers key
      queryClient.invalidateQueries({ queryKey: ['user-servers'] });
    },
  });
}

/**
 * Hook to update user permission for a server
 */
export function useUpdatePermission() {
  const queryClient = useQueryClient();

  return useMutation<
    UserServerEntry,
    Error,
    { id: string; permission: 'view' | 'manage' | 'admin' }
  >({
    mutationFn: ({ id, permission }) =>
      apiFetch<UserServerEntry>(`/api/user-servers/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ permission }),
      }),
    onSuccess: () => {
      // Invalidate all user-servers queries
      queryClient.invalidateQueries({ queryKey: ['user-servers'] });
    },
  });
}

/**
 * Hook to revoke user access to a server
 */
export function useRevokeAccess() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: (id) =>
      apiFetch<void>(`/api/user-servers/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      // Invalidate all user-servers queries
      queryClient.invalidateQueries({ queryKey: ['user-servers'] });
    },
  });
}

/**
 * Hook to search users (for autocomplete)
 * @param query - Search query (name or email)
 */
export function useSearchUsers(query: string, options?: { enabled?: boolean }) {
  return useQuery<UserSearchResponse, Error>({
    queryKey: ['users', 'search', query],
    queryFn: () =>
      apiFetch<UserSearchResponse>(`/api/users?q=${encodeURIComponent(query)}`),
    enabled: options?.enabled !== false && query.length >= 2, // Only search if query is at least 2 characters
    staleTime: 30000, // Cache for 30 seconds
  });
}
