import { join } from 'node:path';
import {
  Paths,
  log,
  colors,
  User,
  Username,
  YamlUserRepository,
} from '@minecraft-docker/shared';
import { getContainer } from '../../infrastructure/index.js';
import {
  AdminConfigManager,
  type ApiAccessMode,
} from '../../lib/admin-config.js';

/**
 * Admin init command options
 */
export interface AdminInitOptions {
  root?: string;
  force?: boolean;
}

/**
 * Execute admin init command
 *
 * Interactive flow:
 * 1. Check if already initialized
 * 2. Prompt for admin username
 * 3. Prompt for admin password (with confirmation)
 * 4. Prompt for API access mode
 * 5. Generate API key if needed
 * 6. Save configuration and user
 */
export async function adminInitCommand(
  options: AdminInitOptions
): Promise<number> {
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
  if (configManager.isInitialized() && !options.force) {
    const existingConfig = await configManager.load();
    if (existingConfig) {
      log.warn('Admin Service is already initialized');
      console.log(`  Config: ${colors.cyan(configManager.path)}`);
      console.log(
        `  Initialized: ${colors.dim(existingConfig.initialized_at)}`
      );
      console.log('');
      console.log('  To reinitialize, use:');
      console.log(`    ${colors.dim('mcctl admin init --force')}`);
      console.log('');
      return 0;
    }
  }

  try {
    prompt.intro('Initialize Admin Service');

    // Step 1: Admin username
    const username = await prompt.text({
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

    // Step 2: Admin password
    const password = await prompt.password({
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

    // Step 3: Confirm password
    const confirmPassword = await prompt.password({
      message: 'Confirm password?',
      validate: (value) => {
        if (value !== password) {
          return 'Passwords do not match';
        }
        return undefined;
      },
    });

    // Step 4: API access mode
    const accessMode = await prompt.select<ApiAccessMode>({
      message: 'API access mode?',
      options: [
        {
          value: 'internal' as const,
          label: 'internal',
          hint: 'Docker network only (default, most secure)',
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
      const spinner = prompt.spinner();
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
          // Basic IP/CIDR validation
          const ips = value.split(',').map((ip) => ip.trim());
          for (const ip of ips) {
            // Simple validation - allows IP or CIDR notation
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

    // Step 8: Save user to YAML
    const spinner = prompt.spinner();
    spinner.start('Creating admin user...');

    const usersPath = join(paths.root, 'users.yaml');
    const userRepo = new YamlUserRepository(usersPath);

    // Check if user already exists
    const usernameVO = Username.create(username);
    const existingUser = await userRepo.findByUsername(usernameVO);

    if (existingUser && !options.force) {
      spinner.stop('');
      log.error(`User '${username}' already exists`);
      console.log('  To overwrite, use: mcctl admin init --force');
      return 1;
    }

    // Hash password and create user
    const passwordHash = await userRepo.hashPassword(password);
    const adminUser = User.createAdmin(usernameVO, passwordHash);

    // If user exists and force is true, delete the old one first
    if (existingUser && options.force) {
      await userRepo.delete(existingUser.id);
    }

    await userRepo.save(adminUser);
    spinner.stop('Admin user created');

    // Step 9: Save configuration
    spinner.start('Saving configuration...');

    const config = await configManager.create({
      accessMode,
      apiKey,
      allowedIps,
    });

    spinner.stop('Configuration saved');

    // Step 10: Display summary
    console.log('');
    prompt.success('Admin Service initialized!');

    console.log('');
    console.log(colors.cyan('  Configuration:'));
    console.log(`    Config file: ${colors.dim(configManager.path)}`);
    console.log(`    Users file:  ${colors.dim(usersPath)}`);
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
      `    Console: ${colors.bold(`http://localhost:${config.console.port}`)}`
    );
    console.log(
      `    API:     ${colors.bold(`http://localhost:${config.api.port}`)}`
    );

    console.log('');
    console.log(colors.dim('  Next steps:'));
    console.log(
      colors.dim('    1. Start the admin service: mcctl admin start')
    );
    console.log(colors.dim('    2. Access the console in your browser'));
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
