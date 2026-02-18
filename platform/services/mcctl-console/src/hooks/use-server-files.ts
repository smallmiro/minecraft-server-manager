'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './useApi';
import type {
  FileListResponse,
  FileContentResponse,
  FileWriteResponse,
  FileActionResponse,
  FileRenameResponse,
} from '@/ports/api/IMcctlApiClient';

/**
 * Hook to list files in a server directory
 */
export function useServerFiles(serverName: string, path: string = '/') {
  return useQuery<FileListResponse, Error>({
    queryKey: ['servers', serverName, 'files', path],
    queryFn: () => {
      const params = new URLSearchParams({ path });
      return apiFetch<FileListResponse>(
        `/api/servers/${encodeURIComponent(serverName)}/files?${params}`
      );
    },
    enabled: !!serverName,
  });
}

/**
 * Hook to read a file's content
 */
export function useFileContent(serverName: string, path: string | null) {
  return useQuery<FileContentResponse, Error>({
    queryKey: ['servers', serverName, 'files', 'content', path],
    queryFn: () => {
      const params = new URLSearchParams({ path: path! });
      return apiFetch<FileContentResponse>(
        `/api/servers/${encodeURIComponent(serverName)}/files/read?${params}`
      );
    },
    enabled: !!serverName && !!path,
  });
}

/**
 * Hook to write file content
 */
export function useWriteFile(serverName: string) {
  const queryClient = useQueryClient();

  return useMutation<FileWriteResponse, Error, { path: string; content: string }>({
    mutationFn: ({ path, content }) => {
      const params = new URLSearchParams({ path });
      return apiFetch<FileWriteResponse>(
        `/api/servers/${encodeURIComponent(serverName)}/files/write?${params}`,
        { method: 'PUT', body: JSON.stringify({ content }) }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['servers', serverName, 'files'] });
    },
  });
}

/**
 * Hook to delete a file or directory
 */
export function useDeleteFile(serverName: string) {
  const queryClient = useQueryClient();

  return useMutation<FileActionResponse, Error, { path: string }>({
    mutationFn: ({ path }) => {
      const params = new URLSearchParams({ path });
      return apiFetch<FileActionResponse>(
        `/api/servers/${encodeURIComponent(serverName)}/files?${params}`,
        { method: 'DELETE' }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['servers', serverName, 'files'] });
    },
  });
}

/**
 * Hook to create a directory
 */
export function useCreateDirectory(serverName: string) {
  const queryClient = useQueryClient();

  return useMutation<FileActionResponse, Error, { path: string }>({
    mutationFn: ({ path }) => {
      const params = new URLSearchParams({ path });
      return apiFetch<FileActionResponse>(
        `/api/servers/${encodeURIComponent(serverName)}/files/mkdir?${params}`,
        { method: 'POST' }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['servers', serverName, 'files'] });
    },
  });
}

/**
 * Hook to rename a file or directory
 */
export function useRenameFile(serverName: string) {
  const queryClient = useQueryClient();

  return useMutation<FileRenameResponse, Error, { oldPath: string; newPath: string }>({
    mutationFn: ({ oldPath, newPath }) =>
      apiFetch<FileRenameResponse>(
        `/api/servers/${encodeURIComponent(serverName)}/files/rename`,
        { method: 'POST', body: JSON.stringify({ oldPath, newPath }) }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['servers', serverName, 'files'] });
    },
  });
}
