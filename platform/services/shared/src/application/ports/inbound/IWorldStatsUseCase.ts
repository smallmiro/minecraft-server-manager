import type { BlockStatsResult } from '../../../domain/index.js';
import type { BlockScanProgress } from '../outbound/IBlockScanner.js';

/**
 * World Stats Use Case - Inbound Port (#531, Phase 4)
 *
 * Drives a full region block scan and aggregates the result. Cancellable and
 * progress-reporting because the scan is expensive on large worlds.
 */

export class AnalysisCancelledError extends Error {
  constructor() {
    super('World stats analysis was cancelled');
    this.name = 'AnalysisCancelledError';
  }
}

export interface AnalyzeOptions {
  onProgress?: (progress: BlockScanProgress) => void;
  signal?: AbortSignal;
}

export interface IWorldStatsUseCase {
  /**
   * Run a full block-stats analysis for a world.
   * @throws AnalysisCancelledError when the scan is aborted via the signal.
   * @throws Error when the world does not exist.
   */
  analyze(name: string, options?: AnalyzeOptions): Promise<BlockStatsResult>;
}
