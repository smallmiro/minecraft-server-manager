import { describe, it, expect, afterEach } from 'vitest';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { Paths, resolveMcctlRoot } from '../src/utils/index.js';
import { getServersDir, getWorldsDir } from '../src/docker/index.js';

describe('resolveMcctlRoot (#649)', () => {
  const original = process.env['MCCTL_ROOT'];

  afterEach(() => {
    if (original === undefined) delete process.env['MCCTL_ROOT'];
    else process.env['MCCTL_ROOT'] = original;
  });

  it('uses MCCTL_ROOT as an absolute, normalized path', () => {
    process.env['MCCTL_ROOT'] = '/srv/mc/';
    expect(resolveMcctlRoot()).toBe('/srv/mc');

    process.env['MCCTL_ROOT'] = 'relative/root';
    expect(resolveMcctlRoot()).toBe(resolve('relative/root'));
  });

  it('defaults to ~/minecraft-servers when MCCTL_ROOT is unset or empty', () => {
    delete process.env['MCCTL_ROOT'];
    expect(resolveMcctlRoot()).toBe(join(homedir(), 'minecraft-servers'));

    process.env['MCCTL_ROOT'] = '';
    expect(resolveMcctlRoot()).toBe(join(homedir(), 'minecraft-servers'));
  });

  it('is what Paths and the docker helpers use', () => {
    process.env['MCCTL_ROOT'] = '/srv/mc/';
    expect(new Paths().root).toBe('/srv/mc');
    expect(getServersDir()).toBe('/srv/mc/servers');
    expect(getWorldsDir()).toBe('/srv/mc/worlds');
  });

  it('an explicit Paths root still wins', () => {
    process.env['MCCTL_ROOT'] = '/srv/mc';
    expect(new Paths('/explicit').root).toBe('/explicit');
  });
});
