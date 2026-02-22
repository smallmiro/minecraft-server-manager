/**
 * AuditAction Value Object
 * Represents actions that are audited in the system
 */
export enum AuditActionEnum {
  // Server lifecycle
  SERVER_CREATE = 'server.create',
  SERVER_DELETE = 'server.delete',
  SERVER_START = 'server.start',
  SERVER_STOP = 'server.stop',
  SERVER_RESTART = 'server.restart',

  // Server configuration
  SERVER_CONFIG_UPDATE = 'server.config',
  SERVER_HOSTNAME_UPDATE = 'server.hostname',

  // Player management
  PLAYER_WHITELIST_ADD = 'player.whitelist.add',
  PLAYER_WHITELIST_REMOVE = 'player.whitelist.remove',
  PLAYER_WHITELIST_TOGGLE = 'player.whitelist.toggle',
  PLAYER_BAN = 'player.ban',
  PLAYER_UNBAN = 'player.unban',
  PLAYER_OP = 'player.op',
  PLAYER_OP_LEVEL_UPDATE = 'player.op.level',
  PLAYER_DEOP = 'player.deop',
  PLAYER_KICK = 'player.kick',

  // World management
  WORLD_CREATE = 'world.create',
  WORLD_DELETE = 'world.delete',
  WORLD_ASSIGN = 'world.assign',
  WORLD_RELEASE = 'world.release',

  // System
  AUDIT_PURGE = 'audit.purge',

  // Mod management
  MOD_ADD = 'mod.add',
  MOD_REMOVE = 'mod.remove',

  // Playit.gg agent
  PLAYIT_START = 'playit.start',
  PLAYIT_STOP = 'playit.stop',

  // File management
  FILE_READ = 'file.read',
  FILE_WRITE = 'file.write',
  FILE_DELETE = 'file.delete',
  FILE_MKDIR = 'file.mkdir',
  FILE_RENAME = 'file.rename',
  FILE_UPLOAD = 'file.upload',
  FILE_DOWNLOAD = 'file.download',

  // Backup schedule management
  BACKUP_SCHEDULE_CREATE = 'backup.schedule.create',
  BACKUP_SCHEDULE_UPDATE = 'backup.schedule.update',
  BACKUP_SCHEDULE_DELETE = 'backup.schedule.delete',
  BACKUP_SCHEDULE_ENABLE = 'backup.schedule.enable',
  BACKUP_SCHEDULE_DISABLE = 'backup.schedule.disable',
  BACKUP_SCHEDULE_RUN = 'backup.schedule.run',

  // Config snapshot management
  CONFIG_SNAPSHOT_CREATE = 'config.snapshot.create',
  CONFIG_SNAPSHOT_DELETE = 'config.snapshot.delete',
  CONFIG_SNAPSHOT_RESTORE = 'config.snapshot.restore',
}
