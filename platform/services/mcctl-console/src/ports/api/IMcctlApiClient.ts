/**
 * API Client Interface for mcctl-api communication
 * Port interface for the BFF proxy layer
 */

export interface ServerSummary {
  name: string;
  container: string;
  status: 'running' | 'stopped' | 'created' | 'exited' | 'unknown';
  health: 'healthy' | 'unhealthy' | 'starting' | 'none' | 'unknown';
  hostname: string;
}

export interface ServerStats {
  cpuPercent: number;
  memoryUsage: number;
  memoryLimit: number;
  memoryPercent: number;
}

export interface ServerDetail extends ServerSummary {
  type?: string;
  version?: string;
  memory?: string;
  uptime?: string;
  uptimeSeconds?: number;
  players?: {
    online: number;
    max: number;
    list: string[];
  };
  stats?: ServerStats;
  worldName?: string;
  worldSize?: string;
}

export interface ServerListResponse {
  servers: ServerSummary[];
  total: number;
}

export interface ServerDetailResponse {
  server: ServerDetail;
}

export interface CreateServerRequest {
  name: string;
  type?: string;
  version?: string;
  memory?: string;
  seed?: string;
  worldUrl?: string;
  worldName?: string;
  autoStart?: boolean;
}

export interface CreateServerResponse {
  success: boolean;
  server: {
    name: string;
    container: string;
    status: string;
  };
}

export interface DeleteServerResponse {
  success: boolean;
  server: string;
  message: string;
}

export interface ActionResponse {
  success: boolean;
  server: string;
  action: 'start' | 'stop' | 'restart';
  timestamp: string;
  message?: string;
  error?: string;
}

export interface ExecCommandRequest {
  command: string;
}

export interface ExecCommandResponse {
  success: boolean;
  output: string;
}

export interface LogsResponse {
  logs: string;
  lines: number;
}

export interface World {
  name: string;
  path: string;
  isLocked: boolean;
  lockedBy?: string;
  size?: string;
  lastModified?: string;
}

export interface WorldListResponse {
  worlds: World[];
  total: number;
}

export interface WorldDetailResponse {
  world: World;
}

export interface CreateWorldRequest {
  name: string;
  seed?: string;
  serverName?: string;
  autoStart?: boolean;
}

export interface CreateWorldResponse {
  success: boolean;
  worldName: string;
  seed?: string;
  serverName?: string;
  started?: boolean;
}

export interface AssignWorldRequest {
  serverName: string;
}

export interface AssignWorldResponse {
  success: boolean;
  worldName: string;
  serverName: string;
}

export interface ReleaseWorldResponse {
  success: boolean;
  worldName: string;
  previousServer?: string;
}

export interface DeleteWorldResponse {
  success: boolean;
  worldName: string;
  size?: string;
}

export interface ApiError {
  error: string;
  message: string;
}

/**
 * mcctl-api Client Interface
 * Defines the contract for API communication
 */
export interface IMcctlApiClient {
  // Server operations
  getServers(): Promise<ServerListResponse>;
  getServer(name: string): Promise<ServerDetailResponse>;
  createServer(request: CreateServerRequest): Promise<CreateServerResponse>;
  deleteServer(name: string, force?: boolean): Promise<DeleteServerResponse>;
  startServer(name: string): Promise<ActionResponse>;
  stopServer(name: string): Promise<ActionResponse>;
  restartServer(name: string): Promise<ActionResponse>;
  execCommand(serverName: string, command: string): Promise<ExecCommandResponse>;
  getLogs(serverName: string, lines?: number): Promise<LogsResponse>;

  // World operations
  getWorlds(): Promise<WorldListResponse>;
  getWorld(name: string): Promise<WorldDetailResponse>;
  createWorld(request: CreateWorldRequest): Promise<CreateWorldResponse>;
  assignWorld(worldName: string, serverName: string): Promise<AssignWorldResponse>;
  releaseWorld(worldName: string, force?: boolean): Promise<ReleaseWorldResponse>;
  deleteWorld(worldName: string, force?: boolean): Promise<DeleteWorldResponse>;
}
