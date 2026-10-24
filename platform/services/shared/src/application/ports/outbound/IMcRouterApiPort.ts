/** One entry of mc-router's route table (#768). */
export interface McRouterRoute {
  /** Backend address, e.g. `mc-alpha:25565`. */
  backend: string;
  /** Workload auto-scale acts on, when mc-router reports one. */
  scalingTarget?: string;
}

/**
 * mc-router management API - Outbound Port (#768)
 */
export interface IMcRouterApiPort {
  /**
   * Routes mc-router currently serves, keyed by server address as reported.
   * null when the API is unreachable, slow, non-200 or returns invalid data.
   */
  listRoutes(): Promise<Map<string, McRouterRoute> | null>;
}
