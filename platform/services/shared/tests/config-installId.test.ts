import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync, chmodSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Config, Paths, isTelemetryEnabled } from '../src/index.js';
import type { McctlConfig } from '../src/index.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const baseConfig: McctlConfig = {
  version: '2.30.0',
  initialized: '2026-01-01T00:00:00.000Z',
  dataDir: '/data',
  defaultType: 'PAPER',
  defaultVersion: '1.21.1',
  autoStart: true,
  avahiEnabled: false,
  templateVersion: '2.30.0',
};

describe('Config.getOrCreateInstallId', () => {
  let dir: string;
  let configPath: string;
  let config: Config;

  const writeConfig = (data: unknown) => writeFileSync(configPath, JSON.stringify(data), 'utf-8');
  const readConfig = () => JSON.parse(readFileSync(configPath, 'utf-8')) as McctlConfig;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'mcctl-installid-'));
    configPath = join(dir, '.mcctl.json');
    config = new Config(new Paths(dir));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  test('generates a UUID and saves it when missing', () => {
    writeConfig(baseConfig);

    const id = config.getOrCreateInstallId();

    expect(id).toMatch(UUID_RE);
    expect(readConfig().installId).toBe(id);
  });

  test('returns the same id on repeated calls', () => {
    writeConfig(baseConfig);

    const first = config.getOrCreateInstallId();
    const second = config.getOrCreateInstallId();

    expect(second).toBe(first);
  });

  test('keeps an existing installId untouched', () => {
    writeConfig({ ...baseConfig, installId: 'existing-id' });

    expect(config.getOrCreateInstallId()).toBe('existing-id');
    expect(readConfig().installId).toBe('existing-id');
  });

  test('preserves all other fields, including unknown ones', () => {
    writeConfig({ ...baseConfig, telemetry: false, playitEnabled: true, extra: 'keep-me' });

    config.getOrCreateInstallId();

    const saved = readConfig() as McctlConfig & { extra?: string };
    expect(saved).toMatchObject({ ...baseConfig, telemetry: false, playitEnabled: true, extra: 'keep-me' });
  });

  test('returns null and does not create the file when it is missing', () => {
    expect(config.getOrCreateInstallId()).toBeNull();
    expect(existsSync(configPath)).toBe(false);
  });

  test('returns null and leaves a corrupted file as-is', () => {
    writeFileSync(configPath, '{ not json', 'utf-8');

    expect(config.getOrCreateInstallId()).toBeNull();
    expect(readFileSync(configPath, 'utf-8')).toBe('{ not json');
  });

  test.skipIf(process.getuid?.() === 0)('returns null when the file cannot be written', () => {
    writeConfig(baseConfig);
    chmodSync(configPath, 0o444);

    expect(config.getOrCreateInstallId()).toBeNull();
    expect(readConfig().installId).toBeUndefined();
  });
});

describe('isTelemetryEnabled', () => {
  test('false when config is null', () => {
    expect(isTelemetryEnabled(null, {})).toBe(false);
  });

  test('false when telemetry is explicitly false', () => {
    expect(isTelemetryEnabled({ ...baseConfig, telemetry: false }, {})).toBe(false);
  });

  test.each(['1', 'true'])('false when DO_NOT_TRACK=%s', (value) => {
    expect(isTelemetryEnabled(baseConfig, { DO_NOT_TRACK: value })).toBe(false);
  });

  test('true when DO_NOT_TRACK has another value', () => {
    expect(isTelemetryEnabled(baseConfig, { DO_NOT_TRACK: '0' })).toBe(true);
  });

  test('true by default (telemetry unset or true)', () => {
    expect(isTelemetryEnabled(baseConfig, {})).toBe(true);
    expect(isTelemetryEnabled({ ...baseConfig, telemetry: true }, {})).toBe(true);
  });

  test('defaults env to process.env', () => {
    const prev = process.env['DO_NOT_TRACK'];
    process.env['DO_NOT_TRACK'] = '1';
    try {
      expect(isTelemetryEnabled(baseConfig)).toBe(false);
    } finally {
      if (prev === undefined) delete process.env['DO_NOT_TRACK'];
      else process.env['DO_NOT_TRACK'] = prev;
    }
  });
});
