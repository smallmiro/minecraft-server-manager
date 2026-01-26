/**
 * PM2 Ecosystem Configuration Types
 * Based on PM2 ecosystem.config.js specification
 * @see https://pm2.keymetrics.io/docs/usage/application-declaration/
 */

/**
 * PM2 execution mode
 */
export type Pm2ExecMode = 'fork' | 'cluster';

/**
 * PM2 interpreter type
 */
export type Pm2Interpreter = 'node' | 'bash' | 'python' | 'python3' | 'ruby' | 'perl' | string;

/**
 * PM2 log configuration
 */
export interface IPm2LogConfig {
  /** Output log file path */
  output?: string;
  /** Error log file path */
  error?: string;
  /** Combined log file path */
  log?: string;
  /** Log date format */
  logDateFormat?: string;
  /** Merge logs from different instances */
  mergeLogs?: boolean;
}

/**
 * PM2 restart strategy
 */
export interface IPm2RestartConfig {
  /** Delay between restart (ms) */
  restartDelay?: number;
  /** Maximum restarts within exponential backoff window */
  maxRestarts?: number;
  /** Minimum uptime to be considered started (ms) */
  minUptime?: number;
  /** Maximum memory before restart */
  maxMemoryRestart?: string;
  /** Enable exponential backoff restart */
  expBackoffRestartDelay?: number;
}

/**
 * PM2 watch configuration
 */
export interface IPm2WatchConfig {
  /** Enable watching */
  watch?: boolean | string[];
  /** Paths to ignore for watching */
  ignoreWatch?: string[];
  /** Watch options passed to chokidar */
  watchOptions?: {
    usePolling?: boolean;
    interval?: number;
  };
}

/**
 * PM2 application configuration
 * Defines a single application/service in PM2
 */
export interface IPm2AppConfig {
  /** Application name (required) */
  name: string;

  /** Script path to run (required) */
  script: string;

  /** Working directory */
  cwd?: string;

  /** Script arguments */
  args?: string | string[];

  /** Interpreter to use */
  interpreter?: Pm2Interpreter;

  /** Interpreter arguments */
  interpreterArgs?: string | string[];

  /** Node.js arguments (alias for interpreterArgs when using node) */
  nodeArgs?: string | string[];

  /** Number of instances (cluster mode) */
  instances?: number | 'max';

  /** Execution mode: 'fork' or 'cluster' */
  execMode?: Pm2ExecMode;

  /** Environment variables */
  env?: Record<string, string>;

  /** Production environment variables */
  envProduction?: Record<string, string>;

  /** Development environment variables */
  envDevelopment?: Record<string, string>;

  /** Log configuration */
  logConfig?: IPm2LogConfig;

  /** Output log file path (shorthand) */
  output?: string;

  /** Error log file path (shorthand) */
  error?: string;

  /** Combined log file path (shorthand) */
  log?: string;

  /** Log date format */
  logDateFormat?: string;

  /** Merge logs from different instances */
  mergeLogs?: boolean;

  /** Restart configuration */
  restartConfig?: IPm2RestartConfig;

  /** Delay between restart (ms, shorthand) */
  restartDelay?: number;

  /** Maximum restarts within exponential backoff window (shorthand) */
  maxRestarts?: number;

  /** Minimum uptime to be considered started (ms, shorthand) */
  minUptime?: number;

  /** Maximum memory before restart (shorthand) */
  maxMemoryRestart?: string;

  /** Enable exponential backoff restart (shorthand) */
  expBackoffRestartDelay?: number;

  /** Watch configuration */
  watchConfig?: IPm2WatchConfig;

  /** Enable watching (shorthand) */
  watch?: boolean | string[];

  /** Paths to ignore for watching (shorthand) */
  ignoreWatch?: string[];

  /** Auto restart on crash */
  autorestart?: boolean;

  /** Cron pattern for scheduled restart */
  cron?: string;

  /** Enable listening on a port */
  listenTimeout?: number;

  /** Kill timeout (ms) */
  killTimeout?: number;

  /** Wait ready signal (process.send('ready')) */
  waitReady?: boolean;

  /** Source map support */
  sourceMapSupport?: boolean;

  /** Instance variable name for environment */
  instanceVar?: string;

  /** Filter environment variables */
  filterEnv?: string[];

  /** Additional raw PM2 options */
  [key: string]: unknown;
}

/**
 * PM2 Ecosystem Configuration
 * Defines the complete ecosystem.config.js structure
 */
export interface IPm2EcosystemConfig {
  /** List of applications */
  apps: IPm2AppConfig[];

  /** Deploy configuration (optional) */
  deploy?: Record<string, IPm2DeployConfig>;
}

/**
 * PM2 Deploy Configuration
 * For deployment targets
 */
export interface IPm2DeployConfig {
  /** User to use for SSH */
  user: string;

  /** Host(s) to deploy to */
  host: string | string[];

  /** SSH port */
  port?: number;

  /** Git repository URL */
  repo: string;

  /** Git reference to deploy */
  ref: string;

  /** Path on remote server */
  path: string;

  /** SSH key path */
  key?: string;

  /** Pre-setup commands */
  preSetup?: string;

  /** Post-setup commands */
  postSetup?: string;

  /** Pre-deploy commands (local) */
  preDeploy?: string;

  /** Post-deploy commands (remote) */
  postDeploy?: string;

  /** Environment variables */
  env?: Record<string, string>;
}

/**
 * Create a minimal PM2 app configuration
 */
export function createPm2AppConfig(
  name: string,
  script: string,
  options?: Partial<Omit<IPm2AppConfig, 'name' | 'script'>>
): IPm2AppConfig {
  return {
    name,
    script,
    ...options,
  };
}

/**
 * Create a PM2 ecosystem configuration
 */
export function createPm2EcosystemConfig(
  apps: IPm2AppConfig[],
  deploy?: Record<string, IPm2DeployConfig>
): IPm2EcosystemConfig {
  return {
    apps,
    ...(deploy && { deploy }),
  };
}

/**
 * Default PM2 app configuration values
 */
export const PM2_APP_DEFAULTS: Partial<IPm2AppConfig> = {
  interpreter: 'node',
  execMode: 'fork',
  instances: 1,
  autorestart: true,
  maxRestarts: 10,
  minUptime: 1000,
  killTimeout: 3000,
  listenTimeout: 3000,
  mergeLogs: true,
} as const;

/**
 * Merge app config with defaults
 */
export function withPm2Defaults(config: IPm2AppConfig): IPm2AppConfig {
  return {
    ...PM2_APP_DEFAULTS,
    ...config,
  };
}
