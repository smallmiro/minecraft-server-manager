import type { RestartScope, SettingType } from '../../schemas/platform-settings.js';

export type Validator = (value: string) => string | null;

export interface RegistryEntry {
  label: string;
  description: string;
  group: string;
  type: SettingType;
  status: 'supported' | 'readonly' | 'shadowed' | 'legacy';
  secret?: boolean;
  /** Cannot be removed from .env (removal would fall back to a stale value). */
  required?: boolean;
  choices?: string[];
  restartScope: RestartScope;
  /** Present for supported keys. Legacy keys accept any (bash-safe) value. */
  validate?: Validator;
}

const octet = (s: string) => /^\d{1,3}$/.test(s) && Number(s) <= 255;
const isIpv4 = (v: string) => {
  const p = v.split('.');
  return p.length === 4 && p.every(octet);
};
const intRange = (min: number, max: number, what: string): Validator => (v) =>
  /^\d+$/.test(v) && Number(v) >= min && Number(v) <= max ? null : `Must be an integer ${min}-${max} (${what})`;
const nonEmpty: Validator = (v) => (v.length > 0 ? null : 'Must not be empty');
const oneOf = (choices: string[]): Validator => (v) => (choices.includes(v) ? null : `Must be one of: ${choices.join(', ')}`);

const validTz: Validator = (v) => {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: v });
    return /^[A-Za-z0-9_+\-/]+$/.test(v) ? null : 'Invalid time zone';
  } catch {
    return 'Invalid IANA time zone';
  }
};

const LOG_LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'];

const httpUrl: Validator = (v) => {
  try {
    return ['http:', 'https:'].includes(new URL(v).protocol) ? null : 'Must be an http(s) URL';
  } catch {
    return 'Must be an http(s) URL';
  }
};

export const REGISTRY: Record<string, RegistryEntry> = {
  HOST_IP: { label: 'Host IP', description: 'Host IPv4 used for nip.io hostnames of newly created servers.', group: 'Network & Routing', type: 'ipv4', status: 'supported', restartScope: 'next-create', validate: (v) => (isIpv4(v) ? null : 'Must be an IPv4 address') },
  HOST_IPS: { label: 'Host IPs', description: 'Comma-separated host IPv4 list for multi-NIC hostnames of newly created servers.', group: 'Network & Routing', type: 'ipv4-list', status: 'supported', restartScope: 'next-create', validate: (v) => (v.length > 0 && v.split(',').every(isIpv4) ? null : 'Must be comma-separated IPv4 addresses (no spaces)') },
  DOCKER_GID: { label: 'Docker GID', description: 'Group ID of the docker socket, used by mc-router.', group: 'Network & Routing', type: 'integer', status: 'supported', restartScope: 'router', validate: intRange(0, 65535, 'gid') },
  MINECRAFT_NETWORK: { label: 'Docker network', description: 'Changing it requires recreating the network: mcctl down, edit .env, mcctl up.', group: 'Network & Routing', type: 'string', status: 'readonly', restartScope: 'none' },
  MINECRAFT_SUBNET: { label: 'Docker subnet', description: 'Changing it requires recreating the network: mcctl down, edit .env, mcctl up.', group: 'Network & Routing', type: 'string', status: 'readonly', restartScope: 'none' },
  COMPOSE_PROJECT_NAME: { label: 'Compose project name', description: 'Changing it orphans existing containers and networks. Use the CLI.', group: 'Network & Routing', type: 'string', status: 'readonly', restartScope: 'none' },
  TZ: { label: 'Time zone', description: 'IANA time zone for all Minecraft server containers (a server config.env overrides it).', group: 'Server Runtime', type: 'tz', status: 'supported', restartScope: 'servers', validate: validTz },
  EXTRA_ARGS: { label: 'Extra args', description: 'Extra arguments passed to all Minecraft servers (a server config.env overrides it).', group: 'Server Runtime', type: 'string', status: 'supported', restartScope: 'servers', validate: () => null },
  RCON_PASSWORD: { label: 'RCON password', description: 'RCON password for all Minecraft server containers.', group: 'RCON', type: 'secret', status: 'supported', secret: true, restartScope: 'servers', validate: nonEmpty },
  RCON_PORT: { label: 'RCON port', description: 'RCON port for all Minecraft server containers.', group: 'RCON', type: 'port', status: 'supported', restartScope: 'servers', validate: intRange(1, 65535, 'port') },
  BACKUP_GITHUB_TOKEN: { label: 'GitHub token', description: 'Token used to push world backups.', group: 'Backup', type: 'secret', status: 'supported', secret: true, restartScope: 'api', validate: nonEmpty },
  BACKUP_GITHUB_REPO: { label: 'GitHub repository', description: 'Backup repository (owner/repo).', group: 'Backup', type: 'repo', status: 'supported', restartScope: 'api', validate: (v) => (/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(v) ? null : 'Must be owner/repo') },
  BACKUP_GITHUB_BRANCH: { label: 'GitHub branch', description: 'Backup branch.', group: 'Backup', type: 'string', status: 'supported', restartScope: 'api', validate: (v) => (/^[A-Za-z0-9._/-]+$/.test(v) && !v.includes('..') && !/^[-/]|[/.]$/.test(v) ? null : 'Invalid git branch name') },
  BACKUP_AUTO_ON_STOP: { label: 'Backup on stop', description: 'Run a backup automatically on mcctl stop.', group: 'Backup', type: 'boolean', status: 'supported', choices: ['true', 'false'], restartScope: 'none', validate: oneOf(['true', 'false']) },
  PLAYIT_SECRET_KEY: { label: 'playit.gg secret key', description: 'Secret key of the playit.gg agent.', group: 'External Access', type: 'secret', status: 'supported', secret: true, restartScope: 'playit', validate: nonEmpty },
  LOG_LEVEL: { label: 'API log level', description: 'Log level of mcctl-api.', group: 'Console & Logging', type: 'enum', status: 'supported', choices: LOG_LEVELS, restartScope: 'api', validate: oneOf(LOG_LEVELS) },
  // Read by mcctl-console from this .env once ecosystem.config.cjs no longer defines it (#686, #699).
  BETTER_AUTH_SECRET: { label: 'Console session secret', description: 'Signs console login sessions. Changing it signs everyone out.', group: 'Console & Logging', type: 'secret', status: 'supported', secret: true, required: true, restartScope: 'console', validate: nonEmpty },
  BETTER_AUTH_BASE_URL: { label: 'Console base URL', description: 'Public URL of the console for auth callbacks. Unset: http://localhost:<console port>.', group: 'Console & Logging', type: 'string', status: 'supported', restartScope: 'console', validate: httpUrl },
};

const LEGACY: Array<[string, boolean]> = [
  ['API_ACCESS_MODE', false], ['BETTER_AUTH_TRUSTED_ORIGINS', false], ['BETTER_AUTH_URL', false],
  ['MCCTL_API_IMAGE', false], ['MCCTL_CONSOLE_IMAGE', false], ['MCCTL_CONSOLE_PORT', false],
  ['MCCTL_CORS_ORIGIN', false], ['MCCTL_JWT_EXPIRY', false], ['MCCTL_JWT_SECRET', true],
  ['NEXTAUTH_SECRET', true], ['NEXTAUTH_URL', false], ['DEFAULT_MEMORY', false], ['DEFAULT_VERSION', false],
];
for (const [key, secret] of LEGACY) {
  REGISTRY[key] = { label: key, description: 'Not read by any current code.', group: 'Legacy / Unused', type: secret ? 'secret' : 'string', status: 'legacy', secret, restartScope: 'none' };
}

export const SECRET_NAME_RE = /(SECRET|TOKEN|PASSWORD|PASSWD|CREDENTIAL|PRIVATE|(^|_)KEY$)/i;

/** Keys read by mcctl-api from process.env: the file value is only applied after an API restart. */
export const isApiScoped = (key: string) => REGISTRY[key]?.restartScope === 'api';
