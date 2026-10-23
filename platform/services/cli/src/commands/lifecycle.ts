import { existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  Paths,
  ServerName,
  log,
  autoBackupOnStop,
  type ContainerStatus,
  type IContainerRuntimePort,
  type IWorldBackupPort,
} from '@minecraft-docker/shared';
import { getContainer } from '../infrastructure/index.js';

export interface LifecycleCommandOptions {
  root?: string;
  serverName?: string;
  runtime?: IContainerRuntimePort;
  /** Used by stop for BACKUP_AUTO_ON_STOP. */
  backup?: IWorldBackupPort;
}

/** Exit code when the server is already in the requested state (as mcctl.sh did). */
const ALREADY = 2;

/** The server, or an exit code after reporting why there is none. */
function resolveServer(options: LifecycleCommandOptions, command: 'start' | 'stop'): ServerName | number {
  if (!options.serverName) {
    log.error(`Usage: mcctl ${command} <server>  (or --all)`);
    return 1;
  }
  let server: ServerName;
  try {
    server = ServerName.fromExisting(options.serverName);
  } catch (e) {
    log.error(e instanceof Error ? e.message : String(e));
    return 1;
  }
  const paths = new Paths(options.root);
  if (!existsSync(join(paths.servers, server.value, 'docker-compose.yml'))) {
    log.error(`Server '${server.value}' not found (no config at servers/${server.value}/)`);
    return 1;
  }
  return server;
}

/**
 * The server's status, or null after reporting that the runtime cannot be
 * queried: getStatus answers 'not_found' then too (D1), so confirm it with a
 * strict list (mcctl.sh ran check_docker first).
 */
function statusOf(runtime: IContainerRuntimePort, server: ServerName): ContainerStatus | null {
  const status = runtime.getStatus(server);
  if (status !== 'not_found') return status;
  try {
    runtime.list({ strict: true });
    return status;
  } catch (e) {
    log.error(`Cannot query the container runtime: ${e instanceof Error ? e.message : String(e)}`);
    return null;
  }
}

/** mcctl start <server>: create the container if needed and run it (#734; was mcctl.sh). */
export async function startCommand(options: LifecycleCommandOptions): Promise<number> {
  const server = resolveServer(options, 'start');
  if (typeof server === 'number') return server;
  const runtime = options.runtime ?? getContainer(options.root).containerRuntime;

  const status = statusOf(runtime, server);
  if (status === null) return 1;
  if (status === 'running') {
    log.warn(`Server '${server.value}' is already running`);
    return ALREADY;
  }

  log.info(`Starting server '${server.value}'...`);
  const result = await runtime.start(server);
  if (!result.success) {
    log.error(`Failed to start '${server.value}': ${result.error || result.stderr || 'unknown error'}`);
    return 1;
  }
  log.info(`Server '${server.value}' started`);
  return 0;
}

/**
 * mcctl stop <server>, then the auto-backup when BACKUP_AUTO_ON_STOP=true
 * (#734; was mcctl.sh). A failed backup is reported but keeps exit 0.
 */
export async function stopCommand(options: LifecycleCommandOptions): Promise<number> {
  const server = resolveServer(options, 'stop');
  if (typeof server === 'number') return server;
  const runtime = options.runtime ?? getContainer(options.root).containerRuntime;

  const status = statusOf(runtime, server);
  if (status === null) return 1;
  if (status !== 'running') {
    log.warn(
      status === 'not_found'
        ? `Server '${server.value}' is not running (container not created)`
        : `Server '${server.value}' is not running (status: ${status})`
    );
    return ALREADY;
  }

  log.info(`Stopping server '${server.value}'...`);
  const result = await runtime.stop(server);
  if (!result.success) {
    log.error(`Failed to stop '${server.value}': ${result.error || result.stderr || 'unknown error'}`);
    return 1;
  }
  log.info(`Server '${server.value}' stopped`);

  const backup = options.backup ?? getContainer(options.root).worldBackupPort;
  const auto = await autoBackupOnStop(backup, server.value);
  if (auto.status === 'done') {
    log.info(
      auto.outcome.commit ? `Auto-backup complete: ${auto.outcome.commit.substring(0, 7)}` : 'Auto-backup: no changes'
    );
  } else if (auto.status === 'failed') {
    log.warn(`Auto-backup failed (non-critical): ${auto.error.message}`);
  }
  return 0;
}
