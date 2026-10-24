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

describe('parseChangelog section handling', () => {
  it('drops items under sections other than Added / Fixed / Changed', () => {
    const md = [
      '## [3.0.0] - 2026-10-30',
      '### Changed',
      '- **New layout** - x',
      '### Removed',
      '- **All Bash scripts** - gone',
      '### Security',
      '- **Shell injection** - fixed',
      '### Fixed',
      '- **Crash** - fixed',
    ].join('\n');

    expect(parseChangelog(md, 1)[0].items).toEqual([
      { type: 'changed', message: 'New layout' },
      { type: 'fixed', message: 'Crash' },
    ]);
  });

  it('does not carry the section type into the next version', () => {
    const md = [
      '## [2.0.0] - 2026-10-30',
      '### Fixed',
      '- **A** - x',
      '## [1.0.0] - 2026-10-01',
      '- **Orphan** - before any section',
      '### Added',
      '- **B** - y',
    ].join('\n');

    expect(parseChangelog(md, 2)[1].items).toEqual([{ type: 'added', message: 'B' }]);
  });
});

describe('compareVersions / isNewerVersion', () => {
  it('compares prerelease identifiers field by field', () => {
    expect(compareVersions('3.0.0-rc.10', '3.0.0-rc.9')).toBeGreaterThan(0);
    expect(compareVersions('3.0.0-beta.2', '3.0.0-alpha.10')).toBeGreaterThan(0);
    expect(compareVersions('3.0.0-rc', '3.0.0-rc.1')).toBeLessThan(0);
    expect(compareVersions('3.0.0-1', '3.0.0-alpha')).toBeLessThan(0);
  });

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
