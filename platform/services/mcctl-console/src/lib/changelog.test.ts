import { describe, it, expect } from 'vitest';
import { parseChangelog } from './changelog';

const SAMPLE = `# Changelog

## [2.34.0] - 2026-10-01

### Added
- **Dashboard widget** - shows updates
- **Second feature**: extra

### Fixed
- **Crash on start** - fixed it

### Changed
- **Renamed thing** – en dash description

## [2.33.0] - 2026-09-01

### Added
- **Older feature** - old

## [2.32.0] - 2026-08-01

### Fixed
- **Oldest fix** - older
`;

describe('parseChangelog', () => {
  it('parses version header and date', () => {
    const [v] = parseChangelog(SAMPLE, 1);
    expect(v.version).toBe('2.34.0');
    expect(v.date).toBe('2026-10-01');
  });

  it('groups items into Added/Fixed/Changed sections', () => {
    const [v] = parseChangelog(SAMPLE, 1);
    expect(v.items).toEqual([
      { type: 'added', message: 'Dashboard widget' },
      { type: 'added', message: 'Second feature' },
      { type: 'fixed', message: 'Crash on start' },
      { type: 'changed', message: 'Renamed thing' },
    ]);
  });

  it('ignores list items that do not use the bold-title format', () => {
    const out = parseChangelog('## [1.0.0] - 2026-01-01\n### Added\n- plain item\n- **Bold** - ok\n', 5);
    expect(out[0].items).toEqual([{ type: 'added', message: 'Bold' }]);
  });

  it('ignores items before the first version header', () => {
    const out = parseChangelog('- **Orphan** - x\n## [1.0.0] - 2026-01-01\n', 5);
    expect(out).toHaveLength(1);
    expect(out[0].items).toEqual([]);
  });

  it('respects maxVersions', () => {
    expect(parseChangelog(SAMPLE, 2).map((v) => v.version)).toEqual(['2.34.0', '2.33.0']);
    expect(parseChangelog(SAMPLE, 10).map((v) => v.version)).toEqual(['2.34.0', '2.33.0', '2.32.0']);
  });

  it('returns an empty array for empty input', () => {
    expect(parseChangelog('', 2)).toEqual([]);
    expect(parseChangelog('# Changelog\n\nnothing here', 2)).toEqual([]);
  });
});

import { compareVersions, isNewerVersion } from './changelog';

describe('compareVersions / isNewerVersion', () => {
  it('compares numerically, not lexically', () => {
    expect(compareVersions('2.10.0', '2.9.0')).toBeGreaterThan(0);
    expect(compareVersions('2.33.0', '2.33.0')).toBe(0);
    expect(compareVersions('1.0.0', '1.0.1')).toBeLessThan(0);
  });

  it('tolerates a v prefix and missing segments', () => {
    expect(compareVersions('v2.34.0', '2.33.9')).toBeGreaterThan(0);
    expect(compareVersions('2.1', '2.1.0')).toBe(0);
  });

  it('ranks a prerelease below its release', () => {
    expect(compareVersions('2.34.0-rc.1', '2.34.0')).toBeLessThan(0);
  });

  it('isNewerVersion is true only when latest is strictly newer', () => {
    expect(isNewerVersion('2.34.0', '2.33.0')).toBe(true);
    expect(isNewerVersion('2.33.0', '2.33.0')).toBe(false);
    expect(isNewerVersion('2.32.0', '2.33.0')).toBe(false);
  });

  it('returns false for unparseable versions', () => {
    expect(isNewerVersion('Unreleased', '2.33.0')).toBe(false);
    expect(isNewerVersion('2.34.0', 'unknown')).toBe(false);
  });
});
