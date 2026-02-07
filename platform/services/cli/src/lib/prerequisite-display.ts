import type { PrerequisiteReport } from '@minecraft-docker/shared';
import { colors, log } from '@minecraft-docker/shared';

/**
 * Display a PrerequisiteReport as a formatted table.
 * Returns true if all mandatory prerequisites are satisfied.
 */
export function displayPrerequisiteReport(report: PrerequisiteReport): boolean {
  for (const r of report.results) {
    const versionStr = r.version ?? 'not found';
    // Only add 'v' prefix if version looks like a semver number
    const displayVersion = r.version && /^\d/.test(r.version) ? `v${versionStr}` : versionStr;
    const requiredStr = `(${r.required})`;

    if (r.satisfied) {
      console.log(`  ✓ ${r.name.padEnd(18)} ${colors.green(displayVersion)}  ${colors.dim(requiredStr)}`);
    } else if (r.optional) {
      console.log(`  ⚠ ${r.name.padEnd(18)} ${colors.yellow(displayVersion)}  ${colors.dim(requiredStr)}`);
      if (r.hint) {
        console.log(`    ${colors.dim(r.hint)}`);
      }
    } else {
      console.log(`  ✗ ${r.name.padEnd(18)} ${colors.red(versionStr)}  ${colors.dim(requiredStr)}`);
      if (r.hint) {
        console.log(`    ${colors.dim(r.hint)}`);
      }
    }
  }

  if (!report.allSatisfied) {
    console.log('');
    const failed = report.results.filter(r => !r.optional && !r.satisfied);
    for (const f of failed) {
      if (!f.installed) {
        log.error(`${f.name} is not installed`);
      } else {
        log.error(`${f.name} version ${f.version} does not meet minimum requirement ${f.required}`);
      }
    }
  }

  return report.allSatisfied;
}
