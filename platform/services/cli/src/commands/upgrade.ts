import { existsSync, readFileSync, writeFileSync, copyFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { Paths, Config, log, colors } from '@minecraft-docker/shared';
import type { McctlConfig } from '@minecraft-docker/shared';
import { diffEnvFiles, applyEnvDiff } from '../lib/env-diff.js';
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

  // --- Step 2: Update servers/_template files ---
  templateFilesUpdated = updateTemplateFiles(paths, options);

  // --- Step 3: Update templateVersion in config ---
  if (!options.dryRun) {
    const updatedConfig: McctlConfig = mcctlConfig
      ? { ...mcctlConfig, templateVersion: cliVersion }
      : {
          version: cliVersion,
          initialized: new Date().toISOString(),
          dataDir: paths.root,
          defaultType: 'PAPER',
          defaultVersion: '1.21.1',
          autoStart: true,
          avahiEnabled: true,
          templateVersion: cliVersion,
        };
    config.save(updatedConfig);
  }

  // --- Summary ---
  printSummary(envChangesApplied, templateFilesUpdated, cliVersion, options.dryRun);

  return 0;
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
 * Print upgrade summary.
 */
function printSummary(
  envChanged: boolean,
  templateFilesUpdated: number,
  newVersion: string,
  dryRun?: boolean,
): void {
  console.log('');

  if (dryRun) {
    prompts.outro(colors.yellow('Dry run complete. No files were modified.'));
    return;
  }

  const changes: string[] = [];
  if (envChanged) changes.push('.env updated with new variables');
  if (templateFilesUpdated > 0) changes.push(`${templateFilesUpdated} template file(s) updated`);
  changes.push(`templateVersion set to ${newVersion}`);

  if (changes.length > 0) {
    prompts.outro(colors.green(`Upgrade complete: ${changes.join(', ')}.`));
  } else {
    prompts.outro(colors.green('Everything is up to date.'));
  }
}
