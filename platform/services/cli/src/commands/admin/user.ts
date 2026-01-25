import { Command } from 'commander';
import * as p from '@clack/prompts';
import {
  User,
  Username,
  Role,
  RoleEnum,
  YamlUserRepository,
  Paths,
  colors,
} from '@minecraft-docker/shared';
import { resolve } from 'node:path';

export interface AdminUserCommandOptions {
  json?: boolean;
  force?: boolean;
  role?: string;
  password?: string;
}

/**
 * Get the user repository instance
 */
function getUserRepository(): YamlUserRepository {
  const paths = new Paths();
  const usersFile = resolve(paths.platform, 'users.yaml');
  return new YamlUserRepository(usersFile);
}

/**
 * List all users
 */
async function listUsers(options: AdminUserCommandOptions): Promise<void> {
  const repo = getUserRepository();
  const users = await repo.findAll();

  if (options.json) {
    console.log(JSON.stringify(users.map((u) => u.toJSON()), null, 2));
    return;
  }

  if (users.length === 0) {
    console.log(colors.yellow('No users found.'));
    console.log(`Run ${colors.cyan('mcctl admin init')} to create an admin user.`);
    return;
  }

  console.log();
  console.log(colors.bold('Users:'));
  console.log();

  // Table header
  const header = `${colors.dim('Username'.padEnd(20))}${colors.dim('Role'.padEnd(12))}${colors.dim('Created')}`;
  console.log(header);
  console.log(colors.dim('-'.repeat(50)));

  // Table rows
  for (const user of users) {
    const roleColor = user.role.isAdmin ? colors.red : colors.blue;
    const row = `${user.username.value.padEnd(20)}${roleColor(user.role.value.padEnd(12))}${user.createdAt.toISOString().split('T')[0]}`;
    console.log(row);
  }

  console.log();
  console.log(`Total: ${colors.cyan(users.length.toString())} user(s)`);
}

/**
 * Add a new user
 */
async function addUser(
  usernameArg: string | undefined,
  options: AdminUserCommandOptions
): Promise<void> {
  const repo = getUserRepository();

  let username: string;
  let role: RoleEnum;
  let password: string;

  if (usernameArg && options.role && options.password) {
    // CLI mode
    username = usernameArg;
    role = options.role.toLowerCase() as RoleEnum;
    password = options.password;
  } else {
    // Interactive mode
    p.intro(colors.cyan('Add New User'));

    const result = await p.group(
      {
        username: () =>
          p.text({
            message: 'Username:',
            placeholder: 'operator1',
            validate: (value) => {
              if (!value || value.trim().length === 0) {
                return 'Username is required';
              }
              if (value.length < 3) {
                return 'Username must be at least 3 characters';
              }
              if (!/^[a-zA-Z0-9_-]+$/.test(value)) {
                return 'Username can only contain letters, numbers, underscores, and hyphens';
              }
              return undefined;
            },
          }),
        role: () =>
          p.select({
            message: 'Role:',
            options: [
              { value: RoleEnum.ADMIN, label: 'Admin - Full access' },
              { value: RoleEnum.VIEWER, label: 'Viewer - Read-only access' },
            ],
          }),
        password: () =>
          p.password({
            message: 'Password:',
            validate: (value) => {
              if (!value || value.length < 8) {
                return 'Password must be at least 8 characters';
              }
              return undefined;
            },
          }),
        confirmPassword: () =>
          p.password({
            message: 'Confirm password:',
          }),
      },
      {
        onCancel: () => {
          p.cancel('Operation cancelled.');
          process.exit(0);
        },
      }
    );

    if (result.password !== result.confirmPassword) {
      p.cancel('Passwords do not match.');
      process.exit(1);
    }

    username = result.username as string;
    role = result.role as RoleEnum;
    password = result.password as string;
  }

  // Check if user already exists
  try {
    const existingUser = await repo.findByUsername(Username.create(username));
    if (existingUser) {
      console.error(colors.red(`User '${username}' already exists.`));
      process.exit(1);
    }
  } catch {
    // Username validation failed
    console.error(colors.red(`Invalid username: ${username}`));
    process.exit(1);
  }

  // Create user
  const passwordHash = await repo.hashPassword(password);
  const user = User.create({
    username: Username.create(username),
    passwordHash,
    role: Role.create(role),
  });

  await repo.save(user);

  if (usernameArg) {
    console.log(JSON.stringify({ success: true, username: user.username.value }));
  } else {
    p.outro(colors.green(`User '${username}' created successfully!`));
  }
}

/**
 * Remove a user
 */
async function removeUser(
  usernameArg: string | undefined,
  options: AdminUserCommandOptions
): Promise<void> {
  const repo = getUserRepository();

  let username: string;

  if (usernameArg) {
    username = usernameArg;
  } else {
    // Interactive mode
    const users = await repo.findAll();
    if (users.length === 0) {
      console.error(colors.red('No users found.'));
      process.exit(1);
    }

    const result = await p.select({
      message: 'Select user to remove:',
      options: users.map((u) => ({
        value: u.username.value,
        label: `${u.username.value} (${u.role.value})`,
      })),
    });

    if (p.isCancel(result)) {
      p.cancel('Operation cancelled.');
      process.exit(0);
    }

    username = result as string;
  }

  // Find user
  const user = await repo.findByUsername(Username.create(username));
  if (!user) {
    console.error(colors.red(`User '${username}' not found.`));
    process.exit(1);
  }

  // Check if this is the last admin
  if (user.isAdmin) {
    const allUsers = await repo.findAll();
    const adminCount = allUsers.filter((u) => u.isAdmin).length;
    if (adminCount <= 1) {
      console.error(colors.red('Cannot delete the last admin user.'));
      process.exit(1);
    }
  }

  // Confirm deletion
  if (!options.force) {
    const confirmed = await p.confirm({
      message: `Are you sure you want to delete user '${username}'?`,
    });

    if (p.isCancel(confirmed) || !confirmed) {
      p.cancel('Operation cancelled.');
      process.exit(0);
    }
  }

  await repo.delete(user.id);

  console.log(colors.green(`User '${username}' deleted successfully.`));
}

/**
 * Update a user
 */
async function updateUser(
  usernameArg: string | undefined,
  options: AdminUserCommandOptions
): Promise<void> {
  const repo = getUserRepository();

  let username: string;

  if (usernameArg) {
    username = usernameArg;
  } else {
    // Interactive mode
    const users = await repo.findAll();
    if (users.length === 0) {
      console.error(colors.red('No users found.'));
      process.exit(1);
    }

    const result = await p.select({
      message: 'Select user to update:',
      options: users.map((u) => ({
        value: u.username.value,
        label: `${u.username.value} (${u.role.value})`,
      })),
    });

    if (p.isCancel(result)) {
      p.cancel('Operation cancelled.');
      process.exit(0);
    }

    username = result as string;
  }

  // Find user
  const user = await repo.findByUsername(Username.create(username));
  if (!user) {
    console.error(colors.red(`User '${username}' not found.`));
    process.exit(1);
  }

  // Update role
  let newRole: RoleEnum;
  if (options.role) {
    newRole = options.role.toLowerCase() as RoleEnum;
  } else {
    const result = await p.select({
      message: 'New role:',
      initialValue: user.role.value,
      options: [
        { value: RoleEnum.ADMIN, label: 'Admin - Full access' },
        { value: RoleEnum.VIEWER, label: 'Viewer - Read-only access' },
      ],
    });

    if (p.isCancel(result)) {
      p.cancel('Operation cancelled.');
      process.exit(0);
    }

    newRole = result as RoleEnum;
  }

  // Check if this would remove the last admin
  if (user.isAdmin && newRole !== RoleEnum.ADMIN) {
    const allUsers = await repo.findAll();
    const adminCount = allUsers.filter((u) => u.isAdmin).length;
    if (adminCount <= 1) {
      console.error(colors.red('Cannot change role of the last admin user.'));
      process.exit(1);
    }
  }

  user.updateRole(Role.create(newRole));
  await repo.save(user);

  console.log(colors.green(`User '${username}' updated to role '${newRole}'.`));
}

/**
 * Reset a user's password
 */
async function resetPassword(
  usernameArg: string | undefined,
  options: AdminUserCommandOptions
): Promise<void> {
  const repo = getUserRepository();

  let username: string;

  if (usernameArg) {
    username = usernameArg;
  } else {
    // Interactive mode
    const users = await repo.findAll();
    if (users.length === 0) {
      console.error(colors.red('No users found.'));
      process.exit(1);
    }

    const result = await p.select({
      message: 'Select user to reset password:',
      options: users.map((u) => ({
        value: u.username.value,
        label: `${u.username.value} (${u.role.value})`,
      })),
    });

    if (p.isCancel(result)) {
      p.cancel('Operation cancelled.');
      process.exit(0);
    }

    username = result as string;
  }

  // Find user
  const user = await repo.findByUsername(Username.create(username));
  if (!user) {
    console.error(colors.red(`User '${username}' not found.`));
    process.exit(1);
  }

  // Get new password
  let newPassword: string;
  if (options.password) {
    newPassword = options.password;
  } else {
    const result = await p.group(
      {
        password: () =>
          p.password({
            message: 'New password:',
            validate: (value) => {
              if (!value || value.length < 8) {
                return 'Password must be at least 8 characters';
              }
              return undefined;
            },
          }),
        confirmPassword: () =>
          p.password({
            message: 'Confirm password:',
          }),
      },
      {
        onCancel: () => {
          p.cancel('Operation cancelled.');
          process.exit(0);
        },
      }
    );

    if (result.password !== result.confirmPassword) {
      p.cancel('Passwords do not match.');
      process.exit(1);
    }

    newPassword = result.password as string;
  }

  // Update password
  const passwordHash = await repo.hashPassword(newPassword);
  user.updatePasswordHash(passwordHash);
  await repo.save(user);

  console.log(colors.green(`Password for '${username}' has been reset.`));
}

/**
 * Create admin user command
 */
export function adminUserCommand(): Command {
  const cmd = new Command('user')
    .description('Manage admin console users')
    .addHelpText(
      'after',
      `
Examples:
  $ mcctl admin user list                        List all users
  $ mcctl admin user list --json                 List users in JSON format
  $ mcctl admin user add                         Add user (interactive)
  $ mcctl admin user add operator1 --role viewer --password "secret"
  $ mcctl admin user remove                      Remove user (interactive)
  $ mcctl admin user remove operator1            Remove user directly
  $ mcctl admin user remove operator1 --force    Remove without confirmation
  $ mcctl admin user update                      Update user (interactive)
  $ mcctl admin user update operator1 --role admin
  $ mcctl admin user reset-password              Reset password (interactive)
  $ mcctl admin user reset-password operator1
`
    );

  // list subcommand
  cmd
    .command('list')
    .description('List all users')
    .option('--json', 'Output in JSON format')
    .action(async (options: AdminUserCommandOptions) => {
      try {
        await listUsers(options);
      } catch (error) {
        console.error(colors.red(`Error: ${(error as Error).message}`));
        process.exit(1);
      }
    });

  // add subcommand
  cmd
    .command('add [username]')
    .description('Add a new user')
    .option('--role <role>', 'User role (admin, viewer)')
    .option('--password <password>', 'User password')
    .action(async (username: string | undefined, options: AdminUserCommandOptions) => {
      try {
        await addUser(username, options);
      } catch (error) {
        console.error(colors.red(`Error: ${(error as Error).message}`));
        process.exit(1);
      }
    });

  // remove subcommand
  cmd
    .command('remove [username]')
    .description('Remove a user')
    .option('--force', 'Skip confirmation')
    .action(async (username: string | undefined, options: AdminUserCommandOptions) => {
      try {
        await removeUser(username, options);
      } catch (error) {
        console.error(colors.red(`Error: ${(error as Error).message}`));
        process.exit(1);
      }
    });

  // update subcommand
  cmd
    .command('update [username]')
    .description('Update a user')
    .option('--role <role>', 'New role (admin, viewer)')
    .action(async (username: string | undefined, options: AdminUserCommandOptions) => {
      try {
        await updateUser(username, options);
      } catch (error) {
        console.error(colors.red(`Error: ${(error as Error).message}`));
        process.exit(1);
      }
    });

  // reset-password subcommand
  cmd
    .command('reset-password [username]')
    .description('Reset a user password')
    .option('--password <password>', 'New password (for non-interactive use)')
    .action(async (username: string | undefined, options: AdminUserCommandOptions) => {
      try {
        await resetPassword(username, options);
      } catch (error) {
        console.error(colors.red(`Error: ${(error as Error).message}`));
        process.exit(1);
      }
    });

  return cmd;
}
