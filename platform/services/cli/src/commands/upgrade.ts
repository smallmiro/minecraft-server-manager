import { existsSync, readFileSync, writeFileSync, copyFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { execSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { Paths, Config, log, colors } from '@minecraft-docker/shared';
import type { McctlConfig } from '@minecraft-docker/shared';
import { diffEnvFiles, applyEnvDiff } from '../lib/env-diff.js';
import { detectDockerGid, setDockerGid } from '../lib/docker-gid.js';
import { patchRouterCompose } from '../lib/compose-router-patch.js';
import * as prompts from '@clack/prompts';

export interface UpgradeCommandOptions {
  root?: string;
  dryRun?: boolean;
  nonInteractive?: boolean;
}

/**
 * Get CLI package version from package.json
 */
function getCliVersion(): string {
  try {
    const packageJsonPath = new URL('../../package.json', import.meta.url);
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
    return packageJson.version;
  } catch {
    return '0.0.0';
  }
}

/**
 * Template files to sync to servers/_template
 */
const TEMPLATE_FILES = [
  'servers/_template/docker-compose.yml',
  'servers/_template/config.env',
];

/**
 * Execute the upgrade command.
 *
 * Flow:
 * 1. Check platform initialization
 * 2. Compare templateVersion with CLI version
 * 3. Diff .env template against user .env
 * 4. Apply new variables (interactive or non-interactive)
 * 5. Update servers/_template files
 * 6. Update templateVersion in config
 */
export async function upgradeCommand(options: UpgradeCommandOptions): Promise<number> {
  const paths = new Paths(options.root);
  const config = new Config(paths);
  const cliVersion = getCliVersion();

  // Check initialization
  if (!paths.isInitialized()) {
    log.error('Platform not initialized. Run: mcctl init');
    return 1;
  }

  prompts.intro(colors.bold(`mcctl upgrade (v${cliVersion})`));

  // Load config (may not exist for older platforms)
  let mcctlConfig = config.load();
  const currentTemplateVersion = mcctlConfig?.templateVersion ?? 'unknown';

  prompts.log.info(`Current template version: ${colors.cyan(currentTemplateVersion)}`);
  prompts.log.info(`CLI version: ${colors.cyan(cliVersion)}`);

  // Track changes made
  let envChangesApplied = false;
  let templateFilesUpdated = 0;

  // --- Step 1: .env migration ---
  const envResult = await migrateEnvFile(paths, options);
  if (envResult.error) {
    return 1;
  }
  envChangesApplied = envResult.changed;

  // --- Step 1b: DOCKER_GID for non-root mc-router (v1.46+) ---
  if (!options.dryRun && existsSync(paths.envFile) && setDockerGid(paths.envFile, detectDockerGid())) {
    prompts.log.success('DOCKER_GID set from docker socket.');
    envChangesApplied = true;
  }

  // --- Step 1c: docker-compose.yml router (image tag + group_add) ---
  // A compose failure must not leave the upgrade half-done: run the remaining steps, then exit 1.
  const composeResult = await migrateComposeFile(paths, options);

  // --- Step 2: Update servers/_template files ---
  templateFilesUpdated = updateTemplateFiles(paths, options);

  // --- Step 3: Update templateVersion in config (and backfill installId) ---
  const addInstallId = !mcctlConfig?.installId;
  if (!options.dryRun) {
    const installId = mcctlConfig?.installId ?? randomUUID();
    const updatedConfig: McctlConfig = mcctlConfig
      ? { ...mcctlConfig, templateVersion: cliVersion, installId }
      : {
          version: cliVersion,
          initialized: new Date().toISOString(),
          dataDir: paths.root,
          defaultType: 'PAPER',
          defaultVersion: '26.1.1',
          autoStart: true,
          avahiEnabled: true,
          templateVersion: cliVersion,
          installId,
        };
    config.save(updatedConfig);
    if (addInstallId) prompts.log.success('Added installId to .mcctl.json.');
  } else if (addInstallId) {
    prompts.log.info('Would add installId to .mcctl.json.');
  }

  // --- Summary ---
  printSummary(envChangesApplied, templateFilesUpdated, cliVersion, options.dryRun, composeResult.changed);

  return composeResult.error ? 1 : 0;
}

/**
 * Migrate .env file by comparing template with user's file.
 */
async function migrateEnvFile(
  paths: Paths,
  options: UpgradeCommandOptions,
): Promise<{ changed: boolean; error: boolean }> {
  const templateEnvPath = join(paths.templates, '.env.example');
  const userEnvPath = paths.envFile;

  if (!existsSync(templateEnvPath)) {
    prompts.log.warn('Template .env.example not found. Skipping .env migration.');
    return { changed: false, error: false };
  }

  if (!existsSync(userEnvPath)) {
    prompts.log.warn('User .env file not found. Skipping .env migration.');
    return { changed: false, error: false };
  }

  const templateContent = readFileSync(templateEnvPath, 'utf-8');
  const userContent = readFileSync(userEnvPath, 'utf-8');

  const diff = diffEnvFiles(templateContent, userContent);

  const totalNew = diff.newVars.length + diff.newCommentedVars.length;

  if (totalNew === 0) {
    prompts.log.success('No new environment variables found. .env is up to date.');
    return { changed: false, error: false };
  }

  // Report findings
  prompts.log.step(`Found ${colors.yellow(String(totalNew))} new variable(s) in template:`);

  for (const v of diff.newVars) {
    const sectionHint = v.section ? ` (${v.section})` : '';
    console.log(`  ${colors.green('+')} ${colors.bold(v.key)}=${colors.dim(v.defaultValue)}${colors.dim(sectionHint)}`);
  }

  for (const v of diff.newCommentedVars) {
    const sectionHint = v.section ? ` (${v.section})` : '';
    console.log(`  ${colors.dim('+')} ${colors.dim(`# ${v.key}=${v.defaultValue}`)}${colors.dim(sectionHint)}`);
  }
  console.log('');

  // Dry-run: just show, don't write
  if (options.dryRun) {
    prompts.log.info('Dry run mode - no changes will be made.');
    return { changed: false, error: false };
  }

  // Collect values for new active variables
  const values = new Map<string, string>();

  if (!options.nonInteractive && diff.newVars.length > 0) {
    prompts.log.info('Enter values for new variables (press Enter for default):');
    console.log('');

    for (const v of diff.newVars) {
      const result = await prompts.text({
        message: `${v.key}`,
        placeholder: v.defaultValue,
        defaultValue: v.defaultValue,
      });

      if (prompts.isCancel(result)) {
        prompts.log.warn('Cancelled. No changes made.');
        return { changed: false, error: false };
      }

      values.set(v.key, result as string);
    }
  }

  // Apply diff
  const updatedContent = applyEnvDiff(userContent, diff, values);
  writeFileSync(userEnvPath, updatedContent, 'utf-8');
  prompts.log.success(`.env updated with ${totalNew} new variable(s).`);

  return { changed: true, error: false };
}

/**
 * Update servers/_template files from bundled templates.
 */
function updateTemplateFiles(
  paths: Paths,
  options: UpgradeCommandOptions,
): number {
  let updated = 0;

  for (const relPath of TEMPLATE_FILES) {
    const srcPath = join(paths.templates, relPath);
    const destPath = join(paths.root, relPath);

    if (!existsSync(srcPath)) {
      continue;
    }

    if (options.dryRun) {
      prompts.log.info(`Would update: ${relPath}`);
      updated++;
      continue;
    }

    // Ensure destination directory exists
    const destDir = dirname(destPath);
    if (!existsSync(destDir)) {
      mkdirSync(destDir, { recursive: true });
    }

    copyFileSync(srcPath, destPath);
    updated++;
  }

  if (updated > 0) {
    const verb = options.dryRun ? 'Would update' : 'Updated';
    prompts.log.success(`${verb} ${updated} template file(s) in servers/_template.`);
  }

  return updated;
}

/**
 * Patch the user's docker-compose.yml: mc-router image tag and group_add only.
 * Everything else (extra services, ports, comments) is left untouched.
 */
async function migrateComposeFile(
  paths: Paths,
  options: UpgradeCommandOptions,
): Promise<{ changed: boolean; error?: boolean }> {
  const templatePath = join(paths.templates, 'docker-compose.yml');
  if (!existsSync(paths.composeFile)) {
    return { changed: false };
  }
  if (!existsSync(templatePath)) {
    prompts.log.warn('Template docker-compose.yml not found. Skipping docker-compose.yml update.');
    return { changed: false };
  }

  const user = readFileSync(paths.composeFile, 'utf-8');
  const result = patchRouterCompose(user, readFileSync(templatePath, 'utf-8'));

  if (result.skipped) {
    prompts.log.warn(
      'Could not patch mc-router in docker-compose.yml automatically. For mc-router 1.46+, set:\n' +
      '    image: itzg/mc-router:<tag from template>\n    group_add:\n      - "${DOCKER_GID:-999}"',
    );
    return { changed: false };
  }
  if (result.changes.length === 0) {
    prompts.log.success('docker-compose.yml is up to date.');
    return { changed: false };
  }

  const diff = lineDiff(user.split('\n'), result.content.split('\n'));
  prompts.log.step(`docker-compose.yml: ${result.changes.join(', ')}`);
  prompts.log.message(diff.join('\n'));

  if (options.dryRun) {
    prompts.log.info('Dry run mode - docker-compose.yml not modified.');
    return { changed: false };
  }

  if (!options.nonInteractive) {
    const ok = await prompts.confirm({ message: 'Apply to docker-compose.yml?', initialValue: true });
    if (prompts.isCancel(ok) || !ok) {
      prompts.log.warn('Skipped docker-compose.yml update.');
      return { changed: false };
    }
  }

  const stamp = new Date().toISOString().replace(/\D/g, '').slice(0, 14);
  const backup = `${paths.composeFile}.bak-${stamp}`;
  try {
    copyFileSync(paths.composeFile, backup);
    writeFileSync(paths.composeFile, result.content, 'utf-8');
  } catch (err) {
    try { copyFileSync(backup, paths.composeFile); } catch { /* backup restore best effort */ }
    prompts.log.error(`Failed to update docker-compose.yml: ${(err as Error).message}`);
    return { changed: false, error: true };
  }
  prompts.log.success(`docker-compose.yml updated (backup: ${backup}).`);

  recreateRouter(paths);
  return { changed: true };
}

/** Minimal LCS line diff (compose files are small): `-`/`+` lines only, in file order. */
function lineDiff(a: string[], b: string[]): string[] {
  const lcs = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      lcs[i]![j] = a[i] === b[j] ? lcs[i + 1]![j + 1]! + 1 : Math.max(lcs[i + 1]![j]!, lcs[i]![j + 1]!);
    }
  }
  const out: string[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) { i++; j++; }
    else if (i < a.length && (j === b.length || lcs[i + 1]![j]! >= lcs[i]![j + 1]!)) out.push(colors.red(`- ${a[i++]}`));
    else out.push(colors.green(`+ ${b[j++]}`));
  }
  return out;
}

/** Recreate mc-router so the patched compose takes effect (servers keep running). */
function recreateRouter(paths: Paths): void {
  try {
    execSync('docker compose up -d router', { cwd: paths.root, stdio: 'inherit', timeout: 5 * 60_000 });
    prompts.log.success('mc-router recreated.');
  } catch {
    prompts.log.warn('Could not recreate mc-router. Run: docker compose up -d router');
  }
}

/**
 * Print upgrade summary.
 */
function printSummary(
  envChanged: boolean,
  templateFilesUpdated: number,
  newVersion: string,
  dryRun?: boolean,
  composeChanged?: boolean,
): void {
  console.log('');

  if (dryRun) {
    prompts.outro(colors.yellow('Dry run complete. No files were modified.'));
    return;
  }

  const changes: string[] = [];
  if (envChanged) changes.push('.env updated with new variables');
  if (composeChanged) changes.push('docker-compose.yml router patched');
  if (templateFilesUpdated > 0) changes.push(`${templateFilesUpdated} template file(s) updated`);
  changes.push(`templateVersion set to ${newVersion}`);

  if (changes.length > 0) {
    prompts.outro(colors.green(`Upgrade complete: ${changes.join(', ')}.`));
  } else {
    prompts.outro(colors.green('Everything is up to date.'));
  }
}
