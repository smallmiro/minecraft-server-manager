import type { IWorldRepository } from '../ports/outbound/IWorldRepository.js';
import type { IBlockScanner } from '../ports/outbound/IBlockScanner.js';
import {
  type IWorldStatsUseCase,
  type AnalyzeOptions,
  AnalysisCancelledError,
} from '../ports/inbound/IWorldStatsUseCase.js';
import { aggregateBlockCounts, type BlockStatsResult } from '../../domain/index.js';

/**
 * World Stats Use Case (#531, Phase 4)
 *
 * Orchestrates a full region block scan and aggregates raw block counts into
 * the cached {@link BlockStatsResult}. The scan itself (and its progress /
 * cancellation) is delegated to an injected {@link IBlockScanner}.
 */
export class WorldStatsUseCase implements IWorldStatsUseCase {
  constructor(
    private readonly worldRepository: IWorldRepository,
    private readonly scanner: IBlockScanner
  ) {}

  async analyze(name: string, options?: AnalyzeOptions): Promise<BlockStatsResult> {
    const world = await this.worldRepository.findByName(name);
    if (!world) {
      throw new Error(`World not found: ${name}`);
    }

    const startedAt = Date.now();
    const outcome = await this.scanner.scanWorld(world.path, {
      onProgress: options?.onProgress,
      signal: options?.signal,
    });
    const durationMs = Date.now() - startedAt;

    if (outcome.cancelled) {
      throw new AnalysisCancelledError();
    }

    return {
      world: name,
      analyzedAt: new Date().toISOString(),
      durationMs,
      dimensions: outcome.dimensions,
      regionsScanned: outcome.regionsScanned,
      ...aggregateBlockCounts(outcome.counts),
    };
  }
}
