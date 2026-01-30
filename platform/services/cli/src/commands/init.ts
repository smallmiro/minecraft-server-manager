import { existsSync, mkdirSync, copyFileSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { execSync } from 'node:child_process';
import { Paths, Config, log, colors, checkDocker, checkDockerCompose } from '@minecraft-docker/shared';
import type { McctlConfig } from '@minecraft-docker/shared';
import { selectHostIPs, getNetworkInterfaces } from '../lib/prompts/ip-select.js';

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
    console.log(colors.cyan('[1/6] Checking prerequisites...'));

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
  console.log(colors.cyan('[2/6] Creating directory structure...'));

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
  console.log(colors.cyan('[3/6] Copying template files...'));

  const templateFiles: Array<{ src: string; dest: string; transform?: (content: string) => string }> = [
    { src: 'docker-compose.yml', dest: 'docker-compose.yml' },
    { src: '.env.example', dest: '.env' },
    { src: 'gitignore.template', dest: '.gitignore' },
    { src: 'servers/compose.template.yml', dest: 'servers/compose.yml' },
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

  // Step 4: Configure host IP(s)
  console.log(colors.cyan('[4/6] Configuring host IP address(es)...'));

  // Detect available network interfaces
  const interfaces = getNetworkInterfaces();
  if (interfaces.length > 0) {
    console.log('');
    console.log('  Detected network interfaces:');
    for (const iface of interfaces.slice(0, 5)) {  // Show max 5
      console.log(`    ${colors.cyan(iface.address)} (${iface.name})`);
    }
    if (interfaces.length > 5) {
      console.log(`    ... and ${interfaces.length - 5} more`);
    }
    console.log('');
  }

  const selectedIPs = await selectHostIPs();

  if (selectedIPs === null) {
    log.warn('IP selection cancelled. Using auto-detection.');
  } else {
    // Update .env file with selected IPs
    const envPath = join(paths.root, '.env');
    if (existsSync(envPath)) {
      let envContent = readFileSync(envPath, 'utf-8');

      // Determine if single IP or multiple IPs
      const ipList = selectedIPs.split(',');
      const primaryIP = ipList[0];

      if (ipList.length === 1) {
        // Single IP - use HOST_IP
        envContent = envContent.replace(
          /^HOST_IP=.*$/m,
          `HOST_IP=${primaryIP}`
        );
        console.log(`  ✓ Set HOST_IP=${primaryIP}`);
      } else {
        // Multiple IPs - use HOST_IPS and set HOST_IP to first
        envContent = envContent.replace(
          /^HOST_IP=.*$/m,
          `HOST_IP=${primaryIP}`
        );

        // Add or update HOST_IPS
        if (envContent.includes('HOST_IPS=')) {
          envContent = envContent.replace(
            /^HOST_IPS=.*$/m,
            `HOST_IPS=${selectedIPs}`
          );
        } else {
          // Add HOST_IPS after HOST_IP line
          envContent = envContent.replace(
            /^(HOST_IP=.*)$/m,
            `$1\nHOST_IPS=${selectedIPs}`
          );
        }
        console.log(`  ✓ Set HOST_IP=${primaryIP}`);
        console.log(`  ✓ Set HOST_IPS=${selectedIPs}`);
      }

      writeFileSync(envPath, envContent, 'utf-8');
    }
  }
  console.log('');

  // Step 5: Create mcctl config
  console.log(colors.cyan('[5/6] Creating configuration...'));

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

  // Step 6: Setup Docker (optional)
  if (!options.skipDocker) {
    console.log(colors.cyan('[6/6] Setting up Docker network...'));

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
