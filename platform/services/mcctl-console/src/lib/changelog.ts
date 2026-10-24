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
  let currentType: 'added' | 'fixed' | 'changed' = 'added';

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
      continue;
    }

    // Match section header: ### Added, ### Fixed, ### Changed
    const sectionMatch = line.match(/^### (Added|Fixed|Changed)/i);
    if (sectionMatch) {
      currentType = sectionMatch[1].toLowerCase() as 'added' | 'fixed' | 'changed';
      continue;
    }

    // Match list item: - **Feature** - Description
    const itemMatch = line.match(/^- \*\*([^*]+)\*\*\s*[-–]?\s*(.*)$/);
    if (itemMatch && currentVersion) {
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
