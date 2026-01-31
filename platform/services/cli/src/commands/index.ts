export { initCommand } from './init.js';
export { statusCommand } from './status.js';
export { createCommand, type CreateCommandOptions } from './create.js';
export { deleteCommand, type DeleteCommandOptions } from './delete.js';
export { worldCommand, type WorldCommandOptions } from './world.js';
export { backupCommand, type BackupCommandOptions } from './backup.js';
export { execCommand, type ExecCommandOptions } from './exec.js';
export { rconCommand, type RconCommandOptions } from './rcon.js';
export { configCommand, type ConfigCommandOptions } from './config.js';
export { opCommand, type OpCommandOptions } from './op.js';
export { serverBackupCommand, type ServerBackupOptions } from './server-backup.js';
export { serverRestoreCommand, type ServerRestoreOptions } from './server-restore.js';
export { whitelistCommand, type WhitelistCommandOptions } from './whitelist.js';
export { banCommand, type BanCommandOptions } from './ban.js';
export { kickCommand, type KickCommandOptions } from './kick.js';
export { playerOnlineCommand, type PlayerOnlineCommandOptions } from './player-online.js';
export { playerCommand, type PlayerCommandOptions } from './player.js';
export { migrateCommand, type MigrateCommandOptions } from './migrate.js';
export { modCommand, type ModCommandOptions } from './mod.js';
export { updateCommand, type UpdateCommandOptions } from './update.js';

// Console commands (new names)
export {
  consoleInitCommand,
  consoleServiceCommand,
  consoleUserCommand,
  consoleApiCommand,
  consoleRemoveCommand,
  deleteAdminImages,
  type ConsoleInitOptions,
  type ConsoleServiceOptions,
  type ConsoleUserCommandOptions,
  type ConsoleApiCommandOptions,
  type ConsoleRemoveOptions,
} from './console/index.js';

// Backward compatibility aliases (deprecated - use console* instead)
export {
  adminInitCommand,
  adminServiceCommand,
  adminUserCommand,
  adminApiCommand,
  type AdminInitOptions,
  type AdminServiceOptions,
  type AdminUserCommandOptions,
  type AdminApiCommandOptions,
} from './console/index.js';
