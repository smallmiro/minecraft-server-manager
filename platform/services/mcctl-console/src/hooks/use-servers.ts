import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryResult,
  type UseMutationResult,
} from '@tanstack/react-query';
import { api, ApiError } from '@/lib/api-client';
import type {
  Server,
  ServersResponse,
  ServerActionResponse,
  CommandResponse,
} from '@/types/server';

/**
 * Query keys for server-related queries
 */
export const serverKeys = {
  all: ['servers'] as const,
  lists: () => [...serverKeys.all, 'list'] as const,
  list: () => [...serverKeys.lists()] as const,
  details: () => [...serverKeys.all, 'detail'] as const,
  detail: (name: string) => [...serverKeys.details(), name] as const,
};

/**
 * Hook options
 */
interface UseServersOptions {
  /** Refetch interval in milliseconds (default: 5000) */
  refetchInterval?: number;
  /** Enable/disable the query */
  enabled?: boolean;
}

/**
 * Hook to fetch all servers
 *
 * @example
 * const { data, isLoading, error } = useServers();
 * if (data) {
 *   console.log(data.servers);
 * }
 */
export function useServers(
  options: UseServersOptions = {}
): UseQueryResult<ServersResponse, ApiError> {
  const { refetchInterval = 5000, enabled = true } = options;

  return useQuery({
    queryKey: serverKeys.list(),
    queryFn: () => api.get<ServersResponse>('/servers'),
    refetchInterval,
    enabled,
  });
}

/**
 * Hook to fetch a single server by name
 *
 * @example
 * const { data: server, isLoading } = useServer('myserver');
 */
export function useServer(
  name: string,
  options: UseServersOptions = {}
): UseQueryResult<Server, ApiError> {
  const { refetchInterval = 5000, enabled = true } = options;

  return useQuery({
    queryKey: serverKeys.detail(name),
    queryFn: () => api.get<Server>(`/servers/${name}`),
    refetchInterval,
    enabled: enabled && !!name,
  });
}

/**
 * Hook to start a server
 *
 * @example
 * const startServer = useStartServer();
 * startServer.mutate('myserver');
 */
export function useStartServer(): UseMutationResult<
  ServerActionResponse,
  ApiError,
  string
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (name: string) =>
      api.post<ServerActionResponse>(`/servers/${name}/start`, {}),
    onSuccess: (_data, name) => {
      // Invalidate both the list and the specific server
      queryClient.invalidateQueries({ queryKey: serverKeys.list() });
      queryClient.invalidateQueries({ queryKey: serverKeys.detail(name) });
    },
  });
}

/**
 * Hook to stop a server
 *
 * @example
 * const stopServer = useStopServer();
 * stopServer.mutate('myserver');
 */
export function useStopServer(): UseMutationResult<
  ServerActionResponse,
  ApiError,
  string
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (name: string) =>
      api.post<ServerActionResponse>(`/servers/${name}/stop`, {}),
    onSuccess: (_data, name) => {
      queryClient.invalidateQueries({ queryKey: serverKeys.list() });
      queryClient.invalidateQueries({ queryKey: serverKeys.detail(name) });
    },
  });
}

/**
 * Hook to restart a server
 *
 * @example
 * const restartServer = useRestartServer();
 * restartServer.mutate('myserver');
 */
export function useRestartServer(): UseMutationResult<
  ServerActionResponse,
  ApiError,
  string
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (name: string) =>
      api.post<ServerActionResponse>(`/servers/${name}/restart`, {}),
    onSuccess: (_data, name) => {
      queryClient.invalidateQueries({ queryKey: serverKeys.list() });
      queryClient.invalidateQueries({ queryKey: serverKeys.detail(name) });
    },
  });
}

/**
 * Command execution parameters
 */
interface ExecuteCommandParams {
  serverName: string;
  command: string;
}

/**
 * Hook to execute a command on a server via RCON
 *
 * @example
 * const executeCommand = useExecuteCommand();
 * executeCommand.mutate({ serverName: 'myserver', command: 'say Hello!' });
 */
export function useExecuteCommand(): UseMutationResult<
  CommandResponse,
  ApiError,
  ExecuteCommandParams
> {
  return useMutation({
    mutationFn: ({ serverName, command }: ExecuteCommandParams) =>
      api.post<CommandResponse>(`/servers/${serverName}/command`, { command }),
  });
}

/**
 * Hook to delete a server
 *
 * @example
 * const deleteServer = useDeleteServer();
 * deleteServer.mutate('myserver');
 */
export function useDeleteServer(): UseMutationResult<
  ServerActionResponse,
  ApiError,
  string
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (name: string) =>
      api.delete<ServerActionResponse>(`/servers/${name}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: serverKeys.list() });
    },
  });
}
