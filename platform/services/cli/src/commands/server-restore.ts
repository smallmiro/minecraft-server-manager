import { Paths, log, colors } from '@minecraft-docker/shared';
import { existsSync, readdirSync, statSync, copyFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import * as tar from 'tar';
import * as readline from 'node:readline';

export interface ServerRestoreOptions {
  root?: string;
  serverName?: string;
  backupId?: string;
  force?: boolean;
  dryRun?: boolean;
  json?: boolean;
}

interface BackupManifest {
  version: string;
  serverName: string;
  createdAt: string;
  description: string;
  mcctlVersion: string;
  files: Array<{
    path: string;
    size: number;
    checksum: string;
  }>;
  serverConfig: {
    type?: string;
    version?: string;
    memory?: string;
  };
}

/**
 * Get the backup directory for a server
 */
function getBackupDir(paths: Paths, serverName: string): string {
  return join(paths.backups, 'servers', serverName);
}

/**
 * Read manifest from backup file
 */
async function readManifest(backupPath: string): Promise<BackupManifest | null> {
  return new Promise((resolve) => {
    let manifest: BackupManifest | null = null;

    tar.list({
      file: backupPath,
      onentry: (entry) => {
        if (entry.path === 'manifest.json') {
          const chunks: Buffer[] = [];
          entry.on('data', (chunk: Buffer) => chunks.push(chunk));
          entry.on('end', () => {
            try {
              manifest = JSON.parse(Buffer.concat(chunks).toString('utf-8'));
            } catch {
              // Ignore parse errors
            }
          });
        }
      }
    }).then(() => resolve(manifest)).catch(() => resolve(null));
  });
}

/**
 * Ask user for confirmation
 */
async function confirm(message: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question(`${message} (y/N): `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

/**
 * List available backups and let user select
 */
async function selectBackup(
  paths: Paths,
  serverName: string
): Promise<string | null> {
  const backupDir = getBackupDir(paths, serverName);

  if (!existsSync(backupDir)) {
    log.error(`No backups found for server '${serverName}'`);
    return null;
  }

  const files = readdirSync(backupDir)
    .filter(f => f.endsWith('.tar.gz'))
    .sort()
    .reverse();

  if (files.length === 0) {
    log.error(`No backups found for server '${serverName}'`);
    return null;
  }

  console.log(colors.bold(`\nAvailable backups for ${serverName}:\n`));

  const backupInfos: Array<{ id: string; date: string; description: string }> = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i]!;
    const filePath = join(backupDir, file);
    const id = file.replace('.tar.gz', '');
    const stat = statSync(filePath);
    const date = stat.mtime.toLocaleString();

    // Try to read description from manifest
    const manifest = await readManifest(filePath);
    const description = manifest?.description || '';

    backupInfos.push({ id, date, description });
    console.log(`  ${colors.cyan(`[${i + 1}]`)} ${id}`);
    console.log(`      Created: ${date}`);
    if (description) {
      console.log(`      Description: ${description}`);
    }
  }

  console.log('');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question('Select backup number (or press Enter to cancel): ', (answer) => {
      rl.close();

      if (!answer.trim()) {
        resolve(null);
        return;
      }

      const num = parseInt(answer, 10);
      if (isNaN(num) || num < 1 || num > backupInfos.length) {
        log.error('Invalid selection');
        resolve(null);
        return;
      }

      resolve(backupInfos[num - 1]!.id);
    });
  });
}

/**
 * Restore a backup
 */
async function restoreBackup(
  paths: Paths,
  serverName: string,
  backupId: string,
  force: boolean,
  dryRun: boolean,
  json: boolean
): Promise<number> {
  const backupDir = getBackupDir(paths, serverName);
  const backupPath = join(backupDir, `${backupId}.tar.gz`);
  const serverDir = paths.serverDir(serverName);

  if (!existsSync(backupPath)) {
    if (json) {
      console.log(JSON.stringify({
        success: false,
        error: 'backup_not_found',
        backupId,
        server: serverName
      }));
    } else {
      log.error(`Backup '${backupId}' not found for server '${serverName}'`);
    }
    return 1;
  }

  if (!existsSync(serverDir)) {
    if (json) {
      console.log(JSON.stringify({
        success: false,
        error: 'server_not_found',
        server: serverName
      }));
    } else {
      log.error(`Server '${serverName}' not found`);
    }
    return 1;
  }

  // Read manifest
  const manifest = await readManifest(backupPath);

  if (!manifest) {
    if (json) {
      console.log(JSON.stringify({
        success: false,
        error: 'invalid_backup',
        message: 'Could not read backup manifest',
        backupId,
        server: serverName
      }));
    } else {
      log.error('Could not read backup manifest');
    }
    return 1;
  }

  // Show what will be restored
  if (!json) {
    console.log(colors.bold(`\nRestore Summary:\n`));
    console.log(`  Server: ${serverName}`);
    console.log(`  Backup: ${backupId}`);
    console.log(`  Created: ${new Date(manifest.createdAt).toLocaleString()}`);
    if (manifest.description) {
      console.log(`  Description: ${manifest.description}`);
    }
    console.log(`\n  Files to restore:`);
    for (const file of manifest.files) {
      const exists = existsSync(join(serverDir, file.path));
      const status = exists ? colors.yellow('(overwrite)') : colors.green('(new)');
      console.log(`    - ${file.path} ${status}`);
    }
    console.log('');
  }

  if (dryRun) {
    if (json) {
      console.log(JSON.stringify({
        success: true,
        dryRun: true,
        server: serverName,
        backupId,
        files: manifest.files.map(f => f.path)
      }));
    } else {
      log.info('Dry run complete. No changes were made.');
    }
    return 0;
  }

  // Confirm unless forced
  if (!force && !json) {
    const confirmed = await confirm('Proceed with restore?');
    if (!confirmed) {
      log.info('Restore cancelled.');
      return 0;
    }
  }

  try {
    // Create backup of current files before overwriting
    const preRestoreBackupDir = join(backupDir, '.pre-restore');
    if (!existsSync(preRestoreBackupDir)) {
      mkdirSync(preRestoreBackupDir, { recursive: true });
    }

    for (const file of manifest.files) {
      const currentPath = join(serverDir, file.path);
      if (existsSync(currentPath)) {
        const backupName = `${backupId}-${file.path.replace(/\//g, '_')}`;
        copyFileSync(currentPath, join(preRestoreBackupDir, backupName));
      }
    }

    // Extract files from backup
    await tar.extract({
      file: backupPath,
      cwd: serverDir,
      filter: (path) => path !== 'manifest.json' // Don't extract manifest to server dir
    });

    if (json) {
      console.log(JSON.stringify({
        success: true,
        server: serverName,
        backupId,
        filesRestored: manifest.files.length,
        preRestoreBackup: preRestoreBackupDir
      }));
    } else {
      console.log(colors.green(`\n✓ Restore completed successfully!\n`));
      console.log(`  Files restored: ${manifest.files.length}`);
      console.log(`  Pre-restore backup: ${preRestoreBackupDir}`);
      console.log('');
      log.warn('Server may need to be restarted for changes to take effect.');
    }

    return 0;
  } catch (err) {
    if (json) {
      console.log(JSON.stringify({
        success: false,
        error: 'restore_failed',
        message: err instanceof Error ? err.message : String(err),
        server: serverName,
        backupId
      }));
    } else {
      log.error(`Failed to restore backup: ${err instanceof Error ? err.message : String(err)}`);
    }
    return 1;
  }
}

/**
 * Server restore command handler
 */
export async function serverRestoreCommand(options: ServerRestoreOptions): Promise<number> {
  const paths = new Paths(options.root);

  if (!paths.isInitialized()) {
    log.error('Platform not initialized. Run: mcctl init');
    return 1;
  }

  if (!options.serverName) {
    log.error('Server name is required');
    log.info('Usage: mcctl server-restore <server> [backup-id] [--force] [--dry-run]');
    return 1;
  }

  // Normalize server name (remove mc- prefix if present)
  const serverName = options.serverName.startsWith('mc-')
    ? options.serverName.slice(3)
    : options.serverName;

  let backupId = options.backupId;

  // If no backup ID provided, show interactive selection
  if (!backupId && !options.json) {
    backupId = await selectBackup(paths, serverName) ?? undefined;
    if (!backupId) {
      return 0; // User cancelled
    }
  } else if (!backupId) {
    if (options.json) {
      console.log(JSON.stringify({
        success: false,
        error: 'backup_id_required',
        server: serverName
      }));
    } else {
      log.error('Backup ID is required');
    }
    return 1;
  }

  return restoreBackup(
    paths,
    serverName,
    backupId,
    options.force ?? false,
    options.dryRun ?? false,
    options.json ?? false
  );
}
