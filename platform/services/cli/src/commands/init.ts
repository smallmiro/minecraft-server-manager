import { existsSync, mkdirSync, copyFileSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { execSync } from 'node:child_process';
import { Paths, Config, log, colors, checkPlatformPrerequisites } from '@minecraft-docker/shared';
import type { McctlConfig } from '@minecraft-docker/shared';
import { selectHostIPs, getNetworkInterfaces } from '../lib/prompts/ip-select.js';
import { multiselect, text, select, confirm, password, isCancel } from '@clack/prompts';
import { displayPrerequisiteReport } from '../lib/prerequisite-display.js';
import { printBanner, getGitHash, type UpdateCheckResult } from '../lib/banner.js';
import {
  getInstalledVersion,
  fetchLatestVersionForced,
  isUpdateAvailable,
} from '../lib/update-checker.js';

/**
 * Initialize the platform
 */
export async function initCommand(options: {
  root?: string;
  skipValidation?: boolean;
  skipDocker?: boolean;
  reconfigure?: boolean;
  upgrade?: boolean;
  playitKey?: string;
  noPlayit?: boolean;
}): Promise<number> {
  // Route to upgrade command if --upgrade flag is set
  if (options.upgrade) {
    const { upgradeCommand } = await import('./upgrade.js');
    return upgradeCommand({ root: options.root });
  }

  const paths = new Paths(options.root);
  const config = new Config(paths);

  // Get version info for banner
  const version = getInstalledVersion();
  const gitHash = getGitHash();

  // Check for updates (non-blocking, with timeout)
  let updateInfo: UpdateCheckResult | null = null;
  try {
    const latestVersion = await fetchLatestVersionForced();
    if (latestVersion && isUpdateAvailable(version, latestVersion)) {
      updateInfo = {
        currentVersion: version,
        latestVersion,
        updateCommand: 'npm install -g @minecraft-docker/mcctl',
      };
    }
  } catch {
    // Silently ignore update check failures
  }

  // Print creeper banner
  printBanner({ version, gitHash, updateInfo });

  console.log(`  Data directory: ${colors.cyan(paths.root)}`);
  console.log('');

  // Check if already initialized
  if (paths.isInitialized()) {
    if (options.reconfigure) {
      return reconfigureCommand(paths, config);
    }
    log.warn('Platform is already initialized');
    console.log(`  Config: ${paths.configFile}`);
    console.log(`  Compose: ${paths.composeFile}`);
    console.log('');
    console.log('  To reconfigure settings:');
    console.log(`    ${colors.cyan('mcctl init --reconfigure')}`);
    console.log('');
    console.log('  To reinitialize, delete the data directory first:');
    console.log(`    ${colors.dim(`rm -rf ${paths.root}`)}`);
    console.log('');
    return 0;
  }

  // Step 1: Validate prerequisites
  if (!options.skipValidation) {
    console.log(colors.cyan('[1/6] Checking prerequisites...'));

    const report = checkPlatformPrerequisites();
    if (!displayPrerequisiteReport(report)) {
      return 1;
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

  // Step 4.5: Configure playit.gg (optional)
  console.log(colors.cyan('[4.5/6] Configuring playit.gg (optional)...'));

  let playitEnabled = false;
  let playitSecretKey: string | undefined;

  // Determine playit setup from options or prompt
  if (options.playitKey) {
    // Non-interactive: --playit-key provided
    playitEnabled = true;
    playitSecretKey = options.playitKey;
    console.log('  ✓ playit.gg enabled (via --playit-key)');
  } else if (options.noPlayit) {
    // Non-interactive: --no-playit provided
    playitEnabled = false;
    console.log('  ✓ playit.gg disabled (via --no-playit)');
  } else {
    // Interactive mode: prompt user
    console.log('');
    console.log('  playit.gg enables external access without port forwarding.');
    console.log('  Setup: https://playit.gg/account/agents/new-docker');
    console.log('');

    const enablePlayit = await confirm({
      message: 'Enable playit.gg tunneling?',
      initialValue: false,
    });

    if (isCancel(enablePlayit)) {
      log.warn('Playit setup cancelled. Continuing without playit.gg.');
      playitEnabled = false;
    } else if (enablePlayit) {
      playitEnabled = true;

      // Prompt for SECRET_KEY
      const secretKey = await password({
        message: 'playit.gg SECRET_KEY?',
        validate: (value) => {
          if (!value || value.trim().length === 0) {
            return 'SECRET_KEY is required';
          }
          return undefined;
        },
      });

      if (isCancel(secretKey)) {
        log.warn('SECRET_KEY input cancelled. Disabling playit.gg.');
        playitEnabled = false;
      } else {
        playitSecretKey = secretKey as string;
        console.log('  ✓ playit.gg SECRET_KEY configured');
      }
    } else {
      playitEnabled = false;
      console.log('  ✓ playit.gg disabled');
    }
  }

  // Update .env file with PLAYIT_SECRET_KEY if enabled
  if (playitEnabled && playitSecretKey) {
    const envPath = join(paths.root, '.env');
    if (existsSync(envPath)) {
      let envContent = readFileSync(envPath, 'utf-8');

      // Check if PLAYIT_SECRET_KEY line already exists (commented or not)
      if (envContent.includes('PLAYIT_SECRET_KEY=')) {
        // Replace existing line
        envContent = envContent.replace(
          /^#?\s*PLAYIT_SECRET_KEY=.*$/m,
          `PLAYIT_SECRET_KEY=${playitSecretKey}`
        );
      } else {
        // Add new line in the playit.gg section
        const playitSectionRegex = /# External Access \(playit\.gg\)[\s\S]*?(?=\n#|$)/;
        const match = envContent.match(playitSectionRegex);
        if (match) {
          const insertPos = match.index! + match[0].length;
          envContent =
            envContent.slice(0, insertPos) +
            `\nPLAYIT_SECRET_KEY=${playitSecretKey}` +
            envContent.slice(insertPos);
        } else {
          // Fallback: append at the end
          envContent += `\n# playit.gg\nPLAYIT_SECRET_KEY=${playitSecretKey}\n`;
        }
      }

      writeFileSync(envPath, envContent, 'utf-8');
      console.log(`  ✓ Saved PLAYIT_SECRET_KEY to .env`);
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
    playitEnabled,
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

/**
 * Configurable settings for reconfiguration
 */
interface ConfigurableSetting {
  key: string;
  label: string;
  source: 'env' | 'config';
  currentValue: string;
  type: 'text' | 'select' | 'confirm' | 'password' | 'ip';
  validate?: (value: string) => string | undefined;
  options?: Array<{ value: string; label: string }>;
}

/**
 * Reconfigure existing platform settings
 */
async function reconfigureCommand(paths: Paths, config: Config): Promise<number> {
  console.log('');
  console.log(colors.bold('═'.repeat(60)));
  console.log(colors.bold('  Minecraft Server Platform - Reconfigure'));
  console.log(colors.bold('═'.repeat(60)));
  console.log('');

  // Load current settings
  const envConfig = config.loadEnv();
  let mcctlConfig = config.load();

  if (!mcctlConfig) {
    // Create default config from .env values for platforms initialized before v2.3.0
    log.warn('Configuration file (.mcctl.json) not found, creating with defaults...');
    mcctlConfig = {
      version: '2.3.0',
      initialized: new Date().toISOString(),
      dataDir: paths.root,
      defaultType: 'PAPER' as const,
      defaultVersion: envConfig.DEFAULT_VERSION || '1.21.1',
      autoStart: true,
      avahiEnabled: false,
      playitEnabled: !!envConfig.PLAYIT_SECRET_KEY,
    };
    config.save(mcctlConfig);
  }

  // Display current settings
  const displayIPs = envConfig.HOST_IPS || envConfig.HOST_IP || 'auto-detect';
  console.log(colors.cyan('Current Settings:'));
  console.log('');
  console.log('  Network:');
  console.log(`    HOST_IP(s):        ${colors.yellow(displayIPs)}`);
  console.log(`    Timezone:          ${colors.yellow(envConfig.TZ || 'system default')}`);
  console.log('');
  console.log('  Defaults:');
  console.log(`    Default Memory:    ${colors.yellow(envConfig.DEFAULT_MEMORY || '4G')}`);
  console.log(`    Default Type:      ${colors.yellow(mcctlConfig.defaultType)}`);
  console.log(`    Default Version:   ${colors.yellow(mcctlConfig.defaultVersion)}`);
  console.log('');
  console.log('  Behavior:');
  console.log(`    Auto Start:        ${colors.yellow(String(mcctlConfig.autoStart))}`);
  console.log(`    Avahi Enabled:     ${colors.yellow(String(mcctlConfig.avahiEnabled))}`);
  console.log('');
  console.log('  Security:');
  console.log(`    RCON Password:     ${colors.yellow(envConfig.RCON_PASSWORD ? '********' : 'not set')}`);
  console.log('');

  // Build settings list
  const settings: ConfigurableSetting[] = [
    {
      key: 'HOST_IP',
      label: 'Host IP(s)',
      source: 'env',
      currentValue: displayIPs,
      type: 'ip',
    },
    {
      key: 'DEFAULT_MEMORY',
      label: 'Default Memory',
      source: 'env',
      currentValue: envConfig.DEFAULT_MEMORY || '4G',
      type: 'text',
      validate: (value) => {
        if (!/^\d+[MG]$/i.test(value)) {
          return 'Invalid format. Use format like 4G or 2048M';
        }
        return undefined;
      },
    },
    {
      key: 'TZ',
      label: 'Timezone',
      source: 'env',
      currentValue: envConfig.TZ || 'system default',
      type: 'text',
    },
    {
      key: 'defaultType',
      label: 'Default Server Type',
      source: 'config',
      currentValue: mcctlConfig.defaultType,
      type: 'select',
      options: [
        { value: 'PAPER', label: 'Paper (Recommended)' },
        { value: 'VANILLA', label: 'Vanilla' },
        { value: 'FORGE', label: 'Forge' },
        { value: 'FABRIC', label: 'Fabric' },
        { value: 'SPIGOT', label: 'Spigot' },
        { value: 'BUKKIT', label: 'Bukkit' },
      ],
    },
    {
      key: 'defaultVersion',
      label: 'Default MC Version',
      source: 'config',
      currentValue: mcctlConfig.defaultVersion,
      type: 'text',
      validate: (value) => {
        if (!/^\d+\.\d+(\.\d+)?$/.test(value)) {
          return 'Invalid version format. Use format like 1.21.1';
        }
        return undefined;
      },
    },
    {
      key: 'autoStart',
      label: 'Auto Start Servers',
      source: 'config',
      currentValue: String(mcctlConfig.autoStart),
      type: 'confirm',
    },
    {
      key: 'avahiEnabled',
      label: 'Avahi/mDNS Enabled',
      source: 'config',
      currentValue: String(mcctlConfig.avahiEnabled),
      type: 'confirm',
    },
    {
      key: 'RCON_PASSWORD',
      label: 'RCON Password',
      source: 'env',
      currentValue: envConfig.RCON_PASSWORD ? '********' : 'not set',
      type: 'password',
      validate: (value) => {
        if (value.length < 8) {
          return 'Password must be at least 8 characters';
        }
        return undefined;
      },
    },
  ];

  // Multiselect for settings to change
  const selectedKeys = await multiselect({
    message: 'Select settings to change:',
    options: settings.map((s) => ({
      value: s.key,
      label: s.label,
      hint: `Current: ${s.currentValue}`,
    })),
    required: false,
  });

  if (isCancel(selectedKeys) || (selectedKeys as string[]).length === 0) {
    console.log('');
    log.info('No changes made');
    return 0;
  }

  const keysToChange = selectedKeys as string[];
  const envUpdates: Record<string, string> = {};
  const configUpdates: Partial<McctlConfig> = {};
  let ipChanged = false;
  let newHostIPs = '';

  // Prompt for each selected setting
  for (const key of keysToChange) {
    const setting = settings.find((s) => s.key === key);
    if (!setting) continue;

    console.log('');

    if (setting.type === 'ip') {
      // Use the existing IP selection prompt
      const selectedIPs = await selectHostIPs();
      if (isCancel(selectedIPs) || selectedIPs === null) {
        continue;
      }
      const ipList = selectedIPs.split(',');
      const primaryIP = ipList[0];
      envUpdates['HOST_IP'] = primaryIP!;
      if (ipList.length > 1) {
        envUpdates['HOST_IPS'] = selectedIPs;
      }
      newHostIPs = selectedIPs;
      ipChanged = true;
      console.log(`  ${colors.green('✓')} HOST_IP=${primaryIP}`);
      if (ipList.length > 1) {
        console.log(`  ${colors.green('✓')} HOST_IPS=${selectedIPs}`);
      }
    } else if (setting.type === 'text') {
      const result = await text({
        message: `Enter ${setting.label}:`,
        placeholder: setting.currentValue,
        defaultValue: setting.currentValue === 'system default' ? '' : setting.currentValue,
        validate: setting.validate,
      });
      if (isCancel(result)) continue;
      const value = result as string;
      if (setting.source === 'env') {
        envUpdates[key] = value;
      } else {
        (configUpdates as Record<string, string>)[key] = value;
      }
      console.log(`  ${colors.green('✓')} ${key}=${value}`);
    } else if (setting.type === 'select' && setting.options) {
      const result = await select({
        message: `Select ${setting.label}:`,
        options: setting.options,
        initialValue: setting.currentValue,
      });
      if (isCancel(result)) continue;
      const value = result as string;
      if (setting.source === 'env') {
        envUpdates[key] = value;
      } else {
        (configUpdates as Record<string, string>)[key] = value;
      }
      console.log(`  ${colors.green('✓')} ${key}=${value}`);
    } else if (setting.type === 'confirm') {
      const result = await confirm({
        message: `Enable ${setting.label}?`,
        initialValue: setting.currentValue === 'true',
      });
      if (isCancel(result)) continue;
      const value = result as boolean;
      if (setting.source === 'env') {
        envUpdates[key] = String(value);
      } else {
        (configUpdates as Record<string, boolean>)[key] = value;
      }
      console.log(`  ${colors.green('✓')} ${key}=${value}`);
    } else if (setting.type === 'password') {
      const result = await password({
        message: `Enter ${setting.label}:`,
        validate: setting.validate,
      });
      if (isCancel(result)) continue;
      const value = result as string;
      envUpdates[key] = value;
      console.log(`  ${colors.green('✓')} ${key}=********`);
    }
  }

  // Apply changes to .env file
  if (Object.keys(envUpdates).length > 0) {
    config.updateEnv(envUpdates);
    console.log('');
    log.info('Updated .env file');
  }

  // Apply changes to .mcctl.json
  if (Object.keys(configUpdates).length > 0) {
    const updatedConfig: McctlConfig = { ...mcctlConfig, ...configUpdates };
    config.save(updatedConfig);
    console.log('');
    log.info('Updated .mcctl.json');
  }

  // Handle IP change - update server hostnames
  if (ipChanged && newHostIPs) {
    console.log('');
    const updateServers = await confirm({
      message: 'Update existing servers with new IP hostnames?',
      initialValue: true,
    });

    if (!isCancel(updateServers) && updateServers) {
      const updatedCount = await updateServerHostnames(paths, newHostIPs);
      if (updatedCount > 0) {
        console.log(`  ${colors.green('✓')} Updated ${updatedCount} server(s)`);
      }
    }

    // Prompt to restart mc-router
    const restartRouter = await confirm({
      message: 'Restart mc-router to apply changes?',
      initialValue: true,
    });

    if (!isCancel(restartRouter) && restartRouter) {
      try {
        // Using execSync with hardcoded command (no user input) - safe from injection
        execSync('docker compose restart mc-router', {
          cwd: paths.root,
          stdio: 'pipe',
        });
        console.log(`  ${colors.green('✓')} mc-router restarted`);
      } catch {
        log.warn('Failed to restart mc-router (may not be running)');
      }
    }
  }

  // Success message
  console.log('');
  console.log(colors.green('═'.repeat(60)));
  console.log(colors.green('  ✓ Configuration updated successfully!'));
  console.log(colors.green('═'.repeat(60)));
  console.log('');

  return 0;
}

/**
 * Update server docker-compose.yml files with new hostnames
 */
async function updateServerHostnames(paths: Paths, newHostIPs: string): Promise<number> {
  const serversDir = paths.servers;
  let updatedCount = 0;

  if (!existsSync(serversDir)) {
    return 0;
  }

  const serverDirs = readdirSync(serversDir, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory() && !dirent.name.startsWith('_'))
    .map((dirent) => dirent.name);

  for (const serverName of serverDirs) {
    const composeFile = join(serversDir, serverName, 'docker-compose.yml');
    if (!existsSync(composeFile)) {
      continue;
    }

    try {
      let content = readFileSync(composeFile, 'utf-8');

      // Build new hostname list
      const hostnames = buildHostnames(serverName, newHostIPs);

      // Replace mc-router.host label value
      // Match patterns like: mc-router.host: "server.local,server.ip.nip.io"
      const hostLabelRegex = /(mc-router\.host:\s*["'])([^"']+)(["'])/;
      const match = content.match(hostLabelRegex);

      if (match) {
        content = content.replace(hostLabelRegex, `$1${hostnames}$3`);
        writeFileSync(composeFile, content, 'utf-8');
        updatedCount++;
      }
    } catch {
      log.warn(`Failed to update ${serverName}/docker-compose.yml`);
    }
  }

  return updatedCount;
}

/**
 * Build hostname string from server name and IPs
 */
function buildHostnames(serverName: string, hostIPs: string): string {
  let hostnames = `${serverName}.local`;

  if (hostIPs) {
    const ips = hostIPs.split(',').map((ip) => ip.trim()).filter((ip) => ip);
    for (const ip of ips) {
      hostnames += `,${serverName}.${ip}.nip.io`;
    }
  }

  return hostnames;
}
