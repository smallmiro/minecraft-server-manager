/**
 * Block Scanner Port - Outbound Port (#531, Phase 4)
 *
 * Abstraction over a full region block scan: decodes every chunk section's
 * block-state palette and counts blocks by id across all present dimensions.
 * Expensive, so it reports progress and is cancellable via an AbortSignal.
 */

export interface BlockScanProgress {
  /** Dimension currently being scanned. */
  dimension: string;
  /** Region files completed so far (across all dimensions). */
  regionsDone: number;
  /** Total region files to scan (across all dimensions). */
  regionsTotal: number;
}

export interface BlockScanOutcome {
  /** Raw block id → count across all scanned dimensions. */
  counts: Record<string, number>;
  /** Dimensions that were scanned. */
  dimensions: string[];
  /** Region files actually scanned. */
  regionsScanned: number;
  /** True when the scan stopped early due to cancellation. */
  cancelled: boolean;
}

export interface BlockScanOptions {
  onProgress?: (progress: BlockScanProgress) => void;
  signal?: AbortSignal;
}

export interface IBlockScanner {
  /**
   * Scan a world's region data and count blocks by id.
   * @param worldPath Absolute path to the world directory.
   * @param options Progress callback and abort signal.
   */
  scanWorld(worldPath: string, options?: BlockScanOptions): Promise<BlockScanOutcome>;
}
