import { join } from 'node:path';
import { existsSync, unlinkSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { multiselect, isCancel } from '@clack/prompts';
import {
  Paths,
  log,
  colors,
  User,
  Username,
  YamlUserRepository,
  checkConsolePrerequisites,
} from '@minecraft-docker/shared';
import { getContainer } from '../../infrastructure/index.js';
import {
  AdminConfigManager,
  type ApiAccessMode,
} from '../../lib/admin-config.js';
import { Pm2ServiceManagerAdapter } from '../../infrastructure/adapters/Pm2ServiceManagerAdapter.js';
import {
  checkPm2Installation,
  ECOSYSTEM_CONFIG_FILE,
  PM2_SERVICE_NAMES,
  resolveServiceScriptPaths,
} from '../../lib/pm2-utils.js';
import { displayPrerequisiteReport } from '../../lib/prerequisite-display.js';

/**
 * Check if mcctl-console is available on npm
 * Currently returns false as it's not yet published
 */
function isConsoleAvailable(): boolean {
  // mcctl-console is not yet published to npm
  // This will be updated when console is available
  return false;
}

/**
 * Install mcctl-api package if not present
 * @param rootDir - Root directory to install in
 * @returns true if installation succeeded or already installed
 */
function installMcctlApiIfNeeded(rootDir: string): { installed: boolean; error?: string } {
  const apiPackagePath = join(rootDir, 'node_modules/@minecraft-docker/mcctl-api/dist/index.js');

  // Already installed
  if (existsSync(apiPackagePath)) {
    return { installed: true };
  }

  // Check if package.json exists, if not create it
  const packageJsonPath = join(rootDir, 'package.json');
  if (!existsSync(packageJsonPath)) {
    const initResult = spawnSync('npm', ['init', '-y'], {
      cwd: rootDir,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    if (initResult.status !== 0) {
      return { installed: false, error: 'Failed to initialize package.json' };
    }
  }

  // Install mcctl-api
  const installResult = spawnSync('npm', ['install', '@minecraft-docker/mcctl-api@latest'], {
    cwd: rootDir,
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  if (installResult.status !== 0) {
    return {
      installed: false,
      error: installResult.stderr || 'Failed to install @minecraft-docker/mcctl-api'
    };
  }

  return { installed: true };
}

/**
 * Console init command options
 */
export interface ConsoleInitOptions {
  root?: string;
  force?: boolean;
  apiPort?: number;
  consolePort?: number;
}

// Backward compatibility alias
export type AdminInitOptions = ConsoleInitOptions;

/**
 * Minimum required Node.js version
 */
const MIN_NODE_VERSION = 18;

/**
 * Check Node.js version meets requirements
 * @returns Object with version check result
 */
export function checkNodeVersion(): {
  valid: boolean;
  version: string;
  required: number;
} {
  const version = process.version.replace('v', '');
  const majorVersion = parseInt(version.split('.')[0] ?? '0', 10);

  return {
    valid: majorVersion >= MIN_NODE_VERSION,
    version,
    required: MIN_NODE_VERSION,
  };
}

/**
 * Delete admin images (legacy - now a no-op for backward compatibility)
 * @deprecated Use PM2 process management instead
 */
export function deleteAdminImages(): {
  success: boolean;
  deleted: string[];
  errors: string[];
} {
  // In PM2 mode, we don't use Docker images
  // This function is kept for backward compatibility
  return {
    success: true,
    deleted: [],
    errors: [],
  };
}

/**
 * Stop admin services using PM2
 */
async function stopAdminServices(paths: Paths): Promise<boolean> {
  const pm2Adapter = new Pm2ServiceManagerAdapter(paths);

  try {
    // Check if services exist and stop them
    for (const serviceName of [PM2_SERVICE_NAMES.API, PM2_SERVICE_NAMES.CONSOLE]) {
      const exists = await pm2Adapter.exists(serviceName);
      if (exists) {
        await pm2Adapter.delete(serviceName);
      }
    }
    return true;
  } catch {
    return false;
  } finally {
    pm2Adapter.disconnect();
  }
}

/**
 * Service installation options
 */
interface ServiceInstallOptions {
  installApi: boolean;
  installConsole: boolean;
}

/**
 * Auth configuration for ecosystem config
 */
interface AuthConfig {
  accessMode: string;
  apiKey: string | null;
  allowedIps: string[];
}

/**
 * Generate ecosystem.config.cjs content
 * Only includes services that are selected for installation
 */
function generateEcosystemConfig(
  apiPort: number,
  consolePort: number,
  apiScriptPath: string,
  consoleScriptPath: string,
  isDevelopment: boolean,
  nextAuthSecret: string,
  serviceOptions: ServiceInstallOptions,
  authConfig: AuthConfig,
  rootDir: string
): string {
  const modeComment = isDevelopment
    ? '// NOTE: Development mode - using workspace paths'
    : '// NOTE: Production mode - using node_modules paths';

  const apps: string[] = [];

  if (serviceOptions.installApi) {
    // Build API environment variables
    const apiEnvVars = [
      `        NODE_ENV: '${isDevelopment ? 'development' : 'production'}',`,
      `        PORT: ${apiPort},`,
      `        HOST: '0.0.0.0',`,
      `        MCCTL_ROOT: '${rootDir}',`,
      `        AUTH_MODE: '${authConfig.accessMode}',`,
    ];

    if (authConfig.apiKey) {
      apiEnvVars.push(`        AUTH_API_KEY: '${authConfig.apiKey}',`);
    }

    if (authConfig.allowedIps.length > 0) {
      apiEnvVars.push(`        AUTH_IP_WHITELIST: '${authConfig.allowedIps.join(',')}',`);
    }

    apps.push(`    {
      name: 'mcctl-api',
      script: '${apiScriptPath}',
      cwd: '${rootDir}',
      env: {
${apiEnvVars.join('\n')}
      },
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      autorestart: true,
      max_memory_restart: '500M',
    }`);
  }

  if (serviceOptions.installConsole) {
    apps.push(`    {
      name: 'mcctl-console',
      script: '${consoleScriptPath}',
      cwd: '${rootDir}',
      env: {
        NODE_ENV: '${isDevelopment ? 'development' : 'production'}',
        PORT: ${consolePort},
        HOSTNAME: '0.0.0.0',
        MCCTL_API_URL: 'http://localhost:${apiPort}',
        MCCTL_ROOT: '${rootDir}',
        NEXTAUTH_SECRET: '${nextAuthSecret}',
        NEXTAUTH_URL: 'http://localhost:${consolePort}',
      },
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      autorestart: true,
      max_memory_restart: '500M',
    }`);
  }

  return `// ecosystem.config.cjs
// =============================================================================
// PM2 Ecosystem Configuration for Minecraft Admin Service
// =============================================================================
// This file is auto-generated by 'mcctl console init' command.
// It configures PM2 to run mcctl-api and mcctl-console services.
//
// Usage:
//   pm2 start ecosystem.config.cjs     # Start all services
//   pm2 stop all                       # Stop all services
//   pm2 restart all                    # Restart all services
//   pm2 logs                           # View logs
//   pm2 status                         # Check status
//
// Installation:
//   npm install -g pm2
//   pm2 startup                        # Configure auto-start on boot
//   pm2 save                           # Save current process list
// =============================================================================
${modeComment}

module.exports = {
  apps: [
${apps.join(',\n')}
  ],
};
`;
}

/**
 * Cleanup existing configuration and services
 * Called when --force flag is used or user confirms reinitialize
 */
async function cleanupExistingConfig(
  paths: Paths,
  configManager: AdminConfigManager,
  prompt: ReturnType<typeof getContainer>['promptPort']
): Promise<boolean> {
  const spinner = prompt.spinner();

  // Step 1: Stop PM2 services
  spinner.start('Stopping console services...');
  const stopResult = await stopAdminServices(paths);
  if (!stopResult) {
    spinner.stop('Warning: Failed to stop some services');
  } else {
    spinner.stop('Console services stopped');
  }

  // Step 2: Delete config files
  spinner.start('Cleaning up configuration files...');
  const filesToDelete = [
    configManager.path, // .mcctl-admin.yml
    join(paths.root, 'users.yaml'),
    join(paths.platform, ECOSYSTEM_CONFIG_FILE), // ecosystem.config.cjs
  ];

  for (const file of filesToDelete) {
    if (existsSync(file)) {
      try {
        unlinkSync(file);
      } catch {
        // Ignore errors
      }
    }
  }
  spinner.stop('Configuration files cleaned up');

  return true;
}

/**
 * Execute console init command
 *
 * Interactive flow:
 * 1. Check Node.js version (>= 18)
 * 2. Check PM2 installation
 * 3. Check if already initialized
 * 4. If exists: prompt for reinitialize confirmation (unless --force)
 * 5. Cleanup existing config if reinitializing
 * 6. Prompt for admin username
 * 7. Prompt for admin password (with confirmation)
 * 8. Prompt for API access mode
 * 9. Generate API key if needed
 * 10. Generate ecosystem.config.cjs
 * 11. Save configuration and user
 */
export async function consoleInitCommand(
  options: ConsoleInitOptions
): Promise<number> {
  // Check all prerequisites (Node.js, Docker, Docker Compose, PM2)
  console.log(colors.cyan('Checking prerequisites...'));
  const prereqReport = checkConsolePrerequisites();
  if (!displayPrerequisiteReport(prereqReport)) {
    return 1;
  }
  console.log('');

  // Extract version info for display later
  const nodeResult = prereqReport.results.find(r => r.name === 'Node.js');
  const pm2Result = prereqReport.results.find(r => r.name === 'PM2');

  const paths = new Paths(options.root);

  // Check if platform is initialized
  if (!paths.isInitialized()) {
    log.error('Platform not initialized. Run: mcctl init');
    return 1;
  }

  const container = getContainer({ rootDir: options.root });
  const prompt = container.promptPort;
  const configManager = new AdminConfigManager(options.root);

  // Check if already initialized
  if (configManager.isInitialized()) {
    const existingConfig = await configManager.load();

    if (existingConfig && !options.force) {
      // Show existing config info
      log.warn('Console Service is already initialized');
      console.log(`  Config: ${colors.cyan(configManager.path)}`);
      console.log(
        `  Initialized: ${colors.dim(existingConfig.initialized_at)}`
      );
      console.log('');

      // Prompt for reinitialize
      try {
        const shouldReinitialize = await prompt.confirm({
          message:
            'Existing configuration found. Reinitialize? (This will delete all settings and stop services)',
          initialValue: false,
        });

        if (prompt.isCancel(shouldReinitialize) || !shouldReinitialize) {
          console.log('');
          console.log('  To reinitialize with --force, use:');
          console.log(`    ${colors.dim('mcctl console init --force')}`);
          console.log('');
          return 0;
        }
      } catch (error) {
        if (prompt.isCancel(error)) {
          return 0;
        }
        throw error;
      }
    }

    // Cleanup existing config (either --force or user confirmed)
    await cleanupExistingConfig(paths, configManager, prompt);
    console.log('');
  }

  try {
    prompt.intro('Initialize Console Service');

    // Show environment info
    console.log(colors.dim(`  Node.js: v${nodeResult?.version ?? process.version.replace(/^v/, '')}`));
    console.log(colors.dim(`  PM2: ${pm2Result?.version ?? 'installed'}`));
    console.log('');

    // Step 1: Select services to install
    const consoleAvailable = isConsoleAvailable();

    const serviceOptions = [
      {
        value: 'api' as const,
        label: 'mcctl-api',
        hint: 'REST API server for managing Minecraft servers',
      },
      {
        value: 'console' as const,
        label: 'mcctl-console',
        hint: consoleAvailable ? 'Web UI for server management' : 'Coming soon (not yet available)',
      },
    ];

    const selectedServices = await multiselect({
      message: 'Select services to install:',
      options: serviceOptions,
      initialValues: ['api'], // API is selected by default
      required: true,
    });

    if (isCancel(selectedServices)) {
      return 0;
    }

    const services = selectedServices as ('api' | 'console')[];

    // Check if user selected console but it's not available
    if (services.includes('console') && !consoleAvailable) {
      console.log('');
      log.warn('mcctl-console is not yet available on npm.');
      log.info('Only mcctl-api will be installed. Console support coming soon!');

      // Remove console from selection
      const apiOnlyServices = services.filter(s => s !== 'console');
      if (apiOnlyServices.length === 0) {
        log.error('At least one service must be selected.');
        return 1;
      }
      services.length = 0;
      services.push(...apiOnlyServices);
    }

    const installApi = services.includes('api');
    const installConsole = services.includes('console') && consoleAvailable;

    // Show selected services
    console.log('');
    console.log(colors.cyan('  Selected services:'));
    if (installApi) {
      console.log(`    ${colors.green('✓')} mcctl-api`);
    }
    if (installConsole) {
      console.log(`    ${colors.green('✓')} mcctl-console`);
    } else if (services.includes('console')) {
      console.log(`    ${colors.yellow('○')} mcctl-console ${colors.dim('(skipped - not available)')}`);
    }
    console.log('');

    // Admin setup is only required when console is installed
    let username = '';
    let password = '';

    if (installConsole) {
      // Step 2: Admin username (required for Console authentication)
      username = await prompt.text({
        message: 'Admin username?',
        placeholder: 'admin',
        initialValue: 'admin',
        validate: (value) => {
          try {
            Username.create(value);
            return undefined;
          } catch (error) {
            return error instanceof Error
              ? error.message
              : 'Invalid username format';
          }
        },
      });

      // Step 3: Admin password
      password = await prompt.password({
        message: 'Admin password?',
        validate: (value) => {
          if (!value || value.length < 8) {
            return 'Password must be at least 8 characters';
          }
          // Check for basic password strength
          if (!/[A-Z]/.test(value)) {
            return 'Password must contain at least one uppercase letter';
          }
          if (!/[a-z]/.test(value)) {
            return 'Password must contain at least one lowercase letter';
          }
          if (!/[0-9]/.test(value)) {
            return 'Password must contain at least one number';
          }
          return undefined;
        },
      });
    }

    // Default port configuration
    const DEFAULT_API_PORT = 5001;
    const DEFAULT_CONSOLE_PORT = 5000;
    const apiPort = options.apiPort ?? DEFAULT_API_PORT;
    const consolePort = options.consolePort ?? DEFAULT_CONSOLE_PORT;

    const spinner = prompt.spinner();

    // Step 4: API access mode (required for both API and Console)
    const accessMode = await prompt.select<ApiAccessMode>({
      message: 'API access mode?',
      options: [
        {
          value: 'internal' as const,
          label: 'internal',
          hint: 'Local network only (default, most secure)',
        },
        {
          value: 'api-key' as const,
          label: 'api-key',
          hint: 'External access with API key',
        },
        {
          value: 'ip-whitelist' as const,
          label: 'ip-whitelist',
          hint: 'IP-based access control',
        },
        {
          value: 'api-key-ip' as const,
          label: 'api-key-ip',
          hint: 'Both API key and IP required',
        },
        {
          value: 'open' as const,
          label: 'open',
          hint: 'No authentication (development only)',
        },
      ],
      initialValue: 'internal' as const,
    });

    // Step 5: Generate API key if needed
    let apiKey: string | null = null;
    if (accessMode === 'api-key' || accessMode === 'api-key-ip') {
      spinner.start('Generating API key...');
      apiKey = AdminConfigManager.generateApiKey();
      spinner.stop('API key generated');
    }

    // Step 6: Prompt for allowed IPs if needed
    let allowedIps: string[] = [];
    if (accessMode === 'ip-whitelist' || accessMode === 'api-key-ip') {
      const ipsInput = await prompt.text({
        message: 'Allowed IPs (comma-separated)?',
        placeholder: '127.0.0.1, 192.168.1.0/24',
        validate: (value) => {
          if (!value.trim()) {
            return 'At least one IP or CIDR range is required';
          }
          const ips = value.split(',').map((ip) => ip.trim());
          for (const ip of ips) {
            if (
              !/^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/.test(ip) &&
              ip !== 'localhost'
            ) {
              return `Invalid IP format: ${ip}`;
            }
          }
          return undefined;
        },
      });
      allowedIps = ipsInput.split(',').map((ip) => ip.trim());
    }

    // Step 7: Show warning for open mode
    if (accessMode === 'open') {
      prompt.warn(
        'WARNING: Open mode has no authentication. Use only for local development!'
      );
      const proceed = await prompt.confirm({
        message: 'Are you sure you want to use open mode?',
        initialValue: false,
      });
      if (!proceed) {
        prompt.info('Cancelled. Please run again to choose a different mode.');
        return 0;
      }
    }

    // Console-specific setup: admin user
    if (installConsole) {
      spinner.start('Creating admin user...');

      const usersPath = join(paths.root, 'users.yaml');
      const userRepo = new YamlUserRepository(usersPath);

      const usernameVO = Username.create(username);
      const existingUser = await userRepo.findByUsername(usernameVO);

      if (existingUser && !options.force) {
        spinner.stop('');
        log.error(`User '${username}' already exists`);
        console.log('  To overwrite, use: mcctl console init --force');
        return 1;
      }

      const passwordHash = await userRepo.hashPassword(password);
      const adminUser = User.createAdmin(usernameVO, passwordHash);

      if (existingUser && options.force) {
        await userRepo.delete(existingUser.id);
      }

      await userRepo.save(adminUser);
      spinner.stop('Admin user created');
    }

    // Step 10: Install mcctl-api if needed (production mode)
    spinner.start('Checking mcctl-api installation...');

    const installResult = installMcctlApiIfNeeded(paths.root);
    if (!installResult.installed) {
      spinner.stop('');
      log.error(`Failed to install mcctl-api: ${installResult.error}`);
      log.info('Try installing manually: npm install @minecraft-docker/mcctl-api');
      return 1;
    }
    spinner.stop('mcctl-api ready');

    // Use service selection from earlier
    const serviceInstallOptions: ServiceInstallOptions = {
      installApi,
      installConsole,
    };

    // Step 11: Generate ecosystem.config.cjs
    spinner.start('Resolving service script paths...');

    // Resolve script paths (development vs production)
    const scriptPaths = resolveServiceScriptPaths(paths.root);

    if (scriptPaths.isDevelopment) {
      spinner.stop('Using development workspace paths');
      console.log(colors.dim(`    API: ${scriptPaths.api}`));
      if (serviceInstallOptions.installConsole) {
        console.log(colors.dim(`    Console: ${scriptPaths.console}`));
      }
    } else {
      spinner.stop('Using production node_modules paths');
    }

    spinner.start('Generating PM2 ecosystem config...');

    // Generate NextAuth secret for session encryption
    const nextAuthSecret = AdminConfigManager.generateApiKey();

    const ecosystemPath = join(paths.platform, ECOSYSTEM_CONFIG_FILE);
    const ecosystemContent = generateEcosystemConfig(
      apiPort,
      consolePort,
      scriptPaths.api,
      scriptPaths.console,
      scriptPaths.isDevelopment,
      nextAuthSecret,
      serviceInstallOptions,
      { accessMode, apiKey, allowedIps },
      paths.root
    );
    writeFileSync(ecosystemPath, ecosystemContent, 'utf-8');

    spinner.stop('PM2 ecosystem config generated');

    // Step 12: Save configuration
    spinner.start('Saving configuration...');

    const config = await configManager.create({
      accessMode,
      apiKey,
      allowedIps,
      apiPort,
      consolePort,
    });

    spinner.stop('Configuration saved');

    // Step 13: Display summary
    console.log('');
    prompt.success('Console Service initialized!');

    console.log('');
    console.log(colors.cyan('  Configuration:'));
    console.log(`    Config file: ${colors.dim(configManager.path)}`);
    if (installConsole) {
      console.log(`    Users file:  ${colors.dim(join(paths.root, 'users.yaml'))}`);
    }
    console.log(`    PM2 config:  ${colors.dim(ecosystemPath)}`);
    console.log(`    Access mode: ${colors.bold(accessMode)}`);

    if (apiKey) {
      console.log('');
      console.log(colors.yellow('  API Key (save this, shown only once):'));
      console.log(`    ${colors.bold(apiKey)}`);
    }

    if (allowedIps.length > 0) {
      console.log('');
      console.log(colors.cyan('  Allowed IPs:'));
      for (const ip of allowedIps) {
        console.log(`    - ${ip}`);
      }
    }

    console.log('');
    console.log(colors.cyan('  Endpoints:'));
    console.log(
      `    API:     ${colors.bold(`http://localhost:${config.api.port}`)}`
    );
    if (installConsole) {
      console.log(
        `    Console: ${colors.bold(`http://localhost:${config.console.port}`)}`
      );
    }

    console.log('');
    console.log(colors.dim('  Next steps:'));
    console.log(
      colors.dim('    1. Start the service: mcctl console service start')
    );
    if (installConsole) {
      console.log(colors.dim('    2. Access the console in your browser'));
    }
    console.log('');

    return 0;
  } catch (error) {
    // Check if user cancelled
    if (prompt.isCancel(error)) {
      return 0;
    }

    const message = error instanceof Error ? error.message : String(error);
    log.error(message);
    return 1;
  }
}

// Backward compatibility alias
export const adminInitCommand = consoleInitCommand;
