import { describe, test, expect } from 'vitest';
import {
  buildModpackCompatibilityMatrix,
  isModpackCompatible,
} from '../src/domain/mod/modpackCompatibility.js';
import type { ModVersion } from '../src/domain/mod/index.js';

/**
 * Helper to build a minimal ModVersion for tests.
 */
function makeVersion(partial: Partial<ModVersion> & Pick<ModVersion, 'id'>): ModVersion {
  return {
    projectId: 'proj-1',
    name: partial.name ?? partial.id,
    versionNumber: partial.versionNumber ?? '1.0.0',
    versionType: partial.versionType ?? 'release',
    gameVersions: partial.gameVersions ?? [],
    loaders: partial.loaders ?? [],
    files: partial.files ?? [],
    dependencies: partial.dependencies ?? [],
    downloads: partial.downloads ?? 0,
    datePublished: partial.datePublished ?? '2024-01-01T00:00:00Z',
    ...partial,
  };
}

describe('buildModpackCompatibilityMatrix', () => {
  test('빈 버전 목록이면 빈 매트릭스를 반환한다', () => {
    const matrix = buildModpackCompatibilityMatrix([]);
    expect(matrix.loaders).toEqual([]);
    expect(matrix.byLoader).toEqual({});
  });

  test('단일 로더/게임버전 조합을 집계한다', () => {
    const versions = [
      makeVersion({
        id: 'v1',
        versionNumber: '1.0.0',
        loaders: ['neoforge'],
        gameVersions: ['1.21.1'],
      }),
    ];

    const matrix = buildModpackCompatibilityMatrix(versions);

    expect(matrix.loaders).toEqual(['neoforge']);
    expect(matrix.byLoader.neoforge.gameVersions).toEqual(['1.21.1']);
    expect(matrix.byLoader.neoforge.recommended['1.21.1']).toBe('1.0.0');
  });

  test('로더별로 호환 게임버전을 분리 집계한다', () => {
    const versions = [
      makeVersion({ id: 'v1', loaders: ['neoforge'], gameVersions: ['1.21.1'] }),
      makeVersion({ id: 'v2', loaders: ['forge'], gameVersions: ['1.19.2'] }),
    ];

    const matrix = buildModpackCompatibilityMatrix(versions);

    expect(matrix.loaders.sort()).toEqual(['forge', 'neoforge']);
    expect(matrix.byLoader.neoforge.gameVersions).toEqual(['1.21.1']);
    expect(matrix.byLoader.forge.gameVersions).toEqual(['1.19.2']);
  });

  test('하나의 버전이 여러 로더/게임버전을 지원하면 모두 집계한다', () => {
    const versions = [
      makeVersion({
        id: 'v1',
        loaders: ['fabric', 'quilt'],
        gameVersions: ['1.20.1', '1.20.4'],
      }),
    ];

    const matrix = buildModpackCompatibilityMatrix(versions);

    expect(matrix.loaders.sort()).toEqual(['fabric', 'quilt']);
    expect(matrix.byLoader.fabric.gameVersions.sort()).toEqual(['1.20.1', '1.20.4']);
    expect(matrix.byLoader.quilt.gameVersions.sort()).toEqual(['1.20.1', '1.20.4']);
  });

  test('동일 (로더, 게임버전)에 여러 modpack 버전이 있으면 최신(첫 등장)을 추천한다', () => {
    // Modrinth returns versions newest-first. The first one encountered wins.
    const versions = [
      makeVersion({
        id: 'v-new',
        versionNumber: '2.0.0',
        loaders: ['neoforge'],
        gameVersions: ['1.21.1'],
        datePublished: '2024-06-01T00:00:00Z',
      }),
      makeVersion({
        id: 'v-old',
        versionNumber: '1.0.0',
        loaders: ['neoforge'],
        gameVersions: ['1.21.1'],
        datePublished: '2024-01-01T00:00:00Z',
      }),
    ];

    const matrix = buildModpackCompatibilityMatrix(versions);

    expect(matrix.byLoader.neoforge.recommended['1.21.1']).toBe('2.0.0');
  });

  test('게임버전 목록은 내림차순(최신 우선)으로 정렬된다', () => {
    const versions = [
      makeVersion({ id: 'v1', loaders: ['fabric'], gameVersions: ['1.20.1'] }),
      makeVersion({ id: 'v2', loaders: ['fabric'], gameVersions: ['1.21.1'] }),
      makeVersion({ id: 'v3', loaders: ['fabric'], gameVersions: ['1.20.4'] }),
    ];

    const matrix = buildModpackCompatibilityMatrix(versions);

    expect(matrix.byLoader.fabric.gameVersions).toEqual(['1.21.1', '1.20.4', '1.20.1']);
  });

  test('snapshot 등 비표준 게임버전은 정렬 시 뒤로 보낸다', () => {
    const versions = [
      makeVersion({ id: 'v1', loaders: ['fabric'], gameVersions: ['1.21.1'] }),
      makeVersion({ id: 'v2', loaders: ['fabric'], gameVersions: ['24w14a'] }),
    ];

    const matrix = buildModpackCompatibilityMatrix(versions);

    expect(matrix.byLoader.fabric.gameVersions[0]).toBe('1.21.1');
  });

  test('로더가 없는 버전(데이터팩 등)은 무시한다', () => {
    const versions = [
      makeVersion({ id: 'v1', loaders: [], gameVersions: ['1.21.1'] }),
      makeVersion({ id: 'v2', loaders: ['neoforge'], gameVersions: ['1.21.1'] }),
    ];

    const matrix = buildModpackCompatibilityMatrix(versions);

    expect(matrix.loaders).toEqual(['neoforge']);
  });
});

describe('isModpackCompatible', () => {
  const matrix = buildModpackCompatibilityMatrix([
    makeVersion({ id: 'v1', loaders: ['neoforge'], gameVersions: ['1.21.1'] }),
    makeVersion({ id: 'v2', loaders: ['forge'], gameVersions: ['1.19.2'] }),
  ]);

  test('호환되는 (로더, 게임버전) 조합이면 true', () => {
    expect(isModpackCompatible(matrix, 'neoforge', '1.21.1')).toBe(true);
    expect(isModpackCompatible(matrix, 'forge', '1.19.2')).toBe(true);
  });

  test('비호환 조합이면 false', () => {
    // forge + 1.21.1 is the bug scenario (no files available)
    expect(isModpackCompatible(matrix, 'forge', '1.21.1')).toBe(false);
    expect(isModpackCompatible(matrix, 'neoforge', '1.20.4')).toBe(false);
  });

  test('알 수 없는 로더면 false', () => {
    expect(isModpackCompatible(matrix, 'fabric', '1.21.1')).toBe(false);
  });

  test('로더 비교는 대소문자를 구분하지 않는다', () => {
    expect(isModpackCompatible(matrix, 'NeoForge', '1.21.1')).toBe(true);
  });
});
