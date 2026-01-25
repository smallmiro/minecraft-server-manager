/**
 * API client for BFF proxy endpoints
 */

import type { ServerDetail, ServerLogs, ServerActionResponse, ServersResponse } from '@/types/server';

const API_BASE = '/api/proxy';

class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public data?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new ApiError(
      errorData.message || `API Error: ${response.status}`,
      response.status,
      errorData
    );
  }

  return response.json();
}

/**
 * Server API endpoints
 */
export const serverApi = {
  /**
   * Get all servers
   */
  getServers: (): Promise<ServersResponse> => {
    return fetchApi<ServersResponse>('/servers');
  },

  /**
   * Get server details by name
   */
  getServer: (name: string): Promise<ServerDetail> => {
    return fetchApi<ServerDetail>(`/servers/${encodeURIComponent(name)}`);
  },

  /**
   * Get server logs
   */
  getLogs: (name: string, lines: number = 50): Promise<ServerLogs> => {
    return fetchApi<ServerLogs>(`/servers/${encodeURIComponent(name)}/logs?lines=${lines}`);
  },

  /**
   * Start a server
   */
  startServer: (name: string): Promise<ServerActionResponse> => {
    return fetchApi<ServerActionResponse>(`/servers/${encodeURIComponent(name)}/start`, {
      method: 'POST',
    });
  },

  /**
   * Stop a server
   */
  stopServer: (name: string): Promise<ServerActionResponse> => {
    return fetchApi<ServerActionResponse>(`/servers/${encodeURIComponent(name)}/stop`, {
      method: 'POST',
    });
  },

  /**
   * Restart a server
   */
  restartServer: (name: string): Promise<ServerActionResponse> => {
    return fetchApi<ServerActionResponse>(`/servers/${encodeURIComponent(name)}/restart`, {
      method: 'POST',
    });
  },
};

export { ApiError };
