'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  PlatformSettingsResponse,
  PlatformSettingsUpdateRequest,
  PlatformSettingsUpdateResponse,
} from '@/types/platform-settings';

export const PLATFORM_SETTINGS_KEY = ['platform-settings'] as const;

/** Error that keeps the HTTP status and the parsed body (400 field errors, 409 currentRevision). */
export class PlatformSettingsError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly body: unknown
  ) {
    super(message);
    this.name = 'PlatformSettingsError';
  }
}

async function request<T>(init?: RequestInit): Promise<T> {
  const response = await fetch('/api/platform-settings', {
    ...init,
    cache: 'no-store',
    headers: init?.body ? { 'Content-Type': 'application/json' } : undefined,
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new PlatformSettingsError(
      response.status,
      (body as { message?: string } | null)?.message ?? response.statusText,
      body
    );
  }
  return body as T;
}

/** Platform settings query. Pass `enabled: false` for non-admins so no request is made. */
export function usePlatformSettings(options: { enabled: boolean }) {
  return useQuery<PlatformSettingsResponse, PlatformSettingsError>({
    queryKey: PLATFORM_SETTINGS_KEY,
    queryFn: () => request<PlatformSettingsResponse>(),
    enabled: options.enabled,
    retry: false,
    refetchOnWindowFocus: false,
  });
}

export function useUpdatePlatformSettings() {
  const queryClient = useQueryClient();
  return useMutation<PlatformSettingsUpdateResponse, PlatformSettingsError, PlatformSettingsUpdateRequest>({
    mutationFn: (payload) =>
      request<PlatformSettingsUpdateResponse>({ method: 'PUT', body: JSON.stringify(payload) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PLATFORM_SETTINGS_KEY }),
  });
}
