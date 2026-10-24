/** setEnvKeys (#675, ADR-0003 §6): config.env-style writes mapped onto the spec. */
import { describe, it, expect } from 'vitest';
import { setEnvKeys } from '../src/domain/server-spec/setEnvKeys.js';
import { ServerSpecError, type ServerSpecDocument } from '../src/domain/server-spec/ServerSpecDocument.js';

const doc: ServerSpecDocument = {
  specVersion: 1,
  name: 'alpha',
  type: 'PAPER',
  version: '1.21.1',
  memory: '4G',
  image: 'itzg/minecraft-server:java25',
  world: { level: 'alpha', storage: 'universe' },
  routing: { customHostnames: [], playitDomain: 'p.example.com', autoScale: { up: true, down: true } },
  env: { MOTD: 'hi', EXTRA_ARGS: '-Dx=1' },
};

describe('setEnvKeys', () => {
  it('maps managed keys to typed fields and the rest to env, leaving the input alone', () => {
    const next = setEnvKeys(doc, {
      set: { TYPE: 'FABRIC', VERSION: '1.21.4', MEMORY: '6G', LEVEL: 'other', PLAYIT_DOMAIN: 'q.example.com', PVP: 'false' },
    });
    expect(next).toMatchObject({
      type: 'FABRIC',
      version: '1.21.4',
      memory: '6G',
      world: { level: 'other', storage: 'universe' },
      routing: { playitDomain: 'q.example.com' },
      env: { MOTD: 'hi', EXTRA_ARGS: '-Dx=1', PVP: 'false' },
    });
    expect(doc.type).toBe('PAPER');
  });

  it('clears VERSION, MEMORY and PLAYIT_DOMAIN when empty or removed', () => {
    const empty = setEnvKeys(doc, { set: { VERSION: '', PLAYIT_DOMAIN: '' } });
    expect(empty.version).toBeUndefined();
    expect(empty.routing.playitDomain).toBeUndefined();
    const removed = setEnvKeys(doc, { remove: ['MEMORY', 'PLAYIT_DOMAIN', 'MOTD'] });
    expect(removed.memory).toBeUndefined();
    expect(removed.routing.playitDomain).toBeUndefined();
    expect(removed.env).toEqual({ EXTRA_ARGS: '-Dx=1' });
  });

  it.each([
    ['--universe /worlds/ -Dy=2', 'universe', '-Dy=2'],
    ['--universe=/worlds', 'universe', undefined],
    ['-Dy=2', 'data', '-Dy=2'],
    ['', 'data', undefined],
  ] as const)('maps EXTRA_ARGS %j to storage %s and env %s', (value, storage, rest) => {
    const next = setEnvKeys(doc, { set: { EXTRA_ARGS: value } });
    expect(next.world.storage).toBe(storage);
    expect(next.env['EXTRA_ARGS']).toBe(rest);
  });

  it("refuses an EXTRA_ARGS that puts the world elsewhere ('undetermined')", () => {
    expect(() => setEnvKeys(doc, { set: { EXTRA_ARGS: '--universe /srv' } })).toThrow(ServerSpecError);
  });

  it('falls back to the itzg defaults when TYPE or LEVEL is removed', () => {
    const next = setEnvKeys(doc, { remove: ['TYPE', 'LEVEL'] });
    expect(next.type).toBe('VANILLA');
    expect(next.world.level).toBe('world');
  });
});
