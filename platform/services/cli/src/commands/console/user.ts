import { Command } from 'commander';
import * as p from '@clack/prompts';
import { join } from 'node:path';
import {
  Paths,
  colors,
} from '@minecraft-docker/shared';
import { ConsoleDatabase, type ConsoleUser } from '../../lib/console-db.js';

/**
 * Console user command options
 */
export interface ConsoleUserCommandOptions {
  json?: boolean;
  force?: boolean;
  role?: string;
  password?: string;
}

// Backward compatibility alias
export type AdminUserCommandOptions = ConsoleUserCommandOptions;

/**
 * Get the ConsoleDatabase instance
 */
function getConsoleDb(): ConsoleDatabase {
  const paths = new Paths();
  const dbPath = join(paths.root, 'data', 'mcctl.db');
  const db = new ConsoleDatabase(dbPath);
  db.ensureSchema();
  return db;
}

/**
 * List all users
 */
async function listUsers(options: ConsoleUserCommandOptions): Promise<void> {
  const db = getConsoleDb();

  try {
    const users = db.findAllUsers();

    if (options.json) {
      console.log(JSON.stringify(users.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        emailVerified: u.emailVerified,
        banned: u.banned,
        createdAt: u.createdAt.toISOString(),
        updatedAt: u.updatedAt.toISOString(),
      })), null, 2));
      return;
    }

    if (users.length === 0) {
      console.log(colors.yellow('No users found.'));
      console.log(`Run ${colors.cyan('mcctl console init')} to create an admin user.`);
      return;
    }

    console.log();
    console.log(colors.bold('Users:'));
    console.log();

    // Table header
    const header = `${colors.dim('Email'.padEnd(30))}${colors.dim('Name'.padEnd(20))}${colors.dim('Role'.padEnd(12))}${colors.dim('Created')}`;
    console.log(header);
    console.log(colors.dim('-'.repeat(75)));

    // Table rows
    for (const user of users) {
      const roleColor = user.role === 'admin' ? colors.red : colors.blue;
      const row = `${user.email.padEnd(30)}${user.name.padEnd(20)}${roleColor(user.role.padEnd(12))}${user.createdAt.toISOString().split('T')[0]}`;
      console.log(row);
    }

    console.log();
    console.log(`Total: ${colors.cyan(users.length.toString())} user(s)`);
  } finally {
    db.close();
  }
}

/**
 * Add a new user
 */
async function addUser(
  emailArg: string | undefined,
  options: ConsoleUserCommandOptions
): Promise<void> {
  const db = getConsoleDb();

  try {
    let email: string;
    let name: string;
    let role: string;
    let password: string;

    if (emailArg && options.role && options.password) {
      // CLI mode
      email = emailArg;
      name = emailArg.split('@')[0] ?? emailArg;
      role = options.role.toLowerCase();
      password = options.password;
    } else {
      // Interactive mode
      p.intro(colors.cyan('Add New User'));

      const result = await p.group(
        {
          email: () =>
            p.text({
              message: 'Email:',
              placeholder: 'user@example.com',
              validate: (value) => {
                if (!value || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
                  return 'Valid email address is required';
                }
                return undefined;
              },
            }),
          name: () =>
            p.text({
              message: 'Name:',
              placeholder: 'User Name',
              validate: (value) => {
                if (!value || value.trim().length === 0) {
                  return 'Name is required';
                }
                return undefined;
              },
            }),
          role: () =>
            p.select({
              message: 'Role:',
              options: [
                { value: 'admin', label: 'Admin - Full access' },
                { value: 'user', label: 'User - Standard access' },
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

      email = result.email as string;
      name = result.name as string;
      role = result.role as string;
      password = result.password as string;
    }

    // Check if user already exists
    const existingUser = db.findUserByEmail(email);
    if (existingUser) {
      console.error(colors.red(`User '${email}' already exists.`));
      process.exit(1);
    }

    // Create user
    db.createUser({ email, name, password, role });

    if (emailArg) {
      console.log(JSON.stringify({ success: true, email }));
    } else {
      p.outro(colors.green(`User '${email}' created successfully!`));
    }
  } finally {
    db.close();
  }
}

/**
 * Remove a user
 */
async function removeUser(
  emailArg: string | undefined,
  options: ConsoleUserCommandOptions
): Promise<void> {
  const db = getConsoleDb();

  try {
    let targetUser: ConsoleUser;

    if (emailArg) {
      const user = db.findUserByEmail(emailArg);
      if (!user) {
        console.error(colors.red(`User '${emailArg}' not found.`));
        process.exit(1);
      }
      targetUser = user;
    } else {
      // Interactive mode
      const users = db.findAllUsers();
      if (users.length === 0) {
        console.error(colors.red('No users found.'));
        process.exit(1);
      }

      const result = await p.select({
        message: 'Select user to remove:',
        options: users.map((u) => ({
          value: u.email,
          label: `${u.email} (${u.role})`,
        })),
      });

      if (p.isCancel(result)) {
        p.cancel('Operation cancelled.');
        process.exit(0);
      }

      const user = db.findUserByEmail(result as string);
      if (!user) {
        console.error(colors.red('User not found.'));
        process.exit(1);
      }
      targetUser = user;
    }

    // Check if this is the last admin
    if (targetUser.role === 'admin') {
      const allUsers = db.findAllUsers();
      const adminCount = allUsers.filter((u) => u.role === 'admin').length;
      if (adminCount <= 1) {
        console.error(colors.red('Cannot delete the last admin user.'));
        process.exit(1);
      }
    }

    // Confirm deletion
    if (!options.force) {
      const confirmed = await p.confirm({
        message: `Are you sure you want to delete user '${targetUser.email}'?`,
      });

      if (p.isCancel(confirmed) || !confirmed) {
        p.cancel('Operation cancelled.');
        process.exit(0);
      }
    }

    db.deleteUser(targetUser.id);

    console.log(colors.green(`User '${targetUser.email}' deleted successfully.`));
  } finally {
    db.close();
  }
}

/**
 * Update a user's role
 */
async function updateUser(
  emailArg: string | undefined,
  options: ConsoleUserCommandOptions
): Promise<void> {
  const db = getConsoleDb();

  try {
    let targetUser: ConsoleUser;

    if (emailArg) {
      const user = db.findUserByEmail(emailArg);
      if (!user) {
        console.error(colors.red(`User '${emailArg}' not found.`));
        process.exit(1);
      }
      targetUser = user;
    } else {
      // Interactive mode
      const users = db.findAllUsers();
      if (users.length === 0) {
        console.error(colors.red('No users found.'));
        process.exit(1);
      }

      const result = await p.select({
        message: 'Select user to update:',
        options: users.map((u) => ({
          value: u.email,
          label: `${u.email} (${u.role})`,
        })),
      });

      if (p.isCancel(result)) {
        p.cancel('Operation cancelled.');
        process.exit(0);
      }

      const user = db.findUserByEmail(result as string);
      if (!user) {
        console.error(colors.red('User not found.'));
        process.exit(1);
      }
      targetUser = user;
    }

    // Update role
    let newRole: string;
    if (options.role) {
      newRole = options.role.toLowerCase();
    } else {
      const result = await p.select({
        message: 'New role:',
        initialValue: targetUser.role,
        options: [
          { value: 'admin', label: 'Admin - Full access' },
          { value: 'user', label: 'User - Standard access' },
        ],
      });

      if (p.isCancel(result)) {
        p.cancel('Operation cancelled.');
        process.exit(0);
      }

      newRole = result as string;
    }

    // Check if this would remove the last admin
    if (targetUser.role === 'admin' && newRole !== 'admin') {
      const allUsers = db.findAllUsers();
      const adminCount = allUsers.filter((u) => u.role === 'admin').length;
      if (adminCount <= 1) {
        console.error(colors.red('Cannot change role of the last admin user.'));
        process.exit(1);
      }
    }

    db.updateUserRole(targetUser.id, newRole);

    console.log(colors.green(`User '${targetUser.email}' updated to role '${newRole}'.`));
  } finally {
    db.close();
  }
}

/**
 * Reset a user's password
 */
async function resetPassword(
  emailArg: string | undefined,
  options: ConsoleUserCommandOptions
): Promise<void> {
  const db = getConsoleDb();

  try {
    let targetUser: ConsoleUser;

    if (emailArg) {
      const user = db.findUserByEmail(emailArg);
      if (!user) {
        console.error(colors.red(`User '${emailArg}' not found.`));
        process.exit(1);
      }
      targetUser = user;
    } else {
      // Interactive mode
      const users = db.findAllUsers();
      if (users.length === 0) {
        console.error(colors.red('No users found.'));
        process.exit(1);
      }

      const result = await p.select({
        message: 'Select user to reset password:',
        options: users.map((u) => ({
          value: u.email,
          label: `${u.email} (${u.role})`,
        })),
      });

      if (p.isCancel(result)) {
        p.cancel('Operation cancelled.');
        process.exit(0);
      }

      const user = db.findUserByEmail(result as string);
      if (!user) {
        console.error(colors.red('User not found.'));
        process.exit(1);
      }
      targetUser = user;
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
    db.updatePassword(targetUser.id, newPassword);

    console.log(colors.green(`Password for '${targetUser.email}' has been reset.`));
  } finally {
    db.close();
  }
}

/**
 * Create console user command
 */
export function consoleUserCommand(): Command {
  const cmd = new Command('user')
    .description('Manage console users')
    .addHelpText(
      'after',
      `
Examples:
  $ mcctl console user list                        List all users
  $ mcctl console user list --json                 List users in JSON format
  $ mcctl console user add                         Add user (interactive)
  $ mcctl console user add user@example.com --role admin --password "secret"
  $ mcctl console user remove                      Remove user (interactive)
  $ mcctl console user remove user@example.com     Remove user directly
  $ mcctl console user remove user@example.com --force    Remove without confirmation
  $ mcctl console user update                      Update user (interactive)
  $ mcctl console user update user@example.com --role admin
  $ mcctl console user reset-password              Reset password (interactive)
  $ mcctl console user reset-password user@example.com
`
    );

  // list subcommand
  cmd
    .command('list')
    .description('List all users')
    .option('--json', 'Output in JSON format')
    .action(async (options: ConsoleUserCommandOptions) => {
      try {
        await listUsers(options);
      } catch (error) {
        console.error(colors.red(`Error: ${(error as Error).message}`));
        process.exit(1);
      }
    });

  // add subcommand
  cmd
    .command('add [email]')
    .description('Add a new user')
    .option('--role <role>', 'User role (admin, user)')
    .option('--password <password>', 'User password')
    .action(async (email: string | undefined, options: ConsoleUserCommandOptions) => {
      try {
        await addUser(email, options);
      } catch (error) {
        console.error(colors.red(`Error: ${(error as Error).message}`));
        process.exit(1);
      }
    });

  // remove subcommand
  cmd
    .command('remove [email]')
    .description('Remove a user')
    .option('--force', 'Skip confirmation')
    .action(async (email: string | undefined, options: ConsoleUserCommandOptions) => {
      try {
        await removeUser(email, options);
      } catch (error) {
        console.error(colors.red(`Error: ${(error as Error).message}`));
        process.exit(1);
      }
    });

  // update subcommand
  cmd
    .command('update [email]')
    .description('Update a user')
    .option('--role <role>', 'New role (admin, user)')
    .action(async (email: string | undefined, options: ConsoleUserCommandOptions) => {
      try {
        await updateUser(email, options);
      } catch (error) {
        console.error(colors.red(`Error: ${(error as Error).message}`));
        process.exit(1);
      }
    });

  // reset-password subcommand
  cmd
    .command('reset-password [email]')
    .description('Reset a user password')
    .option('--password <password>', 'New password (for non-interactive use)')
    .action(async (email: string | undefined, options: ConsoleUserCommandOptions) => {
      try {
        await resetPassword(email, options);
      } catch (error) {
        console.error(colors.red(`Error: ${(error as Error).message}`));
        process.exit(1);
      }
    });

  return cmd;
}

// Backward compatibility alias
export const adminUserCommand = consoleUserCommand;
