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
  /** isAvailable for request paths (#672): awaited, with a timeout. */
  isAvailableAsync(): Promise<boolean>;
  getEngineVersion(): ToolVersion;
  /** Version without a leading 'v'. */
  getComposeVersion(): ToolVersion;
}
