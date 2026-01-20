import { Paths, log, colors } from '@minecraft-docker/shared';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, createWriteStream } from 'node:fs';
import { join, basename } from 'node:path';
import { createHash } from 'node:crypto';
import { createGzip } from 'node:zlib';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import * as tar from 'tar';

export interface ServerBackupOptions {
  root?: string;
  serverName?: string;
  message?: string;
  list?: boolean;
  json?: boolean;
}

export interface BackupManifest {
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

export interface BackupListItem {
  id: string;
  createdAt: string;
  description: string;
  size: number;
  fileCount: number;
}

/**
 * Get the backup directory for a server
 */
function getBackupDir(paths: Paths, serverName: string): string {
  return join(paths.backups, 'servers', serverName);
}

/**
 * Calculate SHA256 checksum of a file
 */
function calculateChecksum(filePath: string): string {
  const content = readFileSync(filePath);
  return `sha256:${createHash('sha256').update(content).digest('hex')}`;
}

/**
 * Generate backup ID from current timestamp
 */
function generateBackupId(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  return `${year}${month}${day}-${hours}${minutes}${seconds}`;
}

/**
 * Read server config.env and extract key settings
 */
function readServerConfig(configPath: string): BackupManifest['serverConfig'] {
  if (!existsSync(configPath)) {
    return {};
  }

  const content = readFileSync(configPath, 'utf-8');
  const config: BackupManifest['serverConfig'] = {};

  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const match = trimmed.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (match) {
      const [, key, value] = match;
      const cleanValue = value!.replace(/^["']|["']$/g, '');

      if (key === 'TYPE') config.type = cleanValue;
      if (key === 'VERSION') config.version = cleanValue;
      if (key === 'MEMORY') config.memory = cleanValue;
    }
  }

  return config;
}

/**
 * List all backups for a server
 */
async function listBackups(
  paths: Paths,
  serverName: string,
  json: boolean
): Promise<number> {
  const backupDir = getBackupDir(paths, serverName);

  if (!existsSync(backupDir)) {
    if (json) {
      console.log(JSON.stringify({ server: serverName, backups: [] }));
    } else {
      log.info(`No backups found for server '${serverName}'`);
    }
    return 0;
  }

  const files = readdirSync(backupDir)
    .filter(f => f.endsWith('.tar.gz'))
    .sort()
    .reverse();

  const backups: BackupListItem[] = [];

  for (const file of files) {
    const filePath = join(backupDir, file);
    const stat = statSync(filePath);
    const id = file.replace('.tar.gz', '');

    // Try to read manifest from tar
    let description = '';
    let fileCount = 0;

    try {
      const entries: string[] = [];
      await tar.list({
        file: filePath,
        onentry: (entry) => {
          entries.push(entry.path);
          if (entry.path === 'manifest.json') {
            const chunks: Buffer[] = [];
            entry.on('data', (chunk: Buffer) => chunks.push(chunk));
            entry.on('end', () => {
              try {
                const manifest = JSON.parse(Buffer.concat(chunks).toString('utf-8'));
                description = manifest.description || '';
                fileCount = manifest.files?.length || 0;
              } catch {
                // Ignore parse errors
              }
            });
          }
        }
      });

      if (fileCount === 0) {
        fileCount = entries.filter(e => e !== 'manifest.json').length;
      }
    } catch {
      // If we can't read the tar, just use file stats
    }

    backups.push({
      id,
      createdAt: stat.mtime.toISOString(),
      description,
      size: stat.size,
      fileCount
    });
  }

  if (json) {
    console.log(JSON.stringify({ server: serverName, backups }));
  } else {
    console.log(colors.bold(`\nBackups for ${serverName}:\n`));

    if (backups.length === 0) {
      console.log('  (none)');
    } else {
      for (const backup of backups) {
        const sizeKB = Math.round(backup.size / 1024);
        const date = new Date(backup.createdAt).toLocaleString();
        console.log(`  ${colors.cyan(backup.id)}`);
        console.log(`    Created: ${date}`);
        console.log(`    Size: ${sizeKB} KB, Files: ${backup.fileCount}`);
        if (backup.description) {
          console.log(`    Description: ${backup.description}`);
        }
        console.log('');
      }
    }
  }

  return 0;
}

/**
 * Create a backup of server configuration
 */
async function createBackup(
  paths: Paths,
  serverName: string,
  message: string,
  json: boolean
): Promise<number> {
  const serverDir = paths.serverDir(serverName);

  if (!existsSync(serverDir)) {
    if (json) {
      console.log(JSON.stringify({ success: false, error: 'server_not_found', server: serverName }));
    } else {
      log.error(`Server '${serverName}' not found`);
    }
    return 1;
  }

  const backupDir = getBackupDir(paths, serverName);
  const backupId = generateBackupId();
  const backupPath = join(backupDir, `${backupId}.tar.gz`);

  // Create backup directory if needed
  if (!existsSync(backupDir)) {
    mkdirSync(backupDir, { recursive: true });
  }

  // Define files to backup
  const backupTargets = [
    { path: 'config.env', required: true },
    { path: 'docker-compose.yml', required: true },
    { path: 'data/ops.json', required: false },
    { path: 'data/whitelist.json', required: false },
    { path: 'data/banned-players.json', required: false },
    { path: 'data/banned-ips.json', required: false },
    { path: 'data/server.properties', required: false },
  ];

  // Collect files that exist
  const filesToBackup: Array<{ path: string; fullPath: string; size: number; checksum: string }> = [];

  for (const target of backupTargets) {
    const fullPath = join(serverDir, target.path);
    if (existsSync(fullPath)) {
      const stat = statSync(fullPath);
      filesToBackup.push({
        path: target.path,
        fullPath,
        size: stat.size,
        checksum: calculateChecksum(fullPath)
      });
    } else if (target.required) {
      if (json) {
        console.log(JSON.stringify({
          success: false,
          error: 'missing_required_file',
          file: target.path,
          server: serverName
        }));
      } else {
        log.error(`Required file missing: ${target.path}`);
      }
      return 1;
    }
  }

  // Create manifest
  const configPath = join(serverDir, 'config.env');
  const manifest: BackupManifest = {
    version: '1.0',
    serverName,
    createdAt: new Date().toISOString(),
    description: message || '',
    mcctlVersion: '1.3.0',
    files: filesToBackup.map(f => ({
      path: f.path,
      size: f.size,
      checksum: f.checksum
    })),
    serverConfig: readServerConfig(configPath)
  };

  // Create temporary manifest file content
  const manifestContent = JSON.stringify(manifest, null, 2);

  try {
    // Create tar.gz with all files
    const fileList = filesToBackup.map(f => f.path);

    await tar.create(
      {
        gzip: true,
        file: backupPath,
        cwd: serverDir,
        prefix: ''
      },
      fileList
    );

    // We need to add manifest to the archive
    // Since tar.create doesn't easily support adding strings, we'll recreate with manifest
    const tempManifestPath = join(serverDir, 'manifest.json.tmp');
    const fs = await import('node:fs/promises');
    await fs.writeFile(tempManifestPath, manifestContent);

    // Recreate archive with manifest
    await tar.create(
      {
        gzip: true,
        file: backupPath,
        cwd: serverDir,
        prefix: ''
      },
      ['manifest.json.tmp', ...fileList]
    );

    // Rename manifest.json.tmp to manifest.json inside archive by recreating
    // Actually, let's just create properly
    await fs.unlink(tempManifestPath);

    // Create the archive properly with manifest
    const manifestPath = join(serverDir, 'manifest.json');
    await fs.writeFile(manifestPath, manifestContent);

    await tar.create(
      {
        gzip: true,
        file: backupPath,
        cwd: serverDir,
        prefix: ''
      },
      ['manifest.json', ...fileList]
    );

    await fs.unlink(manifestPath);

    const stat = statSync(backupPath);
    const sizeKB = Math.round(stat.size / 1024);

    if (json) {
      console.log(JSON.stringify({
        success: true,
        server: serverName,
        backupId,
        path: backupPath,
        size: stat.size,
        files: manifest.files.length,
        description: message || null
      }));
    } else {
      console.log(colors.green(`\n✓ Backup created successfully!\n`));
      console.log(`  ID: ${colors.cyan(backupId)}`);
      console.log(`  Path: ${backupPath}`);
      console.log(`  Size: ${sizeKB} KB`);
      console.log(`  Files: ${manifest.files.length}`);
      if (message) {
        console.log(`  Description: ${message}`);
      }
      console.log('');
    }

    return 0;
  } catch (err) {
    if (json) {
      console.log(JSON.stringify({
        success: false,
        error: 'backup_failed',
        message: err instanceof Error ? err.message : String(err),
        server: serverName
      }));
    } else {
      log.error(`Failed to create backup: ${err instanceof Error ? err.message : String(err)}`);
    }
    return 1;
  }
}

/**
 * Server backup command handler
 */
export async function serverBackupCommand(options: ServerBackupOptions): Promise<number> {
  const paths = new Paths(options.root);

  if (!paths.isInitialized()) {
    log.error('Platform not initialized. Run: mcctl init');
    return 1;
  }

  if (!options.serverName) {
    log.error('Server name is required');
    log.info('Usage: mcctl server-backup <server> [--list] [-m "message"]');
    return 1;
  }

  // Normalize server name (remove mc- prefix if present)
  const serverName = options.serverName.startsWith('mc-')
    ? options.serverName.slice(3)
    : options.serverName;

  if (options.list) {
    return listBackups(paths, serverName, options.json ?? false);
  }

  return createBackup(paths, serverName, options.message ?? '', options.json ?? false);
}
