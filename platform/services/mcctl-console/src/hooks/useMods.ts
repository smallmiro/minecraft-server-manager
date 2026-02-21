import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './useApi';
import type {
  ModListResponse,
  AddModsResponse,
  RemoveModResponse,
  ModSearchResponse,
  ModProjectsResponse,
} from '@/ports/api/IMcctlApiClient';

// ============================================================
// Server Mods Hooks
// ============================================================

/**
 * Hook to fetch installed mods for a server
 */
export function useServerMods(serverName: string, options?: { enabled?: boolean }) {
  return useQuery<ModListResponse, Error>({
    queryKey: ['servers', serverName, 'mods'],
    queryFn: () =>
      apiFetch<ModListResponse>(`/api/servers/${encodeURIComponent(serverName)}/mods`),
    enabled: options?.enabled !== false && !!serverName,
  });
}

/**
 * Hook to search mods on Modrinth
 */
export function useModSearch(
  query: string,
  options?: { limit?: number; offset?: number; enabled?: boolean }
) {
  const params = new URLSearchParams();
  if (query) params.set('q', query);
  if (options?.limit != null) params.set('limit', String(options.limit));
  if (options?.offset != null) params.set('offset', String(options.offset));

  return useQuery<ModSearchResponse, Error>({
    queryKey: ['mods', 'search', query, options?.limit, options?.offset],
    queryFn: () => apiFetch<ModSearchResponse>(`/api/mods/search?${params}`),
    enabled: options?.enabled !== false && !!query.trim(),
  });
}

/**
 * Hook to fetch project details for installed mods (batch)
 */
export function useModProjects(
  slugs: string[],
  options?: { source?: string; enabled?: boolean }
) {
  const slugsKey = slugs.slice().sort().join(',');
  const params = new URLSearchParams();
  if (slugsKey) params.set('slugs', slugsKey);
  if (options?.source) params.set('source', options.source);

  return useQuery<ModProjectsResponse, Error>({
    queryKey: ['mods', 'projects', slugsKey, options?.source],
    queryFn: () => apiFetch<ModProjectsResponse>(`/api/mods/projects?${params}`),
    enabled: options?.enabled !== false && slugs.length > 0,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
}

/**
 * Hook to add mods to a server
 */
export function useAddMod() {
  const queryClient = useQueryClient();

  return useMutation<
    AddModsResponse,
    Error,
    { serverName: string; slugs: string[]; source?: string }
  >({
    mutationFn: ({ serverName, slugs, source }) =>
      apiFetch<AddModsResponse>(
        `/api/servers/${encodeURIComponent(serverName)}/mods`,
        {
          method: 'POST',
          body: JSON.stringify({ slugs, source }),
        }
      ),
    onSuccess: (_, { serverName }) => {
      queryClient.invalidateQueries({ queryKey: ['servers', serverName, 'mods'] });
    },
  });
}

/**
 * Hook to remove a mod from a server
 */
export function useRemoveMod() {
  const queryClient = useQueryClient();

  return useMutation<RemoveModResponse, Error, { serverName: string; slug: string }>({
    mutationFn: ({ serverName, slug }) =>
      apiFetch<RemoveModResponse>(
        `/api/servers/${encodeURIComponent(serverName)}/mods/${encodeURIComponent(slug)}`,
        { method: 'DELETE' }
      ),
    onSuccess: (_, { serverName }) => {
      queryClient.invalidateQueries({ queryKey: ['servers', serverName, 'mods'] });
    },
  });
}
