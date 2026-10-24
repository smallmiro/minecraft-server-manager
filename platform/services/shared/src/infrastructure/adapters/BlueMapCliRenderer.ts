import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import type {
  IMapRenderer,
  MapRenderOptions,
  MapRenderProgress,
  MapRenderResult,
} from '../../application/ports/outbound/IMapRenderer.js';
import { Dimension } from '../../domain/index.js';
import { execCommandStreaming } from '../process.js';
import { resolveRegionDirs } from './dimensionRegions.js';

/** BlueMap CLI image, built from `docker/bluemap/Dockerfile` (same version as its BLUEMAP_VERSION). */
const IMAGE = 'mcctl-bluemap:5.22';

/**
 * Memory ceiling for BlueMap containers (#662). The JVM only takes 25% of the
 * container limit for its heap by default, so let it use 75%.
 */
const MEMORY_ARGS = ['--memory', '2g', '-e', 'JAVA_TOOL_OPTIONS=-XX:MaxRAMPercentage=75'];

/** Map id -> Minecraft dimension id, viewer name, and viewer order. */
const MAPS: Record<Dimension, { dimension: string; name: string; sorting: number }> = {
  [Dimension.Overworld]: { dimension: 'minecraft:overworld', name: 'Overworld', sorting: 0 },
  [Dimension.Nether]: { dimension: 'minecraft:the_nether', name: 'Nether', sorting: 1 },
  [Dimension.End]: { dimension: 'minecraft:the_end', name: 'End', sorting: 2 },
};

/** Thrown when a world cannot be rendered. */
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

/** Directories the renderer reads from and writes to. */
export interface BlueMapCliRendererPaths {
  /** Directory holding the worlds (`<root>/worlds`). */
  worldsDir: string;
  /** Output directory (`<root>/maps`), kept out of worlds/ so backups stay lean. */
  mapsDir: string;
  /** BlueMap image build context (holds the Dockerfile), used only when the image is missing. */
  dockerDir: string;
}

/**
 * {@link IMapRenderer} that runs the BlueMap CLI in Docker. BlueMap runs
 * standalone (no Minecraft server needed), so this works with mc-router
 * auto-scaling.
 *
 * Output per world:
 *   maps/<world>/web/      web map (index.html is the iframe entry point)
 *   maps/<world>/config/   generated BlueMap config
 *   maps/.bluemap-data/    shared render cache (Minecraft client jar, textures)
 *
 * Docker is run with argv arrays (no shell) and `--` before the image, so a
 * world name such as `-lobby` only ever appears inside mount paths (#728).
 */
export class BlueMapCliRenderer implements IMapRenderer {
  constructor(private readonly paths: BlueMapCliRendererPaths) {}

  async renderWorld(
    worldName: string,
    options?: MapRenderOptions,
    onProgress?: (progress: MapRenderProgress) => void
  ): Promise<MapRenderResult> {
    const { worldsDir, mapsDir, dockerDir } = this.paths;
    // A name must be one path segment: maps/<name>/config is deleted on --force.
    if (dirname(resolve(worldsDir, worldName)) !== resolve(worldsDir)) {
      throw new MapRenderError(`Invalid world name: '${worldName}'`);
    }
    const worldRoot = join(worldsDir, worldName);
    if (!existsSync(worldRoot)) {
      throw new MapRenderError(`World not found: ${worldRoot}`);
    }

    const requested = options?.dimensions?.length
      ? options.dimensions.map((d) => d.trim().toLowerCase())
      : Object.keys(MAPS);
    const roots = resolveRegionDirs(worldRoot);
    const maps: Dimension[] = [];
    const worldMounts: string[] = [];
    for (const id of new Set(requested)) {
      if (!Object.hasOwn(MAPS, id)) {
        throw new MapRenderError(`Unknown dimension: '${id}' (expected overworld|nether|end)`);
      }
      // Dimensions without region data are skipped (#575).
      const root = roots.find((r) => r.dimension === id)?.root;
      if (!root) continue;
      maps.push(id as Dimension);
      worldMounts.push('-v', `${root}:/worlds/${id}:ro`);
    }
    if (maps.length === 0) {
      throw new MapRenderError(`No renderable dimensions found for world '${worldName}'`);
    }

    await this.ensureImage(dockerDir);

    const configDir = join(mapsDir, worldName, 'config');
    const webDir = join(mapsDir, worldName, 'web');
    const dataDir = join(mapsDir, '.bluemap-data');
    // Force regenerates the config but keeps the web output, so a failed
    // re-render does not destroy the working map; `-f` overwrites tiles.
    if (options?.force) rmSync(configDir, { recursive: true, force: true });
    // Create bind-mount dirs as the host user; Docker would create them as root.
    for (const dir of [configDir, webDir, dataDir]) mkdirSync(dir, { recursive: true });

    // Run as the host user so generated files stay owned by the caller.
    const run = [
      'run', '--rm', '--user', `${process.getuid!()}:${process.getgid!()}`, ...MEMORY_ARGS,
      '-v', `${configDir}:/work/config`, '-v', `${dataDir}:/work/data`,
    ];

    // Scaffold BlueMap's default config once, then patch the parts we control.
    const coreConf = join(configDir, 'core.conf');
    if (!existsSync(coreConf)) await this.docker([...run, '--', IMAGE, '-c', '/work/config']);
    if (!existsSync(coreConf)) {
      throw new MapRenderError(`Failed to generate BlueMap config in ${configDir}`);
    }
    // Accept Mojang's EULA for the texture download and disable metrics.
    writeFileSync(
      coreConf,
      readFileSync(coreConf, 'utf-8')
        .replace(/^accept-download: false/gm, 'accept-download: true')
        .replace(/^metrics: true/gm, 'metrics: false')
    );
    const mapsConfDir = join(configDir, 'maps');
    rmSync(mapsConfDir, { recursive: true, force: true });
    mkdirSync(mapsConfDir);
    for (const id of maps) {
      const m = MAPS[id];
      writeFileSync(
        join(mapsConfDir, `${id}.conf`),
        `world: "/worlds/${id}"\ndimension: "${m.dimension}"\nname: "${m.name}"\nstorage: "file"\nsorting: ${m.sorting}\n`
      );
    }

    const renderArgs = ['-c', '/work/config', '-r', '-g', '-m', maps.join(',')];
    if (options?.force) renderArgs.push('-f');
    const { code, stdout, stderr } = await this.docker(
      [...run, '-v', `${webDir}:/work/web`, ...worldMounts, '--', IMAGE, ...renderArgs],
      (line) => {
        const progress = onProgress && parseProgressLine(line);
        if (progress) onProgress(progress);
      }
    );
    if (code !== 0) {
      const detail = (stderr.trim() || stdout.trim()).slice(-500) || `exit code ${code}`;
      const hint = code === 137 ? ' (killed: out of memory?)' : '';
      throw new MapRenderError(`Map render failed${hint}: ${detail}`);
    }

    const entry = join(webDir, 'index.html');
    if (!existsSync(entry)) {
      throw new MapRenderError(`Render finished but ${entry} is missing`);
    }
    // BlueMap lists maps alphabetically and the viewer opens the first one,
    // ignoring `sorting`; keep our order so it opens on the overworld (#564, #575).
    const settings = join(webDir, 'settings.json');
    if (existsSync(settings)) {
      writeFileSync(
        settings,
        readFileSync(settings, 'utf-8').replace(/"maps":\[[^\]]*\]/, `"maps":${JSON.stringify(maps)}`)
      );
    }

    return { world: worldName, maps, webroot: webDir, entry };
  }

  /** Build the BlueMap image unless it already exists. */
  private async ensureImage(dockerDir: string): Promise<void> {
    if ((await this.docker(['image', 'inspect', '--', IMAGE])).code === 0) return;
    if (!existsSync(join(dockerDir, 'Dockerfile'))) {
      throw new MapRenderError(`BlueMap Dockerfile not found at ${join(dockerDir, 'Dockerfile')}`);
    }
    const build = await this.docker(['build', '-t', IMAGE, '--', dockerDir]);
    if (build.code !== 0) {
      throw new MapRenderError(`BlueMap image build failed: ${build.stderr.trim().slice(-500)}`);
    }
  }

  private docker(args: string[], onLine: (line: string) => void = () => {}) {
    return execCommandStreaming('docker', args, onLine);
  }
}
