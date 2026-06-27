/**
 * Map Renderer Port - Outbound Port
 *
 * Abstraction over offline web-map generation for a world. The default
 * adapter ({@link BlueMapCliRenderer}) shells out to the BlueMap CLI
 * (`scripts/render-map.sh` running BlueMap in Docker), which renders all
 * present dimensions to a static, pan/zoom-able webroot. BlueMap runs
 * standalone (no Minecraft server required), so this is safe to use
 * alongside mc-router auto-scaling.
 */

/** Progress event emitted while a map renders. */
export interface MapRenderProgress {
  /** Map/dimension id being rendered (`overworld` | `nether` | `end`). */
  map: string;
  /** Completion percentage for that map (0-100). */
  percent: number;
  /** Estimated time remaining as reported by BlueMap (e.g. `"20 seconds"`). */
  eta?: string;
}

/** Result of a successful world render. */
export interface MapRenderResult {
  /** World that was rendered. */
  world: string;
  /** Dimensions that were rendered (`overworld` | `nether` | `end`). */
  maps: string[];
  /** Absolute path to the generated webroot. */
  webroot: string;
  /** Absolute path to the iframe entry point (`index.html`). */
  entry: string;
}

/** Options controlling a render. */
export interface MapRenderOptions {
  /** Limit to specific dimensions; defaults to all present in the world. */
  dimensions?: string[];
  /** Force a full re-render, discarding cached tiles for the world. */
  force?: boolean;
}

export interface IMapRenderer {
  /**
   * Render a world's web map. Resolves with the output location once the
   * render completes, and reports incremental progress via {@link onProgress}.
   *
   * @param worldName World under `worlds/` to render.
   * @param options Dimension/force options.
   * @param onProgress Optional callback invoked per progress update.
   * @throws When the underlying renderer exits with a non-zero status.
   */
  renderWorld(
    worldName: string,
    options?: MapRenderOptions,
    onProgress?: (progress: MapRenderProgress) => void
  ): Promise<MapRenderResult>;
}
