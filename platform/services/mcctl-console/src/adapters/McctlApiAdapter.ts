import {
  IMcctlApiClient,
  ServerListResponse,
  ServerDetailResponse,
  CreateServerRequest,
  CreateServerResponse,
  DeleteServerResponse,
  ActionResponse,
  ExecCommandResponse,
  LogsResponse,
  WorldListResponse,
  WorldDetailResponse,
  CreateWorldRequest,
  CreateWorldResponse,
  AssignWorldResponse,
  ReleaseWorldResponse,
  DeleteWorldResponse,
  ServerConfigResponse,
  UpdateServerConfigRequest,
  UpdateServerConfigResponse,
  WorldResetResponse,
  ApiError,
} from '../ports/api/IMcctlApiClient';

/**
 * API Error class for mcctl-api errors
 */
export class McctlApiError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly error: string,
    message: string
  ) {
    super(message);
    this.name = 'McctlApiError';
  }
}

/**
 * User context for request headers
 */
export interface UserContext {
  username: string;
  role: string;
}

/**
 * Configuration for McctlApiAdapter
 */
export interface McctlApiConfig {
  baseUrl: string;
  apiKey: string;
  userContext?: UserContext;
}

/**
 * McctlApiAdapter - Implementation of IMcctlApiClient
 * Communicates with mcctl-api using X-API-Key authentication
 */
export class McctlApiAdapter implements IMcctlApiClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly userContext?: UserContext;

  constructor(config: McctlApiConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, ''); // Remove trailing slash
    this.apiKey = config.apiKey;
    this.userContext = config.userContext;
  }

  /**
   * Internal fetch wrapper with authentication
   */
  private async fetch<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    // Build headers with optional user context
    const headers: Record<string, string> = {
      'X-API-Key': this.apiKey,
    };

    // Only set Content-Type when there's a body
    if (options.body) {
      headers['Content-Type'] = 'application/json';
    }

    // Add user context headers if available
    if (this.userContext) {
      headers['X-User'] = this.userContext.username;
      headers['X-Role'] = this.userContext.role;
    }

    const response = await fetch(url, {
      ...options,
      headers: {
        ...headers,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({
        error: 'UnknownError',
        message: response.statusText,
      })) as ApiError;

      throw new McctlApiError(
        response.status,
        errorBody.error,
        errorBody.message
      );
    }

    return response.json() as Promise<T>;
  }

  // ============================================================
  // Server Operations
  // ============================================================

  async getServers(): Promise<ServerListResponse> {
    return this.fetch<ServerListResponse>('/api/servers');
  }

  async getServer(name: string): Promise<ServerDetailResponse> {
    return this.fetch<ServerDetailResponse>(`/api/servers/${encodeURIComponent(name)}`);
  }

  async createServer(request: CreateServerRequest): Promise<CreateServerResponse> {
    return this.fetch<CreateServerResponse>('/api/servers', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  async deleteServer(name: string, force?: boolean): Promise<DeleteServerResponse> {
    const query = force ? '?force=true' : '';
    return this.fetch<DeleteServerResponse>(
      `/api/servers/${encodeURIComponent(name)}${query}`,
      { method: 'DELETE' }
    );
  }

  async startServer(name: string): Promise<ActionResponse> {
    return this.fetch<ActionResponse>(
      `/api/servers/${encodeURIComponent(name)}/start`,
      { method: 'POST' }
    );
  }

  async stopServer(name: string): Promise<ActionResponse> {
    return this.fetch<ActionResponse>(
      `/api/servers/${encodeURIComponent(name)}/stop`,
      { method: 'POST' }
    );
  }

  async restartServer(name: string): Promise<ActionResponse> {
    return this.fetch<ActionResponse>(
      `/api/servers/${encodeURIComponent(name)}/restart`,
      { method: 'POST' }
    );
  }

  async execCommand(serverName: string, command: string): Promise<ExecCommandResponse> {
    return this.fetch<ExecCommandResponse>(
      `/api/servers/${encodeURIComponent(serverName)}/exec`,
      {
        method: 'POST',
        body: JSON.stringify({ command }),
      }
    );
  }

  async getLogs(serverName: string, lines: number = 100): Promise<LogsResponse> {
    return this.fetch<LogsResponse>(
      `/api/servers/${encodeURIComponent(serverName)}/logs?lines=${lines}`
    );
  }

  // ============================================================
  // World Operations
  // ============================================================

  async getWorlds(): Promise<WorldListResponse> {
    return this.fetch<WorldListResponse>('/api/worlds');
  }

  async getWorld(name: string): Promise<WorldDetailResponse> {
    return this.fetch<WorldDetailResponse>(`/api/worlds/${encodeURIComponent(name)}`);
  }

  async createWorld(request: CreateWorldRequest): Promise<CreateWorldResponse> {
    return this.fetch<CreateWorldResponse>('/api/worlds', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  async assignWorld(worldName: string, serverName: string): Promise<AssignWorldResponse> {
    return this.fetch<AssignWorldResponse>(
      `/api/worlds/${encodeURIComponent(worldName)}/assign`,
      {
        method: 'POST',
        body: JSON.stringify({ serverName }),
      }
    );
  }

  async releaseWorld(worldName: string, force?: boolean): Promise<ReleaseWorldResponse> {
    const query = force ? '?force=true' : '';
    return this.fetch<ReleaseWorldResponse>(
      `/api/worlds/${encodeURIComponent(worldName)}/release${query}`,
      { method: 'POST' }
    );
  }

  async deleteWorld(worldName: string, force?: boolean): Promise<DeleteWorldResponse> {
    const query = force ? '?force=true' : '';
    return this.fetch<DeleteWorldResponse>(
      `/api/worlds/${encodeURIComponent(worldName)}${query}`,
      { method: 'DELETE' }
    );
  }

  // ============================================================
  // Server Configuration Operations
  // ============================================================

  async getServerConfig(serverName: string): Promise<ServerConfigResponse> {
    return this.fetch<ServerConfigResponse>(
      `/api/servers/${encodeURIComponent(serverName)}/config`
    );
  }

  async updateServerConfig(
    serverName: string,
    config: UpdateServerConfigRequest
  ): Promise<UpdateServerConfigResponse> {
    return this.fetch<UpdateServerConfigResponse>(
      `/api/servers/${encodeURIComponent(serverName)}/config`,
      {
        method: 'PATCH',
        body: JSON.stringify(config),
      }
    );
  }

  async resetWorld(serverName: string): Promise<WorldResetResponse> {
    return this.fetch<WorldResetResponse>(
      `/api/servers/${encodeURIComponent(serverName)}/world/reset`,
      { method: 'POST' }
    );
  }
}

/**
 * Create a McctlApiAdapter instance from environment variables
 * @param userContext Optional user context for X-User and X-Role headers
 */
export function createMcctlApiClient(userContext?: UserContext): McctlApiAdapter {
  const baseUrl = process.env.MCCTL_API_URL || 'http://localhost:5001';
  const apiKey = process.env.MCCTL_API_KEY || '';

  if (!apiKey) {
    console.warn('MCCTL_API_KEY is not set. API requests may fail.');
  }

  return new McctlApiAdapter({ baseUrl, apiKey, userContext });
}
