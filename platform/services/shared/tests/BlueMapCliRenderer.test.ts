import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  readdirSync,
  existsSync,
  rmSync,
} from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import {
  BlueMapCliRenderer,
  MapRenderError,
  parseProgressLine,
  parseResultJson,
  type RenderSpawn,
} from '../src/infrastructure/adapters/BlueMapCliRenderer.js';
import { execCommandStreaming } from '../src/infrastructure/process.js';

describe('parseProgressLine', () => {
  it('parses a BlueMap progress line with ETA', () => {
    const p = parseProgressLine(
      "[09:25:45 INFO] updating map 'overworld': 33.333% (ETA: 20 seconds)"
    );
    expect(p).toEqual({ map: 'overworld', percent: 33.333, eta: '20 seconds' });
  });

  it('parses a progress line without ETA', () => {
    const p = parseProgressLine("updating map 'nether': 100%");
    expect(p).toEqual({ map: 'nether', percent: 100, eta: undefined });
  });

  it('returns null for non-progress lines', () => {
    expect(parseProgressLine('[INFO] Resources loaded.')).toBeNull();
    expect(parseProgressLine('')).toBeNull();
  });
});

describe('parseResultJson (deprecated)', () => {
  it('extracts the JSON summary even when log lines precede it', () => {
    const stdout = [
      "[INFO] Rendering map for 'survival'...",
      '[INFO] Map rendered: /p/maps/survival/web/index.html',
      '{',
      '  "world": "survival",',
      '  "maps": ["overworld","nether"],',
      '  "webroot": "/p/maps/survival/web",',
      '  "entry": "/p/maps/survival/web/index.html"',
      '}',
    ].join('\n');
    expect(parseResultJson(stdout)).toEqual({
      world: 'survival',
      maps: ['overworld', 'nether'],
      webroot: '/p/maps/survival/web',
      entry: '/p/maps/survival/web/index.html',
    });
  });

  it('throws when no JSON object is present', () => {
    expect(() => parseResultJson('no json here')).toThrow(MapRenderError);
  });
});

// A fake `docker` first on PATH (a Node script, so the renderer's real spawn
// path runs) logs each argv as a JSON line and plays BlueMap's part:
// `image inspect` succeeds only with FAKE_IMAGE_PRESENT=1, the config scaffold
// run writes BlueMap's default config, and the render run streams progress on
// stdout and stderr and writes the webroot (#733).
const FAKE_DOCKER = `#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const args = process.argv.slice(2);
fs.appendFileSync(process.env.FAKE_DOCKER_LOG, JSON.stringify(args) + '\\n');
const mount = (target) => {
  const v = args.find((a) => a.endsWith(':' + target));
  return v && v.slice(0, -(target.length + 1));
};
if (args[0] === 'image') process.exit(process.env.FAKE_IMAGE_PRESENT === '1' ? 0 : 1);
if (args[0] === 'run') {
  const web = mount('/work/web');
  const config = mount('/work/config');
  if (web) {
    if (process.env.FAKE_RENDER_EXIT) {
      console.error('[ERROR] render exploded');
      process.exit(Number(process.env.FAKE_RENDER_EXIT));
    }
    console.log("[INFO] updating map 'overworld': 50% (ETA: 3 seconds)");
    console.error("[INFO] updating map 'overworld': 100%");
    const maps = args[args.indexOf('-m') + 1].split(',').sort();
    fs.writeFileSync(path.join(web, 'index.html'), '<html></html>');
    fs.writeFileSync(path.join(web, 'settings.json'), JSON.stringify({ version: '5.22', maps }));
  } else {
    fs.writeFileSync(path.join(config, 'core.conf'), 'accept-download: false\\nmetrics: true\\ndata: "data"\\n');
    fs.mkdirSync(path.join(config, 'maps'), { recursive: true });
    for (const id of ['overworld', 'nether', 'end']) {
      fs.writeFileSync(path.join(config, 'maps', id + '.conf'), 'default');
    }
  }
}
`;

describe('BlueMapCliRenderer', () => {
  const IMAGE = 'mcctl-bluemap:5.22';
  const user = `${process.getuid!()}:${process.getgid!()}`;
  // Every BlueMap container runs as the host user with a memory ceiling (#662).
  const runPrefix = [
    'run', '--rm', '--user', user, '--memory', '2g',
    '-e', 'JAVA_TOOL_OPTIONS=-XX:MaxRAMPercentage=75',
  ];

  let tmp: string;
  let worldsDir: string;
  let mapsDir: string;
  let dockerDir: string;
  let log: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'bluemap-renderer-'));
    worldsDir = join(tmp, 'worlds');
    mapsDir = join(tmp, 'maps');
    dockerDir = join(tmp, 'docker', 'bluemap');
    log = join(tmp, 'docker.log');
    mkdirSync(join(tmp, 'bin'));
    writeFileSync(join(tmp, 'bin', 'docker'), FAKE_DOCKER, { mode: 0o755 });
    mkdirSync(dockerDir, { recursive: true });
    writeFileSync(join(dockerDir, 'Dockerfile'), 'FROM scratch\n');
    vi.stubEnv('PATH', `${join(tmp, 'bin')}:${process.env.PATH}`);
    vi.stubEnv('FAKE_DOCKER_LOG', log);
    vi.stubEnv('FAKE_IMAGE_PRESENT', '1');
    vi.stubEnv('FAKE_RENDER_EXIT', '');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    rmSync(tmp, { recursive: true, force: true });
  });

  const calls = (): string[][] =>
    existsSync(log)
      ? readFileSync(log, 'utf-8').trim().split('\n').map((l) => JSON.parse(l) as string[])
      : [];
  const renderCall = (): string[] | undefined => calls().find((a) => a.includes('-r'));
  const mkRegion = (dir: string): void => {
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'r.0.0.mca'), '');
  };
  const renderer = (): BlueMapCliRenderer =>
    new BlueMapCliRenderer({ worldsDir, mapsDir, dockerDir });

  it('renders a world named "-lobby": the name only appears inside mount paths, after no option (#728)', async () => {
    mkRegion(join(worldsDir, '-lobby', 'region'));
    mkRegion(join(worldsDir, '-lobby_nether', 'DIM-1', 'region'));

    const result = await renderer().renderWorld('-lobby');

    const web = join(mapsDir, '-lobby', 'web');
    expect(result).toEqual({
      world: '-lobby',
      maps: ['overworld', 'nether'],
      webroot: web,
      entry: join(web, 'index.html'),
    });
    expect(renderCall()).toEqual([
      ...runPrefix,
      '-v', `${join(mapsDir, '-lobby', 'config')}:/work/config`,
      '-v', `${join(mapsDir, '.bluemap-data')}:/work/data`,
      '-v', `${web}:/work/web`,
      '-v', `${join(worldsDir, '-lobby')}:/worlds/overworld:ro`,
      '-v', `${join(worldsDir, '-lobby_nether')}:/worlds/nether:ro`,
      '--', IMAGE, '-c', '/work/config', '-r', '-g', '-m', 'overworld,nether',
    ]);
  });

  it('builds the image only when it is missing', async () => {
    mkRegion(join(worldsDir, 'w', 'region'));

    await renderer().renderWorld('w');
    expect(calls()[0]).toEqual(['image', 'inspect', '--', IMAGE]);
    expect(calls().filter((a) => a[0] === 'build')).toEqual([]);

    rmSync(log);
    vi.stubEnv('FAKE_IMAGE_PRESENT', '0');
    await renderer().renderWorld('w');
    expect(calls().slice(0, 2)).toEqual([
      ['image', 'inspect', '--', IMAGE],
      ['build', '-t', IMAGE, '--', dockerDir],
    ]);
  });

  it('fails with a clear error when the image is missing and there is no Dockerfile', async () => {
    mkRegion(join(worldsDir, 'w', 'region'));
    vi.stubEnv('FAKE_IMAGE_PRESENT', '0');
    rmSync(join(dockerDir, 'Dockerfile'));

    await expect(renderer().renderWorld('w')).rejects.toThrow(/Dockerfile not found/);
    expect(calls().filter((a) => a[0] !== 'image')).toEqual([]);
  });

  it('scaffolds the BlueMap config once, accepts the download, disables metrics and keeps only the rendered maps', async () => {
    mkRegion(join(worldsDir, 'w', 'region'));
    mkRegion(join(worldsDir, 'w', 'DIM1', 'region'));
    const config = join(mapsDir, 'w', 'config');

    await renderer().renderWorld('w');

    expect(calls().filter((a) => a[0] === 'run' && !a.includes('-r'))).toEqual([
      [
        ...runPrefix,
        '-v', `${config}:/work/config`,
        '-v', `${join(mapsDir, '.bluemap-data')}:/work/data`,
        '--', IMAGE, '-c', '/work/config',
      ],
    ]);
    expect(readFileSync(join(config, 'core.conf'), 'utf-8')).toBe(
      'accept-download: true\nmetrics: false\ndata: "data"\n'
    );
    expect(readdirSync(join(config, 'maps')).sort()).toEqual(['end.conf', 'overworld.conf']);
    expect(readFileSync(join(config, 'maps', 'end.conf'), 'utf-8')).toBe(
      'world: "/worlds/end"\ndimension: "minecraft:the_end"\nname: "End"\nstorage: "file"\nsorting: 2\n'
    );

    rmSync(log);
    await renderer().renderWorld('w');
    expect(calls().filter((a) => a[0] === 'run')).toHaveLength(1);
  });

  it('force regenerates the config, keeps the previous web output and passes -f', async () => {
    mkRegion(join(worldsDir, 'w', 'region'));
    await renderer().renderWorld('w');
    const keep = join(mapsDir, 'w', 'web', 'maps', 'overworld', 'tile.png');
    mkdirSync(join(keep, '..'), { recursive: true });
    writeFileSync(keep, 'tile');

    rmSync(log);
    await renderer().renderWorld('w', { force: true });

    expect(calls().filter((a) => a[0] === 'run' && !a.includes('-r'))).toHaveLength(1);
    expect(renderCall()?.slice(-2)).toEqual(['overworld', '-f']);
    expect(existsSync(keep)).toBe(true);
  });

  it('renders only the requested dimensions, skipping those without region data', async () => {
    mkRegion(join(worldsDir, 'w', 'region'));
    mkdirSync(join(worldsDir, 'w', 'DIM-1', 'region'), { recursive: true });

    const result = await renderer().renderWorld('w', { dimensions: [' Overworld', 'nether'] });

    expect(result.maps).toEqual(['overworld']);
    expect(renderCall()?.slice(-1)).toEqual(['overworld']);
  });

  it('rejects an unknown dimension before running docker', async () => {
    mkRegion(join(worldsDir, 'w', 'region'));
    await expect(renderer().renderWorld('w', { dimensions: ['moon'] })).rejects.toThrow(
      /Unknown dimension: 'moon'/
    );
    expect(calls()).toEqual([]);
  });

  it('rejects a missing world, a world without region data, and names outside worlds/', async () => {
    mkdirSync(join(worldsDir, 'empty'), { recursive: true });
    for (const name of ['ghost', 'empty', '..', '.', 'a/b', '']) {
      await expect(renderer().renderWorld(name)).rejects.toBeInstanceOf(MapRenderError);
    }
    expect(calls()).toEqual([]);
  });

  it('streams progress parsed from both stdout and stderr', async () => {
    mkRegion(join(worldsDir, 'w', 'region'));
    const events: number[] = [];

    await renderer().renderWorld('w', undefined, (p) => events.push(p.percent));

    expect(events).toEqual([50, 100]);
  });

  it('rewrites settings.json so the viewer opens on the overworld (#564, #575)', async () => {
    mkRegion(join(worldsDir, 'w', 'region'));
    mkRegion(join(worldsDir, 'w', 'DIM-1', 'region'));
    mkRegion(join(worldsDir, 'w', 'DIM1', 'region'));

    await renderer().renderWorld('w');

    const settings = JSON.parse(readFileSync(join(mapsDir, 'w', 'web', 'settings.json'), 'utf-8'));
    expect(settings).toEqual({ version: '5.22', maps: ['overworld', 'nether', 'end'] });
  });

  it('throws MapRenderError carrying the docker output when the render fails', async () => {
    mkRegion(join(worldsDir, 'w', 'region'));
    vi.stubEnv('FAKE_RENDER_EXIT', '3');

    const err = await renderer().renderWorld('w').catch((e: unknown) => e);

    expect(err).toBeInstanceOf(MapRenderError);
    expect((err as Error).message).toMatch(/render exploded/);
  });

  // Deprecated v2 constructor, kept until v3.0.0 (#736). It derives the paths
  // the way render-map.sh did: <scripts>/.. is the platform root unless
  // MCCTL_ROOT is set, and the build context is ${MCCTL_DOCKER:-<scripts>/../docker}/bluemap.
  describe('deprecated script-path constructor', () => {
    beforeEach(() => {
      vi.stubEnv('MCCTL_ROOT', '');
      vi.stubEnv('MCCTL_DOCKER', '');
    });

    const expectedRender = (): string[] => [
      ...runPrefix,
      '-v', `${join(mapsDir, 'w', 'config')}:/work/config`,
      '-v', `${join(mapsDir, '.bluemap-data')}:/work/data`,
      '-v', `${join(mapsDir, 'w', 'web')}:/work/web`,
      '-v', `${join(worldsDir, 'w')}:/worlds/overworld:ro`,
      '--', IMAGE, '-c', '/work/config', '-r', '-g', '-m', 'overworld',
    ];

    it('renders from the platform root next to the scripts dir', async () => {
      mkRegion(join(worldsDir, 'w', 'region'));
      vi.stubEnv('FAKE_IMAGE_PRESENT', '0');

      const result = await new BlueMapCliRenderer(join(tmp, 'scripts', 'render-map.sh')).renderWorld('w');

      expect(result.webroot).toBe(join(mapsDir, 'w', 'web'));
      expect(calls()[1]).toEqual(['build', '-t', IMAGE, '--', dockerDir]);
      expect(renderCall()).toEqual(expectedRender());
    });

    it('honors MCCTL_ROOT and MCCTL_DOCKER from the old mcctl-api call shape', async () => {
      mkRegion(join(worldsDir, 'w', 'region'));
      vi.stubEnv('FAKE_IMAGE_PRESENT', '0');
      const pkgScripts = join(tmp, 'pkg', 'scripts');

      await new BlueMapCliRenderer(join(pkgScripts, 'render-map.sh'), undefined, {
        cwd: tmp,
        env: {
          ...process.env,
          MCCTL_ROOT: tmp,
          MCCTL_SCRIPTS: pkgScripts,
          MCCTL_DOCKER: join(tmp, 'docker'),
        },
      }).renderWorld('w');

      expect(calls()[1]).toEqual(['build', '-t', IMAGE, '--', dockerDir]);
      expect(renderCall()).toEqual(expectedRender());
    });

    it('reads MCCTL_ROOT and MCCTL_DOCKER from process.env when no spawn env is given', async () => {
      mkRegion(join(worldsDir, 'w', 'region'));
      vi.stubEnv('FAKE_IMAGE_PRESENT', '0');
      vi.stubEnv('MCCTL_ROOT', tmp);
      vi.stubEnv('MCCTL_DOCKER', join(tmp, 'docker'));

      await new BlueMapCliRenderer(join(tmp, 'pkg', 'scripts', 'render-map.sh')).renderWorld('w');

      expect(calls()[1]).toEqual(['build', '-t', IMAGE, '--', dockerDir]);
      expect(renderCall()).toEqual(expectedRender());
    });

    it('runs docker through a custom run with the given spawn options', async () => {
      mkRegion(join(worldsDir, 'w', 'region'));
      const options = { cwd: tmp, env: { ...process.env } };
      const seen: { file: string; options: unknown }[] = [];
      const run: RenderSpawn = (file, args, onLine, opts) => {
        seen.push({ file, options: opts });
        return execCommandStreaming(file, args, onLine, opts);
      };

      await new BlueMapCliRenderer(join(tmp, 'scripts', 'render-map.sh'), run, options).renderWorld('w');

      expect(seen.length).toBe(calls().length);
      expect(seen.every((c) => c.file === 'docker' && c.options === options)).toBe(true);
      expect(renderCall()).toEqual(expectedRender());
    });
  });
});

// The v2 public API stays until v3.0.0 (#736): removed exports come back as
// @deprecated and old call shapes must still compile. Tests are not part of
// `tsc`, so type-check a consumer snippet here.
describe('deprecated v2 BlueMap API (#733, removed in v3.0.0 #736)', () => {
  it('is still exported from the package root', async () => {
    const shared = await import('../src/index.js');
    expect(typeof shared.parseResultJson).toBe('function');
    expect(typeof shared.BlueMapCliRenderer).toBe('function');
  });

  it('old constructor, type exports and v2 DimensionRegionDir objects still type-check', () => {
    const testsDir = dirname(fileURLToPath(import.meta.url));
    const file = join(testsDir, `.bluemap-compat-${process.pid}.ts`);
    writeFileSync(
      file,
      [
        "import { BlueMapCliRenderer, parseResultJson, type DimensionRegionDir, type MapRenderResult, type RenderSpawn, type RenderSpawnOptions } from '../src/index.js';",
        "import { Dimension } from '../src/domain/index.js';",
        "const run: RenderSpawn = async (_file, _args, onStderr) => { onStderr(''); return { code: 0, stdout: '', stderr: '' }; };",
        "const options: RenderSpawnOptions = { cwd: '/p', env: { MCCTL_ROOT: '/p' } };",
        "export const renderers = [",
        "  new BlueMapCliRenderer('/p/scripts/render-map.sh'),",
        "  new BlueMapCliRenderer('/p/scripts/render-map.sh', undefined, options),",
        "  new BlueMapCliRenderer('/p/scripts/render-map.sh', run, options),",
        "  new BlueMapCliRenderer({ worldsDir: '/p/worlds', mapsDir: '/p/maps', dockerDir: '/p/docker/bluemap' }),",
        "];",
        "export const result: MapRenderResult = parseResultJson('{}');",
        "export const region: DimensionRegionDir = { dimension: Dimension.Overworld, dir: '/world/region' };",
      ].join('\n')
    );
    try {
      const { options } = ts.parseJsonConfigFileContent(
        { extends: '../tsconfig.json', compilerOptions: { noEmit: true, rootDir: '..' } },
        ts.sys,
        testsDir
      );
      const program = ts.createProgram([file], options);
      const errors = ts
        .getPreEmitDiagnostics(program)
        .map((d) => ts.flattenDiagnosticMessageText(d.messageText, '\n'));
      expect(errors).toEqual([]);
    } finally {
      rmSync(file, { force: true });
    }
  });
});
