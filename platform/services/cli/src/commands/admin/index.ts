import { Command } from 'commander';
import { adminUserCommand } from './user.js';

/**
 * Create admin command group
 */
export function adminCommand(): Command {
  const cmd = new Command('admin')
    .description('Admin console management commands')
    .addHelpText(
      'after',
      `
Commands:
  user     Manage admin console users

Examples:
  $ mcctl admin user list              List all users
  $ mcctl admin user add               Add a new user (interactive)
  $ mcctl admin user remove operator1  Remove a user
`
    );

  // Add subcommands
  cmd.addCommand(adminUserCommand());

  return cmd;
}

export { adminUserCommand };
