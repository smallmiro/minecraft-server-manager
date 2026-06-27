import { describe, it, expect } from 'vitest';
import {
  BlueMapCliRenderer,
  MapRenderError,
  parseProgressLine,
  parseResultJson,
  type RenderSpawn,
} from '../src/infrastructure/adapters/BlueMapCliRenderer.js';

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

describe('parseResultJson', () => {
  it('extracts the JSON summary even when log lines precede it', () => {
    const stdout = [
      '[INFO] Rendering map for \'survival\'...',
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
    expect(() => parseResultJson('no json here')).toThrow();
  });
});

describe('BlueMapCliRenderer', () => {
  const okResult = (world: string, maps: string[]) =>
    JSON.stringify({
      world,
      maps,
      webroot: `/p/maps/${world}/web`,
      entry: `/p/maps/${world}/web/index.html`,
    });

  it('invokes the script with --json and returns the parsed result', async () => {
    let captured: { file: string; args: string[] } | null = null;
    const spawn: RenderSpawn = async (file, args) => {
      captured = { file, args };
      return { code: 0, stdout: okResult('survival', ['overworld']), stderr: '' };
    };
    const renderer = new BlueMapCliRenderer('/scripts/render-map.sh', spawn);

    const result = await renderer.renderWorld('survival');

    expect(captured).toEqual({
      file: '/scripts/render-map.sh',
      args: ['survival', '--json'],
    });
    expect(result.world).toBe('survival');
    expect(result.maps).toEqual(['overworld']);
    expect(result.entry).toBe('/p/maps/survival/web/index.html');
  });

  it('forwards --force and --dimensions options', async () => {
    let args: string[] = [];
    const spawn: RenderSpawn = async (_file, a) => {
      args = a;
      return { code: 0, stdout: okResult('w', ['overworld', 'nether']), stderr: '' };
    };
    const renderer = new BlueMapCliRenderer('/s.sh', spawn);

    await renderer.renderWorld('w', { force: true, dimensions: ['overworld', 'nether'] });

    expect(args).toEqual([
      'w',
      '--json',
      '--force',
      '--dimensions',
      'overworld,nether',
    ]);
  });

  it('streams progress events parsed from stderr', async () => {
    const spawn: RenderSpawn = async (_file, _args, onStderr) => {
      onStderr("[INFO] updating map 'overworld': 25% (ETA: 30 seconds)");
      onStderr('[INFO] Loading resources...');
      onStderr("[INFO] updating map 'overworld': 100%");
      return { code: 0, stdout: okResult('w', ['overworld']), stderr: '' };
    };
    const renderer = new BlueMapCliRenderer('/s.sh', spawn);

    const events: number[] = [];
    await renderer.renderWorld('w', undefined, (p) => events.push(p.percent));

    expect(events).toEqual([25, 100]);
  });

  it('passes cwd/env spawn options through to a custom runner', async () => {
    let seen: { cwd?: string; env?: NodeJS.ProcessEnv } | undefined;
    const spawn: RenderSpawn = async (_file, _args, _onStderr, opts) => {
      seen = opts;
      return { code: 0, stdout: okResult('w', ['overworld']), stderr: '' };
    };
    const renderer = new BlueMapCliRenderer('/s.sh', spawn, {
      cwd: '/platform',
      env: { MCCTL_ROOT: '/platform' },
    });

    await renderer.renderWorld('w');

    expect(seen?.cwd).toBe('/platform');
    expect(seen?.env?.['MCCTL_ROOT']).toBe('/platform');
  });

  it('throws MapRenderError on a non-zero exit', async () => {
    const spawn: RenderSpawn = async () => ({
      code: 1,
      stdout: '',
      stderr: '[ERROR] World not found',
    });
    const renderer = new BlueMapCliRenderer('/s.sh', spawn);

    await expect(renderer.renderWorld('missing')).rejects.toBeInstanceOf(
      MapRenderError
    );
  });
});
