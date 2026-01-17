import { existsSync, mkdirSync, copyFileSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { execSync } from 'node:child_process';
import { Paths, Config, log, colors, checkDocker, checkDockerCompose } from '@minecraft-docker/shared';
import type { McctlConfig } from '@minecraft-docker/shared';

/**
 * Copy directory recursively
 */
function copyDirSync(src: string, dest: string): void {
  if (!existsSync(src)) return;

  mkdirSync(dest, { recursive: true });

  const entries = require('node:fs').readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = join(src, entry.name);
    const destPath = join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      copyFileSync(srcPath, destPath);
    }
  }
}

/**
 * Initialize the platform
 */
export async function initCommand(options: {
  root?: string;
  skipValidation?: boolean;
  skipDocker?: boolean;
}): Promise<number> {
  const paths = new Paths(options.root);
  const config = new Config(paths);

  console.log('');
  console.log(colors.bold('='.repeat(60)));
  console.log(colors.bold('  Minecraft Server Platform - Initialization'));
  console.log(colors.bold('='.repeat(60)));
  console.log('');
  console.log(`  Data directory: ${colors.cyan(paths.root)}`);
  console.log('');

  // Check if already initialized
  if (paths.isInitialized()) {
    log.warn('Platform is already initialized');
    console.log(`  Config: ${paths.configFile}`);
    console.log(`  Compose: ${paths.composeFile}`);
    console.log('');
    console.log('  To reinitialize, delete the data directory first:');
    console.log(`    ${colors.dim(`rm -rf ${paths.root}`)}`);
    console.log('');
    return 0;
  }

  // Step 1: Validate prerequisites
  if (!options.skipValidation) {
    console.log(colors.cyan('[1/5] Checking prerequisites...'));

    if (!checkDocker()) {
      log.error('Docker is not installed or not running');
      console.log('');
      console.log('  Please install Docker:');
      console.log('    https://docs.docker.com/get-docker/');
      return 1;
    }
    console.log('  ✓ Docker is available');

    if (!checkDockerCompose()) {
      log.error('Docker Compose is not installed');
      console.log('');
      console.log('  Please install Docker Compose v2:');
      console.log('    https://docs.docker.com/compose/install/');
      return 1;
    }
    console.log('  ✓ Docker Compose is available');

    // Check avahi-daemon (optional)
    try {
      execSync('which avahi-daemon', { stdio: 'pipe' });
      console.log('  ✓ avahi-daemon is available (mDNS support)');
    } catch {
      log.warn('avahi-daemon not found - mDNS will not work');
      console.log('    Install with: sudo apt install avahi-daemon');
    }

    console.log('');
  }

  // Step 2: Create directory structure
  console.log(colors.cyan('[2/5] Creating directory structure...'));

  const directories = [
    paths.root,
    paths.servers,
    paths.serverTemplate,
    paths.worlds,
    paths.locks,
    join(paths.root, 'shared', 'plugins'),
    join(paths.root, 'shared', 'mods'),
    paths.backups,
  ];

  for (const dir of directories) {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
      console.log(`  Created: ${dir.replace(paths.root, '~/.minecraft-servers')}`);
    }
  }
  console.log('');

  // Step 3: Copy template files
  console.log(colors.cyan('[3/5] Copying template files...'));

  const templateFiles: Array<{ src: string; dest: string; transform?: (content: string) => string }> = [
    { src: 'docker-compose.yml', dest: 'docker-compose.yml' },
    { src: '.env.example', dest: '.env' },
    { src: '.gitignore', dest: '.gitignore' },
    { src: 'servers/compose.yml', dest: 'servers/compose.yml' },
    { src: 'servers/_template/docker-compose.yml', dest: 'servers/_template/docker-compose.yml' },
    { src: 'servers/_template/config.env', dest: 'servers/_template/config.env' },
  ];

  for (const { src, dest, transform } of templateFiles) {
    const srcPath = join(paths.templates, src);
    const destPath = join(paths.root, dest);

    if (!existsSync(srcPath)) {
      log.warn(`Template not found: ${src}`);
      continue;
    }

    const destDir = dirname(destPath);
    if (!existsSync(destDir)) {
      mkdirSync(destDir, { recursive: true });
    }

    if (transform) {
      let content = readFileSync(srcPath, 'utf-8');
      content = transform(content);
      writeFileSync(destPath, content, 'utf-8');
    } else {
      copyFileSync(srcPath, destPath);
    }

    console.log(`  Copied: ${dest}`);
  }
  console.log('');

  // Step 4: Create mcctl config
  console.log(colors.cyan('[4/5] Creating configuration...'));

  const mcctlConfig: McctlConfig = {
    version: '0.1.0',
    initialized: new Date().toISOString(),
    dataDir: paths.root,
    defaultType: 'PAPER',
    defaultVersion: '1.21.1',
    autoStart: true,
    avahiEnabled: true,
  };

  config.save(mcctlConfig);
  console.log(`  Created: .mcctl.json`);
  console.log('');

  // Step 5: Setup Docker (optional)
  if (!options.skipDocker) {
    console.log(colors.cyan('[5/5] Setting up Docker network...'));

    try {
      // Check if network exists
      execSync('docker network inspect minecraft-net', { stdio: 'pipe' });
      console.log('  ✓ Network minecraft-net already exists');
    } catch {
      // Create network
      try {
        execSync('docker network create --driver bridge --subnet 172.28.0.0/16 minecraft-net', {
          stdio: 'pipe',
        });
        console.log('  ✓ Created network: minecraft-net');
      } catch (err) {
        log.warn('Failed to create Docker network (may already exist)');
      }
    }
    console.log('');
  }

  // Success message
  console.log(colors.green('═'.repeat(60)));
  console.log(colors.green('  ✓ Platform initialized successfully!'));
  console.log(colors.green('═'.repeat(60)));
  console.log('');
  console.log('  Next steps:');
  console.log('');
  console.log(`  1. Edit configuration (optional):`);
  console.log(`     ${colors.dim(`nano ${paths.envFile}`)}`);
  console.log('');
  console.log(`  2. Create your first server:`);
  console.log(`     ${colors.cyan('mcctl create myserver')}`);
  console.log('');
  console.log(`  3. Connect via Minecraft:`);
  console.log(`     ${colors.cyan('myserver.local:25565')}`);
  console.log('');
  console.log('  For help:');
  console.log(`     ${colors.dim('mcctl --help')}`);
  console.log('');

  return 0;
}
