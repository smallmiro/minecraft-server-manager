import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Paths } from '@minecraft-docker/shared';
import { ShellExecutor } from '../../../src/lib/shell.js';

// writeConfigValue backs `mcctl config`, whitelist and op. config.env is the
// container's env_file, so a line break would add another setting (#726).
describe('ShellExecutor.writeConfigValue', () => {
  let root: string;
  let configPath: string;
  let shell: ShellExecutor;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'mcctl-cli-write-config-'));
    mkdirSync(join(root, 'servers', 'alpha'), { recursive: true });
    configPath = join(root, 'servers', 'alpha', 'config.env');
    writeFileSync(configPath, 'TYPE=PAPER\nMOTD=old\n', 'utf-8');
    shell = new ShellExecutor(new Paths(root));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('writes a multi-word value with § color codes', () => {
    expect(shell.writeConfigValue('alpha', 'MOTD', '§6Welcome §lto my server')).toBe(true);
    expect(readFileSync(configPath, 'utf-8')).toBe('TYPE=PAPER\nMOTD=§6Welcome §lto my server\n');
  });

  it.each(['x\nMODS=http://evil/x.jar', 'x\rMODS=http://evil/x.jar', 'x\u0000y', 'x\u001by'])(
    'refuses %j without writing config.env',
    (value) => {
      expect(shell.writeConfigValue('alpha', 'MOTD', value)).toBe(false);
      expect(readFileSync(configPath, 'utf-8')).toBe('TYPE=PAPER\nMOTD=old\n');
    }
  );
});
