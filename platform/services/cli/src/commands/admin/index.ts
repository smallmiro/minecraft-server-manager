import { Command } from 'commander';
import { adminUserCommand } from './user.js';
import { adminApiCommand } from './api.js';

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
  api      Manage API configuration

Examples:
  $ mcctl admin user list              List all users
  $ mcctl admin user add               Add a new user (interactive)
  $ mcctl admin user remove operator1  Remove a user
  $ mcctl admin api status             Show API configuration
  $ mcctl admin api mode api-key       Change access mode
  $ mcctl admin api whitelist add 192.168.1.0/24
`
    );

  // Add subcommands
  cmd.addCommand(adminUserCommand());
  cmd.addCommand(adminApiCommand());

  return cmd;
}

export { adminUserCommand };
export { adminApiCommand };
