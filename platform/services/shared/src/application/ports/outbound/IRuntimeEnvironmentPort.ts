export interface ToolVersion {
  installed: boolean;
  version?: string;
}

/**
 * Runtime Environment Port - Outbound Port (ADR-0001)
 */
export interface IRuntimeEnvironmentPort {
  /** Runtime daemon/cluster reachable. */
  isAvailable(): boolean;
  getEngineVersion(): ToolVersion;
  /** Version without a leading 'v'. */
  getComposeVersion(): ToolVersion;
}
