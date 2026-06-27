import { spawn } from 'node:child_process';
import type {
  IMapRenderer,
  MapRenderOptions,
  MapRenderProgress,
  MapRenderResult,
} from '../../application/ports/outbound/IMapRenderer.js';

/** Process options (working directory / environment) for the render script. */
export interface RenderSpawnOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
}

/**
 * Spawns the render script and resolves once it exits, capturing stdout and
 * streaming stderr lines (which carry BlueMap's progress output) to
 * {@link onStderr}. Injectable so the adapter can be unit-tested without
 * Docker or a real child process.
 */
export type RenderSpawn = (
  file: string,
  args: string[],
  onStderr: (line: string) => void,
  options?: RenderSpawnOptions
) => Promise<{ code: number; stdout: string; stderr: string }>;

/** Thrown when the render script exits with a non-zero status. */
export class MapRenderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MapRenderError';
  }
}

const PROGRESS_RE =
  /updating map '([^']+)':\s*([\d.]+)%(?:\s*\(ETA:\s*([^)]+)\))?/;

/**
 * Parse a BlueMap progress line such as
 * `updating map 'overworld': 33.333% (ETA: 20 seconds)`. Returns null for
 * lines that are not progress reports.
 */
export function parseProgressLine(line: string): MapRenderProgress | null {
  const match = line.match(PROGRESS_RE);
  if (!match) return null;
  return {
    map: match[1]!,
    percent: parseFloat(match[2]!),
    eta: match[3]?.trim(),
  };
}

/**
 * Extract the `--json` summary emitted by render-map.sh from captured stdout.
 * The script may print human-readable log lines before the JSON object, so we
 * slice out the single brace-delimited block.
 */
export function parseResultJson(stdout: string): MapRenderResult {
  const start = stdout.indexOf('{');
  const end = stdout.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) {
    throw new MapRenderError(`No JSON summary found in render output`);
  }
  return JSON.parse(stdout.slice(start, end + 1)) as MapRenderResult;
}

const defaultSpawn: RenderSpawn = (file, args, onStderr, options) =>
  new Promise((resolve, reject) => {
    const child = spawn(file, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      cwd: options?.cwd,
      env: options?.env,
    });
    let stdout = '';
    let stderr = '';
    let stderrBuf = '';

    child.stdout.setEncoding('utf-8');
    child.stdout.on('data', (chunk: string) => {
      stdout += chunk;
    });

    child.stderr.setEncoding('utf-8');
    child.stderr.on('data', (chunk: string) => {
      stderr += chunk;
      stderrBuf += chunk;
      // Emit complete lines as they arrive so progress streams in real time.
      let nl: number;
      while ((nl = stderrBuf.indexOf('\n')) !== -1) {
        onStderr(stderrBuf.slice(0, nl));
        stderrBuf = stderrBuf.slice(nl + 1);
      }
    });

    child.on('error', reject);
    child.on('close', (code) => {
      if (stderrBuf.length > 0) onStderr(stderrBuf);
      resolve({ code: code ?? 0, stdout, stderr });
    });
  });

/**
 * {@link IMapRenderer} backed by the BlueMap CLI via `scripts/render-map.sh`.
 *
 * The script auto-detects present dimensions, renders them in Docker, and
 * prints a JSON summary on stdout while streaming BlueMap progress on stderr.
 */
export class BlueMapCliRenderer implements IMapRenderer {
  /**
   * @param scriptPath Absolute path to `render-map.sh`.
   * @param run Spawn implementation (defaults to a real child process).
   * @param spawnOptions Working directory / environment for the script
   *   (e.g. `MCCTL_ROOT`/`MCCTL_SCRIPTS` so it resolves the right data dir).
   */
  constructor(
    private readonly scriptPath: string,
    private readonly run: RenderSpawn = defaultSpawn,
    private readonly spawnOptions: RenderSpawnOptions = {}
  ) {}

  async renderWorld(
    worldName: string,
    options?: MapRenderOptions,
    onProgress?: (progress: MapRenderProgress) => void
  ): Promise<MapRenderResult> {
    const args = [worldName, '--json'];
    if (options?.force) args.push('--force');
    if (options?.dimensions?.length) {
      args.push('--dimensions', options.dimensions.join(','));
    }

    const { code, stdout, stderr } = await this.run(
      this.scriptPath,
      args,
      (line) => {
        if (!onProgress) return;
        const progress = parseProgressLine(line);
        if (progress) onProgress(progress);
      },
      this.spawnOptions
    );

    if (code !== 0) {
      const detail = stderr.trim().slice(-500) || `exit code ${code}`;
      throw new MapRenderError(`Map render failed: ${detail}`);
    }

    return parseResultJson(stdout);
  }
}
