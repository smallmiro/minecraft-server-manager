import { lstat, readdir, rm, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import * as prompts from '@clack/prompts';

export const LEGACY_SCRIPTS_DOC_URL =
  'https://minecraft-server-manager.readthedocs.io/en/latest/advanced/upgrade-runbook/#v300-scripts';

/**
 * <root>/scripts is unused since v3.0.0 (#736). Tell the user, and delete it
 * only after an interactive y/N (default N). Only that one entry under <root>
 * is touched; a symlink is unlinked, never followed.
 */
export async function handleLegacyScripts(
  root: string,
  opts: { interactive: boolean; dryRun?: boolean },
): Promise<void> {
  const dir = join(root, 'scripts');
  let isLink: boolean;
  try {
    const st = await lstat(dir);
    if (!st.isDirectory() && !st.isSymbolicLink()) return;
    isLink = st.isSymbolicLink();
  } catch {
    return;
  }

  prompts.log.warn(
    `${dir} is no longer used since v3.0.0. It may contain files you edited yourself.\n` +
      `Old script -> mcctl command mapping: ${LEGACY_SCRIPTS_DOC_URL}`,
  );
  if (opts.dryRun) {
    prompts.log.info(`Would ask before removing ${dir}.`);
    return;
  }
  if (!opts.interactive) {
    prompts.log.info(`Not removed (non-interactive). Delete it yourself when ready: rm -r ${dir}`);
    return;
  }
  if (!isLink) prompts.log.info(`Contains: ${await describeEntries(dir)}`);
  const ok = await prompts.confirm({ message: `Remove ${dir}?`, initialValue: false });
  if (prompts.isCancel(ok) || !ok) {
    prompts.log.info('Kept scripts/.');
    return;
  }
  try {
    if (isLink) await unlink(dir);
    else await rm(dir, { recursive: true });
  } catch (err) {
    // The rest of the upgrade (templateVersion, summary) must still run
    prompts.log.warn(`Could not remove ${dir}: ${(err as Error).message}. Delete it yourself: rm -r ${dir}`);
    return;
  }
  prompts.log.success(`Removed ${dir}.`);
}

/** The top-level entries (folders end with /), at most 10, so the user sees what y deletes. */
async function describeEntries(dir: string): Promise<string> {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  if (entries.length === 0) return '(empty)';
  const names = entries.map((e) => (e.isDirectory() ? `${e.name}/` : e.name)).sort();
  const more = names.length > 10 ? `, … (${names.length - 10} more)` : '';
  return names.slice(0, 10).join(', ') + more;
}
