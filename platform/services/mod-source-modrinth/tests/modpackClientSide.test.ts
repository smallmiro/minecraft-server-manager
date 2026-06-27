import { describe, test, expect } from 'vitest';
import {
  extractProjectIdFromCdnUrl,
  selectClientOnlyFilenames,
  type ModpackIndexEntry,
} from '../src/modpackClientSide.js';

describe('extractProjectIdFromCdnUrl', () => {
  test('extracts the project id from a Modrinth CDN URL', () => {
    const url =
      'https://cdn.modrinth.com/data/AABBCCDD/versions/v1xyz/searchables-1.21.1-1.0.jar';
    expect(extractProjectIdFromCdnUrl(url)).toBe('AABBCCDD');
  });

  test('ignores query strings and extra path segments', () => {
    const url =
      'https://cdn.modrinth.com/data/Pr0jId/versions/ver/file.jar?foo=bar';
    expect(extractProjectIdFromCdnUrl(url)).toBe('Pr0jId');
  });

  test('returns null for a non-Modrinth or malformed URL', () => {
    expect(extractProjectIdFromCdnUrl('https://example.com/mods/foo.jar')).toBeNull();
    expect(extractProjectIdFromCdnUrl('not a url')).toBeNull();
    expect(extractProjectIdFromCdnUrl('https://cdn.modrinth.com/data/')).toBeNull();
  });
});

describe('selectClientOnlyFilenames', () => {
  const entries: ModpackIndexEntry[] = [
    { path: 'mods/searchables-1.21.1-1.0.jar', projectId: 'search01' },
    { path: 'mods/create-6.0.jar', projectId: 'create01' },
    { path: 'mods/statuseffectbars-1.21.1.jar', projectId: 'seb01' },
  ];

  test('returns basenames (no extension) of mods whose canonical server_side is unsupported', () => {
    const serverSideById = new Map<string, 'required' | 'optional' | 'unsupported'>([
      ['search01', 'unsupported'],
      ['create01', 'required'],
      ['seb01', 'unsupported'],
    ]);

    expect(selectClientOnlyFilenames(entries, serverSideById)).toEqual([
      'searchables-1.21.1-1.0',
      'statuseffectbars-1.21.1',
    ]);
  });

  test('does not exclude mods that are optional or required on the server', () => {
    const serverSideById = new Map<string, 'required' | 'optional' | 'unsupported'>([
      ['search01', 'optional'],
      ['create01', 'required'],
      ['seb01', 'required'],
    ]);

    expect(selectClientOnlyFilenames(entries, serverSideById)).toEqual([]);
  });

  test('skips entries whose project metadata is unknown (not in the map)', () => {
    const serverSideById = new Map<string, 'required' | 'optional' | 'unsupported'>([
      ['seb01', 'unsupported'],
    ]);

    expect(selectClientOnlyFilenames(entries, serverSideById)).toEqual([
      'statuseffectbars-1.21.1',
    ]);
  });

  test('ignores non-mod paths (e.g. resourcepacks/config)', () => {
    const mixed: ModpackIndexEntry[] = [
      { path: 'resourcepacks/fancy.zip', projectId: 'rp01' },
      { path: 'mods/clientmod-1.0.jar', projectId: 'cm01' },
    ];
    const serverSideById = new Map<string, 'required' | 'optional' | 'unsupported'>([
      ['rp01', 'unsupported'],
      ['cm01', 'unsupported'],
    ]);

    expect(selectClientOnlyFilenames(mixed, serverSideById)).toEqual(['clientmod-1.0']);
  });
});
