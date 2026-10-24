export interface ChangelogItem {
  type: 'added' | 'fixed' | 'changed';
  message: string;
}

export interface ChangelogVersion {
  version: string;
  date: string;
  items: ChangelogItem[];
}

export function parseChangelog(content: string, maxVersions: number): ChangelogVersion[] {
  const versions: ChangelogVersion[] = [];
  const lines = content.split('\n');

  let currentVersion: ChangelogVersion | null = null;
  // null outside a recognized section: items under Removed, Security etc. are skipped, not mislabelled
  let currentType: ChangelogItem['type'] | null = null;

  for (const line of lines) {
    // Match version header: ## [1.7.11] - 2026-02-04
    const versionMatch = line.match(/^## \[([^\]]+)\] - (\d{4}-\d{2}-\d{2})/);
    if (versionMatch) {
      if (currentVersion) {
        versions.push(currentVersion);
        if (versions.length >= maxVersions) break;
      }
      currentVersion = {
        version: versionMatch[1],
        date: versionMatch[2],
        items: [],
      };
      currentType = null;
      continue;
    }

    // Section header: only ### Added, ### Fixed, ### Changed are shown
    const sectionMatch = line.match(/^### (\S+)/);
    if (sectionMatch) {
      const name = sectionMatch[1].toLowerCase();
      currentType = name === 'added' || name === 'fixed' || name === 'changed' ? name : null;
      continue;
    }

    // Match list item: - **Feature** - Description
    const itemMatch = line.match(/^- \*\*([^*]+)\*\*\s*[-–]?\s*(.*)$/);
    if (itemMatch && currentVersion && currentType) {
      currentVersion.items.push({
        type: currentType,
        message: itemMatch[1].trim(),
      });
    }
  }

  // Push last version if exists
  if (currentVersion && versions.length < maxVersions) {
    versions.push(currentVersion);
  }

  return versions;
}

function parseSemver(v: string): { nums: number[]; pre: string } | null {
  const m = v.trim().match(/^v?(\d+)(?:\.(\d+))?(?:\.(\d+))?(?:-([0-9A-Za-z.-]+))?(?:\+.*)?$/);
  if (!m) return null;
  return { nums: [Number(m[1]), Number(m[2] ?? 0), Number(m[3] ?? 0)], pre: m[4] ?? '' };
}

/** Small semver compare (major.minor.patch, prerelease ranks below release). Throws on unparseable input. */
export function compareVersions(a: string, b: string): number {
  const pa = parseSemver(a);
  const pb = parseSemver(b);
  if (!pa || !pb) throw new Error('Invalid version');
  for (let i = 0; i < 3; i++) {
    if (pa.nums[i] !== pb.nums[i]) return pa.nums[i] > pb.nums[i] ? 1 : -1;
  }
  if (pa.pre === pb.pre) return 0;
  if (!pa.pre) return 1;
  if (!pb.pre) return -1;
  return comparePrerelease(pa.pre.split('.'), pb.pre.split('.'));
}

/** semver §11: numeric identifiers compare numerically and rank below alphanumeric ones; a shorter list ranks lower. */
function comparePrerelease(a: string[], b: string[]): number {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (a[i] === undefined) return -1;
    if (b[i] === undefined) return 1;
    if (a[i] === b[i]) continue;
    const na = /^\d+$/.test(a[i]);
    const nb = /^\d+$/.test(b[i]);
    if (na && nb) return Number(a[i]) > Number(b[i]) ? 1 : -1;
    if (na !== nb) return na ? -1 : 1;
    return a[i] > b[i] ? 1 : -1;
  }
  return 0;
}

/** True only when `latest` is strictly newer than `installed`; false if either is unparseable. */
export function isNewerVersion(latest: string, installed: string): boolean {
  try {
    return compareVersions(latest, installed) > 0;
  } catch {
    return false;
  }
}
