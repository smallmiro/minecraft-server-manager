import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { readServerConfigEnv } from '../src/docker/index.js';
import { Config, Paths } from '../src/utils/index.js';
import { ServerRepository } from '../src/infrastructure/adapters/ServerRepository.js';

// Every env reader goes through the one codec, so they all read a file the
// way Docker Compose does (#656).
const CONFIG_ENV = [
  '# server config',
  'TYPE=PAPER # inline comment',
  'export VERSION=1.21.1',
  'MEMORY = 4G',
  'MOTD="Say \\"hi\\""',
  "SEED='-123'",
  '',
].join('\n');

describe('env readers use the shared codec', () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'mcctl-env-readers-'));
    mkdirSync(join(root, 'servers', 'alpha'), { recursive: true });
    writeFileSync(join(root, 'servers', 'alpha', 'config.env'), CONFIG_ENV);
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  test('readServerConfigEnv', () => {
    expect(readServerConfigEnv('alpha', join(root, 'servers'))).toEqual({
      TYPE: 'PAPER', VERSION: '1.21.1', MEMORY: '4G', MOTD: 'Say "hi"', SEED: '-123',
    });
  });

  test('ServerRepository.getConfig', async () => {
    const config = await new ServerRepository(new Paths(root)).getConfig('alpha');
    expect(config).toMatchObject({ type: 'PAPER', version: '1.21.1', memory: '4G', seed: '-123' });
    expect(config?.customEnv['MOTD']).toBe('Say "hi"');
  });

  test('Config.loadEnv', () => {
    writeFileSync(join(root, '.env'), 'HOST_IP=10.0.0.1 # lan\nexport DEBUG=true\nNAME="a b"\n');
    expect(new Config(new Paths(root)).loadEnv()).toEqual({ HOST_IP: '10.0.0.1', DEBUG: true, NAME: 'a b' });
  });
});
