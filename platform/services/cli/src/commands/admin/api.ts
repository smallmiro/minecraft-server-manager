import { Command } from 'commander';
import * as p from '@clack/prompts';
import { Paths, colors } from '@minecraft-docker/shared';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomBytes } from 'node:crypto';

export interface AdminApiCommandOptions {
  json?: boolean;
  force?: boolean;
}

/**
 * Access modes for the API
 */
export type AccessMode = 'internal' | 'api-key' | 'ip-whitelist' | 'api-key-ip' | 'open';

/**
 * API configuration structure
 */
interface ApiConfig {
  accessMode: AccessMode;
  apiKey: string;
  port: number;
  ipWhitelist: string[];
}

/**
 * Get the API config file path
 */
function getConfigPath(): string {
  const paths = new Paths();
  return resolve(paths.platform, 'api-config.json');
}

/**
 * Load API configuration
 */
function loadConfig(): ApiConfig {
  const configPath = getConfigPath();

  if (!existsSync(configPath)) {
    // Return default config
    return {
      accessMode: 'internal',
      apiKey: generateApiKey(),
      port: 3001,
      ipWhitelist: [],
    };
  }

  try {
    const content = readFileSync(configPath, 'utf-8');
    return JSON.parse(content) as ApiConfig;
  } catch {
    return {
      accessMode: 'internal',
      apiKey: generateApiKey(),
      port: 3001,
      ipWhitelist: [],
    };
  }
}

/**
 * Save API configuration
 */
function saveConfig(config: ApiConfig): void {
  const configPath = getConfigPath();
  writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
}

/**
 * Generate a new API key
 */
function generateApiKey(): string {
  const bytes = randomBytes(32);
  return `mctk_${bytes.toString('hex')}`;
}

/**
 * Mask API key for display
 */
function maskApiKey(key: string): string {
  if (key.length <= 12) return key;
  const prefix = key.slice(0, 8);
  const suffix = key.slice(-4);
  return `${prefix}...${suffix}`;
}

/**
 * Validate CIDR notation
 */
function isValidCidr(value: string): boolean {
  // Simple IP validation (IPv4)
  const ipPattern = /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/;
  if (!ipPattern.test(value)) return false;

  const parts = value.split('/');
  const ip = parts[0]!;
  const cidr = parts[1] ? parseInt(parts[1], 10) : 32;

  // Validate IP octets
  const octets = ip.split('.').map(Number);
  if (octets.some((o) => o < 0 || o > 255)) return false;

  // Validate CIDR range
  if (cidr < 0 || cidr > 32) return false;

  return true;
}

/**
 * Show API status
 */
async function showStatus(options: AdminApiCommandOptions): Promise<void> {
  const config = loadConfig();

  if (options.json) {
    console.log(JSON.stringify({
      accessMode: config.accessMode,
      port: config.port,
      apiKey: maskApiKey(config.apiKey),
      ipWhitelist: config.ipWhitelist,
    }, null, 2));
    return;
  }

  console.log();
  console.log(colors.bold('API Configuration'));
  console.log();
  console.log(`  Access Mode: ${colors.cyan(config.accessMode)}`);
  console.log(`  Port: ${colors.cyan(config.port.toString())}`);
  console.log(`  API Key: ${colors.dim(maskApiKey(config.apiKey))}`);
  console.log();

  if (config.ipWhitelist.length > 0) {
    console.log('  IP Whitelist:');
    for (const ip of config.ipWhitelist) {
      console.log(`    • ${ip}`);
    }
  } else {
    console.log('  IP Whitelist: ' + colors.dim('(empty)'));
  }

  console.log();

  // Show mode description
  const modeDescriptions: Record<AccessMode, string> = {
    internal: 'Docker network only (most secure)',
    'api-key': 'External access with X-API-Key header',
    'ip-whitelist': 'IP-based access control',
    'api-key-ip': 'Both API key and IP required',
    open: colors.red('No authentication (development only!)'),
  };

  console.log(`  Mode: ${modeDescriptions[config.accessMode]}`);

  if (config.accessMode === 'open') {
    console.log();
    console.log(colors.red('  ⚠️  WARNING: API is open without authentication!'));
    console.log(colors.red('     Do not use this mode in production!'));
  }
}

/**
 * Regenerate API key
 */
async function regenerateKey(options: AdminApiCommandOptions): Promise<void> {
  const config = loadConfig();

  if (!options.force) {
    const confirmed = await p.confirm({
      message: 'Are you sure you want to regenerate the API key? All existing clients will need to be updated.',
    });

    if (p.isCancel(confirmed) || !confirmed) {
      p.cancel('Operation cancelled.');
      process.exit(0);
    }
  }

  config.apiKey = generateApiKey();
  saveConfig(config);

  console.log(colors.green('API key regenerated successfully.'));
  console.log();
  console.log(`New API Key: ${colors.cyan(config.apiKey)}`);
  console.log();
  console.log(colors.yellow('Please update all clients with the new API key.'));
}

/**
 * Change access mode
 */
async function changeMode(mode: string | undefined, options: AdminApiCommandOptions): Promise<void> {
  const config = loadConfig();
  const validModes: AccessMode[] = ['internal', 'api-key', 'ip-whitelist', 'api-key-ip', 'open'];

  let newMode: AccessMode;

  if (mode) {
    if (!validModes.includes(mode as AccessMode)) {
      console.error(colors.red(`Invalid mode: ${mode}`));
      console.error(`Valid modes: ${validModes.join(', ')}`);
      process.exit(1);
    }
    newMode = mode as AccessMode;
  } else {
    // Interactive mode
    const result = await p.select({
      message: 'Select access mode:',
      initialValue: config.accessMode,
      options: [
        { value: 'internal', label: 'internal - Docker network only (most secure)' },
        { value: 'api-key', label: 'api-key - External access with X-API-Key header' },
        { value: 'ip-whitelist', label: 'ip-whitelist - IP-based access control' },
        { value: 'api-key-ip', label: 'api-key-ip - Both API key and IP required' },
        { value: 'open', label: 'open - No authentication (development only!)' },
      ],
    });

    if (p.isCancel(result)) {
      p.cancel('Operation cancelled.');
      process.exit(0);
    }

    newMode = result as AccessMode;
  }

  // Warn about open mode
  if (newMode === 'open' && !options.force) {
    console.log();
    console.log(colors.red('⚠️  WARNING: Setting access mode to "open" disables all authentication!'));
    console.log(colors.red('   This mode should only be used for development purposes.'));
    console.log();

    const confirmed = await p.confirm({
      message: 'Are you sure you want to proceed?',
    });

    if (p.isCancel(confirmed) || !confirmed) {
      p.cancel('Operation cancelled.');
      process.exit(0);
    }
  }

  config.accessMode = newMode;
  saveConfig(config);

  console.log(colors.green(`Access mode changed to: ${newMode}`));
}

/**
 * Manage IP whitelist
 */
async function manageWhitelist(
  action: string | undefined,
  ip: string | undefined,
  options: AdminApiCommandOptions
): Promise<void> {
  const config = loadConfig();

  if (!action) {
    action = 'list';
  }

  switch (action) {
    case 'list': {
      if (options.json) {
        console.log(JSON.stringify(config.ipWhitelist, null, 2));
        return;
      }

      console.log();
      console.log(colors.bold('IP Whitelist'));
      console.log();

      if (config.ipWhitelist.length === 0) {
        console.log(colors.dim('  (empty)'));
      } else {
        for (const entry of config.ipWhitelist) {
          console.log(`  • ${entry}`);
        }
      }
      console.log();
      break;
    }

    case 'add': {
      if (!ip) {
        // Interactive mode
        const result = await p.text({
          message: 'Enter IP address or CIDR range:',
          placeholder: '192.168.1.100 or 10.0.0.0/8',
          validate: (value) => {
            if (!value || value.trim().length === 0) {
              return 'IP address is required';
            }
            if (!isValidCidr(value)) {
              return 'Invalid IP address or CIDR notation';
            }
            return undefined;
          },
        });

        if (p.isCancel(result)) {
          p.cancel('Operation cancelled.');
          process.exit(0);
        }

        ip = result as string;
      }

      if (!isValidCidr(ip)) {
        console.error(colors.red(`Invalid IP address or CIDR notation: ${ip}`));
        process.exit(1);
      }

      if (config.ipWhitelist.includes(ip)) {
        console.log(colors.yellow(`IP ${ip} is already in the whitelist.`));
        return;
      }

      config.ipWhitelist.push(ip);
      saveConfig(config);

      console.log(colors.green(`Added ${ip} to IP whitelist.`));
      break;
    }

    case 'remove': {
      if (!ip) {
        if (config.ipWhitelist.length === 0) {
          console.error(colors.red('IP whitelist is empty.'));
          process.exit(1);
        }

        // Interactive mode
        const result = await p.select({
          message: 'Select IP to remove:',
          options: config.ipWhitelist.map((entry) => ({
            value: entry,
            label: entry,
          })),
        });

        if (p.isCancel(result)) {
          p.cancel('Operation cancelled.');
          process.exit(0);
        }

        ip = result as string;
      }

      const index = config.ipWhitelist.indexOf(ip);
      if (index === -1) {
        console.error(colors.red(`IP ${ip} is not in the whitelist.`));
        process.exit(1);
      }

      config.ipWhitelist.splice(index, 1);
      saveConfig(config);

      console.log(colors.green(`Removed ${ip} from IP whitelist.`));
      break;
    }

    default:
      console.error(colors.red(`Unknown whitelist action: ${action}`));
      console.error('Valid actions: list, add, remove');
      process.exit(1);
  }
}

/**
 * Create admin api command
 */
export function adminApiCommand(): Command {
  const cmd = new Command('api')
    .description('Manage API configuration')
    .addHelpText(
      'after',
      `
Examples:
  $ mcctl admin api status              Show API configuration
  $ mcctl admin api status --json       JSON output
  $ mcctl admin api key regenerate      Regenerate API key
  $ mcctl admin api mode api-key        Change access mode
  $ mcctl admin api mode                Interactive mode selection
  $ mcctl admin api whitelist list      List IP whitelist
  $ mcctl admin api whitelist add 192.168.1.100
  $ mcctl admin api whitelist add 10.0.0.0/8
  $ mcctl admin api whitelist remove 192.168.1.100

Access Modes:
  internal       Docker network only (default, most secure)
  api-key        External access with X-API-Key header
  ip-whitelist   IP-based access control
  api-key-ip     Both API key and IP required
  open           No authentication (development only!)
`
    );

  // status subcommand
  cmd
    .command('status')
    .description('Show API configuration')
    .option('--json', 'Output in JSON format')
    .action(async (options: AdminApiCommandOptions) => {
      try {
        await showStatus(options);
      } catch (error) {
        console.error(colors.red(`Error: ${(error as Error).message}`));
        process.exit(1);
      }
    });

  // key subcommand
  const keyCmd = cmd
    .command('key')
    .description('API key management');

  keyCmd
    .command('regenerate')
    .description('Regenerate API key')
    .option('--force', 'Skip confirmation')
    .action(async (options: AdminApiCommandOptions) => {
      try {
        await regenerateKey(options);
      } catch (error) {
        console.error(colors.red(`Error: ${(error as Error).message}`));
        process.exit(1);
      }
    });

  // mode subcommand
  cmd
    .command('mode [mode]')
    .description('Change access mode')
    .option('--force', 'Skip confirmation for dangerous modes')
    .action(async (mode: string | undefined, options: AdminApiCommandOptions) => {
      try {
        await changeMode(mode, options);
      } catch (error) {
        console.error(colors.red(`Error: ${(error as Error).message}`));
        process.exit(1);
      }
    });

  // whitelist subcommand
  const whitelistCmd = cmd
    .command('whitelist [action] [ip]')
    .description('Manage IP whitelist')
    .option('--json', 'Output in JSON format')
    .action(async (action: string | undefined, ip: string | undefined, options: AdminApiCommandOptions) => {
      try {
        await manageWhitelist(action, ip, options);
      } catch (error) {
        console.error(colors.red(`Error: ${(error as Error).message}`));
        process.exit(1);
      }
    });

  // Add explicit whitelist subcommands for better help
  whitelistCmd.addHelpText('after', `
Actions:
  list           List all whitelisted IPs
  add <ip>       Add IP or CIDR range to whitelist
  remove <ip>    Remove IP from whitelist
`);

  return cmd;
}
