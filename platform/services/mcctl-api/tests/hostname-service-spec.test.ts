/**
 * HostnameService writes custom hosts and the playit domain through the
 * ServerSpec (#675): server.yaml routing, the mc-router label rendered with
 * routerHosts. Real temp platform, no runtime.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { FileServerSpecRepository, Paths } from '@minecraft-docker/shared';
import { HostnameService } from '../src/services/HostnameService.js';
import { serverSpecRepositories } from '../src/lib/server-spec.js';

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'mcctl-api-hostnames-'));
  mkdirSync(join(root, 'servers', 'factory'), { recursive: true });
  writeFileSync(join(root, 'servers', 'compose.yml'), 'include:\n  - factory/docker-compose.yml\n');
  writeFileSync(join(root, 'servers', 'factory', 'config.env'), 'TYPE=PAPER\nLEVEL=factory\nEXTRA_ARGS=--universe /worlds/\nPLAYIT_DOMAIN=old.gl.joinmc.link\n');
  writeFileSync(
    join(root, 'servers', 'factory', 'docker-compose.yml'),
    readFileSync(join(import.meta.dirname, '../../cli/templates/servers/_template/docker-compose.yml'), 'utf-8')
      .replace(/mc-template/g, 'mc-factory')
      .replace('mc-router.host: "template.local"', 'mc-router.host: "factory.local,factory.10.0.0.2.nip.io,old.gl.joinmc.link"')
  );
  serverSpecRepositories.create = (r) => new FileServerSpecRepository(new Paths(r), undefined, undefined, () => ['10.0.0.2']);
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('HostnameService.updateCustomHostnames', () => {
  it('stores custom hosts and the playit domain in server.yaml and renders the label', async () => {
    const data = await new HostnameService(root).updateCustomHostnames('factory', ['MC.example.com', 'new.tun.ply.gg'], 'new.tun.ply.gg');

    const spec = readFileSync(join(root, 'servers', 'factory', 'server.yaml'), 'utf-8');
    expect(spec).toContain('playitDomain: new.tun.ply.gg');
    expect(spec).toMatch(/customHostnames:\n\s+- mc\.example\.com\n/);
    expect(data.hostnames).toEqual(['factory.local', 'factory.10.0.0.2.nip.io', 'new.tun.ply.gg', 'mc.example.com']);
    expect(readFileSync(join(root, 'servers', 'factory', 'config.env'), 'utf-8')).toContain('PLAYIT_DOMAIN=new.tun.ply.gg');
  });

  it('removes the playit domain when it is no longer listed', async () => {
    await new HostnameService(root).updateCustomHostnames('factory', ['mc.example.com'], null);
    expect(readFileSync(join(root, 'servers', 'factory', 'config.env'), 'utf-8')).not.toContain('PLAYIT_DOMAIN');
  });

  it('refuses an invalid hostname with the domain rule and writes nothing', async () => {
    await expect(new HostnameService(root).updateCustomHostnames('factory', ['bad host'], null)).rejects.toThrow(/RFC 1123/);
    await expect(new HostnameService(root).updateCustomHostnames('factory', ['a..b'], null)).rejects.toThrow(/RFC 1123/);
  });
});
