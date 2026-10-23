/**
 * `mcctl migrate spec [<name>|--all] [--dry-run] [--force] [--json]` (#675,
 * ADR-0003 §4): explicit import of existing servers into server.yaml.
 * Real temp platform, real FileServerSpecRepository.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { migrateCommand } from '../../../src/commands/migrate.js';

let root: string;
let output: string[];

const COMPOSE = (name: string) =>
  `services:\n  mc-${name}:\n    image: itzg/minecraft-server:java25\n    labels:\n      mc-router.host: "${name}.local"\n      mc-router.auto-scale-up: "true"\n      mc-router.auto-scale-down: "true"\n`;

function server(name: string, configEnv: string, compose = COMPOSE(name)): void {
  mkdirSync(join(root, 'servers', name), { recursive: true });
  writeFileSync(join(root, 'servers', name, 'config.env'), configEnv);
  writeFileSync(join(root, 'servers', name, 'docker-compose.yml'), compose);
}

const specFile = (name: string) => join(root, 'servers', name, 'server.yaml');
const run = (opts: Record<string, unknown>) => migrateCommand({ root, subCommand: 'spec', ...opts });

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'mcctl-cli-migrate-spec-'));
  writeFileSync(join(root, 'docker-compose.yml'), 'services: {}\n');
  mkdirSync(join(root, 'servers'));
  output = [];
  const capture = (...args: unknown[]) => {
    output.push(args.map(String).join(' '));
  };
  vi.spyOn(console, 'log').mockImplementation(capture);
  vi.spyOn(console, 'error').mockImplementation(capture);
});

afterEach(() => {
  vi.restoreAllMocks();
  rmSync(root, { recursive: true, force: true });
});

describe('mcctl migrate spec', () => {
  it('--dry-run reports the import and writes nothing', async () => {
    server('alpha', 'TYPE=PAPER\nLEVEL=alpha\n');

    expect(await run({ serverName: 'alpha', dryRun: true })).toBe(0);
    expect(existsSync(specFile('alpha'))).toBe(false);
    const text = output.join('\n');
    expect(text).toMatch(/alpha.*would import/);
    expect(text).toMatch(/EXTRA_ARGS.*pin/);
  });

  it('writes server.yaml, then reports it as already imported', async () => {
    server('alpha', 'TYPE=PAPER\nLEVEL=alpha\nEXTRA_ARGS=--universe /worlds/\nMEMORY=4G\n');

    expect(await run({ serverName: 'alpha' })).toBe(0);
    const written = readFileSync(specFile('alpha'), 'utf-8');
    expect(written).toContain('memory: 4G');
    expect(output.join('\n')).toMatch(/alpha.*imported/);

    output = [];
    expect(await run({ serverName: 'alpha' })).toBe(0);
    expect(output.join('\n')).toMatch(/alpha.*already imported/);
    expect(readFileSync(specFile('alpha'), 'utf-8')).toBe(written);
  });

  it('--force re-imports from config.env and compose, also over a broken server.yaml', async () => {
    server('alpha', 'TYPE=PAPER\nEXTRA_ARGS=\nMEMORY=4G\n');
    await run({ serverName: 'alpha' });
    writeFileSync(join(root, 'servers', 'alpha', 'config.env'), 'TYPE=PAPER\nEXTRA_ARGS=\nMEMORY=6G\n');
    writeFileSync(specFile('alpha'), 'specVersion: 1\nname: [\n');

    expect(await run({ serverName: 'alpha' })).toBe(1);
    expect(await run({ serverName: 'alpha', force: true })).toBe(0);
    expect(readFileSync(specFile('alpha'), 'utf-8')).toContain('memory: 6G');
  });

  it('--all imports every server and exits 1 when one is refused', async () => {
    server('alpha', 'TYPE=PAPER\nEXTRA_ARGS=\n');
    server('beta', 'TYPE=PAPER\nMEMORY=${MEM}\n');

    expect(await run({ all: true })).toBe(1);
    expect(existsSync(specFile('alpha'))).toBe(true);
    expect(existsSync(specFile('beta'))).toBe(false);
    expect(output.join('\n')).toMatch(/beta.*refused.*MEMORY/s);
  });

  it('--json prints the per-server report', async () => {
    server('alpha', 'TYPE=PAPER\nEXTRA_ARGS=\n');
    server('beta', 'TYPE=PAPER\nMEMORY=${MEM}\n');

    await run({ all: true, dryRun: true, json: true });
    const report = JSON.parse(output.join('\n'));
    expect(report.servers).toEqual([
      { server: 'alpha', status: 'would import', warnings: [] },
      { server: 'beta', status: 'refused', warnings: [], reason: expect.stringContaining('MEMORY') },
    ]);
  });

  it('needs a server name or --all, and an existing server', async () => {
    expect(await run({})).toBe(1);
    expect(output.join('\n')).toMatch(/Usage: mcctl migrate spec/);
    expect(await run({ serverName: 'ghost' })).toBe(1);
    expect(output.join('\n')).toMatch(/ghost.*not found/);
  });
});
