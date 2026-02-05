/**
 * AuditAction Value Object
 * Represents actions that are audited in the system
 */
export enum AuditActionEnum {
  SERVER_CREATE = 'server.create',
  SERVER_DELETE = 'server.delete',
  SERVER_START = 'server.start',
  SERVER_STOP = 'server.stop',
  SERVER_RESTART = 'server.restart',
  PLAYER_WHITELIST_ADD = 'player.whitelist.add',
  PLAYER_WHITELIST_REMOVE = 'player.whitelist.remove',
  PLAYER_BAN = 'player.ban',
  PLAYER_UNBAN = 'player.unban',
  PLAYER_OP = 'player.op',
  PLAYER_DEOP = 'player.deop',
  PLAYER_KICK = 'player.kick',
  AUDIT_PURGE = 'audit.purge',
}
