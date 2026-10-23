/**
 * playit.gg Agent Port - Outbound Port (ADR-0001)
 */
export interface IPlayitAgentPort {
  start(): Promise<{ success: boolean; error?: string }>;
  stop(): Promise<boolean>;
}
